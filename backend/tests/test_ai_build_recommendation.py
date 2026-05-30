from types import SimpleNamespace

from backend.ai_providers import AIProviderProfile
from backend.gemini_client import GeminiError
from backend.utils.ai_rag_index import VectorIndexUnavailable
from backend.utils.ai_rag_retrieval import AI_REQUIRED_SLOTS


def component(category, sku, name, price, specs=None, brand="Test Lab", **extra):
    return {
        "sku": sku,
        "id": sku,
        "category": category,
        "name": name,
        "brand": brand,
        "price_idr": price,
        "stock_status": "in_stock",
        "specs": specs or {},
        **extra,
    }


def sample_components():
    return {
        "cpu": [
            component("cpu", "cpu-base", "AMD Ryzen 5 7600", 2_600_000, {"socket": "AM5", "brand": "AMD", "tdp_w": 65}),
            component("cpu", "cpu-ai", "AMD Ryzen 7 7700", 3_000_000, {"socket": "AM5", "brand": "AMD", "tdp_w": 65}),
        ],
        "motherboard": [
            component("motherboard", "mobo-base", "B650M Board", 1_700_000, {"socket": "AM5", "form_factor": "mATX", "ram_type": "DDR5"}),
            component("motherboard", "mobo-ai", "B650M WiFi Board", 1_900_000, {"socket": "AM5", "form_factor": "mATX", "ram_type": "DDR5"}),
            component("motherboard", "mobo-ddr4", "B550M DDR4 Board", 1_500_000, {"socket": "AM5", "form_factor": "mATX", "ram_type": "DDR4"}),
        ],
        "ram": [
            component("ram", "ram-base", "16GB DDR5 Kit", 900_000, {"type": "DDR5", "capacity_gb": 16, "speed_mhz": 5600}),
            component("ram", "ram-ai", "32GB DDR5 Kit", 1_400_000, {"type": "DDR5", "capacity_gb": 32, "speed_mhz": 6000}),
        ],
        "gpu": [
            component("gpu", "gpu-base", "GeForce RTX 4060", 4_500_000, {"vendor": "nvidia", "vram_gb": 8, "recommended_psu_w": 550}),
            component("gpu", "gpu-ai", "GeForce RTX 4060 Ti", 5_000_000, {"vendor": "nvidia", "vram_gb": 8, "recommended_psu_w": 650}),
            component("gpu", "gpu-expensive", "GeForce RTX 4090", 20_000_000, {"vendor": "nvidia", "vram_gb": 24, "recommended_psu_w": 850}),
        ],
        "ssd": [
            component("ssd", "ssd-base", "1TB NVMe SSD", 800_000, {"capacity_gb": 1024, "interface": "NVMe"}),
            component("ssd", "ssd-ai", "2TB NVMe SSD", 1_100_000, {"capacity_gb": 2048, "interface": "NVMe"}),
        ],
        "hdd": [
            component("hdd", "hdd-base", "2TB SATA HDD", 700_000, {"capacity_gb": 2048, "interface": "SATA"}),
        ],
        "psu": [
            component("psu", "psu-base", "650W Gold PSU", 900_000, {"wattage_w": 650, "rating": "Gold"}),
            component("psu", "psu-ai", "750W Gold PSU", 1_100_000, {"wattage_w": 750, "rating": "Gold"}),
        ],
        "case": [
            component("case", "case-base", "Airflow mATX Case", 600_000, {"max_form_factor": "mATX", "form_factor": "mATX"}),
            component("case", "case-ai", "Airflow ATX Case", 800_000, {"max_form_factor": "ATX", "form_factor": "ATX"}),
        ],
        "cooler": [
            component("cooler", "cooler-base", "Tower Air Cooler", 400_000, {"type": "air", "tdp_w": 180}),
            component("cooler", "fan-base", "120mm Case Fan", 150_000, {"type": "fan", "fan_size_mm": 120}),
        ],
    }


def selected_skus(**overrides):
    skus = {
        "cpu": "cpu-ai",
        "motherboard": "mobo-ai",
        "ram": "ram-ai",
        "gpu": "gpu-ai",
        "ssd": "ssd-ai",
        "psu": "psu-ai",
        "case": "case-ai",
    }
    skus.update(overrides)
    return skus


def candidates_for(catalog, **overrides):
    sku_by_slot = selected_skus(**overrides)
    by_sku = {
        item["sku"]: item
        for items in catalog.values()
        for item in items
    }
    return {
        slot: [{**by_sku[sku_by_slot[slot]], "retrieval_score": 0.95}]
        for slot in AI_REQUIRED_SLOTS
    }


