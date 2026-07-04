"""Prompt and fallback helpers for the PC Build Advisor.

The advisor is intentionally narrower than the legacy generic chat endpoint.
It can only discuss the active build or upgrade result supplied by the UI.
"""

from __future__ import annotations

import re
from typing import Iterable


SLOT_LABELS = {
    "cpu": "CPU",
    "motherboard": "Motherboard",
    "ram": "RAM",
    "gpu": "GPU",
    "ssd": "SSD",
    "hdd": "HDD",
    "psu": "PSU",
    "cpu_cooler": "CPU cooler",
    "fan_cooler": "Fan cooler",
    "case": "Casing",
    "monitor": "Monitor",
    "ups": "UPS",
}

SLOT_KEYWORDS = {
    "cpu": ("cpu", "processor", "core", "ryzen", "intel"),
    "motherboard": ("motherboard", "mobo", "socket", "chipset", "board"),
    "ram": ("ram", "memory", "ddr", "gb"),
    "gpu": ("gpu", "vga", "graphics", "graphic", "vram", "geforce", "radeon", "rtx", "rx"),
    "ssd": ("ssd", "nvme", "storage"),
    "hdd": ("hdd", "hard drive", "hard disk"),
    "psu": ("psu", "power supply", "watt", "wattage", "headroom"),
    "cpu_cooler": ("cpu cooler", "cooler", "thermal", "tdp"),
    "fan_cooler": ("fan", "airflow"),
    "case": ("case", "casing", "form factor"),
    "monitor": ("monitor", "display", "screen"),
    "ups": ("ups", "va", "backup power"),
}

SUMMARY_KEYS = {
    "cpu": ("socket", "cores", "threads", "base_clock_ghz", "tdp_w"),
    "motherboard": ("socket", "form_factor", "ram_type", "chipset"),
    "ram": ("type", "capacity_gb", "speed_mhz", "module_count", "modules"),
    "gpu": ("vram_gb", "vendor", "recommended_psu_w", "tdp_w"),
    "ssd": ("capacity_gb", "interface", "form_factor"),
    "hdd": ("capacity_gb", "interface", "form_factor_in"),
    "psu": ("wattage_w", "rating", "modular"),
    "cpu_cooler": ("type", "tdp_w", "fan_size_mm"),
    "fan_cooler": ("type", "fan_size_mm"),
    "case": ("form_factor", "max_form_factor", "color"),
    "monitor": ("size_in", "refresh_rate_hz", "resolution"),
    "ups": ("capacity_va", "wattage_w"),
}

SPEC_LABELS = {
    "socket": "Socket",
    "cores": "Cores",
    "threads": "Threads",
    "base_clock_ghz": "Base clock",
    "tdp_w": "TDP",
    "form_factor": "Form factor",
    "max_form_factor": "Fits board",
    "ram_type": "Memory type",
    "chipset": "Chipset",
    "type": {
        "ram": "Memory type",
        "cpu_cooler": "Cooler type",
        "fan_cooler": "Fan type",
    },
    "capacity_gb": {
        "ram": "Capacity",
        "ssd": "Capacity",
        "hdd": "Capacity",
    },
    "speed_mhz": "Speed",
    "module_count": "Modules",
    "modules": "Modules",
    "vram_gb": "VRAM",
    "vendor": "GPU vendor",
    "recommended_psu_w": "PSU target",
    "wattage_w": "Wattage",
    "rating": "Efficiency",
    "modular": "Modular",
    "fan_size_mm": "Fan size",
    "interface": "Interface",
    "form_factor_in": "Drive size",
    "color": "Color",
    "size_in": "Size",
    "refresh_rate_hz": "Refresh rate",
    "resolution": "Resolution",
    "capacity_va": "Capacity",
}

OUT_OF_SCOPE_TERMS = (
    "laptop",
    "notebook",
    "phone",
    "smartphone",
    "tablet",
    "camera",
    "speaker",
    "headset",
    "printer",
    "gadget",
)


def spec_label(slot: str, key: str) -> str:
    label = SPEC_LABELS.get(key)
    if isinstance(label, dict):
        return label.get(slot) or key.replace("_", " ")
    return label or key.replace("_", " ")


