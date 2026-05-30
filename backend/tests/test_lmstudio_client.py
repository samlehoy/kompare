import pytest

from backend import ai_providers
from backend.ai_providers import AIProviderError, LMStudioClient


def test_lmstudio_embeddings_use_openai_compatible_shape():
    calls = []

    def transport(endpoint, payload, timeout):
        calls.append((endpoint, payload, timeout))
        return {
            "data": [
                {"embedding": [0.1, 0.2]},
                {"embedding": [0.3, 0.4]},
            ]
        }

    client = LMStudioClient(
        base_url="http://localhost:1234/v1",
        llm_model="qwen/qwen3.6-27b",
        embedding_model="text-embedding-qwen3-embedding-4b",
        transport=transport,
        timeout=7,
    )

    vectors = client.embed_texts(["cpu chunk", "", "gpu chunk"])

    assert vectors == [[0.1, 0.2], [0.3, 0.4]]
    assert calls == [
        (
            "/embeddings",
            {
                "model": "text-embedding-qwen3-embedding-4b",
                "input": ["cpu chunk", "gpu chunk"],
            },
            7,
        )
    ]


def test_lmstudio_chat_reads_reasoning_content_when_content_is_empty():
    def transport(endpoint, payload, _timeout):
        assert endpoint == "/chat/completions"
        assert payload["model"] == "qwen/qwen3.6-27b"
        return {
            "choices": [
                {
                    "message": {
                        "content": "",
                        "reasoning_content": '{"selected_skus": {"cpu": "123"}}',
                    }
                }
            ]
        }

    client = LMStudioClient(
        base_url="http://localhost:1234/v1",
        llm_model="qwen/qwen3.6-27b",
        embedding_model="text-embedding-qwen3-embedding-4b",
        transport=transport,
    )

    text = client.generate_chat(
        [
            {"role": "system", "content": "Return JSON."},
            {"role": "user", "content": "Rank candidates."},
        ],
        temperature=0.1,
        max_tokens=500,
    )

    assert text == '{"selected_skus": {"cpu": "123"}}'


def test_lmstudio_generate_json_parses_reasoning_content_json():
    def transport(_endpoint, _payload, _timeout):
        return {
            "choices": [
                {
                    "message": {
                        "content": "",
                        "reasoning_content": '{"summary": "ok", "tradeoffs": []}',
                    }
                }
            ]
        }

    client = LMStudioClient(
        base_url="http://localhost:1234/v1",
        llm_model="qwen/qwen3.6-27b",
        embedding_model="text-embedding-qwen3-embedding-4b",
        transport=transport,
    )

    assert client.generate_json("Return JSON.") == {"summary": "ok", "tradeoffs": []}


def test_lmstudio_generate_json_can_request_json_schema_response_format():
    calls = []

    def transport(endpoint, payload, timeout):
        calls.append((endpoint, payload, timeout))
        return {
            "choices": [
                {
                    "message": {
                        "content": "",
                        "reasoning_content": '{"ok": true}',
                    }
                }
            ]
        }

    client = LMStudioClient(
        base_url="http://localhost:1234/v1",
        llm_model="qwen/qwen3.6-27b",
        embedding_model="text-embedding-qwen3-embedding-4b",
        transport=transport,
    )

    payload = client.generate_json(
        "Return JSON.",
        schema={
            "type": "object",
            "properties": {"ok": {"type": "boolean"}},
            "required": ["ok"],
            "additionalProperties": False,
        },
    )

    assert payload == {"ok": True}
    request_payload = calls[0][1]
    assert request_payload["response_format"] == {
        "type": "json_schema",
        "json_schema": {
            "name": "KompareJsonResponse",
            "schema": {
                "type": "object",
                "properties": {"ok": {"type": "boolean"}},
                "required": ["ok"],
                "additionalProperties": False,
            },
        },
    }


def test_lmstudio_generate_json_rejects_invalid_json():
    def transport(_endpoint, _payload, _timeout):
        return {"choices": [{"message": {"content": "not json"}}]}

    client = LMStudioClient(
        base_url="http://localhost:1234/v1",
        llm_model="qwen/qwen3.6-27b",
        embedding_model="text-embedding-qwen3-embedding-4b",
        transport=transport,
    )

    with pytest.raises(AIProviderError, match="valid JSON"):
        client.generate_json("Return JSON.")


def test_lmstudio_client_from_profile_uses_profile_timeout():
    calls = []

    def transport(endpoint, payload, timeout):
        calls.append((endpoint, payload, timeout))
        return {"data": [{"embedding": [0.1]}]}

    profile = ai_providers.AIProviderProfile(
        name="local_qwen",
        llm_provider="lmstudio",
        embedding_provider="lmstudio",
        vector_backend="qdrant",
        llm_model="qwen",
        embedding_model="embed",
        timeout_seconds=23,
    )
    client = ai_providers.lmstudio_client_from_profile(profile, transport=transport)

    assert client.embed_texts(["gpu"]) == [[0.1]]
    assert calls[0][2] == 23


def test_default_lmstudio_transport_wraps_socket_timeouts(monkeypatch):
    def fake_urlopen(_request, timeout):
        raise TimeoutError("slow local model")

    monkeypatch.setattr(ai_providers.urllib.request, "urlopen", fake_urlopen)

    transport = ai_providers._default_transport("http://localhost:1234/v1")

    with pytest.raises(AIProviderError, match="timed out"):
        transport("/chat/completions", {"model": "qwen"}, 5)
