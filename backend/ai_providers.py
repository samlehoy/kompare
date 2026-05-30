"""AI provider profiles and local LM Studio client adapters."""

from __future__ import annotations

import json
import os
import urllib.error
import urllib.request
from dataclasses import dataclass
from typing import Any, Callable


DEFAULT_GEMINI_LLM_MODEL = "gemini-2.5-flash-lite"
DEFAULT_GEMINI_EMBEDDING_MODEL = "gemini-embedding-001"
DEFAULT_LMSTUDIO_BASE_URL = "http://localhost:1234/v1"
DEFAULT_LMSTUDIO_LLM_MODEL = "qwen/qwen3.6-27b"
DEFAULT_LMSTUDIO_EMBEDDING_MODEL = "text-embedding-qwen3-embedding-4b"
DEFAULT_QDRANT_URL = "http://localhost:6333"
DEFAULT_QWEN_COLLECTION = "kompare_components_qwen"
DEFAULT_LMSTUDIO_TIMEOUT_SECONDS = 90


class AIProviderError(RuntimeError):
    """Raised when an AI provider profile or adapter cannot be used safely."""


@dataclass(frozen=True)
class AIProviderProfile:
    name: str
    llm_provider: str
    embedding_provider: str
    vector_backend: str
    llm_model: str
    embedding_model: str
    embedding_dimension: int | None = None
    llm_base_url: str | None = None
    embedding_base_url: str | None = None
    vector_index_path: str | None = None
    vector_url: str | None = None
    vector_collection: str | None = None
    vector_distance: str = "cosine"
    timeout_seconds: int = 120


Transport = Callable[[str, dict, int], dict]


def _load_dotenv_once() -> None:
    try:
        from dotenv import load_dotenv  # type: ignore
        load_dotenv()
    except ImportError:
        pass


def _env(name: str, default: str = "") -> str:
    return (os.getenv(name) or default).strip()


def _env_int(name: str, default: int | None = None) -> int | None:
    value = _env(name)
    if not value:
        return default
    try:
        return int(value)
    except ValueError as exc:
        raise AIProviderError(f"{name} must be an integer, got {value!r}.") from exc


def _gemini_free_profile() -> AIProviderProfile:
    return AIProviderProfile(
        name="gemini_free",
        llm_provider="gemini",
        embedding_provider="gemini",
        vector_backend="local_json",
        llm_model=_env("GEMINI_MODEL", DEFAULT_GEMINI_LLM_MODEL),
        embedding_model=_env("GEMINI_EMBEDDING_MODEL", DEFAULT_GEMINI_EMBEDDING_MODEL),
        vector_index_path=_env("GEMINI_VECTOR_INDEX_PATH", "data/vector_index"),
    )


def _local_qwen_profile() -> AIProviderProfile:
    base_url = _env("LMSTUDIO_BASE_URL", DEFAULT_LMSTUDIO_BASE_URL).rstrip("/")
    return AIProviderProfile(
        name="local_qwen",
        llm_provider="lmstudio",
        embedding_provider="lmstudio",
        vector_backend="qdrant",
        llm_base_url=base_url,
        embedding_base_url=base_url,
        llm_model=_env("LMSTUDIO_LLM_MODEL", DEFAULT_LMSTUDIO_LLM_MODEL),
        embedding_model=_env("LMSTUDIO_EMBEDDING_MODEL", DEFAULT_LMSTUDIO_EMBEDDING_MODEL),
        embedding_dimension=_env_int("QDRANT_VECTOR_SIZE", 2560),
        vector_url=_env("QDRANT_URL", DEFAULT_QDRANT_URL),
        vector_collection=_env("QDRANT_COLLECTION_QWEN", DEFAULT_QWEN_COLLECTION),
        vector_distance=_env("QDRANT_DISTANCE", "cosine").lower(),
        timeout_seconds=_env_int("LMSTUDIO_TIMEOUT_SECONDS", DEFAULT_LMSTUDIO_TIMEOUT_SECONDS) or DEFAULT_LMSTUDIO_TIMEOUT_SECONDS,
    )


def get_ai_profile(name: str | None = None) -> AIProviderProfile:
    _load_dotenv_once()
    selected = (name or _env("KOMPARE_AI_PROFILE", "gemini_free")).strip().lower()
    if selected == "gemini_free":
        return _gemini_free_profile()
    if selected == "local_qwen":
        return _local_qwen_profile()
    raise AIProviderError(
        f"Unknown AI provider profile {selected!r}. Valid profiles: gemini_free, local_qwen."
    )


def active_ai_profile() -> AIProviderProfile:
    return get_ai_profile()


