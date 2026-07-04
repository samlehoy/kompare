from __future__ import annotations

import argparse
import hashlib
import json
import time
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Callable, Iterable, Sequence

import numpy as np

from backend.gemini_client import embed_texts
from backend.utils.ai_rag_chunks import catalog_hash, read_jsonl


class VectorIndexUnavailable(RuntimeError):
    """Raised when the local vector index cannot be loaded safely."""


@dataclass(frozen=True)
class VectorIndex:
    embeddings: np.ndarray
    metadata: list[dict]
    manifest: dict


@dataclass(frozen=True)
class ResumableEmbeddingResult:
    vectors: list[list[float]]
    complete: bool
    cached_count: int
    missing_count: int
    embedded_this_run: int
    cache_path: Path


def _metadata_row(chunk: dict) -> dict:
    return {
        "chunk_id": chunk.get("chunk_id"),
        "sku": chunk.get("sku"),
        "category": chunk.get("category"),
        "text": chunk.get("text"),
        "metadata": chunk.get("metadata") or {},
    }


def write_vector_index(
    index_dir: Path,
    *,
    chunks: Sequence[dict],
    vectors: Sequence[Sequence[float]],
    source_catalog_hash: str,
    embedding_model: str,
    chunk_file: str | Path,
) -> None:
    if len(chunks) != len(vectors):
        raise ValueError("Chunk count must match vector count.")

    index_dir = Path(index_dir)
    index_dir.mkdir(parents=True, exist_ok=True)

    embeddings = np.array(vectors, dtype=float)
    np.save(index_dir / "embeddings.npy", embeddings)

    metadata_rows = [_metadata_row(chunk) for chunk in chunks]
    with (index_dir / "metadata.jsonl").open("w", encoding="utf-8", newline="\n") as f:
        for row in metadata_rows:
            f.write(json.dumps(row, ensure_ascii=False, sort_keys=True, separators=(",", ":")))
            f.write("\n")

    embedding_dimension = int(embeddings.shape[1]) if embeddings.ndim == 2 and embeddings.shape[0] else 0
    manifest = {
        "source_catalog_hash": source_catalog_hash,
        "embedding_model": embedding_model,
        "embedding_dimension": embedding_dimension,
        "chunk_count": len(chunks),
        "generated_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "chunk_file": str(chunk_file),
    }
    with (index_dir / "manifest.json").open("w", encoding="utf-8") as f:
        json.dump(manifest, f, ensure_ascii=False, sort_keys=True, indent=2)
        f.write("\n")


def _require_index_files(index_dir: Path) -> tuple[Path, Path, Path]:
    embeddings_path = index_dir / "embeddings.npy"
    metadata_path = index_dir / "metadata.jsonl"
    manifest_path = index_dir / "manifest.json"
    missing = [path.name for path in (embeddings_path, metadata_path, manifest_path) if not path.exists()]
    if missing:
        raise VectorIndexUnavailable(f"Local vector index is unavailable; missing {', '.join(missing)}.")
    return embeddings_path, metadata_path, manifest_path


def load_vector_index(index_dir: Path) -> VectorIndex:
    index_dir = Path(index_dir)
    embeddings_path, metadata_path, manifest_path = _require_index_files(index_dir)

    embeddings = np.load(embeddings_path)
    metadata = read_jsonl(metadata_path)
    with manifest_path.open("r", encoding="utf-8") as f:
        manifest = json.load(f)

    if len(metadata) != int(embeddings.shape[0]):
        raise VectorIndexUnavailable(
            "Local vector index is unavailable; metadata row count does not match embedding row count."
        )

    return VectorIndex(embeddings=embeddings, metadata=metadata, manifest=manifest)


def manifest_is_stale(manifest: dict, current_catalog_hash: str) -> bool:
    return manifest.get("source_catalog_hash") != current_catalog_hash


def _chunk_text_hash(chunk: dict) -> str:
    text = str(chunk.get("text") or "")
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def _embedding_cache_path(index_dir: Path) -> Path:
    return Path(index_dir) / "embedding_cache.jsonl"


