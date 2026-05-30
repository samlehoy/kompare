"""Gemini ranking prompt and strict response parser for AI build ranking."""

from __future__ import annotations

import json
from typing import Any


class AIRankerParseError(ValueError):
    """Raised when an AI ranker response cannot be trusted."""


ALLOWED_CANDIDATE_KEYS = (
    "sku",
    "category",
    "name",
    "brand",
    "price_idr",
    "specs",
    "retrieval_score",
)

RESPONSE_SCHEMA = {
    "selected_skus": {
        "slot_key": "exact SKU copied from that slot's provided candidates"
    },
    "slot_rationales": {
        "slot_key": "short reason for choosing this SKU from the provided candidates"
    },
    "summary": "short buyer-readable build summary",
    "tradeoffs": ["short tradeoff notes"],
}

COMPACT_SPEC_KEYS = (
    "socket",
    "ram_type",
    "memory_type",
    "type",
    "cores",
    "vram_gb",
    "recommended_psu_w",
    "wattage_w",
    "capacity_gb",
    "interface",
    "form_factor",
    "max_form_factor",
)


def _candidate_view(component: dict) -> dict:
    """Return only fields Gemini may inspect for ranking."""
    return {key: component.get(key) for key in ALLOWED_CANDIDATE_KEYS}


def _clip_text(value: Any, max_chars: int = 96) -> str:
    text = str(value or "").strip()
    if len(text) <= max_chars:
        return text
    return f"{text[:max_chars - 1].rstrip()}…"


def _compact_specs(component: dict) -> str:
    specs = component.get("specs") or {}
    if not isinstance(specs, dict):
        return ""
    pairs = []
    for key in COMPACT_SPEC_KEYS:
        value = specs.get(key)
        if value not in (None, ""):
            pairs.append(f"{key}={value}")
    return ", ".join(pairs)


def _compact_candidate_line(component: dict) -> str:
    parts = [
        f"sku={component.get('sku')}",
        f"name={_clip_text(component.get('name'))}",
        f"price={component.get('price_idr')}",
    ]
    brand = str(component.get("brand") or "").strip()
    if brand:
        parts.append(f"brand={_clip_text(brand, 32)}")
    specs = _compact_specs(component)
    if specs:
        parts.append(specs)
    return "; ".join(parts)


def build_ai_ranker_prompt(
    budget_idr: int,
    use_case: str,
    candidates_by_slot: dict[str, list[dict]],
) -> str:
    """Build a grounded prompt asking Gemini to rank provided candidates only."""
    candidate_view = {
        slot: [_candidate_view(component) for component in candidates]
        for slot, candidates in candidates_by_slot.items()
    }

    return f"""You are Kompare's PC build ranking assistant.

Choose the best SKU for each slot from the provided candidate lists only.
Backend validation rejects any SKU outside the candidate list for that slot.

Hard rules:
- Choose only from provided SKUs.
- Do not invent SKUs, prices, links, specs, stock, stores, or unavailable options.
- Copy selected SKU values exactly as provided.
- Return JSON only. Do not wrap the response in markdown.
- Do not add fields outside the required response schema.

Budget IDR: {budget_idr}
Use case: {use_case}

Candidates grouped by slot:
{json.dumps(candidate_view, ensure_ascii=False, indent=2)}

Required response schema:
{json.dumps(RESPONSE_SCHEMA, ensure_ascii=False, indent=2)}
"""


def build_compact_ai_ranker_prompt(
    budget_idr: int,
    use_case: str,
    candidates_by_slot: dict[str, list[dict]],
) -> str:
    """Build a smaller ranker prompt for local models with shorter context windows."""
    lines = [
        "You are Kompare's PC build ranking assistant.",
        "Pick exactly one provided SKU per slot. Return JSON only.",
        "Do not invent SKUs. Copy SKU values exactly.",
        f"Budget IDR: {budget_idr}",
        f"Use case: {use_case}",
        "Candidates:",
    ]
    for slot, candidates in candidates_by_slot.items():
        lines.append(f"{slot}:")
        for component in candidates:
            lines.append(f"- {_compact_candidate_line(component)}")
    lines.extend(
        [
            "Required JSON keys: selected_skus, slot_rationales, summary, tradeoffs.",
            "selected_skus must be an object mapping each slot to one exact SKU.",
        ]
    )
    return "\n".join(lines)


