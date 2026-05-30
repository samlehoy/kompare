from fastapi.testclient import TestClient

from backend.app import app
from backend.gemini_client import GeminiError


client = TestClient(app)


def test_build_audit_returns_multimodal_cart_audit(monkeypatch):
    captured = {}

    def fake_prepare(raw):
        captured["raw"] = raw
        return b"prepared-jpeg", {"processed_bytes": len(raw), "width": 320, "height": 240}

    def fake_multimodal(prompt, image_bytes, *, mime_type="image/jpeg", temperature=0.2):
        captured["prompt"] = prompt
        captured["image_bytes"] = image_bytes
        captured["mime_type"] = mime_type
        captured["temperature"] = temperature
        return {
            "status": "needs_attention",
            "summary": "Good start, but the PSU is too small for the GPU target.",
            "detected_parts": [
                {
                    "slot": "cpu",
                    "name": "Ryzen 5 5600",
                    "confidence": 0.9,
                    "source": "text",
                    "extracted_specs": {"socket": "AM4"},
                },
                {
                    "slot": "gpu",
                    "name": "RTX 3060 12GB",
                    "confidence": 0.86,
                    "source": "image",
                    "extracted_specs": {"vram_gb": 12, "recommended_psu_w": 550},
                },
            ],
            "compatibility_issues": [
                {
                    "severity": "warning",
                    "title": "PSU headroom is uncertain",
                    "message": "A 450W PSU may be too tight for this GPU.",
                    "slots": ["psu", "gpu"],
                    "recommendation": "Use at least a quality 550W PSU.",
                }
            ],
            "missing_slots": ["motherboard", "ram", "case"],
            "budget_notes": ["Budget target: 1080p gaming under 12 juta."],
            "suggested_next_steps": ["Confirm motherboard model before buying."],
        }

    monkeypatch.setattr("backend.app.prepare_image", fake_prepare)
    monkeypatch.setattr("backend.app.generate_multimodal_json", fake_multimodal)

    response = client.post(
        "/build/audit",
        data={
            "goal": "Gaming 1080p under 12 juta",
            "parts_list": "CPU: Ryzen 5 5600\nGPU: RTX 3060 12GB\nPSU: 450W Bronze",
        },
        files={"image": ("cart.jpg", b"fake-image-bytes", "image/jpeg")},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["filename"] == "cart.jpg"
    assert payload["image_meta"]["processed_bytes"] == len(b"fake-image-bytes")
    assert payload["audit"]["status"] == "needs_attention"
    assert payload["audit"]["detected_parts"][0]["slot_label"] == "Processor / CPU"
    assert payload["audit"]["detected_parts"][1]["slot"] == "gpu"
    assert payload["audit"]["compatibility_issues"][0]["title"] == "PSU headroom is uncertain"
    assert "motherboard" in payload["audit"]["missing_slots"]
    assert captured["image_bytes"] == b"prepared-jpeg"
    assert captured["mime_type"] == "image/jpeg"
    assert captured["temperature"] == 0.2
    assert "Audit a PC build" in captured["prompt"]
    assert "Gaming 1080p under 12 juta" in captured["prompt"]
    assert "Ryzen 5 5600" in captured["prompt"]


def test_build_audit_supports_text_only_fallback():
    response = client.post(
        "/build/audit",
        data={
            "goal": "Gaming 1080p",
            "parts_list": "CPU: Ryzen 5 5600\nMotherboard: B450M\nRAM: 16GB DDR4 3200\nGPU: RTX 3060 12GB\nPSU: 450W Bronze",
        },
    )

    assert response.status_code == 200
    audit = response.json()["audit"]
    slots = {part["slot"] for part in audit["detected_parts"]}
    assert {"cpu", "motherboard", "ram", "gpu", "psu"}.issubset(slots)
    assert audit["status"] in {"needs_attention", "incomplete"}
    assert any(issue["slot"] == "psu" or "psu" in issue.get("slots", []) for issue in audit["compatibility_issues"])


def test_build_audit_image_only_gemini_failure_returns_actionable_fallback(monkeypatch):
    def fake_prepare(raw):
        return b"prepared-jpeg", {"processed_bytes": len(raw), "width": 320, "height": 240}

    def fake_multimodal(*_args, **_kwargs):
        raise GeminiError("Gemini multimodal call failed: 500 Not Found")

    monkeypatch.setattr("backend.app.prepare_image", fake_prepare)
    monkeypatch.setattr("backend.app.generate_multimodal_json", fake_multimodal)

    response = client.post(
        "/build/audit",
        data={"goal": "General Gaming"},
        files={"image": ("cart.jpg", b"fake-image-bytes", "image/jpeg")},
    )

    assert response.status_code == 200
    payload = response.json()
    audit = payload["audit"]
    assert payload["filename"] == "cart.jpg"
    assert audit["status"] == "incomplete"
    assert "image analysis is unavailable" in audit["summary"].lower()
    assert {"cpu", "motherboard", "ram", "gpu", "psu"}.issubset(set(audit["missing_slots"]))
    assert any("Paste the cart parts as text" in step for step in audit["suggested_next_steps"])


def test_build_audit_rejects_empty_input():
    response = client.post("/build/audit", data={"goal": ""})

    assert response.status_code == 400
    assert response.json()["detail"] == "Paste a parts list or upload a cart screenshot first."
