from fastapi.testclient import TestClient

from backend.app import app
from backend.gemini_client import GeminiError


client = TestClient(app)


def _component(slot, sku, name, price, specs=None):
    return {
        "sku": sku,
        "id": sku,
        "category": slot,
        "name": name,
        "brand": "Kompare Test",
        "price_idr": price,
        "stock_status": "in_stock",
        "scraped_at": "2026-05-10T10:06:21.498121+00:00",
        "product_url": f"https://enterkomputer.com/detail/{sku}",
        "marketplace_links": [{"marketplace": "enterkomputer", "url": f"https://enterkomputer.com/detail/{sku}"}],
        "specs": specs or {},
        "selection_rationale": {
            "summary": f"{name} fits the current PC build.",
            "factors": ["In-stock listing", "Balanced value for the slot budget"],
        },
    }


def _build_context():
    return {
        "budget_idr": 20_000_000,
        "total_idr": 19_795_000,
        "remaining_idr": 205_000,
        "components": {
            "cpu": _component("cpu", "cpu-225f", "Intel Core Ultra 5 225F", 2_890_000, {"socket": "LGA 1851"}),
            "motherboard": _component("motherboard", "b860m", "MAXSUN B860M DDR5 Motherboard", 1_950_000, {"socket": "LGA 1851", "ram_type": "DDR5"}),
            "ram": _component("ram", "ddr5-32", "32GB DDR5 6000 Kit", 4_175_000, {"type": "DDR5", "capacity_gb": 32, "speed_mhz": 6000}),
            "gpu": _component("gpu", "rx5600", "Radeon RX 5600 12GB", 3_550_000, {"vendor": "radeon", "vram_gb": 12, "recommended_psu_w": 650}),
            "psu": _component("psu", "psu-1000", "1000W Platinum PSU", 1_696_000, {"wattage_w": 1000, "rating": "Platinum"}),
        },
        "compatibility_warnings": [],
        "compatibility_issues": [],
    }


def test_build_advisor_returns_deterministic_fallback_when_gemini_fails(monkeypatch):
    def fail_chat(*_args, **_kwargs):
        raise GeminiError("Gemini unavailable")

    monkeypatch.setattr("backend.app.generate_chat_reply", fail_chat)

    response = client.post(
        "/build/advisor",
        json={
            "mode": "build",
            "question": "Why this GPU and is the PSU enough?",
            "context": _build_context(),
            "history": [],
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["fallback"] is True
    assert "GPU" in payload["answer"]
    assert "PSU" in payload["answer"]
    assert payload["referenced_slots"] == ["gpu", "psu"]
    assert payload["evidence_cards"][0]["slot"] == "gpu"
    assert payload["evidence_cards"][0]["name"] == "Radeon RX 5600 12GB"
    assert payload["evidence_cards"][0]["price_idr"] == 3_550_000
    assert {"label": "VRAM", "value": "12 GB"} in payload["evidence_cards"][0]["specs"]
    assert "In-stock listing" in payload["evidence_cards"][0]["rationale"]
    assert payload["evidence_cards"][1]["slot"] == "psu"
    assert {"label": "Wattage", "value": "1000W"} in payload["evidence_cards"][1]["specs"]
    assert payload["suggested_questions"]


def test_build_advisor_suggests_cheaper_compatible_swaps_for_cost_questions(monkeypatch):
    def fail_chat(*_args, **_kwargs):
        raise GeminiError("Gemini unavailable")

    cheaper_gpu = _component(
        "gpu",
        "rx5500",
        "Radeon RX 5500 8GB",
        2_950_000,
        {"vendor": "radeon", "vram_gb": 8, "recommended_psu_w": 550},
    )
    expensive_gpu = _component(
        "gpu",
        "rx7900",
        "Radeon RX 7900 20GB",
        8_950_000,
        {"vendor": "radeon", "vram_gb": 20, "recommended_psu_w": 750},
    )

    monkeypatch.setattr("backend.app.generate_chat_reply", fail_chat)
    monkeypatch.setattr("backend.app.services.load_components", lambda: [cheaper_gpu, expensive_gpu])

    response = client.post(
        "/build/advisor",
        json={
            "mode": "build",
            "question": "Can I reduce the GPU price?",
            "context": _build_context(),
            "history": [],
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["referenced_slots"] == ["gpu"]
    assert len(payload["cost_saving_suggestions"]) == 1
    suggestion = payload["cost_saving_suggestions"][0]
    assert suggestion["slot"] == "gpu"
    assert suggestion["current"]["sku"] == "rx5600"
    assert suggestion["candidate"]["sku"] == "rx5500"
    assert suggestion["candidate"]["name"] == "Radeon RX 5500 8GB"
    assert suggestion["savings_idr"] == 600_000
    assert suggestion["projected_total_idr"] == 19_195_000
    assert suggestion["projected_remaining_idr"] == 805_000
    assert suggestion["compatibility_summary"]
    assert suggestion["compatibility_warnings"] == []


def test_build_advisor_stays_scoped_to_pc_builder_topics(monkeypatch):
    def fail_chat(*_args, **_kwargs):
        raise GeminiError("Gemini unavailable")

    monkeypatch.setattr("backend.app.generate_chat_reply", fail_chat)

    response = client.post(
        "/build/advisor",
        json={
            "mode": "build",
            "question": "Can you recommend a laptop instead?",
            "context": _build_context(),
            "history": [],
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["fallback"] is True
    assert "PC build" in payload["answer"]
    assert "laptop" in payload["answer"].lower()


def test_build_advisor_uses_grounded_gemini_prompt_when_available(monkeypatch):
    captured = {}

    def fake_chat(messages, *, system_instruction=None, temperature=0.6):
        captured["messages"] = messages
        captured["system_instruction"] = system_instruction
        captured["temperature"] = temperature
        return "The RX 5600 is the value pick here, and the 1000W PSU has enough headroom."

    monkeypatch.setattr("backend.app.generate_chat_reply", fake_chat)

    response = client.post(
        "/build/advisor",
        json={
            "mode": "build",
            "question": "Explain the GPU choice.",
            "context": _build_context(),
            "history": [{"role": "assistant", "content": "I can explain this build."}],
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["fallback"] is False
    assert "RX 5600" in payload["answer"]
    assert payload["referenced_slots"] == ["gpu"]
    assert payload["evidence_cards"][0]["slot"] == "gpu"
    assert payload["evidence_cards"][0]["stock_label"] == "In stock"
    assert captured["temperature"] == 0.3
    assert "Radeon RX 5600 12GB" in captured["system_instruction"]
    assert "Selection rationale" in captured["system_instruction"]
    assert "Do not recommend laptops" in captured["system_instruction"]
    assert captured["messages"][-1]["content"] == "Explain the GPU choice."