def install_happy_path(monkeypatch, ai_module, catalog, *, candidates=None, selected=None):
    candidates = candidates or candidates_for(catalog)
    selected = selected or selected_skus()
    flat = ai_module._flat_components(catalog)
    monkeypatch.setattr(
        ai_module,
        "load_vector_index",
        lambda index_dir: SimpleNamespace(
            manifest={
                "source_catalog_hash": ai_module.catalog_hash(flat),
                "embedding_model": "test-embedding-model",
                "chunk_count": 42,
            }
        ),
    )
    monkeypatch.setattr(ai_module, "embed_texts", lambda texts: [[1.0, 0.0] for _ in texts])
    monkeypatch.setattr(ai_module, "retrieve_build_candidates", lambda *args, **kwargs: candidates)
    monkeypatch.setattr(
        ai_module,
        "generate_json",
        lambda prompt, temperature=0.2: {
            "selected_skus": selected,
            "slot_rationales": {slot: f"Reason for {slot}" for slot in selected},
            "summary": "Balanced AI-ranked build.",
            "tradeoffs": ["Costs more for stronger GPU and SSD."],
        },
    )


def test_falls_back_when_index_missing(monkeypatch):
    from backend.utils import ai_build_recommendation as ai_module

    monkeypatch.setattr(
        ai_module,
        "load_vector_index",
        lambda index_dir: (_ for _ in ()).throw(VectorIndexUnavailable("missing")),
    )

    result = ai_module.compose_ai_build(sample_components(), 18_000_000, "gaming")

    assert result["ai_assisted"] is False
    assert result["fallback"] is True
    assert result["fallback_reason"] == "vector_index_missing"
    assert result["validation_source"] == "deterministic"


def test_falls_back_when_ai_ranker_selects_unknown_sku(monkeypatch):
    from backend.utils import ai_build_recommendation as ai_module

    catalog = sample_components()
    install_happy_path(
        monkeypatch,
        ai_module,
        catalog,
        selected=selected_skus(gpu="unknown-gpu"),
    )

    result = ai_module.compose_ai_build(catalog, 18_000_000, "gaming")

    assert result["ai_assisted"] is False
    assert result["fallback"] is True
    assert result["fallback_reason"] == "ai_ranker_rejected"


def test_ai_assisted_result_uses_retrieved_components_and_metadata(monkeypatch):
    from backend.utils import ai_build_recommendation as ai_module

    catalog = sample_components()
    install_happy_path(monkeypatch, ai_module, catalog)

    result = ai_module.compose_ai_build(catalog, 18_000_000, "gaming")

    assert result["ai_assisted"] is True
    assert result["fallback"] is False
    assert result["components"]["cpu"]["sku"] == "cpu-ai"
    assert result["components"]["gpu"]["sku"] == "gpu-ai"
    assert "hdd" not in result["components"]
    assert result["optional_addons"]["hdd"] is None
    assert result["retrieval"]["embedding_model"] == "test-embedding-model"
    assert result["retrieval"]["top_k_per_slot"] == 12
    assert result["retrieval"]["chunk_count_considered"] == 42
    assert result["retrieval"]["candidate_counts"]["gpu"] == 1
    assert result["retrieval"]["selected_skus"]["gpu"] == "gpu-ai"
    assert result["ai_rationale"]["summary"] == "Balanced AI-ranked build."
    assert result["ai_rationale"]["slot_rationales"]["gpu"] == "Reason for gpu"
    assert result["validation_source"] == "deterministic"


def test_local_qwen_profile_retrieves_candidates_from_qdrant(monkeypatch):
    from backend.utils import ai_build_recommendation as ai_module

    catalog = sample_components()
    selected = selected_skus()
    profile = AIProviderProfile(
        name="local_qwen",
        llm_provider="lmstudio",
        embedding_provider="lmstudio",
        vector_backend="qdrant",
        llm_model="qwen-test",
        embedding_model="qwen-embed-test",
        embedding_dimension=3,
        llm_base_url="http://localhost:1234/v1",
        embedding_base_url="http://localhost:1234/v1",
        vector_url="http://localhost:6333",
        vector_collection="kompare_components_qwen",
    )

    class FakeLocalClient:
        def __init__(self):
            self.embedded_texts = []
            self.rank_schema = None

        def embed_texts(self, texts):
            self.embedded_texts.extend(texts)
            return [[1.0, 0.0, 0.0] for _ in texts]

        def generate_json(self, prompt, temperature=0.2, schema=None):
            self.rank_schema = schema
            return selected

    class FakeQdrantStore:
        def __init__(self):
            self.calls = []

        def query(self, vector, *, top_k=12, category=None):
            self.calls.append({"vector": vector, "top_k": top_k, "category": category})
            sku = selected[category]
            return [{"sku": sku, "category": category, "score": 0.91}]

    fake_client = FakeLocalClient()
    fake_store = FakeQdrantStore()

    monkeypatch.setattr(ai_module, "get_ai_profile", lambda name=None: profile)
    monkeypatch.setattr(ai_module, "lmstudio_client_from_profile", lambda selected_profile: fake_client)
    monkeypatch.setattr(ai_module.QdrantVectorStore, "from_profile", lambda selected_profile: fake_store)

    result = ai_module.compose_ai_build(
        catalog,
        18_000_000,
        "gaming",
        profile_name="local_qwen",
    )

    assert result["ai_assisted"] is True
    assert result["fallback"] is False
    assert result["components"]["gpu"]["sku"] == "gpu-ai"
    assert result["retrieval"]["profile"] == "local_qwen"
    assert result["retrieval"]["vector_backend"] == "qdrant"
    assert result["retrieval"]["vector_collection"] == "kompare_components_qwen"
    assert result["retrieval"]["embedding_model"] == "qwen-embed-test"
    assert result["retrieval"]["selected_skus"]["gpu"] == "gpu-ai"
    assert result["ai_rationale"]["summary"] == "Local Qwen selected one grounded SKU per required slot."
    assert {call["category"] for call in fake_store.calls} == set(AI_REQUIRED_SLOTS)
    assert all(call["top_k"] == 36 for call in fake_store.calls)
    assert len(fake_client.embedded_texts) == len(AI_REQUIRED_SLOTS)
    assert all(text.startswith("Instruct: Retrieve relevant PC component catalog entries") for text in fake_client.embedded_texts)
    assert fake_client.rank_schema["properties"]["gpu"]["enum"] == ["gpu-ai"]
    assert fake_client.rank_schema["required"] == AI_REQUIRED_SLOTS