def _load_embedding_cache(cache_path: Path, chunks: Sequence[dict], embedding_model: str) -> dict[str, list[float]]:
    expected_hashes = {
        str(chunk.get("chunk_id") or ""): _chunk_text_hash(chunk)
        for chunk in chunks
        if chunk.get("chunk_id")
    }
    cached: dict[str, list[float]] = {}
    for row in read_jsonl(cache_path):
        chunk_id = str(row.get("chunk_id") or "")
        if not chunk_id or chunk_id not in expected_hashes:
            continue
        if row.get("embedding_model") != embedding_model:
            continue
        if row.get("text_hash") != expected_hashes[chunk_id]:
            continue
        vector = row.get("vector")
        if not isinstance(vector, list) or not vector:
            continue
        cached[chunk_id] = [float(value) for value in vector]
    return cached


def _valid_cached_chunk_ids(cache_path: Path, chunks: Sequence[dict], embedding_model: str) -> set[str]:
    expected_hashes = {
        str(chunk.get("chunk_id") or ""): _chunk_text_hash(chunk)
        for chunk in chunks
        if chunk.get("chunk_id")
    }
    cached: set[str] = set()
    for row in read_jsonl(cache_path):
        chunk_id = str(row.get("chunk_id") or "")
        if not chunk_id or chunk_id not in expected_hashes:
            continue
        if row.get("embedding_model") != embedding_model:
            continue
        if row.get("text_hash") != expected_hashes[chunk_id]:
            continue
        if not isinstance(row.get("vector"), list) or not row.get("vector"):
            continue
        cached.add(chunk_id)
    return cached


def _index_matches_chunks(index_dir: Path, chunks: Sequence[dict], embedding_model: str) -> bool:
    try:
        index = load_vector_index(index_dir)
    except (OSError, ValueError, VectorIndexUnavailable):
        return False

    if index.manifest.get("embedding_model") != embedding_model:
        return False
    if int(index.manifest.get("chunk_count") or -1) != len(chunks):
        return False

    expected_ids = [str(chunk.get("chunk_id") or "") for chunk in chunks]
    actual_ids = [str(row.get("chunk_id") or "") for row in index.metadata]
    return actual_ids == expected_ids


def _append_embedding_cache(
    cache_path: Path,
    *,
    chunks: Sequence[dict],
    vectors: Sequence[Sequence[float]],
    embedding_model: str,
) -> None:
    if len(chunks) != len(vectors):
        raise ValueError("Chunk count must match vector count.")
    cache_path.parent.mkdir(parents=True, exist_ok=True)
    with cache_path.open("a", encoding="utf-8", newline="\n") as f:
        for chunk, vector in zip(chunks, vectors):
            row = {
                "chunk_id": chunk.get("chunk_id"),
                "sku": chunk.get("sku"),
                "embedding_model": embedding_model,
                "text_hash": _chunk_text_hash(chunk),
                "vector": [float(value) for value in vector],
            }
            f.write(json.dumps(row, ensure_ascii=False, sort_keys=True, separators=(",", ":")))
            f.write("\n")


def embed_chunks_with_resume(
    index_dir: Path,
    *,
    chunks: Sequence[dict],
    embedding_model: str,
    batch_size: int = 100,
    delay_seconds: float = 0.0,
    max_batches: int | None = None,
    embedder: Callable[..., list[list[float]]] = embed_texts,
    sleep: Callable[[float], None] = time.sleep,
) -> ResumableEmbeddingResult:
    if batch_size <= 0:
        raise ValueError("batch_size must be greater than zero.")
    if max_batches is not None and max_batches <= 0:
        raise ValueError("max_batches must be greater than zero when provided.")

    index_dir = Path(index_dir)
    cache_path = _embedding_cache_path(index_dir)
    cached = _load_embedding_cache(cache_path, chunks, embedding_model)
    missing = [chunk for chunk in chunks if str(chunk.get("chunk_id") or "") not in cached]
    embedded_this_run = 0
    batches_run = 0

    while missing and (max_batches is None or batches_run < max_batches):
        batch = missing[:batch_size]
        vectors = embedder([chunk["text"] for chunk in batch], model=embedding_model)
        if len(vectors) != len(batch):
            raise ValueError("Embedding count must match chunk batch size.")
        _append_embedding_cache(
            cache_path,
            chunks=batch,
            vectors=vectors,
            embedding_model=embedding_model,
        )
        for chunk, vector in zip(batch, vectors):
            cached[str(chunk.get("chunk_id") or "")] = [float(value) for value in vector]

        embedded_this_run += len(batch)
        batches_run += 1
        missing = missing[len(batch):]
        if missing and (max_batches is None or batches_run < max_batches) and delay_seconds > 0:
            sleep(delay_seconds)

    ordered_ids = [str(chunk.get("chunk_id") or "") for chunk in chunks]
    complete = all(chunk_id in cached for chunk_id in ordered_ids)
    ordered_vectors = [cached[chunk_id] for chunk_id in ordered_ids] if complete else []

    return ResumableEmbeddingResult(
        vectors=ordered_vectors,
        complete=complete,
        cached_count=len(cached),
        missing_count=len(chunks) - len(cached),
        embedded_this_run=embedded_this_run,
        cache_path=cache_path,
    )


