from __future__ import annotations

import argparse
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from backend.utils.ai_build_recommendation import compose_ai_build
from backend.utils.ai_rag_chunks import catalog_hash
from backend.utils.build_pc import BUDGET_TIERS, compose_build


def _flat_components(by_category: dict[str, list[dict]]) -> list[dict]:
    return [
        component
        for components in by_category.values()
        for component in components
    ]


def _scenario_budget(tier: dict) -> int:
    if tier["key"] == "custom":
        return 20_000_000
    min_idr = int(tier["min_idr"])
    max_idr = tier.get("max_idr")
    if max_idr:
        return int((min_idr + int(max_idr)) / 2)
    return min_idr


def default_scenarios() -> list[dict[str, Any]]:
    scenarios = []
    for tier in BUDGET_TIERS:
        key = "custom_budget" if tier["key"] == "custom" else tier["key"]
        scenarios.append(
            {
                "key": key,
                "label": tier["label"],
                "budget_idr": _scenario_budget(tier),
                "use_case": "gaming",
            }
        )
    return scenarios


def _component_sku(component: dict | None) -> str | None:
    if not component:
        return None
    sku = component.get("sku") or component.get("id")
    return str(sku).strip() if sku else None


def _selected_skus(result: dict) -> dict[str, str | None]:
    components = result.get("components") or {}
    return {
        slot: _component_sku(component)
        for slot, component in components.items()
    }


def summarize_result(result: dict) -> dict:
    warnings = result.get("compatibility_warnings") or []
    summary = {
        "budget_idr": result.get("budget_idr"),
        "use_case": result.get("use_case"),
        "total_idr": result.get("total_idr"),
        "remaining_idr": result.get("remaining_idr"),
        "selected_skus": _selected_skus(result),
        "warning_ids": [
            warning.get("id")
            for warning in warnings
            if warning.get("id")
        ],
        "error_warning_ids": [
            warning.get("id")
            for warning in warnings
            if warning.get("id") and warning.get("severity") == "error"
        ],
        "validation_source": result.get("validation_source", "deterministic"),
    }
    if "ai_assisted" in result:
        summary["ai_assisted"] = result.get("ai_assisted")
        summary["fallback"] = result.get("fallback")
        summary["fallback_reason"] = result.get("fallback_reason")
    if result.get("retrieval"):
        summary["retrieval"] = result["retrieval"]
    if result.get("ai_rationale"):
        summary["ai_rationale"] = result["ai_rationale"]
    return summary


def generate_comparison_report(
    by_category: dict[str, list[dict]],
    *,
    profile_name: str | None = None,
    scenarios: list[dict[str, Any]] | None = None,
    generated_at: str | None = None,
) -> dict:
    scenarios = scenarios or default_scenarios()
    rows = []
    for scenario in scenarios:
        budget = int(scenario["budget_idr"])
        use_case = str(scenario.get("use_case") or "gaming")
        deterministic = compose_build(
            by_category,
            budget,
            use_case,
            include_optional_addons=False,
        )
        ai_result = compose_ai_build(
            by_category,
            budget,
            use_case,
            include_optional_addons=False,
            profile_name=profile_name,
        )
        rows.append(
            {
                "key": scenario["key"],
                "label": scenario["label"],
                "budget_idr": budget,
                "use_case": use_case,
                "deterministic": summarize_result(deterministic),
                "ai": summarize_result(ai_result),
                "delta_total_idr": (ai_result.get("total_idr") or 0) - (deterministic.get("total_idr") or 0),
            }
        )

    return {
        "generated_at": generated_at or datetime.now(timezone.utc).isoformat(),
        "profile": profile_name or "default",
        "catalog_hash": catalog_hash(_flat_components(by_category)),
        "scenario_count": len(rows),
        "scenarios": rows,
    }


def write_comparison_report(report: dict, output_path: Path) -> Path:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(
        json.dumps(report, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )
    return output_path


def main() -> None:
    from backend import services

    parser = argparse.ArgumentParser(description="Compare deterministic and AI-assisted PC build outputs.")
    parser.add_argument("--profile", default=None, help="AI provider profile, for example local_qwen or gemini_free.")
    parser.add_argument(
        "--output",
        default="data/ai_comparison_report.json",
        help="JSON report output path.",
    )
    args = parser.parse_args()

    report = generate_comparison_report(
        services.components_by_category(),
        profile_name=args.profile,
    )
    written = write_comparison_report(report, Path(args.output))
    print(f"Wrote AI comparison report to {written}")


if __name__ == "__main__":
    main()
