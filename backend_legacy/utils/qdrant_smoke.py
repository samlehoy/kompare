"""Smoke-test Qdrant retrieval for the local Qwen AI profile."""

from __future__ import annotations

import argparse
import json
from typing import Any

from backend.ai_providers import (
    AIProviderError,
    AIProviderProfile,
    get_ai_profile,
    lmstudio_client_from_profile,
)
from backend.utils.qdrant_store import QdrantVectorStore


QUERY_PREFIX = (
    "Instruct: Retrieve relevant PC component catalog entries for an Indonesian "
    "custom PC build, matching category, budget, specs, compatibility, and value.\n"
    "Query: "
)


def _validate_profile(profile: AIProviderProfile) -> None:
    if profile.name != "local_qwen":
        raise AIProviderError("Qdrant smoke currently requires the local_qwen profile.")
    if profile.embedding_provider != "lmstudio":
        raise AIProviderError("Qdrant smoke requires an LM Studio embedding profile.")
    if profile.vector_backend != "qdrant":
        raise AIProviderError("Qdrant smoke requires a qdrant vector backend profile.")


def _prefixed_query(query: str) -> str:
    clean = query.strip()
    if not clean:
        raise AIProviderError("Qdrant smoke query cannot be empty.")
    return f"{QUERY_PREFIX}{clean}"


def smoke_qdrant_profile(
    *,
    profile: AIProviderProfile,
    query: str,
    category: str | None = None,
    top_k: int = 5,
    embedder: Any = None,
    store: Any = None,
) -> dict:
    _validate_profile(profile)
    if top_k <= 0:
        raise AIProviderError("top_k must be greater than zero.")

    selected_embedder = embedder or lmstudio_client_from_profile(profile)
    selected_store = store or QdrantVectorStore.from_profile(profile)
    query_text = _prefixed_query(query)
    vectors = selected_embedder.embed_texts([query_text])
    if not vectors:
        raise AIProviderError("LM Studio did not return a query vector.")

    matches = selected_store.query(vectors[0], top_k=top_k, category=category or None)
    return {
        "profile": profile.name,
        "collection": profile.vector_collection,
        "query": query.strip(),
        "category": category or None,
        "top_k": top_k,
        "match_count": len(matches),
        "matches": matches,
    }


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Smoke-test local Qwen embeddings against the Qdrant component collection."
    )
    parser.add_argument("--profile", default="local_qwen", help="AI provider profile name.")
    parser.add_argument("--query", required=True, help="Natural language component query.")
    parser.add_argument("--category", default=None, help="Optional component category filter, e.g. gpu.")
    parser.add_argument("--top-k", type=int, default=5)
    args = parser.parse_args(argv)

    profile = get_ai_profile(args.profile)
    result = smoke_qdrant_profile(
        profile=profile,
        query=args.query,
        category=args.category,
        top_k=args.top_k,
    )
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
