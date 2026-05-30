import pytest

from backend import ai_providers


def test_default_ai_profile_uses_existing_gemini_free_stack(monkeypatch):
    monkeypatch.delenv("KOMPARE_AI_PROFILE", raising=False)

    profile = ai_providers.active_ai_profile()

    assert profile.name == "gemini_free"
    assert profile.llm_provider == "gemini"
    assert profile.embedding_provider == "gemini"
    assert profile.vector_backend == "local_json"
    assert profile.vector_index_path == "data/vector_index"


def test_local_qwen_profile_reads_lmstudio_and_qdrant_settings(monkeypatch):
    monkeypatch.setenv("KOMPARE_AI_PROFILE", "local_qwen")
    monkeypatch.setenv("LMSTUDIO_BASE_URL", "http://localhost:1234/v1")
    monkeypatch.setenv("LMSTUDIO_LLM_MODEL", "qwen/qwen3.6-27b")
    monkeypatch.setenv("LMSTUDIO_EMBEDDING_MODEL", "text-embedding-qwen3-embedding-4b")
    monkeypatch.setenv("QDRANT_URL", "http://localhost:6333")
    monkeypatch.setenv("QDRANT_COLLECTION_QWEN", "kompare_components_qwen")
    monkeypatch.setenv("QDRANT_VECTOR_SIZE", "2560")
    monkeypatch.setenv("QDRANT_DISTANCE", "cosine")
    monkeypatch.setenv("LMSTUDIO_TIMEOUT_SECONDS", "45")

    profile = ai_providers.active_ai_profile()

    assert profile.name == "local_qwen"
    assert profile.llm_provider == "lmstudio"
    assert profile.embedding_provider == "lmstudio"
    assert profile.vector_backend == "qdrant"
    assert profile.llm_base_url == "http://localhost:1234/v1"
    assert profile.llm_model == "qwen/qwen3.6-27b"
    assert profile.embedding_model == "text-embedding-qwen3-embedding-4b"
    assert profile.embedding_dimension == 2560
    assert profile.vector_collection == "kompare_components_qwen"
    assert profile.vector_distance == "cosine"
    assert profile.timeout_seconds == 45


def test_local_qwen_profile_default_timeout_allows_slow_local_ranker(monkeypatch):
    monkeypatch.setenv("KOMPARE_AI_PROFILE", "local_qwen")
    monkeypatch.delenv("LMSTUDIO_TIMEOUT_SECONDS", raising=False)

    profile = ai_providers.active_ai_profile()

    assert profile.timeout_seconds == 90


def test_unknown_ai_profile_is_rejected(monkeypatch):
    monkeypatch.setenv("KOMPARE_AI_PROFILE", "surprise_me")

    with pytest.raises(ai_providers.AIProviderError, match="Unknown AI provider profile"):
        ai_providers.active_ai_profile()