def test_local_qwen_profile_uses_constrained_sku_choice_schema(monkeypatch):
    from backend.utils import ai_build_recommendation as ai_module

    catalog = sample_components()
    selected = selected_skus()
    profile = AIProviderProfile(
        name="local_qwen",
        llm_provider="lmstudio",
        embedding_provider="lmstudio",
        vector_backend="qdrant",
        llm_model="qwen-test",
        embedding_model="qwen-embed-test",
        embedding_dimension=3,
        llm_base_url="http://localhost:1234/v1",
        embedding_base_url="http://localhost:1234/v1",
        vector_url="http://localhost:6333",
        vector_collection="kompare_components_qwen",
    )

    class FakeLocalClient:
        def __init__(self):
            self.rank_prompt = ""
            self.rank_schema = None
            self.rank_temperature = None

        def embed_texts(self, texts):
            return [[1.0, 0.0, 0.0] for _ in texts]

        def generate_json(self, prompt, temperature=0.2, schema=None):
            self.rank_prompt = prompt
            self.rank_temperature = temperature
            self.rank_schema = schema
            return selected

    class FakeQdrantStore:
        def query(self, vector, *, top_k=12, category=None):
            return [{"sku": selected[category], "category": category, "score": 0.91}]

    fake_client = FakeLocalClient()

    monkeypatch.setattr(ai_module, "get_ai_profile", lambda name=None: profile)
    monkeypatch.setattr(ai_module, "lmstudio_client_from_profile", lambda selected_profile: fake_client)
    monkeypatch.setattr(ai_module.QdrantVectorStore, "from_profile", lambda selected_profile: FakeQdrantStore())

    result = ai_module.compose_ai_build(
        catalog,
        18_000_000,
        "gaming",
        profile_name="local_qwen",
    )

    assert result["ai_assisted"] is True
    assert result["fallback"] is False
    assert result["retrieval"]["ranker_mode"] == "json_ranker"
    assert result["ai_rationale"]["summary"] == "Local Qwen selected one grounded SKU per required slot."
    assert "Selected by local Qwen" in result["ai_rationale"]["slot_rationales"]["gpu"]
    assert fake_client.rank_temperature == 0.0
    assert fake_client.rank_schema["properties"]["gpu"]["enum"] == ["gpu-ai"]
    assert fake_client.rank_schema["additionalProperties"] is False
    assert "selected_skus" not in fake_client.rank_schema["properties"]
    assert len(fake_client.rank_prompt) < 1800


