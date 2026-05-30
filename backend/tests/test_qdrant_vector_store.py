from uuid import UUID

from backend.ai_providers import AIProviderProfile
from backend.utils import qdrant_store


def chunk(**overrides):
    payload = {
        "chunk_id": "component:cpu-1",
        "sku": "cpu-1",
        "category": "cpu",
        "text": "cpu component: Ryzen 5 7600. price IDR 3.000.000",
        "metadata": {"brand": "AMD", "price_idr": 3_000_000},
    }
    payload.update(overrides)
    return payload


def profile() -> AIProviderProfile:
    return AIProviderProfile(
        name="local_qwen",
        llm_provider="lmstudio",
        embedding_provider="lmstudio",
        vector_backend="qdrant",
        llm_model="qwen/qwen3.6-27b",
        embedding_model="text-embedding-qwen3-embedding-4b",
        embedding_dimension=2560,
        vector_url="http://localhost:6333",
        vector_collection="kompare_components_qwen",
        vector_distance="cosine",
    )


def test_qdrant_store_creates_named_dense_collection():
    calls = []

    def transport(method, path, payload, timeout):
        calls.append((method, path, payload, timeout))
        return {"result": True}

    store = qdrant_store.QdrantVectorStore.from_profile(profile(), transport=transport, timeout=9)

    store.ensure_collection(recreate=True)

    assert calls == [
        ("DELETE", "/collections/kompare_components_qwen", None, 9),
        (
            "PUT",
            "/collections/kompare_components_qwen",
            {
                "vectors": {
                    "dense": {
                        "size": 2560,
                        "distance": "Cosine",
                    }
                }
            },
            9,
        ),
    ]


def test_qdrant_store_upserts_chunks_with_payload_and_named_vectors():
    calls = []

    def transport(method, path, payload, timeout):
        calls.append((method, path, payload, timeout))
        return {"result": {"operation_id": 1}}

    store = qdrant_store.QdrantVectorStore.from_profile(profile(), transport=transport)
    chunks = [
        chunk(),
        chunk(chunk_id="component:gpu-1", sku="gpu-1", category="gpu", text="gpu component: RTX"),
    ]
    vectors = [[0.1, 0.2], [0.3, 0.4]]

    result = store.upsert_chunks(chunks, vectors, batch_size=10)

    assert result["upserted_count"] == 2
    assert calls[0][0] == "PUT"
    assert calls[0][1] == "/collections/kompare_components_qwen/points?wait=true"
    body = calls[0][2]
    assert len(body["points"]) == 2
    assert str(UUID(body["points"][0]["id"])) == body["points"][0]["id"]
    assert body["points"][0]["vector"] == {"dense": [0.1, 0.2]}
    assert body["points"][0]["payload"]["chunk_id"] == "component:cpu-1"
    assert body["points"][0]["payload"]["sku"] == "cpu-1"
    assert body["points"][0]["payload"]["category"] == "cpu"
    assert body["points"][0]["payload"]["metadata"]["price_idr"] == 3_000_000


def test_qdrant_store_queries_named_dense_vector_and_normalizes_matches():
    def transport(method, path, payload, timeout):
        assert method == "POST"
        assert path == "/collections/kompare_components_qwen/points/search"
        assert payload == {
            "vector": {"name": "dense", "vector": [0.1, 0.2]},
            "limit": 3,
            "with_payload": True,
            "with_vector": False,
            "filter": {
                "must": [
                    {
                        "key": "category",
                        "match": {"value": "gpu"},
                    }
                ]
            },
        }
        return {
            "result": [
                {
                    "id": "point-1",
                    "score": 0.91,
                    "payload": {
                        "chunk_id": "component:gpu-1",
                        "sku": "gpu-1",
                        "category": "gpu",
                        "text": "gpu component",
                        "metadata": {"price_idr": 5_000_000},
                    },
                }
            ]
        }

    store = qdrant_store.QdrantVectorStore.from_profile(profile(), transport=transport)

    matches = store.query([0.1, 0.2], top_k=3, category="gpu")

    assert matches == [
        {
            "chunk_id": "component:gpu-1",
            "sku": "gpu-1",
            "category": "gpu",
            "text": "gpu component",
            "metadata": {"price_idr": 5_000_000},
            "score": 0.91,
        }
    ]


def test_build_qdrant_points_rejects_chunk_vector_count_mismatch():
    store = qdrant_store.QdrantVectorStore.from_profile(profile(), transport=lambda *_args: {})

    try:
        store.upsert_chunks([chunk()], [], batch_size=10)
    except ValueError as exc:
        assert "Chunk count must match vector count" in str(exc)
    else:
        raise AssertionError("Expected mismatch to raise ValueError")
