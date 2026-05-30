"""Thin Gemini wrapper for runtime endpoints.

Lazy-loads `google.genai` so the rest of the app works without the SDK
installed (or without a key) for non-AI endpoints. Centralizes JSON-mode
generation + parsing so callers don't repeat the same boilerplate.
"""

from __future__ import annotations

import json
import os
import re
from threading import Lock
from typing import Any, Callable, Optional

# gemini-2.5-flash-lite has a much higher free-tier RPD than -flash, so default
# runtime endpoints to it. Override with GEMINI_MODEL env var if you have paid quota.
DEFAULT_MODEL = "gemini-2.5-flash-lite"
DEFAULT_EMBEDDING_MODEL = "gemini-embedding-001"
EMBEDDING_BATCH_SIZE = 100

_client = None
_clients: dict[tuple[str, str], Any] = {}
_client_settings: Optional[tuple[tuple[str, ...], str]] = None
_quota_exhausted_keys: set[str] = set()
_key_cursor = 0
_client_lock = Lock()


class GeminiError(RuntimeError):
    """Raised when Gemini is unavailable or returned an unparseable response."""

    def __init__(self, message: str, retry_after_seconds: Optional[int] = None,
                 quota_exceeded: bool = False):
        super().__init__(message)
        self.retry_after_seconds = retry_after_seconds
        self.quota_exceeded = quota_exceeded


def _load_dotenv_once() -> None:
    """Load .env if python-dotenv is installed. Safe to call repeatedly."""
    try:
        from dotenv import load_dotenv  # type: ignore
        load_dotenv()
    except ImportError:
        pass


def _configured_api_keys() -> tuple[str, ...]:
    _load_dotenv_once()
    names = ["GEMINI_API_KEY", *(f"GEMINI_API_KEY_{i}" for i in range(1, 5))]
    keys: list[str] = []
    seen: set[str] = set()
    for name in names:
        value = (os.getenv(name) or "").strip()
        if value and value not in seen:
            keys.append(value)
            seen.add(value)
    if not keys:
        raise GeminiError(
            "No Gemini API keys set. Add GEMINI_API_KEY or GEMINI_API_KEY_1..4 to .env."
        )
    return tuple(keys)


def _get_settings() -> tuple[tuple[str, ...], str]:
    keys = _configured_api_keys()
    model = os.getenv("GEMINI_MODEL", DEFAULT_MODEL)
    return keys, model


def _is_quota_error(message: str) -> bool:
    lower = message.lower()
    return (
        "429" in message
        or "503" in message
        or "quota" in lower
        or "rate limit" in lower
        or "resource_exhausted" in lower
    )


def _retry_after_seconds(message: str) -> Optional[int]:
    m = re.search(r"retry_delay\s*\{[^}]*seconds:\s*(\d+)", message)
    return int(m.group(1)) if m else None


def _sync_key_state(settings: tuple[tuple[str, ...], str]) -> None:
    global _client_settings, _key_cursor
    if _client_settings == settings:
        return
    _client_settings = settings
    _quota_exhausted_keys.clear()
    _key_cursor = 0


def _candidate_keys(settings: tuple[tuple[str, ...], str]) -> tuple[str, ...]:
    global _key_cursor
    keys, _model = settings
    with _client_lock:
        _sync_key_state(settings)
        if len(_quota_exhausted_keys) >= len(keys):
            _quota_exhausted_keys.clear()
            _key_cursor = 0
        ordered = keys[_key_cursor:] + keys[:_key_cursor]
        return tuple(key for key in ordered if key not in _quota_exhausted_keys)


def _mark_key_quota_exhausted(api_key: str, settings: tuple[tuple[str, ...], str]) -> None:
    global _key_cursor
    keys, _model = settings
    with _client_lock:
        _sync_key_state(settings)
        _quota_exhausted_keys.add(api_key)
        if api_key in keys:
            _key_cursor = (keys.index(api_key) + 1) % len(keys)


