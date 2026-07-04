import json


def test_generate_comparison_report_summarizes_deterministic_and_ai_results(monkeypatch):
    from backend.utils import ai_build_comparison as comparison

    catalog = {"cpu": [{"sku": "cpu-1", "category": "cpu", "price_idr": 1_000_000}]}

    def fake_compose_build(by_category, budget, use_case, **kwargs):
        assert by_category is catalog
        return {
            "budget_idr": budget,
            "use_case": use_case,
            "total_idr": budget - 500_000,
            "remaining_idr": 500_000,
            "components": {
                "cpu": {"sku": f"det-cpu-{budget}", "price_idr": 1_000_000},
                "gpu": None,
            },
            "compatibility_warnings": [],
            "compatibility_issues": [],
            "validation_source": "deterministic",
        }

    def fake_compose_ai_build(by_category, budget, use_case, **kwargs):
        assert by_category is catalog
        assert kwargs["profile_name"] == "local_qwen"
        return {
            "budget_idr": budget,
            "use_case": use_case,
            "total_idr": budget - 250_000,
            "remaining_idr": 250_000,
            "components": {
                "cpu": {"sku": f"ai-cpu-{budget}", "price_idr": 1_100_000},
                "gpu": {"sku": f"ai-gpu-{budget}", "price_idr": 3_000_000},
            },
            "compatibility_warnings": [{"id": "psu_headroom_low", "severity": "warning"}],
            "compatibility_issues": ["PSU wattage is below GPU recommendation."],
            "ai_assisted": True,
            "fallback": False,
            "retrieval": {"profile": "local_qwen", "ranker_mode": "retrieval_score_fallback"},
            "ai_rationale": {"summary": "AI picked stronger GPU value.", "tradeoffs": ["Uses more budget."]},
            "validation_source": "deterministic",
        }

    monkeypatch.setattr(comparison, "compose_build", fake_compose_build)
    monkeypatch.setattr(comparison, "compose_ai_build", fake_compose_ai_build)
    monkeypatch.setattr(comparison, "catalog_hash", lambda components: "hash-123")

    report = comparison.generate_comparison_report(
        catalog,
        profile_name="local_qwen",
        generated_at="2026-05-22T00:00:00+00:00",
    )

    assert report["profile"] == "local_qwen"
    assert report["catalog_hash"] == "hash-123"
    assert report["scenario_count"] == 4
    assert [scenario["key"] for scenario in report["scenarios"]] == [
        "entry_level",
        "mid_range",
        "high_end",
        "custom_budget",
    ]
    first = report["scenarios"][0]
    assert first["deterministic"]["selected_skus"]["cpu"].startswith("det-cpu-")
    assert first["deterministic"]["selected_skus"]["gpu"] is None
    assert first["ai"]["selected_skus"]["gpu"].startswith("ai-gpu-")
    assert first["ai"]["ai_assisted"] is True
    assert first["ai"]["retrieval"]["ranker_mode"] == "retrieval_score_fallback"
    assert first["delta_total_idr"] == 250_000
    assert first["ai"]["warning_ids"] == ["psu_headroom_low"]


def test_write_comparison_report_creates_json_file(tmp_path):
    from backend.utils import ai_build_comparison as comparison

    report = {"profile": "local_qwen", "scenarios": []}
    output = tmp_path / "comparison.json"

    written = comparison.write_comparison_report(report, output)

    assert written == output
    assert json.loads(output.read_text(encoding="utf-8")) == report
