"""Sync Kompare component chunks into a Qdrant collection."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

from backend.ai_providers import (
    AIProviderError,
    AIProviderProfile,
    get_ai_profile,
    lmstudio_client_from_profile,
)
from backend.utils.ai_rag_chunks import build_component_chunks
from backend.utils.qdrant_store import QdrantVectorStore


DEFAULT_COMPONENTS_PATH = Path("data/components.json")


def _load_components(path: Path) -> list[dict]:
    if not path.exists():
        raise AIProviderError(f"Component catalog not found: {path}")
    with path.open("r", encoding="utf-8") as f:
        data = json.load(f)
    if not isinstance(data, list):
        raise AIProviderError("Component catalog must be a JSON list.")
    return data


def _validate_profile(profile: AIProviderProfile) -> None:
    if profile.name != "local_qwen":
        raise AIProviderError(
            "Qdrant sync currently targets the local_qwen profile only. "
            "Use --profile local_qwen."
        )
    if profile.embedding_provider != "lmstudio":
        raise AIProviderError("Qdrant sync requires an LM Studio embedding profile.")
    if profile.vector_backend != "qdrant":
        raise AIProviderError("Qdrant sync requires a qdrant vector backend profile.")


def sync_qdrant_profile(
    *,
    profile: AIProviderProfile,
    components_path: Path = DEFAULT_COMPONENTS_PATH,
    embedder: Any = None,
    store: Any = None,
    recreate: bool = False,
    dry_run: bool = False,
    batch_size: int = 128,
) -> dict:
    _validate_profile(profile)
    components = _load_components(Path(components_path))
    chunks = build_component_chunks(components)

    if dry_run:
        return {
            "profile": profile.name,
            "collection": profile.vector_collection,
            "chunk_count": len(chunks),
            "vector_count": 0,
            "upserted_count": 0,
            "dry_run": True,
        }

    selected_embedder = embedder or lmstudio_client_from_profile(profile)
    selected_store = store or QdrantVectorStore.from_profile(profile)
    selected_store.ensure_collection(recreate=recreate)

    if batch_size <= 0:
        raise AIProviderError("batch_size must be greater than zero.")

    vector_count = 0
    upserted_count = 0
    for start in range(0, len(chunks), batch_size):
        batch_chunks = chunks[start:start + batch_size]
        vectors = selected_embedder.embed_texts([chunk["text"] for chunk in batch_chunks])
        vector_count += len(vectors)
        result = selected_store.upsert_chunks(batch_chunks, vectors, batch_size=batch_size)
        upserted_count += int(result.get("upserted_count") or 0)

    return {
        "profile": profile.name,
        "collection": profile.vector_collection,
        "chunk_count": len(chunks),
        "vector_count": vector_count,
        "upserted_count": upserted_count,
        "dry_run": False,
    }


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Sync Kompare component chunks into Qdrant for a local AI profile."
    )
    parser.add_argument("--profile", default="local_qwen", help="AI provider profile name.")
    parser.add_argument("--components", type=Path, default=DEFAULT_COMPONENTS_PATH)
    parser.add_argument("--batch-size", type=int, default=128)
    parser.add_argument("--recreate", action="store_true", help="Recreate the Qdrant collection before upsert.")
    parser.add_argument("--dry-run", action="store_true", help="Validate chunk count without embedding or upserting.")
    args = parser.parse_args(argv)

    profile = get_ai_profile(args.profile)
    result = sync_qdrant_profile(
        profile=profile,
        components_path=args.components,
        recreate=args.recreate,
        dry_run=args.dry_run,
        batch_size=args.batch_size,
    )
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