def _default_transport(base_url: str) -> Transport:
    clean_base = base_url.rstrip("/")

    def transport(endpoint: str, payload: dict, timeout: int) -> dict:
        url = f"{clean_base}{endpoint}"
        request = urllib.request.Request(
            url,
            data=json.dumps(payload).encode("utf-8"),
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        try:
            with urllib.request.urlopen(request, timeout=timeout) as response:
                text = response.read().decode("utf-8")
        except urllib.error.HTTPError as exc:
            details = exc.read().decode("utf-8", errors="replace")
            raise AIProviderError(f"LM Studio request failed with HTTP {exc.code}: {details}") from exc
        except TimeoutError as exc:
            raise AIProviderError(f"LM Studio request timed out after {timeout} seconds: {exc}") from exc
        except urllib.error.URLError as exc:
            raise AIProviderError(f"LM Studio request failed: {exc}") from exc

        try:
            return json.loads(text)
        except json.JSONDecodeError as exc:
            raise AIProviderError(f"LM Studio response was not valid JSON: {exc}") from exc

    return transport


def _strip_json_fence(text: str) -> str:
    stripped = text.strip()
    if not stripped.startswith("```"):
        return stripped
    stripped = stripped.strip("`").strip()
    if stripped.lower().startswith("json"):
        stripped = stripped[4:].lstrip()
    return stripped


class LMStudioClient:
    """OpenAI-compatible LM Studio client for local chat and embeddings."""

    def __init__(
        self,
        *,
        base_url: str,
        llm_model: str,
        embedding_model: str,
        transport: Transport | None = None,
        timeout: int = 120,
    ) -> None:
        self.base_url = base_url.rstrip("/")
        self.llm_model = llm_model
        self.embedding_model = embedding_model
        self.timeout = timeout
        self._transport = transport or _default_transport(self.base_url)

    def embed_texts(self, texts: list[str]) -> list[list[float]]:
        clean_texts = [text.strip() for text in texts if text and text.strip()]
        if not clean_texts:
            return []

        response = self._transport(
            "/embeddings",
            {
                "model": self.embedding_model,
                "input": clean_texts,
            },
            self.timeout,
        )
        data = response.get("data")
        if not isinstance(data, list):
            raise AIProviderError("LM Studio embedding response did not include a data list.")

        vectors: list[list[float]] = []
        for item in data:
            embedding = item.get("embedding") if isinstance(item, dict) else None
            if not isinstance(embedding, list):
                raise AIProviderError("LM Studio embedding response included an item without an embedding vector.")
            vectors.append([float(value) for value in embedding])

        if len(vectors) != len(clean_texts):
            raise AIProviderError(
                f"LM Studio returned {len(vectors)} embedding(s) for {len(clean_texts)} text(s)."
            )
        return vectors

    def generate_chat(
        self,
        messages: list[dict],
        *,
        temperature: float = 0.2,
        max_tokens: int = 2048,
        response_format: dict | None = None,
    ) -> str:
        if not messages:
            raise AIProviderError("Cannot generate local chat reply from empty messages.")

        payload = {
                "model": self.llm_model,
                "messages": messages,
                "temperature": temperature,
                "max_tokens": max_tokens,
        }
        if response_format:
            payload["response_format"] = response_format

        response = self._transport(
            "/chat/completions",
            payload,
            self.timeout,
        )
        choices = response.get("choices")
        if not isinstance(choices, list) or not choices:
            raise AIProviderError("LM Studio chat response did not include choices.")

        message = choices[0].get("message") if isinstance(choices[0], dict) else None
        if not isinstance(message, dict):
            raise AIProviderError("LM Studio chat response did not include a message.")

        text = message.get("content") or message.get("reasoning_content") or ""
        text = str(text).strip()
        if not text:
            raise AIProviderError("LM Studio returned an empty chat response.")
        return text

    def generate_json(
        self,
        prompt: str,
        *,
        temperature: float = 0.2,
        schema: dict | None = None,
    ) -> dict[str, Any]:
        response_format = None
        if schema:
            response_format = {
                "type": "json_schema",
                "json_schema": {
                    "name": "KompareJsonResponse",
                    "schema": schema,
                },
            }
        text = self.generate_chat(
            [
                {
                    "role": "system",
                    "content": "Return only valid JSON. Do not wrap it in markdown.",
                },
                {"role": "user", "content": prompt},
            ],
            temperature=temperature,
            response_format=response_format,
        )
        text = _strip_json_fence(text)
        try:
            payload = json.loads(text)
        except json.JSONDecodeError as exc:
            raise AIProviderError(f"LM Studio response was not valid JSON: {exc}.") from exc
        if not isinstance(payload, dict):
            raise AIProviderError("LM Studio JSON response must be an object.")
        return payload


def lmstudio_client_from_profile(
    profile: AIProviderProfile | None = None,
    *,
    transport: Transport | None = None,
) -> LMStudioClient:
    selected = profile or active_ai_profile()
    if selected.llm_provider != "lmstudio" or selected.embedding_provider != "lmstudio":
        raise AIProviderError(f"Profile {selected.name!r} is not an LM Studio profile.")
    return LMStudioClient(
        base_url=selected.llm_base_url or DEFAULT_LMSTUDIO_BASE_URL,
        llm_model=selected.llm_model,
        embedding_model=selected.embedding_model,
        transport=transport,
        timeout=selected.timeout_seconds,
    )