def _get_client(api_key: Optional[str] = None, model: Optional[str] = None):
    global _client
    settings = _get_settings()
    keys, default_model = settings
    api_key = api_key or _candidate_keys(settings)[0]
    model = model or default_model
    cache_key = (api_key, model)
    with _client_lock:
        _sync_key_state(settings)
        cached = _clients.get(cache_key)
        if cached is not None:
            _client = cached
            return cached
        try:
            from google import genai
        except ImportError as exc:
            raise GeminiError(
                "google-genai not installed. Run: pip install google-genai"
            ) from exc
        client = genai.Client(api_key=api_key)
        _clients[cache_key] = client
        _client = client
        return client


def _get_model() -> str:
    return _get_settings()[1]


def _get_embedding_model() -> str:
    _load_dotenv_once()
    return (os.getenv("GEMINI_EMBEDDING_MODEL") or DEFAULT_EMBEDDING_MODEL).strip() or DEFAULT_EMBEDDING_MODEL


def _run_with_key_rotation(
    operation: Callable[[Any, str], Any],
    *,
    quota_message: str,
    failure_prefix: str,
) -> Any:
    settings = _get_settings()
    keys, model = settings
    candidates = _candidate_keys(settings)
    last_quota_exc: Optional[Exception] = None
    retry_seconds: Optional[int] = None

    for api_key in candidates:
        client = _get_client(api_key, model)
        try:
            return operation(client, model)
        except Exception as exc:
            msg = str(exc)
            if not _is_quota_error(msg):
                raise GeminiError(f"{failure_prefix}: {msg}") from exc
            last_quota_exc = exc
            retry_seconds = _retry_after_seconds(msg) or retry_seconds
            _mark_key_quota_exhausted(api_key, settings)

    friendly = quota_message
    if len(keys) > 1:
        friendly += f" Tried {len(candidates)} configured Gemini API key(s)."
    if retry_seconds:
        friendly += f" Retry in ~{retry_seconds}s."
    raise GeminiError(
        friendly,
        retry_after_seconds=retry_seconds,
        quota_exceeded=True,
    ) from last_quota_exc


def _embedding_values(embedding: Any) -> Any:
    if isinstance(embedding, dict):
        if "values" in embedding:
            return embedding["values"]
        nested = embedding.get("embedding")
        if nested is not None:
            return _embedding_values(nested)
        return None

    values = getattr(embedding, "values", None)
    if values is not None:
        return values
    nested = getattr(embedding, "embedding", None)
    if nested is not None:
        return _embedding_values(nested)
    return None


def embed_texts(texts: list[str], *, model: Optional[str] = None) -> list[list[float]]:
    """Embed non-empty text chunks and return one float vector per clean text."""
    clean_texts = [text.strip() for text in texts if text.strip()]
    if not clean_texts:
        return []

    embedding_model = model or _get_embedding_model()
    vectors: list[list[float]] = []

    for start in range(0, len(clean_texts), EMBEDDING_BATCH_SIZE):
        batch = clean_texts[start:start + EMBEDDING_BATCH_SIZE]

        def operation(client: Any, _model: str, batch_texts=batch):
            return client.models.embed_content(
                model=embedding_model,
                contents=batch_texts,
            )

        response = _run_with_key_rotation(
            operation,
            quota_message="Gemini free-tier quota exceeded for embedding request.",
            failure_prefix="Gemini embedding call failed",
        )

        embeddings = response.get("embeddings") if isinstance(response, dict) else getattr(response, "embeddings", None)
        if embeddings is None:
            raise GeminiError("Gemini embedding response did not include embeddings.")

        batch_vectors: list[list[float]] = []
        for embedding in embeddings:
            values = _embedding_values(embedding)
            if not values:
                raise GeminiError("Gemini embedding response included a vector without values.")
            batch_vectors.append([float(value) for value in values])

        if len(batch_vectors) != len(batch):
            raise GeminiError(
                f"Gemini embedding response returned {len(batch_vectors)} vector(s) for {len(batch)} text(s)."
            )
        vectors.extend(batch_vectors)

    if len(vectors) != len(clean_texts):
        raise GeminiError(
            f"Gemini embedding response returned {len(vectors)} vector(s) for {len(clean_texts)} text(s)."
        )
    return vectors


