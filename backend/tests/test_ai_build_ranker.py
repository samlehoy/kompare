import pytest

from backend.prompts.ai_build_ranker import (
    AIRankerParseError,
    build_local_sku_choice_prompt,
    build_sku_choice_schema,
    build_compact_ai_ranker_prompt,
    build_ai_ranker_prompt,
    parse_ai_ranker_response,
    sku_choice_payload_to_ranker_response,
)


def _candidates():
    return {
        "cpu": [
            {
                "sku": "CPU-R5-5600",
                "category": "cpu",
                "name": "AMD Ryzen 5 5600",
                "brand": "AMD",
                "price_idr": 1850000,
                "specs": {"socket": "AM4", "cores": 6},
                "retrieval_score": 0.94,
                "merchant_url": "https://example.invalid/cpu",
            }
        ],
        "gpu": [
            {
                "sku": "GPU-RX-6600",
                "category": "gpu",
                "name": "Radeon RX 6600 8GB",
                "brand": "Sapphire",
                "price_idr": 3050000,
                "specs": {"vram_gb": 8},
                "retrieval_score": 0.91,
            }
        ],
    }


def test_prompt_includes_candidate_sku_budget_and_grounding_rule():
    prompt = build_ai_ranker_prompt(
        budget_idr=9000000,
        use_case="1080p gaming",
        candidates_by_slot=_candidates(),
    )

    assert "CPU-R5-5600" in prompt
    assert "9000000" in prompt
    assert "Choose only from provided SKUs" in prompt
    assert "merchant_url" not in prompt


def test_compact_prompt_clips_long_names_and_keeps_critical_specs():
    candidates = {
        "cpu": [
            {
                "sku": "CPU-LONG",
                "category": "cpu",
                "name": "AMD Ryzen 7 8700F " + ("very long warranty bundle " * 20),
                "brand": "AMD",
                "price_idr": 2_375_000,
                "specs": {
                    "socket": "AM5",
                    "cores": 8,
                    "ram_type": "DDR5",
                    "irrelevant_marketplace_noise": "x" * 500,
                },
                "retrieval_score": 0.60910916,
            }
        ],
    }

    prompt = build_compact_ai_ranker_prompt(
        budget_idr=20_000_000,
        use_case="gaming",
        candidates_by_slot=candidates,
    )

    assert len(prompt) < 1400
    assert "CPU-LONG" in prompt
    assert "socket=AM5" in prompt
    assert "cores=8" in prompt
    assert "ram_type=DDR5" in prompt
    assert "irrelevant_marketplace_noise" not in prompt
    assert "very long warranty bundle " * 5 not in prompt


def test_local_sku_choice_prompt_is_tiny_and_omits_long_product_names():
    candidates = {
        "cpu": [
            {
                "sku": "CPU-AM5",
                "name": "AMD Ryzen 7 8700F " + ("very long warranty bundle " * 20),
                "price_idr": 2_375_000,
                "specs": {"socket": "AM5", "ram_type": "DDR5", "cores": 8},
            },
            {
                "sku": "CPU-LGA1851",
                "name": "Intel Core Ultra",
                "price_idr": 2_890_000,
                "specs": {"socket": "LGA 1851", "ram_type": "DDR5", "cores": 14},
            },
        ],
        "motherboard": [
            {
                "sku": "MOBO-AM5",
                "name": "B650M Board",
                "price_idr": 1_950_000,
                "specs": {"socket": "AM5", "ram_type": "DDR5", "form_factor": "ATX"},
            }
        ],
    }

    prompt = build_local_sku_choice_prompt(
        budget_idr=20_000_000,
        use_case="gaming",
        candidates_by_slot=candidates,
    )

    assert len(prompt) < 700
    assert "CPU-AM5" in prompt
    assert "socket=AM5" in prompt
    assert "very long warranty bundle" not in prompt
    assert "Pick one SKU per slot" in prompt


def test_sku_choice_schema_constrains_each_slot_to_candidate_sku_enums():
    schema = build_sku_choice_schema(_candidates())

    assert schema["additionalProperties"] is False
    assert schema["properties"]["cpu"]["enum"] == ["CPU-R5-5600"]
    assert schema["properties"]["gpu"]["enum"] == ["GPU-RX-6600"]
    assert schema["required"] == ["cpu", "gpu"]


def test_sku_choice_payload_is_converted_to_standard_ranker_response():
    payload = {"cpu": "CPU-R5-5600", "gpu": "GPU-RX-6600"}

    ranker_payload = sku_choice_payload_to_ranker_response(payload, _candidates())

    assert ranker_payload["selected_skus"] == payload
    assert ranker_payload["summary"] == "Local Qwen selected one grounded SKU per required slot."
    assert ranker_payload["slot_rationales"]["cpu"] == "Selected by local Qwen from constrained SKU choices."
    assert ranker_payload["tradeoffs"] == [
        "Human-readable rationale was generated deterministically because local Qwen uses a constrained SKU-only schema."
    ]


def test_parser_accepts_known_skus():
    payload = {
        "selected_skus": {"cpu": "CPU-R5-5600", "gpu": "GPU-RX-6600"},
        "slot_rationales": {"cpu": "Good value", "gpu": 1080},
        "summary": "Balanced build",
        "tradeoffs": ["AM4 platform", 8],
    }

    parsed = parse_ai_ranker_response(payload, _candidates())

    assert parsed == {
        "selected_skus": {"cpu": "CPU-R5-5600", "gpu": "GPU-RX-6600"},
        "slot_rationales": {"cpu": "Good value", "gpu": "1080"},
        "summary": "Balanced build",
        "tradeoffs": ["AM4 platform", "8"],
    }


def test_parser_rejects_unknown_sku():
    payload = {"selected_skus": {"cpu": "CPU-IMAGINARY"}}

    with pytest.raises(AIRankerParseError, match="unknown SKU"):
        parse_ai_ranker_response(payload, _candidates())


@pytest.mark.parametrize("payload", [None, [], "not-json-object"])
def test_parser_rejects_malformed_non_dict_payload(payload):
    with pytest.raises(AIRankerParseError):
        parse_ai_ranker_response(payload, _candidates())


def test_parser_rejects_missing_selected_skus():
    with pytest.raises(AIRankerParseError):
        parse_ai_ranker_response({"summary": "No picks"}, _candidates())


def test_parser_drops_invented_price_link_and_specs_fields():
    payload = {
        "selected_skus": {"cpu": "CPU-R5-5600"},
        "slot_rationales": {"cpu": "Known candidate"},
        "summary": "Grounded pick",
        "tradeoffs": "No invented fields survive",
        "price_idr": 1,
        "link": "https://invented.invalid",
        "specs": {"socket": "LGA9999"},
        "components": {"cpu": {"sku": "CPU-R5-5600", "price_idr": 1}},
    }

    parsed = parse_ai_ranker_response(payload, _candidates())

    assert set(parsed) == {"selected_skus", "slot_rationales", "summary", "tradeoffs"}
    assert parsed["selected_skus"] == {"cpu": "CPU-R5-5600"}
    assert parsed["tradeoffs"] == ["No invented fields survive"]