def build_local_sku_choice_prompt(
    budget_idr: int,
    use_case: str,
    candidates_by_slot: dict[str, list[dict]],
) -> str:
    """Build an ultra-small prompt for local constrained SKU selection."""
    lines = [
        f"Pick one SKU per slot for a compatible {use_case} PC build.",
        f"Budget IDR: {budget_idr}. Return JSON only.",
    ]
    for slot, candidates in candidates_by_slot.items():
        rows = []
        for component in candidates:
            specs = _compact_specs(component)
            price = component.get("price_idr")
            parts = [str(component.get("sku") or "").strip()]
            if price not in (None, ""):
                parts.append(f"p={price}")
            if specs:
                parts.append(specs)
            rows.append(" ".join(part for part in parts if part))
        lines.append(f"{slot}: {' | '.join(rows)}")
    return "\n".join(lines)


def build_sku_choice_schema(candidates_by_slot: dict[str, list[dict]]) -> dict:
    """Build a constrained local schema where each slot can only emit known SKUs."""
    properties = {}
    required = []
    for slot, candidates in candidates_by_slot.items():
        skus = [
            str(component.get("sku") or "").strip()
            for component in candidates
            if str(component.get("sku") or "").strip()
        ]
        if not skus:
            continue
        properties[slot] = {"type": "string", "enum": skus}
        required.append(slot)
    return {
        "type": "object",
        "properties": properties,
        "required": required,
        "additionalProperties": False,
    }


def sku_choice_payload_to_ranker_response(
    payload: dict,
    candidates_by_slot: dict[str, list[dict]],
) -> dict:
    """Convert a local SKU-only response into the standard ranker payload."""
    selected_skus = {
        str(slot): str(payload.get(slot) or "").strip()
        for slot in candidates_by_slot
        if str(payload.get(slot) or "").strip()
    }
    return {
        "selected_skus": selected_skus,
        "slot_rationales": {
            slot: "Selected by local Qwen from constrained SKU choices."
            for slot in selected_skus
        },
        "summary": "Local Qwen selected one grounded SKU per required slot.",
        "tradeoffs": [
            "Human-readable rationale was generated deterministically because local Qwen uses a constrained SKU-only schema."
        ],
    }


def _candidate_skus_by_slot(candidates_by_slot: dict[str, list[dict]]) -> dict[str, set[str]]:
    return {
        slot: {
            str(component.get("sku")).strip()
            for component in candidates
            if str(component.get("sku") or "").strip()
        }
        for slot, candidates in candidates_by_slot.items()
    }


def _string_dict(value: Any) -> dict[str, str]:
    if not isinstance(value, dict):
        return {}
    return {
        str(key): str(item).strip()
        for key, item in value.items()
        if str(key).strip() and str(item).strip()
    }


def _string_list(value: Any) -> list[str]:
    if isinstance(value, list):
        return [str(item).strip() for item in value if str(item).strip()]
    if value is None:
        return []
    text = str(value).strip()
    return [text] if text else []


def parse_ai_ranker_response(
    payload: dict,
    candidates_by_slot: dict[str, list[dict]],
) -> dict:
    """Parse and validate Gemini ranker JSON against the supplied candidates."""
    if not isinstance(payload, dict):
        raise AIRankerParseError("AI ranker response must be a JSON object.")

    selected_skus = payload.get("selected_skus")
    if not isinstance(selected_skus, dict):
        raise AIRankerParseError("AI ranker response must include selected_skus object.")

    allowed_skus = _candidate_skus_by_slot(candidates_by_slot)
    clean_selected_skus: dict[str, str] = {}
    for raw_slot, raw_sku in selected_skus.items():
        slot = str(raw_slot).strip()
        sku = str(raw_sku).strip()
        if not slot or not sku:
            raise AIRankerParseError("AI ranker response contains an empty selected SKU.")
        if sku not in allowed_skus.get(slot, set()):
            raise AIRankerParseError(f"unknown SKU for slot {slot}: {sku}")
        clean_selected_skus[slot] = sku

    return {
        "selected_skus": clean_selected_skus,
        "slot_rationales": _string_dict(payload.get("slot_rationales")),
        "summary": str(payload.get("summary") or "").strip(),
        "tradeoffs": _string_list(payload.get("tradeoffs")),
    }