def test_local_qwen_profile_constrains_ranker_to_requested_cpu_and_gpu_preferences(monkeypatch):
    from backend.utils import ai_build_recommendation as ai_module

    catalog = sample_components()
    catalog["cpu"].append(
        component("cpu", "cpu-intel", "Intel Core Ultra 5", 2_900_000, {"socket": "LGA1851", "brand": "Intel", "tdp_w": 65})
    )
    catalog["motherboard"].append(
        component("motherboard", "mobo-intel", "B860M DDR5 Board", 1_800_000, {"socket": "LGA1851", "form_factor": "mATX", "ram_type": "DDR5"})
    )
    catalog["gpu"].append(
        component("gpu", "gpu-intel", "Intel Arc B580 12GB", 4_700_000, {"vendor": "intel", "vram_gb": 12, "recommended_psu_w": 600})
    )
    selected = {
        "cpu": "cpu-intel",
        "motherboard": "mobo-intel",
        "ram": "ram-ai",
        "gpu": "gpu-intel",
        "ssd": "ssd-ai",
        "psu": "psu-ai",
        "case": "case-ai",
    }
    profile = AIProviderProfile(
        name="local_qwen",
        llm_provider="lmstudio",
        embedding_provider="lmstudio",
        vector_backend="qdrant",
        llm_model="qwen-test",
        embedding_model="qwen-embed-test",
        embedding_dimension=3,
        llm_base_url="http://localhost:1234/v1",
        embedding_base_url="http://localhost:1234/v1",
        vector_url="http://localhost:6333",
        vector_collection="kompare_components_qwen",
    )

    class FakeLocalClient:
        def __init__(self):
            self.rank_schema = None

        def embed_texts(self, texts):
            return [[1.0, 0.0, 0.0] for _ in texts]

        def generate_json(self, prompt, temperature=0.2, schema=None):
            self.rank_schema = schema
            return selected

    class FakeQdrantStore:
        def query(self, vector, *, top_k=12, category=None):
            if category == "cpu":
                return [
                    {"sku": "cpu-ai", "category": category, "score": 0.99},
                    {"sku": "cpu-intel", "category": category, "score": 0.93},
                ]
            if category == "gpu":
                return [
                    {"sku": "gpu-ai", "category": category, "score": 0.98},
                    {"sku": "gpu-intel", "category": category, "score": 0.92},
                ]
            return [{"sku": selected[category], "category": category, "score": 0.91}]

    fake_client = FakeLocalClient()

    monkeypatch.setattr(ai_module, "get_ai_profile", lambda name=None: profile)
    monkeypatch.setattr(ai_module, "lmstudio_client_from_profile", lambda selected_profile: fake_client)
    monkeypatch.setattr(ai_module.QdrantVectorStore, "from_profile", lambda selected_profile: FakeQdrantStore())

    result = ai_module.compose_ai_build(
        catalog,
        18_000_000,
        "gaming",
        cpu_brand="Intel",
        gpu_vendor="Intel",
        profile_name="local_qwen",
    )

    assert result["ai_assisted"] is True
    assert result["fallback"] is False
    assert result["components"]["cpu"]["sku"] == "cpu-intel"
    assert result["components"]["gpu"]["sku"] == "gpu-intel"
    assert fake_client.rank_schema["properties"]["cpu"]["enum"] == ["cpu-intel"]
    assert fake_client.rank_schema["properties"]["gpu"]["enum"] == ["gpu-intel"]


def test_local_qwen_profile_limits_ranker_candidates_for_small_context(monkeypatch):
    from backend.utils import ai_build_recommendation as ai_module

    catalog = sample_components()
    for slot in AI_REQUIRED_SLOTS:
        catalog[slot].extend(
            component(slot, f"{slot}-extra-{index}", f"{slot} extra {index}", 900_000, {})
            for index in range(5)
        )
    profile = AIProviderProfile(
        name="local_qwen",
        llm_provider="lmstudio",
        embedding_provider="lmstudio",
        vector_backend="qdrant",
        llm_model="qwen-test",
        embedding_model="qwen-embed-test",
        embedding_dimension=3,
        llm_base_url="http://localhost:1234/v1",
        embedding_base_url="http://localhost:1234/v1",
        vector_url="http://localhost:6333",
        vector_collection="kompare_components_qwen",
    )
    captured_candidate_counts = {}

    class FakeLocalClient:
        def embed_texts(self, texts):
            return [[1.0, 0.0, 0.0] for _ in texts]

        def generate_json(self, prompt, temperature=0.2, schema=None):
            return selected_skus()

    class FakeQdrantStore:
        def query(self, vector, *, top_k=12, category=None):
            return [
                {"sku": component["sku"], "category": category, "score": 1.0}
                for component in catalog[category][:top_k]
            ]

    def capture_prompt(_budget, _use_case, candidates_by_slot):
        captured_candidate_counts.update(
            {slot: len(candidates) for slot, candidates in candidates_by_slot.items()}
        )
        return "rank these candidates"

    monkeypatch.setattr(ai_module, "get_ai_profile", lambda name=None: profile)
    monkeypatch.setattr(ai_module, "lmstudio_client_from_profile", lambda selected_profile: FakeLocalClient())
    monkeypatch.setattr(ai_module.QdrantVectorStore, "from_profile", lambda selected_profile: FakeQdrantStore())
    monkeypatch.setattr(ai_module, "build_local_sku_choice_prompt", capture_prompt)

    result = ai_module.compose_ai_build(
        catalog,
        18_000_000,
        "gaming",
        profile_name="local_qwen",
    )

    assert result["ai_assisted"] is True
    assert captured_candidate_counts
    assert all(count <= 3 for count in captured_candidate_counts.values())