def format_spec_value(key: str, value) -> str:
    if key in {"wattage_w", "tdp_w", "recommended_psu_w"}:
        return f"{value}W"
    if key in {"capacity_gb", "vram_gb"}:
        return f"{value} GB"
    if key == "speed_mhz":
        return f"{value} MHz"
    if key == "fan_size_mm":
        return f"{value} mm"
    if key == "base_clock_ghz":
        return f"{value} GHz"
    if key == "form_factor_in":
        return f'{value}"'
    if key == "size_in":
        return f'{value}"'
    if key == "refresh_rate_hz":
        return f"{value} Hz"
    if key == "capacity_va":
        return f"{value} VA"
    if isinstance(value, bool):
        return "yes" if value else "no"
    return str(value)


def stock_label(status: str | None) -> str:
    normalized = str(status or "").strip().lower()
    if not normalized:
        return "Stock unknown"
    if normalized in {"in_stock", "instock", "ready", "available", "stock"}:
        return "In stock"
    if normalized in {"out_of_stock", "outofstock", "sold_out", "empty", "habis"}:
        return "Out of stock"
    if "pre" in normalized:
        return "Preorder"
    return normalized.replace("_", " ").title()


def spec_summary(slot: str, specs: dict) -> list[dict]:
    out = []
    for key in SUMMARY_KEYS.get(slot, tuple(specs.keys())):
        value = specs.get(key)
        if value in (None, "", []):
            continue
        out.append({"label": spec_label(slot, key), "value": format_spec_value(key, value)})
        if len(out) >= 4:
            break
    return out


def rationale_lines(component: dict) -> list[str]:
    rationale = component.get("selection_rationale") or {}
    lines = []
    if rationale.get("summary"):
        lines.append(str(rationale["summary"]))
    for factor in rationale.get("factors") or []:
        if factor and factor not in lines:
            lines.append(str(factor))
    return lines[:4]


def compact_component(slot: str, component: dict | None) -> str | None:
    if not component:
        return None
    specs = component.get("specs") or {}
    spec_bits = [f"{item['label']}={item['value']}" for item in spec_summary(slot, specs)]
    suffix = f" ({', '.join(spec_bits)})" if spec_bits else ""
    rationale = rationale_lines(component)
    rationale_suffix = f"; Selection rationale: {'; '.join(rationale[:2])}" if rationale else ""
    return (
        f"{SLOT_LABELS.get(slot, slot)}: {component.get('name')} - "
        f"Rp {component.get('price_idr', 0):,}; {stock_label(component.get('stock_status'))}{suffix}"
        f"{rationale_suffix}"
    )


def extract_components(context: dict) -> dict:
    if isinstance(context.get("components"), dict):
        return context.get("components") or {}
    recommendation = context.get("recommendation") or {}
    if isinstance(recommendation.get("components"), dict):
        return recommendation.get("components") or {}
    return {}


def detect_referenced_slots(question: str, context: dict | None = None) -> list[str]:
    text = (question or "").lower()
    found: list[str] = []
    for slot, keywords in SLOT_KEYWORDS.items():
        if any(keyword in text for keyword in keywords):
            found.append(slot)

    if context:
        for warning in context.get("compatibility_warnings") or []:
            for slot in warning.get("slots") or [warning.get("slot")]:
                if slot and slot not in found:
                    found.append(slot)
    return found


def is_out_of_scope(question: str) -> bool:
    text = (question or "").lower()
    return any(re.search(rf"\b{re.escape(term)}s?\b", text) for term in OUT_OF_SCOPE_TERMS)


def evidence_cards(context: dict, referenced_slots: Iterable[str]) -> list[dict]:
    components = extract_components(context)
    cards = []
    for slot in referenced_slots:
        component = components.get(slot)
        if not component:
            continue
        cards.append(
            {
                "slot": slot,
                "label": SLOT_LABELS.get(slot, slot),
                "sku": component.get("sku") or component.get("id"),
                "name": component.get("name"),
                "brand": component.get("brand"),
                "price_idr": component.get("price_idr") or 0,
                "stock_label": stock_label(component.get("stock_status")),
                "specs": spec_summary(slot, component.get("specs") or {}),
                "rationale": rationale_lines(component),
            }
        )
    return cards


