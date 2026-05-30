"""Readiness smoke checks for the local LM Studio + Qdrant AI profile."""

from __future__ import annotations

import argparse
import json
import time
from typing import Any

from backend.ai_providers import (
    AIProviderError,
    AIProviderProfile,
    LMStudioClient,
    get_ai_profile,
)
from backend.utils.qdrant_store import QdrantVectorStore


QUERY_PREFIX = (
    "Instruct: Retrieve relevant PC component catalog entries for an Indonesian "
    "custom PC build, matching category, budget, specs, compatibility, and value.\n"
    "Query: "
)
STRICT_JSON_SMOKE_SCHEMA = {
    "type": "object",
    "properties": {"ok": {"type": "boolean"}},
    "required": ["ok"],
    "additionalProperties": False,
}


def _elapsed(start: float) -> float:
    return round(time.perf_counter() - start, 3)


def _error_payload(exc: Exception, start: float) -> dict:
    return {
        "ok": False,
        "seconds": _elapsed(start),
        "error": f"{type(exc).__name__}: {exc}",
    }


def _client_from_profile(profile: AIProviderProfile, *, timeout: int) -> LMStudioClient:
    if profile.llm_provider != "lmstudio" or profile.embedding_provider != "lmstudio":
        raise AIProviderError(f"Profile {profile.name!r} is not an LM Studio profile.")
    return LMStudioClient(
        base_url=profile.llm_base_url or profile.embedding_base_url or "http://localhost:1234/v1",
        llm_model=profile.llm_model,
        embedding_model=profile.embedding_model,
        timeout=timeout,
    )


def check_local_ai_readiness(
    *,
    profile: AIProviderProfile,
    query: str = "RTX 4060 under 6 juta",
    category: str = "gpu",
    top_k: int = 3,
    timeout: int = 120,
    check_chat: bool = True,
    client: Any = None,
    store: Any = None,
) -> dict:
    selected_client = client or _client_from_profile(profile, timeout=timeout)
    selected_store = store or QdrantVectorStore.from_profile(profile)
    prefixed_query = f"{QUERY_PREFIX}{query.strip()}"
    result = {
        "profile": profile.name,
        "llm_model": profile.llm_model,
        "embedding_model": profile.embedding_model,
        "vector_backend": profile.vector_backend,
        "vector_collection": profile.vector_collection,
        "query": query.strip(),
        "category": category,
        "embedding": {"ok": False},
        "qdrant": {"ok": False},
        "chat_json": {"ok": False},
    }

    vector: list[float] | None = None
    start = time.perf_counter()
    try:
        vectors = selected_client.embed_texts([prefixed_query])
        vector = [float(value) for value in vectors[0]] if vectors else None
        if not vector:
            raise AIProviderError("Embedding response did not include a vector.")
        result["embedding"] = {
            "ok": True,
            "seconds": _elapsed(start),
            "dimension": len(vector),
        }
    except Exception as exc:
        result["embedding"] = _error_payload(exc, start)

    if vector is None:
        result["qdrant"] = {
            "ok": False,
            "skipped": True,
            "reason": "embedding_unavailable",
        }
    else:
        start = time.perf_counter()
        try:
            matches = selected_store.query(vector, top_k=top_k, category=category)
            if not matches:
                raise AIProviderError("No Qdrant matches returned for readiness query.")
            result["qdrant"] = {
                "ok": True,
                "seconds": _elapsed(start),
                "match_count": len(matches),
                "matches": matches,
            }
        except Exception as exc:
            result["qdrant"] = {
                **_error_payload(exc, start),
                "match_count": 0,
            }

    if not check_chat:
        result["chat_json"] = {
            "ok": False,
            "skipped": True,
            "reason": "chat_check_disabled",
        }
    else:
        start = time.perf_counter()
        try:
            payload = selected_client.generate_json(
                "Return exactly this JSON object and no other text: {\"ok\": true}",
                temperature=0.0,
                schema=STRICT_JSON_SMOKE_SCHEMA,
            )
            if payload.get("ok") is not True:
                raise AIProviderError("Strict JSON smoke response did not contain ok=true.")
            result["chat_json"] = {
                "ok": True,
                "seconds": _elapsed(start),
                "payload": payload,
            }
        except Exception as exc:
            result["chat_json"] = _error_payload(exc, start)

    required_checks = ["embedding", "qdrant"]
    if check_chat:
        required_checks.append("chat_json")
    result["ready"] = all(result[name].get("ok") is True for name in required_checks)
    return result


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Smoke-check local LM Studio embeddings, Qdrant retrieval, and strict JSON chat."
    )
    parser.add_argument("--profile", default="local_qwen", help="AI provider profile to check.")
    parser.add_argument("--query", default="RTX 4060 under 6 juta")
    parser.add_argument("--category", default="gpu")
    parser.add_argument("--top-k", type=int, default=3)
    parser.add_argument("--timeout", type=int, default=120)
    parser.add_argument("--skip-chat", action="store_true")
    parser.add_argument("--fail-on-error", action="store_true")
    args = parser.parse_args(argv)

    profile = get_ai_profile(args.profile)
    result = check_local_ai_readiness(
        profile=profile,
        query=args.query,
        category=args.category,
        top_k=args.top_k,
        timeout=args.timeout,
        check_chat=not args.skip_chat,
    )
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 1 if args.fail_on_error and not result["ready"] else 0


if __name__ == "__main__":
    raise SystemExit(main())