def test_local_qwen_profile_uses_retrieval_rank_when_json_ranker_times_out(monkeypatch):
    from backend.utils import ai_build_recommendation as ai_module

    catalog = sample_components()
    selected = selected_skus()
    profile = AIProviderProfile(
        name="local_qwen",
        llm_provider="lmstudio",
        embedding_provider="lmstudio",
        vector_backend="qdrant",
        llm_model="qwen-test",
        embedding_model="qwen-embed-test",
        embedding_dimension=3,
        llm_base_url="http://localhost:1234/v1",
        embedding_base_url="http://localhost:1234/v1",
        vector_url="http://localhost:6333",
        vector_collection="kompare_components_qwen",
    )

    class SlowLocalClient:
        def embed_texts(self, texts):
            return [[1.0, 0.0, 0.0] for _ in texts]

        def generate_json(self, prompt, temperature=0.2, schema=None):
            raise ai_module.AIProviderError("local ranker timed out")

    class FakeQdrantStore:
        def query(self, vector, *, top_k=12, category=None):
            return [{"sku": selected[category], "category": category, "score": 0.98}]

    monkeypatch.setattr(ai_module, "get_ai_profile", lambda name=None: profile)
    monkeypatch.setattr(ai_module, "lmstudio_client_from_profile", lambda selected_profile: SlowLocalClient())
    monkeypatch.setattr(ai_module.QdrantVectorStore, "from_profile", lambda selected_profile: FakeQdrantStore())

    result = ai_module.compose_ai_build(
        catalog,
        18_000_000,
        "gaming",
        profile_name="local_qwen",
    )

    assert result["ai_assisted"] is True
    assert result["fallback"] is False
    assert result["components"]["cpu"]["sku"] == "cpu-ai"
    assert result["components"]["gpu"]["sku"] == "gpu-ai"
    assert result["retrieval"]["ranker_mode"] == "retrieval_score_fallback"
    assert result["retrieval"]["ranker_error"] == "local ranker timed out"
    assert result["ai_rationale"]["summary"] == "Local retrieval selected the strongest compatible candidates before deterministic validation."
    assert result["ai_rationale"]["slot_rationales"]["gpu"] == "Top Qdrant retrieval candidate accepted by deterministic validation."


def test_local_qwen_retrieval_fallback_selects_compatible_platform_when_top_hits_conflict(monkeypatch):
    from backend.utils import ai_build_recommendation as ai_module

    catalog = sample_components()
    catalog["motherboard"].append(
        component(
            "motherboard",
            "mobo-lga",
            "B760M DDR5 Board",
            1_800_000,
            {"socket": "LGA1700", "form_factor": "mATX", "ram_type": "DDR5"},
        )
    )
    catalog["ram"].append(
        component("ram", "ram-ddr4", "16GB DDR4 Kit", 800_000, {"type": "DDR4", "capacity_gb": 16})
    )
    selected = selected_skus()
    profile = AIProviderProfile(
        name="local_qwen",
        llm_provider="lmstudio",
        embedding_provider="lmstudio",
        vector_backend="qdrant",
        llm_model="qwen-test",
        embedding_model="qwen-embed-test",
        embedding_dimension=3,
        llm_base_url="http://localhost:1234/v1",
        embedding_base_url="http://localhost:1234/v1",
        vector_url="http://localhost:6333",
        vector_collection="kompare_components_qwen",
    )

    class SlowLocalClient:
        def embed_texts(self, texts):
            return [[1.0, 0.0, 0.0] for _ in texts]

        def generate_json(self, prompt, temperature=0.2, schema=None):
            raise ai_module.AIProviderError("local ranker timed out")

    class FakeQdrantStore:
        def query(self, vector, *, top_k=12, category=None):
            by_category = {
                "cpu": ["cpu-ai"],
                "motherboard": ["mobo-lga", "mobo-ai"],
                "ram": ["ram-ddr4", "ram-ai"],
                "gpu": ["gpu-ai"],
                "ssd": ["ssd-ai"],
                "psu": ["psu-ai"],
                "case": ["case-ai"],
            }
            return [
                {"sku": sku, "category": category, "score": 0.99 - index * 0.01}
                for index, sku in enumerate(by_category[category])
            ]

    monkeypatch.setattr(ai_module, "get_ai_profile", lambda name=None: profile)
    monkeypatch.setattr(ai_module, "lmstudio_client_from_profile", lambda selected_profile: SlowLocalClient())
    monkeypatch.setattr(ai_module.QdrantVectorStore, "from_profile", lambda selected_profile: FakeQdrantStore())

    result = ai_module.compose_ai_build(
        catalog,
        18_000_000,
        "gaming",
        profile_name="local_qwen",
    )

    assert result["ai_assisted"] is True
    assert result["fallback"] is False
    assert result["components"]["cpu"]["sku"] == "cpu-ai"
    assert result["components"]["motherboard"]["sku"] == "mobo-ai"
    assert result["components"]["ram"]["sku"] == "ram-ai"
    assert result["retrieval"]["ranker_mode"] == "retrieval_score_fallback"
    assert result["retrieval"]["selected_skus"]["motherboard"] == "mobo-ai"
    assert result["retrieval"]["selected_skus"]["ram"] == "ram-ai"
    assert not [
        warning for warning in result["compatibility_warnings"]
        if warning.get("severity") == "error"
    ]


