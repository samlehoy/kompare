"""PC Builder build-audit prompt and normalizer."""

from __future__ import annotations

import json
from typing import Any


SLOT_LABELS = {
    "cpu": "Processor / CPU",
    "motherboard": "Motherboard",
    "ram": "RAM",
    "gpu": "VGA / GPU",
    "ssd": "SSD",
    "hdd": "Hard Drive / HDD",
    "psu": "PSU",
    "cpu_cooler": "CPU Cooler",
    "fan_cooler": "Fan Cooler",
    "case": "Casing",
    "monitor": "Monitor",
    "ups": "UPS",
    "unknown": "Unknown",
}

SUPPORTED_SLOTS = set(SLOT_LABELS) - {"unknown"}

SCHEMA = {
    "status": "compatible | needs_attention | incomplete",
    "summary": "short buyer-readable audit summary",
    "detected_parts": [
        {
            "slot": "cpu | motherboard | ram | gpu | ssd | hdd | psu | cpu_cooler | fan_cooler | case | monitor | ups | unknown",
            "name": "detected component name",
            "confidence": "number from 0.0 to 1.0",
            "source": "image | text | image_and_text",
            "extracted_specs": "object of compatibility-relevant specs only",
        }
    ],
    "compatibility_issues": [
        {
            "severity": "info | warning | error",
            "title": "issue title",
            "message": "plain-language issue",
            "slots": ["affected slot keys"],
            "recommendation": "what the buyer should do next",
        }
    ],
    "missing_slots": ["required PC Builder slots not found"],
    "budget_notes": ["budget or value notes"],
    "suggested_next_steps": ["specific next actions"],
}


def build_build_audit_prompt(goal: str | None = None, parts_list: str | None = None) -> str:
    goal_block = f"\nUSER GOAL: {goal.strip()}" if goal and goal.strip() else ""
    parts_block = f"\nTYPED PARTS LIST:\n{parts_list.strip()}" if parts_list and parts_list.strip() else ""
    return f"""Audit a PC build from a cart screenshot and optional typed parts list.

Return one JSON object matching the schema. This is a PC Builder audit, not a generic product identifier.

Rules:
- Detect PC component slots: CPU, motherboard, RAM, VGA/GPU, SSD, HDD, PSU, CPU cooler, fan cooler, casing, monitor, UPS.
- Check compatibility risks: CPU socket, motherboard socket, RAM generation, PSU headroom, motherboard/case fit, cooler context, storage interface, monitor target, and UPS wattage/VA.
- Report missing required tower slots: CPU, motherboard, RAM, GPU, SSD, HDD, PSU, CPU cooler, fan cooler, casing.
- Use image evidence and typed text together, but do not invent exact specs when neither source supports them.
- Keep the output grounded in the provided cart/list. Do not recommend laptops, prebuilt desktops, phones, printers, speakers, software, or unrelated electronics.
- Do not wrap output in markdown. Do not add fields outside the schema.{goal_block}{parts_block}

SCHEMA:
{json.dumps(SCHEMA, ensure_ascii=False, indent=2)}
"""


def _normalize_slot(value: Any) -> str:
    raw = str(value or "").strip().lower().replace("-", "_").replace(" ", "_")
    aliases = {
        "processor": "cpu",
        "vga": "gpu",
        "graphics": "gpu",
        "graphics_card": "gpu",
        "hard_drive": "hdd",
        "hard_disk": "hdd",
        "casing": "case",
        "cooler": "cpu_cooler",
        "cpu_fan": "cpu_cooler",
        "case_fan": "fan_cooler",
        "fan": "fan_cooler",
        "memory": "ram",
    }
    raw = aliases.get(raw, raw)
    return raw if raw in SUPPORTED_SLOTS else "unknown"


def _normalize_confidence(value: Any) -> float:
    try:
        confidence = float(value)
    except (TypeError, ValueError):
        return 0.0
    if confidence > 1 and confidence <= 10:
        confidence /= 10
    return max(0.0, min(1.0, confidence))


def _normalize_list(value: Any) -> list[str]:
    if isinstance(value, list):
        return [str(item).strip() for item in value if str(item).strip()]
    if isinstance(value, str) and value.strip():
        return [value.strip()]
    return []


def _normalize_specs(value: Any) -> dict:
    return value if isinstance(value, dict) else {}


def normalize_build_audit(result: dict) -> dict:
    result = result if isinstance(result, dict) else {}
    detected_parts = []
    seen: set[tuple[str, str]] = set()

    for item in result.get("detected_parts") or []:
        if not isinstance(item, dict):
            continue
        slot = _normalize_slot(item.get("slot"))
        name = str(item.get("name") or item.get("name_guess") or "").strip()
        if not name:
            continue
        key = (slot, name.lower())
        if key in seen:
            continue
        seen.add(key)
        detected_parts.append({
            "slot": slot,
            "slot_label": SLOT_LABELS.get(slot, SLOT_LABELS["unknown"]),
            "name": name,
            "confidence": _normalize_confidence(item.get("confidence")),
            "source": str(item.get("source") or "text").strip() or "text",
            "extracted_specs": _normalize_specs(item.get("extracted_specs")),
        })

    issues = []
    for item in result.get("compatibility_issues") or []:
        if not isinstance(item, dict):
            continue
        slots = [_normalize_slot(slot) for slot in _normalize_list(item.get("slots") or item.get("slot"))]
        slots = [slot for slot in slots if slot != "unknown"]
        severity = str(item.get("severity") or "info").lower()
        if severity not in {"info", "warning", "error"}:
            severity = "info"
        issues.append({
            "severity": severity,
            "slot": slots[0] if slots else None,
            "slots": slots,
            "title": str(item.get("title") or "Build audit note").strip(),
            "message": str(item.get("message") or "").strip(),
            "recommendation": str(item.get("recommendation") or "").strip(),
        })

    missing_slots = [
        slot for slot in [_normalize_slot(slot) for slot in _normalize_list(result.get("missing_slots"))]
        if slot != "unknown"
    ]
    status = str(result.get("status") or "").strip().lower()
    if status not in {"compatible", "needs_attention", "incomplete"}:
        status = "needs_attention" if issues else "incomplete" if missing_slots else "compatible"

    return {
        "status": status,
        "summary": str(result.get("summary") or "Build audit completed.").strip(),
        "detected_parts": detected_parts,
        "compatibility_issues": issues,
        "missing_slots": sorted(set(missing_slots)),
        "budget_notes": _normalize_list(result.get("budget_notes")),
        "suggested_next_steps": _normalize_list(result.get("suggested_next_steps")),
    }
