from backend import ai_providers
from backend.utils import qdrant_smoke


def profile() -> ai_providers.AIProviderProfile:
    return ai_providers.AIProviderProfile(
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


def test_qdrant_smoke_embeds_prefixed_query_and_returns_matches():
    calls = []

    class FakeEmbedder:
        def embed_texts(self, texts):
            calls.append(("embed", texts))
            return [[0.1, 0.2, 0.3]]

    class FakeStore:
        def query(self, vector, *, top_k=12, category=None):
            calls.append(("query", vector, top_k, category))
            return [
                {
                    "chunk_id": "component:gpu-1",
                    "sku": "gpu-1",
                    "category": "gpu",
                    "text": "gpu component: RTX 4060",
                    "metadata": {"price_idr": 5_000_000},
                    "score": 0.93,
                }
            ]

    result = qdrant_smoke.smoke_qdrant_profile(
        profile=profile(),
        query="RTX 4060 under 6 juta",
        category="gpu",
        top_k=3,
        embedder=FakeEmbedder(),
        store=FakeStore(),
    )

    assert result["profile"] == "local_qwen"
    assert result["collection"] == "kompare_components_qwen"
    assert result["query"] == "RTX 4060 under 6 juta"
    assert result["category"] == "gpu"
    assert result["match_count"] == 1
    assert result["matches"][0]["sku"] == "gpu-1"
    assert result["matches"][0]["score"] == 0.93
    assert calls[0][0] == "embed"
    assert calls[0][1][0].startswith(
        "Instruct: Retrieve relevant PC component catalog entries"
    )
    assert calls[0][1][0].endswith("Query: RTX 4060 under 6 juta")
    assert calls[1] == ("query", [0.1, 0.2, 0.3], 3, "gpu")


def test_qdrant_smoke_rejects_empty_embedding_result():
    class EmptyEmbedder:
        def embed_texts(self, texts):
            return []

    try:
        qdrant_smoke.smoke_qdrant_profile(
            profile=profile(),
            query="Ryzen 5",
            embedder=EmptyEmbedder(),
            store=None,
        )
    except ai_providers.AIProviderError as exc:
        assert "did not return a query vector" in str(exc)
    else:
        raise AssertionError("Expected empty query embedding to raise")


def test_qdrant_smoke_requires_local_qwen_profile():
    bad_profile = ai_providers.AIProviderProfile(
        name="gemini_free",
        llm_provider="gemini",
        embedding_provider="gemini",
        vector_backend="local_json",
        llm_model="gemini-2.5-flash-lite",
        embedding_model="gemini-embedding-001",
    )

    try:
        qdrant_smoke.smoke_qdrant_profile(
            profile=bad_profile,
            query="Ryzen 5",
            embedder=None,
            store=None,
        )
    except ai_providers.AIProviderError as exc:
        assert "local_qwen" in str(exc)
    else:
        raise AssertionError("Expected non-local profile to raise")