def test_local_qwen_retrieval_fallback_repairs_budget_overrun_with_cheaper_compatible_part(monkeypatch):
    from backend.utils import ai_build_recommendation as ai_module

    catalog = sample_components()
    catalog["gpu"].insert(
        0,
        component("gpu", "gpu-fast", "GeForce RTX 4070", 7_000_000, {"vendor": "nvidia", "vram_gb": 12, "recommended_psu_w": 650}),
    )
    selected = selected_skus(gpu="gpu-fast")
    profile = AIProviderProfile(
        name="local_qwen",
        llm_provider="lmstudio",
        embedding_provider="lmstudio",
        vector_backend="qdrant",
        llm_model="qwen-test",
        embedding_model="qwen-embed-test",
        embedding_dimension=3,
        llm_base_url="http://localhost:1234/v1",
        embedding_base_url="http://localhost:1234/v1",
        vector_url="http://localhost:6333",
        vector_collection="kompare_components_qwen",
    )

    class SlowLocalClient:
        def embed_texts(self, texts):
            return [[1.0, 0.0, 0.0] for _ in texts]

        def generate_json(self, prompt, temperature=0.2, schema=None):
            raise ai_module.AIProviderError("local ranker timed out")

    class FakeQdrantStore:
        def query(self, vector, *, top_k=12, category=None):
            if category == "gpu":
                return [
                    {"sku": "gpu-fast", "category": category, "score": 0.99},
                    {"sku": "gpu-ai", "category": category, "score": 0.98},
                    {"sku": "gpu-base", "category": category, "score": 0.97},
                ]
            return [{"sku": selected[category], "category": category, "score": 0.98}]

    monkeypatch.setattr(ai_module, "get_ai_profile", lambda name=None: profile)
    monkeypatch.setattr(ai_module, "lmstudio_client_from_profile", lambda selected_profile: SlowLocalClient())
    monkeypatch.setattr(ai_module.QdrantVectorStore, "from_profile", lambda selected_profile: FakeQdrantStore())

    result = ai_module.compose_ai_build(
        catalog,
        15_000_000,
        "gaming",
        profile_name="local_qwen",
    )

    assert result["ai_assisted"] is True
    assert result["fallback"] is False
    assert result["total_idr"] <= result["budget_idr"]
    assert result["components"]["gpu"]["sku"] != "gpu-fast"
    assert result["retrieval"]["ranker_mode"] == "retrieval_score_fallback"
    assert result["retrieval"]["selected_skus"]["gpu"] == result["components"]["gpu"]["sku"]
    assert "budget" in result["ai_rationale"]["slot_rationales"]["gpu"].lower()


def test_local_qwen_json_ranker_repairs_budget_overrun_with_cheaper_compatible_part(monkeypatch):
    from backend.utils import ai_build_recommendation as ai_module

    catalog = sample_components()
    catalog["gpu"].insert(
        0,
        component("gpu", "gpu-fast", "GeForce RTX 4070", 7_000_000, {"vendor": "nvidia", "vram_gb": 12, "recommended_psu_w": 650}),
    )
    selected = selected_skus(gpu="gpu-fast")
    profile = AIProviderProfile(
        name="local_qwen",
        llm_provider="lmstudio",
        embedding_provider="lmstudio",
        vector_backend="qdrant",
        llm_model="qwen-test",
        embedding_model="qwen-embed-test",
        embedding_dimension=3,
        llm_base_url="http://localhost:1234/v1",
        embedding_base_url="http://localhost:1234/v1",
        vector_url="http://localhost:6333",
        vector_collection="kompare_components_qwen",
    )

    class FakeLocalClient:
        def embed_texts(self, texts):
            return [[1.0, 0.0, 0.0] for _ in texts]

        def generate_json(self, prompt, temperature=0.2, schema=None):
            return selected

    class FakeQdrantStore:
        def query(self, vector, *, top_k=12, category=None):
            if category == "gpu":
                return [
                    {"sku": "gpu-fast", "category": category, "score": 0.99},
                    {"sku": "gpu-ai", "category": category, "score": 0.98},
                    {"sku": "gpu-base", "category": category, "score": 0.97},
                ]
            return [{"sku": selected[category], "category": category, "score": 0.98}]

    monkeypatch.setattr(ai_module, "get_ai_profile", lambda name=None: profile)
    monkeypatch.setattr(ai_module, "lmstudio_client_from_profile", lambda selected_profile: FakeLocalClient())
    monkeypatch.setattr(ai_module.QdrantVectorStore, "from_profile", lambda selected_profile: FakeQdrantStore())

    result = ai_module.compose_ai_build(
        catalog,
        15_000_000,
        "gaming",
        profile_name="local_qwen",
    )

    assert result["ai_assisted"] is True
    assert result["fallback"] is False
    assert result["retrieval"]["ranker_mode"] == "json_ranker"
    assert result["total_idr"] <= result["budget_idr"]
    assert result["components"]["gpu"]["sku"] != "gpu-fast"
    assert "budget" in result["ai_rationale"]["slot_rationales"]["gpu"].lower()


