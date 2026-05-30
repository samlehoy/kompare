from backend import ai_providers
from backend.utils import local_ai_readiness


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


def test_local_ai_readiness_reports_embedding_qdrant_and_json_chat_success():
    calls = []

    class FakeClient:
        def __init__(self):
            self.schema = None

        def embed_texts(self, texts):
            calls.append(("embed", texts))
            return [[0.1, 0.2, 0.3]]

        def generate_json(self, prompt, *, temperature=0.0, schema=None):
            self.schema = schema
            calls.append(("json", prompt, temperature))
            return {"ok": True}

    class FakeStore:
        def query(self, vector, *, top_k=1, category=None):
            calls.append(("query", vector, top_k, category))
            return [{"sku": "gpu-1", "score": 0.91}]

    fake_client = FakeClient()
    result = local_ai_readiness.check_local_ai_readiness(
        profile=profile(),
        client=fake_client,
        store=FakeStore(),
        query="RTX 4060 under 6 juta",
        category="gpu",
        top_k=1,
    )

    assert result["ready"] is True
    assert result["profile"] == "local_qwen"
    assert result["embedding"]["ok"] is True
    assert result["embedding"]["dimension"] == 3
    assert result["qdrant"]["ok"] is True
    assert result["qdrant"]["match_count"] == 1
    assert result["chat_json"]["ok"] is True
    assert calls[0][0] == "embed"
    assert calls[0][1][0].startswith(local_ai_readiness.QUERY_PREFIX)
    assert calls[1] == ("query", [0.1, 0.2, 0.3], 1, "gpu")
    assert fake_client.schema["properties"]["ok"]["type"] == "boolean"


def test_local_ai_readiness_marks_embedding_failure_and_skips_qdrant():
    class FailingClient:
        def embed_texts(self, _texts):
            raise ai_providers.AIProviderError("embedding timeout")

        def generate_json(self, _prompt, *, temperature=0.0, schema=None):
            return {"ok": True}

    class StoreShouldNotRun:
        def query(self, *_args, **_kwargs):
            raise AssertionError("Qdrant should not run without an embedding vector")

    result = local_ai_readiness.check_local_ai_readiness(
        profile=profile(),
        client=FailingClient(),
        store=StoreShouldNotRun(),
        check_chat=False,
    )

    assert result["ready"] is False
    assert result["embedding"]["ok"] is False
    assert "embedding timeout" in result["embedding"]["error"]
    assert result["qdrant"]["ok"] is False
    assert result["qdrant"]["skipped"] is True
    assert result["chat_json"]["skipped"] is True


def test_local_ai_readiness_marks_json_chat_failure_without_hiding_retrieval():
    class FakeClient:
        def embed_texts(self, _texts):
            return [[0.1, 0.2]]

        def generate_json(self, _prompt, *, temperature=0.0, schema=None):
            raise ai_providers.AIProviderError("not valid JSON")

    class FakeStore:
        def query(self, _vector, *, top_k=1, category=None):
            return [{"sku": "gpu-1"}]

    result = local_ai_readiness.check_local_ai_readiness(
        profile=profile(),
        client=FakeClient(),
        store=FakeStore(),
    )

    assert result["ready"] is False
    assert result["embedding"]["ok"] is True
    assert result["qdrant"]["ok"] is True
    assert result["chat_json"]["ok"] is False
    assert "not valid JSON" in result["chat_json"]["error"]


def test_local_ai_readiness_marks_empty_qdrant_matches_not_ready():
    class FakeClient:
        def embed_texts(self, _texts):
            return [[0.1, 0.2]]

    class EmptyStore:
        def query(self, _vector, *, top_k=1, category=None):
            return []

    result = local_ai_readiness.check_local_ai_readiness(
        profile=profile(),
        client=FakeClient(),
        store=EmptyStore(),
        check_chat=False,
    )

    assert result["ready"] is False
    assert result["embedding"]["ok"] is True
    assert result["qdrant"]["ok"] is False
    assert result["qdrant"]["match_count"] == 0
    assert "No Qdrant matches returned for readiness query." in result["qdrant"]["error"]
