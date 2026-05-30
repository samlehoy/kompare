from pathlib import Path

from backend import ai_providers
from backend.utils import qdrant_sync


def component(sku: str, category: str, name: str) -> dict:
    return {
        "sku": sku,
        "category": category,
        "name": name,
        "price_idr": 1_000_000,
        "stock_status": "in_stock",
        "specs": {"socket": "AM5"},
    }


def test_sync_qdrant_profile_embeds_chunks_and_upserts(tmp_path: Path):
    catalog = tmp_path / "components.json"
    catalog.write_text(
        """
[
  {"sku":"cpu-1","category":"cpu","name":"Ryzen 5 7600","price_idr":3000000,"stock_status":"in_stock","specs":{"socket":"AM5"}},
  {"sku":"gpu-1","category":"gpu","name":"RTX 4060","price_idr":5000000,"stock_status":"in_stock","specs":{"vram_gb":8}}
]
        """.strip(),
        encoding="utf-8",
    )
    profile = ai_providers.AIProviderProfile(
        name="local_qwen",
        llm_provider="lmstudio",
        embedding_provider="lmstudio",
        vector_backend="qdrant",
        llm_model="qwen/qwen3.6-27b",
        embedding_model="text-embedding-qwen3-embedding-4b",
        embedding_dimension=2560,
        vector_url="http://localhost:6333",
        vector_collection="kompare_components_qwen",
    )
    calls = []

    class FakeEmbedder:
        def embed_texts(self, texts):
            calls.append(("embed", list(texts)))
            return [[float(index), 0.0] for index, _text in enumerate(texts)]

    class FakeStore:
        def ensure_collection(self, *, recreate=False):
            calls.append(("ensure", recreate))

        def upsert_chunks(self, chunks, vectors, *, batch_size=128):
            calls.append(("upsert", [chunk["sku"] for chunk in chunks], vectors, batch_size))
            return {"upserted_count": len(chunks)}

    result = qdrant_sync.sync_qdrant_profile(
        profile=profile,
        components_path=catalog,
        embedder=FakeEmbedder(),
        store=FakeStore(),
        recreate=True,
        batch_size=50,
    )

    assert result == {
        "profile": "local_qwen",
        "collection": "kompare_components_qwen",
        "chunk_count": 2,
        "vector_count": 2,
        "upserted_count": 2,
        "dry_run": False,
    }
    assert calls[0] == ("ensure", True)
    assert calls[1][0] == "embed"
    assert calls[2] == ("upsert", ["cpu-1", "gpu-1"], [[0.0, 0.0], [1.0, 0.0]], 50)


def test_sync_qdrant_profile_batches_embedding_requests_and_upserts(tmp_path: Path):
    catalog = tmp_path / "components.json"
    catalog.write_text(
        """
[
  {"sku":"cpu-1","category":"cpu","name":"Ryzen 5 7600","price_idr":3000000,"stock_status":"in_stock","specs":{"socket":"AM5"}},
  {"sku":"gpu-1","category":"gpu","name":"RTX 4060","price_idr":5000000,"stock_status":"in_stock","specs":{"vram_gb":8}},
  {"sku":"ram-1","category":"ram","name":"32GB DDR5","price_idr":1500000,"stock_status":"in_stock","specs":{"type":"DDR5"}}
]
        """.strip(),
        encoding="utf-8",
    )
    profile = ai_providers.AIProviderProfile(
        name="local_qwen",
        llm_provider="lmstudio",
        embedding_provider="lmstudio",
        vector_backend="qdrant",
        llm_model="qwen/qwen3.6-27b",
        embedding_model="text-embedding-qwen3-embedding-4b",
        embedding_dimension=2560,
        vector_url="http://localhost:6333",
        vector_collection="kompare_components_qwen",
    )
    calls = []

    class FakeEmbedder:
        def embed_texts(self, texts):
            calls.append(("embed", len(texts)))
            return [[float(len(calls)), 0.0] for _text in texts]

    class FakeStore:
        def ensure_collection(self, *, recreate=False):
            calls.append(("ensure", recreate))

        def upsert_chunks(self, chunks, vectors, *, batch_size=128):
            calls.append(("upsert", [chunk["sku"] for chunk in chunks], len(vectors), batch_size))
            return {"upserted_count": len(chunks)}

    result = qdrant_sync.sync_qdrant_profile(
        profile=profile,
        components_path=catalog,
        embedder=FakeEmbedder(),
        store=FakeStore(),
        batch_size=2,
    )

    assert result["chunk_count"] == 3
    assert result["vector_count"] == 3
    assert result["upserted_count"] == 3
    assert calls == [
        ("ensure", False),
        ("embed", 2),
        ("upsert", ["cpu-1", "gpu-1"], 2, 2),
        ("embed", 1),
        ("upsert", ["ram-1"], 1, 2),
    ]


def test_sync_qdrant_profile_dry_run_skips_embedding_and_upsert(tmp_path: Path):
    catalog = tmp_path / "components.json"
    catalog.write_text(
        '[{"sku":"cpu-1","category":"cpu","name":"Ryzen 5","price_idr":1}]',
        encoding="utf-8",
    )
    profile = ai_providers.AIProviderProfile(
        name="local_qwen",
        llm_provider="lmstudio",
        embedding_provider="lmstudio",
        vector_backend="qdrant",
        llm_model="qwen/qwen3.6-27b",
        embedding_model="text-embedding-qwen3-embedding-4b",
        embedding_dimension=2560,
        vector_url="http://localhost:6333",
        vector_collection="kompare_components_qwen",
    )

    result = qdrant_sync.sync_qdrant_profile(
        profile=profile,
        components_path=catalog,
        embedder=None,
        store=None,
        dry_run=True,
    )

    assert result["dry_run"] is True
    assert result["chunk_count"] == 1
    assert result["vector_count"] == 0
    assert result["upserted_count"] == 0