def test_local_qwen_profile_injects_deterministic_baseline_when_retrieval_slot_is_empty(monkeypatch):
    from backend.utils import ai_build_recommendation as ai_module

    catalog = sample_components()
    selected = selected_skus()
    profile = AIProviderProfile(
        name="local_qwen",
        llm_provider="lmstudio",
        embedding_provider="lmstudio",
        vector_backend="qdrant",
        llm_model="qwen-test",
        embedding_model="qwen-embed-test",
        embedding_dimension=3,
        llm_base_url="http://localhost:1234/v1",
        embedding_base_url="http://localhost:1234/v1",
        vector_url="http://localhost:6333",
        vector_collection="kompare_components_qwen",
    )

    class SlowLocalClient:
        def embed_texts(self, texts):
            return [[1.0, 0.0, 0.0] for _ in texts]

        def generate_json(self, prompt, temperature=0.2, schema=None):
            raise ai_module.AIProviderError("local ranker timed out")

    class SparseQdrantStore:
        def query(self, vector, *, top_k=12, category=None):
            if category == "gpu":
                return []
            return [{"sku": selected[category], "category": category, "score": 0.98}]

    monkeypatch.setattr(ai_module, "get_ai_profile", lambda name=None: profile)
    monkeypatch.setattr(ai_module, "lmstudio_client_from_profile", lambda selected_profile: SlowLocalClient())
    monkeypatch.setattr(ai_module.QdrantVectorStore, "from_profile", lambda selected_profile: SparseQdrantStore())

    result = ai_module.compose_ai_build(
        catalog,
        15_000_000,
        "gaming",
        profile_name="local_qwen",
    )

    assert result["ai_assisted"] is True
    assert result["fallback"] is False
    assert result["components"]["gpu"]["sku"] == "gpu-base"
    assert result["retrieval"]["ranker_mode"] == "retrieval_score_fallback"
    assert result["retrieval"]["selected_skus"]["gpu"] == "gpu-base"


def test_local_ranker_candidates_prune_platform_options_without_socket_and_ram_path():
    from backend.utils import ai_build_recommendation as ai_module

    candidates = {
        "cpu": [
            component("cpu", "cpu-am5", "AM5 CPU", 2_000_000, {"socket": "AM5", "ram_type": "DDR5"}),
            component("cpu", "cpu-lga1150", "LGA1150 CPU", 800_000, {"socket": "LGA1150", "ram_type": "DDR3"}),
        ],
        "motherboard": [
            component("motherboard", "mobo-am4", "AM4 Board", 1_200_000, {"socket": "AM4", "ram_type": "DDR4"}),
            component("motherboard", "mobo-lga1150", "LGA1150 Board", 1_000_000, {"socket": "LGA1150", "ram_type": "DDR3"}),
        ],
        "ram": [
            component("ram", "ram-ddr5", "DDR5 Kit", 1_000_000, {"type": "DDR5"}),
            component("ram", "ram-ddr3", "DDR3 Kit", 500_000, {"type": "DDR3"}),
        ],
    }

    filtered = ai_module._platform_compatible_candidates(candidates)

    assert [component["sku"] for component in filtered["cpu"]] == ["cpu-lga1150"]
    assert [component["sku"] for component in filtered["motherboard"]] == ["mobo-lga1150"]
    assert [component["sku"] for component in filtered["ram"]] == ["ram-ddr3"]


def test_falls_back_when_ai_selection_fails_deterministic_validation(monkeypatch):
    from backend.utils import ai_build_recommendation as ai_module

    catalog = sample_components()
    install_happy_path(
        monkeypatch,
        ai_module,
        catalog,
        candidates=candidates_for(catalog, motherboard="mobo-ddr4"),
        selected=selected_skus(motherboard="mobo-ddr4"),
    )

    result = ai_module.compose_ai_build(catalog, 18_000_000, "gaming")

    assert result["ai_assisted"] is False
    assert result["fallback"] is True
    assert result["fallback_reason"] == "deterministic_validation_failed"


def test_repairs_ai_selected_ram_generation_mismatch(monkeypatch):
    from backend.utils import ai_build_recommendation as ai_module

    catalog = sample_components()
    catalog["ram"].append(
        component("ram", "ram-ddr4", "16GB DDR4 Kit", 800_000, {"type": "DDR4", "capacity_gb": 16})
    )
    candidates = candidates_for(catalog, ram="ram-ddr4")
    by_sku = {
        item["sku"]: item
        for items in catalog.values()
        for item in items
    }
    candidates["ram"] = [
        {**by_sku["ram-ddr4"], "retrieval_score": 0.99},
    ]
    install_happy_path(
        monkeypatch,
        ai_module,
        catalog,
        candidates=candidates,
        selected=selected_skus(ram="ram-ddr4"),
    )

    result = ai_module.compose_ai_build(catalog, 18_000_000, "gaming")

    assert result["ai_assisted"] is True
    assert result["fallback"] is False
    assert result["components"]["ram"]["sku"] == "ram-ai"
    assert not [
        warning for warning in result["compatibility_warnings"]
        if warning.get("severity") == "error"
    ]


