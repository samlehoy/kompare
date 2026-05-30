"""Audit deterministic build quality across budget presets.

This is a lightweight reporting utility for checking whether the current
runtime catalog responds sensibly to budget strategy and performance priority
controls.
"""

from __future__ import annotations

import argparse
import json
from datetime import datetime, timezone
from pathlib import Path

from backend.utils.build_pc import (
    REQUIRED_BUILD_SLOTS,
    compose_build,
    load_components,
    strategy_allocation_profile,
)


DEFAULT_BUDGETS = [
    5_000_000,
    10_000_000,
    15_000_000,
    20_000_000,
    30_000_000,
    45_000_000,
    60_000_000,
]
DEFAULT_STRATEGIES = ["value", "balanced", "maximize"]
DEFAULT_PRIORITIES = ["gaming", "productivity", "best_value", "balanced", "upgrade_friendly"]


def _component_label(component: dict | None) -> str:
    if not component:
        return "MISSING"
    name = str(component.get("name") or "").strip()
    return name[:72] + ("..." if len(name) > 72 else "")


def _component_sku(component: dict | None) -> str | None:
    if not component:
        return None
    sku = component.get("sku") or component.get("id")
    return str(sku).strip() if sku else None


def _money(value: int | float | None) -> str:
    return f"{int(value or 0):,}".replace(",", ".")


def _warning_counts(result: dict) -> tuple[int, int]:
    warnings = result.get("compatibility_warnings") or []
    errors = [warning for warning in warnings if warning.get("severity") == "error"]
    return len(warnings), len(errors)


def summarize_build(result: dict) -> dict:
    components = result.get("components") or {}
    warning_count, error_count = _warning_counts(result)
    return {
        "budget_idr": result.get("budget_idr"),
        "total_idr": result.get("total_idr"),
        "remaining_idr": result.get("remaining_idr"),
        "budget_band": (result.get("budget_band") or {}).get("key"),
        "budget_usage": result.get("budget_usage"),
        "budget_warning_codes": [
            warning.get("code") or warning.get("id")
            for warning in result.get("budget_warnings") or []
        ],
        "compatibility_warning_count": warning_count,
        "compatibility_error_count": error_count,
        "missing_required_slots": [
            slot for slot in REQUIRED_BUILD_SLOTS if not components.get(slot)
        ],
        "upgrade_suggestion_slots": [
            suggestion.get("slot")
            for suggestion in (result.get("upgrade_suggestions") or [])[:3]
        ],
        "selected_skus": {
            slot: _component_sku(component)
            for slot, component in components.items()
        },
        "selected_labels": {
            slot: _component_label(component)
            for slot, component in components.items()
        },
    }


def generate_quality_report(
    catalog: dict[str, list[dict]],
    *,
    budgets: list[int] | None = None,
    strategies: list[str] | None = None,
    priority: str = "gaming",
    spot_budget: int = 30_000_000,
) -> dict:
    budgets = budgets or DEFAULT_BUDGETS
    strategies = strategies or DEFAULT_STRATEGIES
    rows = []

    for budget in budgets:
        for strategy in strategies:
            result = compose_build(
                catalog,
                budget,
                "gaming",
                budget_strategy=strategy,
                performance_priority=priority,
                include_optional_addons=False,
            )
            summary = summarize_build(result)
            usage = summary.get("budget_usage") or {}
            rows.append(
                {
                    "budget_idr": budget,
                    "use_case": "gaming",
                    "budget_strategy": strategy,
                    "performance_priority": priority,
                    **summary,
                    "quality_flags": _quality_flags(summary, strategy),
                    "used_percent": usage.get("used_percent"),
                    "status": usage.get("status"),
                }
            )

    priority_spot_checks = []
    for spot_priority in DEFAULT_PRIORITIES:
        result = compose_build(
            catalog,
            spot_budget,
            "gaming",
            budget_strategy="balanced",
            performance_priority=spot_priority,
            include_optional_addons=False,
        )
        summary = summarize_build(result)
        usage = summary.get("budget_usage") or {}
        priority_spot_checks.append(
            {
                "budget_idr": spot_budget,
                "use_case": "gaming",
                "budget_strategy": "balanced",
                "performance_priority": spot_priority,
                **summary,
                "quality_flags": _quality_flags(summary, "balanced"),
                "used_percent": usage.get("used_percent"),
                "status": usage.get("status"),
            }
        )

    return {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "catalog": "data/components.json",
        "core_tower_only": True,
        "optional_addons_excluded": ["hdd", "monitor", "ups"],
        "allocation_profiles": {
            strategy: strategy_allocation_profile("gaming", priority, budget_strategy=strategy)
            for strategy in strategies
        },
        "rows": rows,
        "priority_spot_checks": priority_spot_checks,
    }


