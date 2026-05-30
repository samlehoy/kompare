import importlib
import os
import sys
import types
import unittest
from unittest.mock import patch


def install_fake_google(fake_client_cls):
    google_module = types.ModuleType("google")
    genai_module = types.ModuleType("google.genai")
    types_module = types.ModuleType("google.genai.types")

    class FakeContent:
        def __init__(self, role, parts):
            self.role = role
            self.parts = parts

    class FakePart:
        @staticmethod
        def from_text(text):
            return text

        @staticmethod
        def from_bytes(data, mime_type):
            return {"data": data, "mime_type": mime_type}

    class FakeGenerateContentConfig:
        def __init__(self, **kwargs):
            self.kwargs = kwargs

    types_module.Content = FakeContent
    types_module.Part = FakePart
    types_module.GenerateContentConfig = FakeGenerateContentConfig
    genai_module.Client = fake_client_cls
    genai_module.types = types_module
    google_module.genai = genai_module

    return {
        "google": google_module,
        "google.genai": genai_module,
        "google.genai.types": types_module,
    }


class GeminiClientSettingsTests(unittest.TestCase):
    def test_load_dotenv_once_does_not_override_existing_environment(self):
        calls = []

        dotenv_module = types.ModuleType("dotenv")
        dotenv_module.load_dotenv = lambda **kwargs: calls.append(kwargs)

        with patch.dict(sys.modules, {"dotenv": dotenv_module}):
            import backend.gemini_client as gemini_client

            gemini_client = importlib.reload(gemini_client)
            gemini_client._load_dotenv_once()

        self.assertEqual(calls, [{}])

    def test_get_client_recreates_client_when_api_key_changes(self):
        created_keys = []

        class FakeClient:
            def __init__(self, api_key):
                self.api_key = api_key
                created_keys.append(api_key)

        with patch.dict(sys.modules, install_fake_google(FakeClient)):
            import backend.gemini_client as gemini_client

            gemini_client = importlib.reload(gemini_client)
            gemini_client._load_dotenv_once = lambda: None

            with patch.dict(os.environ, {"GEMINI_API_KEY": "first-key"}, clear=False):
                first = gemini_client._get_client()

            with patch.dict(os.environ, {"GEMINI_API_KEY": "second-key"}, clear=False):
                second = gemini_client._get_client()

        self.assertEqual(first.api_key, "first-key")
        self.assertEqual(second.api_key, "second-key")
        self.assertEqual(created_keys, ["first-key", "second-key"])
        self.assertIsNot(first, second)

    def test_generate_chat_reply_falls_back_to_next_numbered_key_when_one_is_quota_limited(self):
        attempts = []

        class FakeChat:
            def __init__(self, api_key):
                self.api_key = api_key

            def send_message(self, message):
                attempts.append((self.api_key, message))
                if self.api_key == "quota-key":
                    raise RuntimeError("429 quota exhausted")
                return types.SimpleNamespace(text=f"ok from {self.api_key}")

        class FakeChats:
            def __init__(self, client):
                self.client = client

            def create(self, **_kwargs):
                return FakeChat(self.client.api_key)

        class FakeClient:
            def __init__(self, api_key):
                self.api_key = api_key
                self.chats = FakeChats(self)

        with patch.dict(sys.modules, install_fake_google(FakeClient)):
            import backend.gemini_client as gemini_client

            gemini_client = importlib.reload(gemini_client)
            gemini_client._load_dotenv_once = lambda: None

            env = {
                "GEMINI_API_KEY_1": "quota-key",
                "GEMINI_API_KEY_2": "good-key",
                "GEMINI_MODEL": "gemini-2.5-flash-lite",
            }
            with patch.dict(os.environ, env, clear=True):
                reply = gemini_client.generate_chat_reply(
                    [{"role": "user", "content": "Say ok."}]
                )

        self.assertEqual(reply, "ok from good-key")
        self.assertEqual(attempts, [("quota-key", "Say ok."), ("good-key", "Say ok.")])

    def test_embed_texts_calls_embedding_model_and_returns_vectors(self):
        calls = []

        class FakeModels:
            def embed_content(self, **kwargs):
                calls.append(kwargs)
                return types.SimpleNamespace(
                    embeddings=[
                        types.SimpleNamespace(values=[0.1, 0.2, 0.3]),
                        types.SimpleNamespace(values=[0.4, 0.5, 0.6]),
                    ]
                )

        class FakeClient:
            def __init__(self, api_key):
                self.api_key = api_key
                self.models = FakeModels()

        with patch.dict(sys.modules, install_fake_google(FakeClient)):
            import backend.gemini_client as gemini_client

            gemini_client = importlib.reload(gemini_client)
            gemini_client._load_dotenv_once = lambda: None

            with patch.dict(os.environ, {"GEMINI_API_KEY": "test-key"}, clear=True):
                vectors = gemini_client.embed_texts(["cpu chunk", "gpu chunk"])

        self.assertEqual(
            calls,
            [
                {
                    "model": "gemini-embedding-001",
                    "contents": ["cpu chunk", "gpu chunk"],
                }
            ],
        )
        self.assertEqual(vectors, [[0.1, 0.2, 0.3], [0.4, 0.5, 0.6]])

    def test_embed_texts_batches_requests_at_gemini_limit(self):
        calls = []

        class FakeModels:
            def embed_content(self, **kwargs):
                contents = kwargs["contents"]
                if len(contents) > 100:
                    raise RuntimeError("BatchEmbedContentsRequest.requests: at most 100 requests can be in one batch")
                calls.append(list(contents))
                return types.SimpleNamespace(
                    embeddings=[
                        types.SimpleNamespace(values=[float(index), 1.0])
                        for index, _text in enumerate(contents)
                    ]
                )

        class FakeClient:
            def __init__(self, api_key):
                self.api_key = api_key
                self.models = FakeModels()

        with patch.dict(sys.modules, install_fake_google(FakeClient)):
            import backend.gemini_client as gemini_client

            gemini_client = importlib.reload(gemini_client)
            gemini_client._load_dotenv_once = lambda: None

            with patch.dict(os.environ, {"GEMINI_API_KEY": "test-key"}, clear=True):
                vectors = gemini_client.embed_texts([f"chunk {index}" for index in range(101)])

        self.assertEqual([len(call) for call in calls], [100, 1])
        self.assertEqual(len(vectors), 101)

    def test_get_embedding_model_loads_dotenv_before_reading_environment(self):
        import backend.gemini_client as gemini_client

        gemini_client = importlib.reload(gemini_client)

        def fake_load_dotenv_once():
            os.environ["GEMINI_EMBEDDING_MODEL"] = "dotenv-embedding-model"

        with patch.dict(os.environ, {}, clear=True):
            gemini_client._load_dotenv_once = fake_load_dotenv_once
            self.assertEqual(
                gemini_client._get_embedding_model(),
                "dotenv-embedding-model",
            )

    def test_503_is_treated_as_quota_like_error(self):
        import backend.gemini_client as gemini_client

        gemini_client = importlib.reload(gemini_client)

        self.assertTrue(gemini_client._is_quota_error("503 service unavailable"))

if __name__ == "__main__":
    unittest.main()