def test_repairs_ai_selected_motherboard_socket_mismatch(monkeypatch):
    from backend.utils import ai_build_recommendation as ai_module

    catalog = sample_components()
    catalog["motherboard"].append(
        component(
            "motherboard",
            "mobo-lga",
            "B760M DDR5 Board",
            1_800_000,
            {"socket": "LGA1700", "form_factor": "mATX", "ram_type": "DDR5"},
        )
    )
    candidates = candidates_for(catalog, motherboard="mobo-lga")
    by_sku = {
        item["sku"]: item
        for items in catalog.values()
        for item in items
    }
    candidates["motherboard"] = [
        {**by_sku["mobo-lga"], "retrieval_score": 0.99},
        {**by_sku["mobo-ai"], "retrieval_score": 0.98},
    ]
    install_happy_path(
        monkeypatch,
        ai_module,
        catalog,
        candidates=candidates,
        selected=selected_skus(motherboard="mobo-lga"),
    )

    result = ai_module.compose_ai_build(catalog, 18_000_000, "gaming")

    assert result["ai_assisted"] is True
    assert result["fallback"] is False
    assert result["components"]["motherboard"]["sku"] == "mobo-ai"
    assert not [
        warning for warning in result["compatibility_warnings"]
        if warning.get("severity") == "error"
    ]


def test_repairs_ai_selected_cpu_when_no_motherboard_matches_socket(monkeypatch):
    from backend.utils import ai_build_recommendation as ai_module

    catalog = sample_components()
    catalog["cpu"].append(
        component("cpu", "cpu-lga", "Intel Core i5", 1_500_000, {"socket": "LGA1700", "brand": "Intel", "cores": 6})
    )
    catalog["motherboard"] = [
        component("motherboard", "mobo-lga", "B760M DDR5 Board", 1_700_000, {"socket": "LGA1700", "form_factor": "mATX", "ram_type": "DDR5"})
    ]
    candidates = candidates_for(catalog, motherboard="mobo-lga")
    by_sku = {
        item["sku"]: item
        for items in catalog.values()
        for item in items
    }
    candidates["cpu"] = [
        {**by_sku["cpu-ai"], "retrieval_score": 0.99},
        {**by_sku["cpu-lga"], "retrieval_score": 0.98},
    ]
    candidates["motherboard"] = [
        {**by_sku["mobo-lga"], "retrieval_score": 0.99},
    ]
    install_happy_path(
        monkeypatch,
        ai_module,
        catalog,
        candidates=candidates,
        selected=selected_skus(cpu="cpu-ai", motherboard="mobo-lga"),
    )

    result = ai_module.compose_ai_build(catalog, 18_000_000, "gaming")

    assert result["ai_assisted"] is True
    assert result["fallback"] is False
    assert result["components"]["cpu"]["sku"] == "cpu-lga"
    assert result["components"]["motherboard"]["sku"] == "mobo-lga"
    assert not [
        warning for warning in result["compatibility_warnings"]
        if warning.get("severity") == "error"
    ]


def test_falls_back_when_index_manifest_is_stale(monkeypatch):
    from backend.utils import ai_build_recommendation as ai_module

    monkeypatch.setattr(
        ai_module,
        "load_vector_index",
        lambda index_dir: SimpleNamespace(manifest={"source_catalog_hash": "old-hash"}),
    )

    result = ai_module.compose_ai_build(sample_components(), 18_000_000, "gaming")

    assert result["fallback"] is True
    assert result["fallback_reason"] == "vector_index_stale"


def test_falls_back_when_retrieval_is_incomplete(monkeypatch):
    from backend.utils import ai_build_recommendation as ai_module

    catalog = sample_components()
    incomplete = candidates_for(catalog)
    incomplete["gpu"] = []
    catalog["gpu"] = []
    install_happy_path(monkeypatch, ai_module, catalog, candidates=incomplete)

    result = ai_module.compose_ai_build(catalog, 18_000_000, "gaming")

    assert result["fallback"] is True
    assert result["fallback_reason"] == "retrieval_incomplete"


def test_falls_back_when_gemini_errors(monkeypatch):
    from backend.utils import ai_build_recommendation as ai_module

    catalog = sample_components()
    install_happy_path(monkeypatch, ai_module, catalog)
    monkeypatch.setattr(
        ai_module,
        "generate_json",
        lambda prompt, temperature=0.2: (_ for _ in ()).throw(ai_module.GeminiError("quota")),
    )

    result = ai_module.compose_ai_build(catalog, 18_000_000, "gaming")

    assert result["fallback"] is True
    assert result["fallback_reason"] == "ai_ranker_rejected"