def generate_chat_reply(
    messages: list[dict],
    *,
    system_instruction: Optional[str] = None,
    temperature: float = 0.6,
) -> str:
    """Multi-turn chat completion. Returns plain assistant text.

    `messages` is a list of {role, content} dicts where role is 'user' or
    'assistant'. We translate to Gemini's contents shape. Empty list raises GeminiError.
    """
    if not messages:
        raise GeminiError("Cannot generate chat reply from empty message list.")

    try:
        from google.genai import types
    except ImportError as exc:
        raise GeminiError("google-genai not installed.") from exc

    history = [
        types.Content(
            role="model" if m["role"] == "assistant" else "user",
            parts=[types.Part.from_text(text=m["content"])]
        ) for m in messages[:-1]
    ]

    config = types.GenerateContentConfig(
        system_instruction=system_instruction,
        temperature=temperature,
    )

    def operation(client: Any, model: str):
        chat = client.chats.create(
            model=model,
            config=config,
            history=history,
        )
        return chat.send_message(messages[-1]["content"])

    response = _run_with_key_rotation(
        operation,
        quota_message=(
            "Gemini free-tier quota exceeded. "
            "Wait for the daily reset, switch GEMINI_MODEL, or use keys from a different GCP project."
        ),
        failure_prefix="Gemini API call failed",
    )

    text = (getattr(response, "text", None) or "").strip()
    if not text:
        raise GeminiError("Gemini returned an empty chat response.")
    return text


def generate_multimodal_json(
    prompt: str,
    image_bytes: bytes,
    *,
    mime_type: str = "image/jpeg",
    temperature: float = 0.2,
) -> dict[str, Any]:
    """JSON-mode generation with one image attached. Returns parsed dict."""
    if not image_bytes:
        raise GeminiError("No image bytes provided.")
    
    try:
        from google.genai import types
    except ImportError as exc:
        raise GeminiError("google-genai not installed.") from exc

    config = types.GenerateContentConfig(
        temperature=temperature,
        response_mime_type="application/json",
    )
    
    part_text = types.Part.from_text(text=prompt)
    part_img = types.Part.from_bytes(data=image_bytes, mime_type=mime_type)

    def operation(client: Any, model: str):
        return client.models.generate_content(
            model=model,
            contents=[part_img, part_text],
            config=config,
        )

    response = _run_with_key_rotation(
        operation,
        quota_message="Gemini free-tier quota exceeded for multimodal request.",
        failure_prefix="Gemini multimodal call failed",
    )

    text = (getattr(response, "text", None) or "").strip()
    if not text:
        raise GeminiError("Gemini returned an empty multimodal response.")
    if text.startswith("```"):
        text = text.strip("`")
        if text.lower().startswith("json"):
            text = text[4:].lstrip()
    try:
        return json.loads(text)
    except json.JSONDecodeError as exc:
        raise GeminiError(
            f"Gemini multimodal response was not valid JSON: {exc}. Raw: {text[:200]}…"
        ) from exc


def generate_json(prompt: str, *, temperature: float = 0.2) -> dict[str, Any]:
    """Run prompt through Gemini in JSON mode and return parsed dict.

    Raises GeminiError if the response can't be parsed or the API call fails.
    """
    try:
        from google.genai import types
    except ImportError as exc:
        raise GeminiError("google-genai not installed.") from exc

    config = types.GenerateContentConfig(
        temperature=temperature,
        response_mime_type="application/json",
    )

    def operation(client: Any, model: str):
        return client.models.generate_content(
            model=model,
            contents=prompt,
            config=config,
        )

    response = _run_with_key_rotation(
        operation,
        quota_message=(
            "Gemini free-tier quota exceeded for the day. "
            "Either wait for the quota reset, set GEMINI_MODEL=gemini-2.5-flash-lite "
            "in .env (higher free-tier RPD), or use a different Google Cloud project."
        ),
        failure_prefix="Gemini API call failed",
    )

    text = (getattr(response, "text", None) or "").strip()
    if not text:
        raise GeminiError("Gemini returned an empty response.")

    # Strip optional markdown fences just in case the model wraps despite JSON mode.
    if text.startswith("```"):
        text = text.strip("`")
        if text.lower().startswith("json"):
            text = text[4:].lstrip()

    try:
        return json.loads(text)
    except json.JSONDecodeError as exc:
        raise GeminiError(
            f"Gemini response was not valid JSON: {exc}. Raw: {text[:200]}…"
        ) from exc
