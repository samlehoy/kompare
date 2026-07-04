import json
from pathlib import Path

import numpy as np
import pytest

from backend.utils.ai_rag_index import (
    VectorIndexUnavailable,
    cosine_search,
    embed_chunks_with_resume,
    inspect_embedding_status,
    load_vector_index,
    manifest_is_stale,
    write_vector_index,
)
from backend.utils import ai_rag_index


def _chunk(**overrides):
    chunk = {
        "chunk_id": "component:cpu-1",
        "sku": "cpu-1",
        "category": "cpu",
        "text": "cpu component: Ryzen 5",
        "metadata": {"brand": "AMD", "price_idr": 2_000_000},
    }
    chunk.update(overrides)
    return chunk


def test_write_and_load_vector_index_round_trip(tmp_path: Path):
    index_dir = tmp_path / "vector_index"
    chunks = [
        _chunk(),
        _chunk(
            chunk_id="component:gpu-1",
            sku="gpu-1",
            category="gpu",
            text="gpu component: RTX",
            metadata={"brand": "NVIDIA", "price_idr": 5_000_000},
        ),
    ]
    vectors = [[1, 0, 0], [0, 1, 0]]

    write_vector_index(
        index_dir,
        chunks=chunks,
        vectors=vectors,
        source_catalog_hash="abc123",
        embedding_model="gemini-embedding-001",
        chunk_file="data/vector_chunks.jsonl",
    )

    loaded = load_vector_index(index_dir)

    assert loaded.embeddings.dtype.kind == "f"
    np.testing.assert_allclose(loaded.embeddings, np.array(vectors, dtype=float))
    assert loaded.metadata == chunks
    assert loaded.manifest["source_catalog_hash"] == "abc123"
    assert loaded.manifest["embedding_model"] == "gemini-embedding-001"
    assert loaded.manifest["embedding_dimension"] == 3
    assert loaded.manifest["chunk_count"] == 2
    assert loaded.manifest["chunk_file"] == "data/vector_chunks.jsonl"
    assert loaded.manifest["generated_at"].endswith("Z")


def test_load_vector_index_raises_when_files_are_missing(tmp_path: Path):
    with pytest.raises(VectorIndexUnavailable, match="vector index"):
        load_vector_index(tmp_path / "missing_index")


def test_load_vector_index_raises_when_metadata_count_mismatches_embeddings(tmp_path: Path):
    index_dir = tmp_path / "vector_index"
    index_dir.mkdir()
    np.save(index_dir / "embeddings.npy", np.array([[1, 0], [0, 1]], dtype=float))
    (index_dir / "metadata.jsonl").write_text(json.dumps(_chunk()) + "\n", encoding="utf-8")
    (index_dir / "manifest.json").write_text(json.dumps({"chunk_count": 2}), encoding="utf-8")

    with pytest.raises(VectorIndexUnavailable, match="vector index"):
        load_vector_index(index_dir)


def test_manifest_is_stale_when_catalog_hash_differs():
    assert manifest_is_stale({"source_catalog_hash": "old"}, "new") is True
    assert manifest_is_stale({"source_catalog_hash": "same"}, "same") is False


def test_write_vector_index_raises_when_counts_mismatch(tmp_path: Path):
    with pytest.raises(ValueError):
        write_vector_index(
            tmp_path / "vector_index",
            chunks=[_chunk()],
            vectors=[],
            source_catalog_hash="abc123",
            embedding_model="gemini-embedding-001",
            chunk_file="data/vector_chunks.jsonl",
        )


def test_cosine_search_filters_by_category_limits_and_skips_zero_vectors():
    embeddings = np.array(
        [
            [1.0, 0.0],
            [0.0, 1.0],
            [0.0, 0.0],
            [0.8, 0.2],
        ]
    )
    metadata = [
        _chunk(chunk_id="component:cpu-1", sku="cpu-1", category="cpu", metadata={"brand": "AMD"}),
        _chunk(chunk_id="component:gpu-1", sku="gpu-1", category="gpu", metadata={"brand": "NVIDIA"}),
        _chunk(chunk_id="component:cpu-0", sku="cpu-0", category="cpu", metadata={"brand": "Zero"}),
        _chunk(chunk_id="component:cpu-2", sku="cpu-2", category="cpu", metadata={"brand": "Intel"}),
    ]

    results = cosine_search(
        embeddings,
        metadata,
        np.array([1.0, 0.0]),
        category="cpu",
        top_k=2,
    )

    assert [result["sku"] for result in results] == ["cpu-1", "cpu-2"]
    assert results[0]["metadata"] == {"brand": "AMD"}
    assert results[0]["score"] == 1.0
    assert results[1]["score"] == 0.970143