def _quality_flags(summary: dict, strategy: str) -> list[str]:
    flags = []
    usage = summary.get("budget_usage") or {}
    used_percent = usage.get("used_percent")
    budget = int(summary.get("budget_idr") or 0)

    if summary.get("compatibility_error_count"):
        flags.append("compatibility_error")
    if summary.get("missing_required_slots"):
        flags.append("missing_required_slot")
    if strategy == "balanced" and budget >= 10_000_000 and used_percent is not None and used_percent < 85:
        flags.append("balanced_underused_budget")
    if strategy == "maximize" and budget >= 10_000_000 and used_percent is not None and used_percent < 95:
        flags.append("maximize_underused_budget")
    return flags


def print_report(report: dict) -> None:
    print("CORE PRESET QUALITY PASS - real data/components.json")
    print("Columns: budget | strategy | used% | status | remaining | warn/error | CPU | GPU | PSU")
    print("-" * 180)

    for row in report["rows"]:
        labels = row["selected_labels"]
        usage = row.get("budget_usage") or {}
        print(
            f"Rp {_money(row['budget_idr']):>10} | "
            f"{row['budget_strategy']:<8} | "
            f"{str(usage.get('used_percent')):>5}% | "
            f"{str(usage.get('status')):<15} | "
            f"Rp {_money(row['remaining_idr']):>9} | "
            f"{row['compatibility_warning_count']}/{row['compatibility_error_count']} | "
            f"{labels.get('cpu', 'MISSING'):<49} | "
            f"{labels.get('gpu', 'MISSING'):<49} | "
            f"{labels.get('psu', 'MISSING')}"
        )

    print("\nALLOCATION PROFILES - gaming use case by strategy")
    for strategy, profile in report["allocation_profiles"].items():
        print(f"{strategy}: {profile}")

    print("\nPRIORITY SPOT CHECKS - Rp 30.000.000 balanced strategy")
    for row in report["priority_spot_checks"]:
        labels = row["selected_labels"]
        usage = row.get("budget_usage") or {}
        print(
            f"{row['performance_priority']:<17} | "
            f"used {str(usage.get('used_percent')):>5}% | "
            f"{str(usage.get('status')):<15} | "
            f"CPU: {labels.get('cpu', 'MISSING'):<49} | "
            f"GPU: {labels.get('gpu', 'MISSING'):<49} | "
            f"warn/error {row['compatibility_warning_count']}/{row['compatibility_error_count']}"
        )

    flagged = [row for row in report["rows"] if row["quality_flags"]]
    print("\nQUALITY FLAGS")
    if not flagged:
        print("No hard compatibility errors, missing required slots, or strategy usage misses found.")
        return

    for row in flagged:
        usage = row.get("budget_usage") or {}
        print(
            f"Rp {_money(row['budget_idr'])} {row['budget_strategy']}: "
            f"used {usage.get('used_percent')}%, status {usage.get('status')}, "
            f"remaining Rp {_money(row['remaining_idr'])}, flags {row['quality_flags']}, "
            f"suggested upgrades {row['upgrade_suggestion_slots']}"
        )


def main() -> None:
    parser = argparse.ArgumentParser(description="Audit budget strategy preset quality.")
    parser.add_argument("--components-file", default="data/components.json")
    parser.add_argument("--output", default=None, help="Optional JSON report output path.")
    args = parser.parse_args()

    catalog = load_components(Path(args.components_file))
    report = generate_quality_report(catalog)
    print_report(report)

    if args.output:
        output = Path(args.output)
        output.parent.mkdir(parents=True, exist_ok=True)
        output.write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding="utf-8")
        print(f"\nWrote preset quality report to {output}")


if __name__ == "__main__":
    main()