def build_context_summary(mode: str, context: dict) -> str:
    components = extract_components(context)
    lines = [
        f"Mode: {mode}",
        f"Budget IDR: {context.get('budget_idr')}",
        f"Total IDR: {context.get('total_idr') or (context.get('recommendation') or {}).get('total_idr')}",
        f"Remaining IDR: {context.get('remaining_idr')}",
        "Components:",
    ]
    for slot in SLOT_LABELS:
        line = compact_component(slot, components.get(slot))
        if line:
            lines.append(f"- {line}")

    priorities = context.get("upgrade_priorities") or []
    if priorities:
        lines.append("Upgrade priorities:")
        for item in priorities[:5]:
            lines.append(f"- {item.get('slot')}: {item.get('title')} | {item.get('reason')}")

    warnings = context.get("compatibility_warnings") or []
    if warnings:
        lines.append("Compatibility warnings:")
        for warning in warnings[:5]:
            lines.append(f"- {warning.get('severity')}: {warning.get('title')} - {warning.get('message')}")
    else:
        lines.append("Compatibility warnings: none")

    return "\n".join(lines)


def build_advisor_system_instruction(mode: str, context: dict) -> str:
    return (
        "You are Kompare's PC Build Advisor. Answer only about the active PC build or upgrade context.\n"
        "Use the provided context as source of truth. Do not invent parts, prices, stock, or marketplace links.\n"
        "Do not recommend laptops, notebooks, gadgets, phones, broad electronics, or unrelated shopping categories.\n"
        "If the user asks outside PC building, briefly steer them back to the active PC build.\n"
        "Be concise, practical, and buyer-readable. Mention compatibility warnings when relevant.\n\n"
        f"ACTIVE CONTEXT:\n{build_context_summary(mode, context)}"
    )


def suggested_questions(mode: str, referenced_slots: Iterable[str]) -> list[str]:
    slots = set(referenced_slots)
    if "gpu" in slots:
        return ["Can I get better GPU value?", "Is the PSU enough for this GPU?", "What would you downgrade to save budget?"]
    if "psu" in slots:
        return ["How much PSU headroom do I have?", "Is the UPS sized correctly?", "Can I use a cheaper PSU?"]
    if mode == "upgrade":
        return ["What should I upgrade first?", "What can wait until later?", "Any compatibility risks?"]
    return ["Why this component mix?", "Can I reduce the total price?", "What is the first future upgrade?"]


def fallback_answer(mode: str, question: str, context: dict) -> str:
    if is_out_of_scope(question):
        return (
            "I can only help with the active PC build or PC upgrade in Kompare. "
            "I cannot recommend laptops, gadgets, or unrelated electronics here. "
            "For this PC build, ask about compatibility, budget tradeoffs, upgrade priority, or a selected component."
        )

    components = extract_components(context)
    referenced = detect_referenced_slots(question, context)
    lines = []
    if not referenced:
        total = context.get("total_idr") or (context.get("recommendation") or {}).get("total_idr")
        budget = context.get("budget_idr")
        lines.append(f"This {mode} recommendation is grounded in the current component list and budget.")
        if total and budget:
            lines.append(f"It uses Rp {total:,} from a Rp {budget:,} budget.")
        priorities = context.get("upgrade_priorities") or []
        if priorities:
            lines.append(f"The top upgrade priority is {priorities[0].get('title')}: {priorities[0].get('reason')}")
    else:
        for slot in referenced:
            component = components.get(slot)
            if not component:
                continue
            label = SLOT_LABELS.get(slot, slot)
            specs = spec_summary(slot, component.get("specs") or {})
            spec_text = ", ".join(f"{item['label']} {item['value']}" for item in specs[:3])
            detail = (
                f"{label}: {component.get('name')} at Rp {component.get('price_idr', 0):,} "
                f"({stock_label(component.get('stock_status'))})."
            )
            if spec_text:
                detail += f" Key specs: {spec_text}."
            lines.append(detail)
            rationale = rationale_lines(component)
            if rationale:
                lines.append(f"Why it fits: {' '.join(rationale[:2])}")

    warnings = context.get("compatibility_warnings") or []
    if warnings:
        lines.append(f"Compatibility note: {warnings[0].get('title')} - {warnings[0].get('message')}")
    elif referenced:
        lines.append("No compatibility warnings are attached to these referenced parts in the current result.")

    return " ".join(lines).strip() or "Ask me about the active PC build, upgrade priorities, compatibility, or budget tradeoffs."