def test_cosine_search_returns_empty_for_zero_query_vector():
    assert cosine_search(np.array([[1.0, 0.0]]), [_chunk()], [0, 0], category="cpu", top_k=1) == []


def test_embed_chunks_with_resume_batches_writes_cache_and_throttles(tmp_path: Path):
    index_dir = tmp_path / "vector_index"
    chunks = [
        _chunk(chunk_id="component:cpu-1", sku="cpu-1", text="cpu one"),
        _chunk(chunk_id="component:cpu-2", sku="cpu-2", text="cpu two"),
        _chunk(chunk_id="component:cpu-3", sku="cpu-3", text="cpu three"),
    ]
    calls = []
    sleeps = []

    def fake_embed(texts, *, model):
        calls.append({"texts": list(texts), "model": model})
        return [[float(len(calls)), float(index)] for index, _text in enumerate(texts)]

    result = embed_chunks_with_resume(
        index_dir,
        chunks=chunks,
        embedding_model="test-embedding",
        batch_size=2,
        delay_seconds=9,
        embedder=fake_embed,
        sleep=sleeps.append,
    )

    assert result.complete is True
    assert result.embedded_this_run == 3
    assert result.cached_count == 3
    assert result.missing_count == 0
    assert [len(call["texts"]) for call in calls] == [2, 1]
    assert [call["model"] for call in calls] == ["test-embedding", "test-embedding"]
    assert sleeps == [9]
    assert result.vectors == [[1.0, 0.0], [1.0, 1.0], [2.0, 0.0]]

    cache_rows = [
        json.loads(line)
        for line in (index_dir / "embedding_cache.jsonl").read_text(encoding="utf-8").splitlines()
    ]
    assert [row["chunk_id"] for row in cache_rows] == [
        "component:cpu-1",
        "component:cpu-2",
        "component:cpu-3",
    ]
    assert {row["embedding_model"] for row in cache_rows} == {"test-embedding"}


def test_embed_chunks_with_resume_reuses_cache_after_failed_run(tmp_path: Path):
    index_dir = tmp_path / "vector_index"
    chunks = [
        _chunk(chunk_id="component:cpu-1", sku="cpu-1", text="cpu one"),
        _chunk(chunk_id="component:cpu-2", sku="cpu-2", text="cpu two"),
        _chunk(chunk_id="component:cpu-3", sku="cpu-3", text="cpu three"),
    ]
    first_calls = []

    def flaky_embed(texts, *, model):
        first_calls.append(list(texts))
        if len(first_calls) > 1:
            raise RuntimeError("quota exhausted")
        return [[1.0, 0.0], [2.0, 0.0]]

    with pytest.raises(RuntimeError, match="quota exhausted"):
        embed_chunks_with_resume(
            index_dir,
            chunks=chunks,
            embedding_model="test-embedding",
            batch_size=2,
            embedder=flaky_embed,
        )

    cache_rows = [
        json.loads(line)
        for line in (index_dir / "embedding_cache.jsonl").read_text(encoding="utf-8").splitlines()
    ]
    assert [row["chunk_id"] for row in cache_rows] == ["component:cpu-1", "component:cpu-2"]

    resume_calls = []

    def resume_embed(texts, *, model):
        resume_calls.append(list(texts))
        return [[3.0, 0.0]]

    result = embed_chunks_with_resume(
        index_dir,
        chunks=chunks,
        embedding_model="test-embedding",
        batch_size=2,
        embedder=resume_embed,
    )

    assert resume_calls == [["cpu three"]]
    assert result.complete is True
    assert result.embedded_this_run == 1
    assert result.cached_count == 3
    assert result.vectors == [[1.0, 0.0], [2.0, 0.0], [3.0, 0.0]]


def test_embed_chunks_with_resume_can_stop_after_max_batches(tmp_path: Path):
    chunks = [
        _chunk(chunk_id="component:cpu-1", sku="cpu-1", text="cpu one"),
        _chunk(chunk_id="component:cpu-2", sku="cpu-2", text="cpu two"),
    ]

    result = embed_chunks_with_resume(
        tmp_path / "vector_index",
        chunks=chunks,
        embedding_model="test-embedding",
        batch_size=1,
        max_batches=1,
        embedder=lambda texts, *, model: [[1.0, 0.0]],
    )

    assert result.complete is False
    assert result.embedded_this_run == 1
    assert result.cached_count == 1
    assert result.missing_count == 1
    assert result.vectors == []