def inspect_embedding_status(index_dir: Path, *, chunks: Sequence[dict], embedding_model: str) -> dict:
    index_dir = Path(index_dir)
    cache_path = _embedding_cache_path(index_dir)
    cached = _valid_cached_chunk_ids(cache_path, chunks, embedding_model)
    missing_count = sum(1 for chunk in chunks if str(chunk.get("chunk_id") or "") not in cached)

    return {
        "chunk_count": len(chunks),
        "cached_count": len(cached),
        "missing_count": missing_count,
        "complete": missing_count == 0,
        "cache_path": str(cache_path),
        "index_exists": _index_matches_chunks(index_dir, chunks, embedding_model),
    }


def cosine_search(
    embeddings: np.ndarray,
    metadata: Sequence[dict],
    query_vector: Sequence[float],
    *,
    category: str,
    top_k: int,
) -> list[dict]:
    query = np.array(query_vector, dtype=float)
    query_norm = float(np.linalg.norm(query))
    if query_norm == 0.0 or top_k <= 0:
        return []

    category_key = str(category).strip().lower()
    results = []
    for row, item in zip(np.array(embeddings, dtype=float), metadata):
        if str(item.get("category") or "").strip().lower() != category_key:
            continue
        row_norm = float(np.linalg.norm(row))
        if row_norm == 0.0:
            continue
        score = float(np.dot(row, query) / (row_norm * query_norm))
        result = dict(item)
        result["score"] = round(score, 6)
        results.append(result)

    return sorted(results, key=lambda item: item["score"], reverse=True)[:top_k]


def _load_components(path: Path) -> list[dict]:
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)


def main(argv: Iterable[str] | None = None) -> None:
    parser = argparse.ArgumentParser(description="Build a local NumPy vector index for AI/RAG component chunks.")
    parser.add_argument("--components", help="Path to components JSON file.")
    parser.add_argument("--chunks", required=True, help="Path to vector chunks JSONL file.")
    parser.add_argument("--index-dir", required=True, help="Directory where vector index files will be written.")
    parser.add_argument("--model", required=True, help="Embedding model name.")
    parser.add_argument("--status", action="store_true", help="Print local vector cache/index status as JSON without embedding.")
    parser.add_argument("--embedding-batch-size", type=int, default=100, help="Number of chunk texts per Gemini embedding call.")
    parser.add_argument("--delay-seconds", type=float, default=0.0, help="Seconds to wait between embedding batches.")
    parser.add_argument("--max-batches", type=int, default=None, help="Stop after this many new batches; useful for free-tier incremental runs.")
    args = parser.parse_args(argv)

    chunks_path = Path(args.chunks)
    index_dir = Path(args.index_dir)

    if args.status and not chunks_path.exists():
        parser.error(f"--chunks file does not exist: {chunks_path}")

    chunks = read_jsonl(chunks_path)

    if args.status:
        print(
            json.dumps(
                inspect_embedding_status(index_dir, chunks=chunks, embedding_model=args.model),
                ensure_ascii=False,
                sort_keys=True,
            )
        )
        return

    if not args.components:
        parser.error("--components is required unless --status is used.")

    components_path = Path(args.components)
    components = _load_components(components_path)
    result = embed_chunks_with_resume(
        index_dir,
        chunks=chunks,
        embedding_model=args.model,
        batch_size=args.embedding_batch_size,
        delay_seconds=args.delay_seconds,
        max_batches=args.max_batches,
    )
    if not result.complete:
        print(
            f"Cached {result.cached_count}/{len(chunks)} vectors at {result.cache_path}. "
            f"Run again to continue; {result.missing_count} remaining."
        )
        raise SystemExit(2)

    write_vector_index(
        index_dir,
        chunks=chunks,
        vectors=result.vectors,
        source_catalog_hash=catalog_hash(components),
        embedding_model=args.model,
        chunk_file=str(chunks_path),
    )
    print(f"Wrote {len(result.vectors)} vectors to {index_dir}")


if __name__ == "__main__":
    main()