def test_inspect_embedding_status_reports_cache_progress_and_loadable_index(tmp_path: Path):
    index_dir = tmp_path / "vector_index"
    chunks = [
        _chunk(chunk_id="component:cpu-1", sku="cpu-1", text="cpu one"),
        _chunk(chunk_id="component:cpu-2", sku="cpu-2", text="cpu two"),
    ]

    embed_chunks_with_resume(
        index_dir,
        chunks=chunks,
        embedding_model="test-embedding",
        batch_size=1,
        max_batches=1,
        embedder=lambda texts, *, model: [[1.0, 0.0]],
    )

    partial = inspect_embedding_status(index_dir, chunks=chunks, embedding_model="test-embedding")

    assert partial["chunk_count"] == 2
    assert partial["cached_count"] == 1
    assert partial["missing_count"] == 1
    assert partial["complete"] is False
    assert partial["cache_path"] == str(index_dir / "embedding_cache.jsonl")
    assert partial["index_exists"] is False

    write_vector_index(
        index_dir,
        chunks=chunks,
        vectors=[[1, 0], [0, 1]],
        source_catalog_hash="abc123",
        embedding_model="test-embedding",
        chunk_file="data/vector_chunks.jsonl",
    )

    complete = inspect_embedding_status(index_dir, chunks=chunks, embedding_model="test-embedding")

    assert complete["index_exists"] is True


def test_inspect_embedding_status_rejects_stale_index_manifest(tmp_path: Path):
    index_dir = tmp_path / "vector_index"
    chunks = [
        _chunk(chunk_id="component:cpu-1", sku="cpu-1", text="cpu one"),
        _chunk(chunk_id="component:cpu-2", sku="cpu-2", text="cpu two"),
    ]
    write_vector_index(
        index_dir,
        chunks=chunks[:1],
        vectors=[[1, 0]],
        source_catalog_hash="abc123",
        embedding_model="different-model",
        chunk_file="data/vector_chunks.jsonl",
    )

    status = inspect_embedding_status(index_dir, chunks=chunks, embedding_model="test-embedding")

    assert status["index_exists"] is False


def test_inspect_embedding_status_streams_cache_without_loading_vectors(tmp_path: Path, monkeypatch):
    index_dir = tmp_path / "vector_index"
    chunks = [_chunk(chunk_id="component:cpu-1", sku="cpu-1", text="cpu one")]
    embed_chunks_with_resume(
        index_dir,
        chunks=chunks,
        embedding_model="test-embedding",
        embedder=lambda texts, *, model: [[1.0, 0.0]],
    )

    def fail_if_vector_cache_loader_is_used(*args, **kwargs):
        raise AssertionError("status should not load full vectors")

    monkeypatch.setattr(ai_rag_index, "_load_embedding_cache", fail_if_vector_cache_loader_is_used)

    status = inspect_embedding_status(index_dir, chunks=chunks, embedding_model="test-embedding")

    assert status["cached_count"] == 1
    assert status["missing_count"] == 0


def test_status_cli_prints_json_without_embedding_calls(tmp_path: Path, capsys, monkeypatch):
    chunks_path = tmp_path / "vector_chunks.jsonl"
    chunks = [
        _chunk(chunk_id="component:cpu-1", sku="cpu-1", text="cpu one"),
        _chunk(chunk_id="component:cpu-2", sku="cpu-2", text="cpu two"),
    ]
    chunks_path.write_text(
        "\n".join(json.dumps(chunk) for chunk in chunks) + "\n",
        encoding="utf-8",
    )
    index_dir = tmp_path / "vector_index"
    embed_chunks_with_resume(
        index_dir,
        chunks=chunks,
        embedding_model="test-embedding",
        batch_size=1,
        max_batches=1,
        embedder=lambda texts, *, model: [[1.0, 0.0]],
    )

    def fail_if_called(*args, **kwargs):
        raise AssertionError("status must not call embeddings")

    monkeypatch.setattr(ai_rag_index, "embed_chunks_with_resume", fail_if_called)

    ai_rag_index.main(
        [
            "--status",
            "--chunks",
            str(chunks_path),
            "--index-dir",
            str(index_dir),
            "--model",
            "test-embedding",
        ]
    )

    output = json.loads(capsys.readouterr().out)

    assert output["chunk_count"] == 2
    assert output["cached_count"] == 1
    assert output["missing_count"] == 1
    assert output["complete"] is False
    assert output["index_exists"] is False


def test_status_cli_fails_when_chunks_file_is_missing(tmp_path: Path):
    with pytest.raises(SystemExit) as excinfo:
        ai_rag_index.main(
            [
                "--status",
                "--chunks",
                str(tmp_path / "missing.jsonl"),
                "--index-dir",
                str(tmp_path / "vector_index"),
                "--model",
                "test-embedding",
            ]
        )

    assert excinfo.value.code == 2
