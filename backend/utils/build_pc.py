"""Custom PC build composer.

Given a budget (IDR) and use case, picks compatible components from
data/components.json and outputs a balanced build.

Usage:
    python backend/utils/build_pc.py --budget 20000000 --use-case gaming
    python backend/utils/build_pc.py --budget 15000000 --use-case content_creation --output data/last_build.json
"""

from __future__ import annotations

import argparse
import json
import math
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

# Budget allocation profiles (% of total). Sum should be 100.
USE_CASE_PROFILES = {
    "gaming":           {"cpu": 18, "gpu": 33, "ram": 7,  "motherboard": 10, "ssd": 10, "psu": 8, "case": 7, "cpu_cooler": 5, "fan_cooler": 2},
    "productivity":     {"cpu": 27, "gpu": 17, "ram": 12, "motherboard": 12, "ssd": 14, "psu": 7, "case": 6, "cpu_cooler": 4, "fan_cooler": 1},
    "content_creation": {"cpu": 24, "gpu": 26, "ram": 12, "motherboard": 10, "ssd": 13, "psu": 7, "case": 4, "cpu_cooler": 3, "fan_cooler": 1},
    "office":           {"cpu": 28, "gpu": 0,  "ram": 12, "motherboard": 18, "ssd": 20, "psu": 8, "case": 8, "cpu_cooler": 5, "fan_cooler": 1},
    "student":          {"cpu": 22, "gpu": 16, "ram": 12, "motherboard": 14, "ssd": 14, "psu": 8, "case": 8, "cpu_cooler": 5, "fan_cooler": 1},
}

ALLOCATION_PRESET_SLOTS = [
    "cpu",
    "gpu",
    "ram",
    "motherboard",
    "ssd",
    "psu",
    "case",
    "cpu_cooler",
    "fan_cooler",
]

PERFORMANCE_PRIORITY_ALLOCATION_SHIFTS = {
    "gaming": {"cpu": 2, "gpu": 4, "motherboard": -1, "ssd": -2, "case": -2, "fan_cooler": -1},
    "productivity": {"cpu": 5, "gpu": -7, "ram": 4, "ssd": 4, "case": -3, "cpu_cooler": -1, "fan_cooler": -2},
    "best_value": {"cpu": -1, "gpu": -2, "ram": 2, "ssd": 2, "psu": 1, "cpu_cooler": -1, "fan_cooler": -1},
    "balanced": {},
    "upgrade_friendly": {"cpu": -2, "gpu": -6, "ram": -1, "motherboard": 5, "ssd": -2, "psu": 4, "case": 3, "fan_cooler": -1},
}

BUDGET_STRATEGY_ALLOCATION_SHIFTS = {
    "value": {"cpu": -1, "gpu": -2, "ram": 1, "ssd": 2, "psu": 1, "cpu_cooler": -1},
    "balanced": {},
    "maximize": {"cpu": 2, "gpu": 3, "ram": -1, "motherboard": -1, "ssd": -2, "case": -2, "cpu_cooler": 1},
}

BUDGET_STRATEGIES = {"value", "balanced", "maximize"}
PERFORMANCE_PRIORITIES = {
    "gaming",
    "productivity",
    "best_value",
    "balanced",
    "upgrade_friendly",
}
BUDGET_USAGE_TARGETS = {
    "value": {"min": 0.0, "max": 0.90},
    "balanced": {"min": 0.85, "max": 0.97},
    "maximize": {"min": 0.95, "max": 1.0},
}
BUDGET_BANDS = [
    {
        "key": "below_entry",
        "label": "Below entry-level",
        "min_idr": 0,
        "max_idr": 6_999_999,
        "summary": "Best-effort build; catalog constraints may leave required parts missing.",
    },
    {
        "key": "entry_level",
        "label": "Entry-level",
        "min_idr": 7_000_000,
        "max_idr": 11_999_999,
        "summary": "Starter PC budget for basic work and light esports.",
    },
    {
        "key": "mid_range",
        "label": "Mid-range",
        "min_idr": 12_000_000,
        "max_idr": 21_999_999,
        "summary": "Mainstream 1080p and balanced multitasking budget.",
    },
    {
        "key": "high_end",
        "label": "High-end",
        "min_idr": 22_000_000,
        "max_idr": 40_000_000,
        "summary": "High-refresh 1440p and creator workload budget.",
    },
    {
        "key": "custom_high",
        "label": "Custom high-budget",
        "min_idr": 40_000_001,
        "max_idr": None,
        "summary": "Performance-tier budget where catalog availability controls the ceiling.",
    },
]
PRIORITY_UPGRADE_ORDER = {
    "gaming": ["gpu", "cpu", "ram", "psu", "cpu_cooler", "motherboard", "ssd", "case", "fan_cooler"],
    "productivity": ["cpu", "ram", "ssd", "gpu", "motherboard", "psu", "cpu_cooler", "case", "fan_cooler"],
    "best_value": ["gpu", "cpu", "ram", "ssd", "psu", "motherboard", "case", "cpu_cooler", "fan_cooler"],
    "upgrade_friendly": ["psu", "motherboard", "case", "cpu", "gpu", "ram", "cpu_cooler", "ssd", "fan_cooler"],
    "balanced": ["gpu", "cpu", "ram", "ssd", "psu", "motherboard", "cpu_cooler", "case", "fan_cooler"],
}

CASE_FF_RANK = {"ITX": 1, "mATX": 2, "ATX": 3, "EATX": 4}
MONITOR_RESOLUTION_RANK = {"FHD": 1, "QHD": 2, "4K": 3}

REQUIRED_BUILD_SLOTS = [
    "cpu",
    "motherboard",
    "ram",
    "gpu",
    "ssd",
    "psu",
    "cpu_cooler",
    "fan_cooler",
    "case",
]

OPTIONAL_ADDON_SLOTS = ["hdd", "monitor", "ups"]
KNOWN_UPGRADE_SLOTS = REQUIRED_BUILD_SLOTS + ["hdd"]


def selected_optional_addon_slots(
    include_optional_addons: bool,
    optional_addon_slots: Optional[list[str]] = None,
) -> list[str]:
    """Return the optional add-on slots the user explicitly wants to include."""
    if optional_addon_slots is None:
        return OPTIONAL_ADDON_SLOTS.copy() if include_optional_addons else []

    selected: list[str] = []
    for slot in optional_addon_slots:
        normalized_slot = str(slot or "").strip().lower()
        if normalized_slot in OPTIONAL_ADDON_SLOTS and normalized_slot not in selected:
            selected.append(normalized_slot)
    return selected

BUDGET_TIERS = [
    {
        "key": "entry_level",
        "label": "Entry-level",
        "min_idr": 7_000_000,
        "max_idr": 12_000_000,
        "target": "Office, school, light esports, and compact upgrade-friendly basics.",
        "summary": "Tight starter build for office, school, and light esports.",
        "performance_goal": "Everyday + light esports",
        "upgrade_note": "Keeps the platform simple and upgrade-ready.",
    },
    {
        "key": "mid_range",
        "label": "Mid-range",
        "min_idr": 12_000_000,
        "max_idr": 22_000_000,
        "target": "Strong 1080p ultra or 1440p entry gaming with balanced platform choices.",
        "summary": "Balanced 1080p ultra build with 1440p entry headroom.",
        "performance_goal": "1080p ultra / 1440p entry",
        "upgrade_note": "Balances GPU value, RAM, and PSU headroom.",
    },
    {
        "key": "high_end",
        "label": "High-end",
        "min_idr": 22_000_000,
        "max_idr": 40_000_000,
        "target": "1440p high-refresh, content creation, and longer upgrade runway.",
        "summary": "Focused high-refresh gaming and creator workload tier.",
        "performance_goal": "1440p high-refresh",
        "upgrade_note": "Adds stronger cooling and platform runway.",
    },
    {
        "key": "custom",
        "label": "Custom budget",
        "min_idr": 3_000_000,
        "max_idr": None,
        "display_range": "♾️",
        "target": "User-defined budget with the same compatibility and balance checks.",
        "summary": "Enter your own number and keep the same balance checks.",
        "performance_goal": "Manual budget fit",
        "upgrade_note": "Uses compatibility checks at your number.",
    },
]


def budget_band_for(budget: int) -> dict:
    """Return the dynamic budget band for any typed budget."""
    for band in BUDGET_BANDS:
        maximum = band["max_idr"]
        if budget >= band["min_idr"] and (maximum is None or budget <= maximum):
            return dict(band)
    return dict(BUDGET_BANDS[-1])


def normalize_budget_strategy(strategy: Optional[str]) -> str:
    value = str(strategy or "balanced").strip().lower()
    return value if value in BUDGET_STRATEGIES else "balanced"


def normalize_performance_priority(priority: Optional[str], use_case: str) -> str:
    value = str(priority or "").strip().lower()
    if value in PERFORMANCE_PRIORITIES:
        return value
    if use_case == "gaming":
        return "gaming"
    if use_case in {"productivity", "content_creation"}:
        return "productivity"
    if use_case in {"office", "student"}:
        return "best_value"
    return "balanced"


def _clean_allocation_percent(value: object) -> int:
    if not isinstance(value, (int, float)) or isinstance(value, bool):
        return 0
    return max(0, min(100, int(round(value))))


def _apply_allocation_shift(profile: dict[str, int], shift: dict[str, int]) -> dict[str, int]:
    shifted = {slot: _clean_allocation_percent(profile.get(slot, 0)) for slot in ALLOCATION_PRESET_SLOTS}
    for slot, delta in shift.items():
        if slot in shifted:
            shifted[slot] = _clean_allocation_percent(shifted[slot] + delta)
    return shifted


def _allocation_fill_order(performance_priority: str) -> list[str]:
    preferred = {
        "gaming": ["gpu", "cpu"],
        "productivity": ["cpu", "ram", "ssd"],
        "best_value": ["gpu", "ssd", "ram"],
        "balanced": ["gpu", "cpu"],
        "upgrade_friendly": ["motherboard", "psu", "case"],
    }.get(performance_priority, ["gpu", "cpu"])
    return preferred + [slot for slot in ALLOCATION_PRESET_SLOTS if slot not in preferred]


def _normalize_allocation_profile(profile: dict[str, int], performance_priority: str) -> dict[str, int]:
    normalized = {slot: _clean_allocation_percent(profile.get(slot, 0)) for slot in ALLOCATION_PRESET_SLOTS}
    total = sum(normalized.values())
    fill_order = _allocation_fill_order(performance_priority)

    while total < 100:
        slot = next((candidate for candidate in fill_order if normalized[candidate] < 60), fill_order[0])
        normalized[slot] += 1
        total += 1

    while total > 100:
        slot = max(ALLOCATION_PRESET_SLOTS, key=lambda candidate: normalized[candidate])
        if normalized[slot] == 0:
            break
        normalized[slot] -= 1
        total -= 1

    return normalized


def strategy_allocation_profile(
    use_case: str,
    performance_priority: str,
    budget_strategy: str = "balanced",
    allocation_overrides: Optional[dict[str, int]] = None,
) -> dict[str, int]:
    profile = dict(USE_CASE_PROFILES[use_case])
    if allocation_overrides:
        allowed = set(ALLOCATION_PRESET_SLOTS)
        cleaned = {
            slot: int(value)
            for slot, value in allocation_overrides.items()
            if slot in allowed and isinstance(value, (int, float)) and value >= 0
        }
        if cleaned and sum(cleaned.values()) == 100:
            return cleaned

    normalized_priority = normalize_performance_priority(performance_priority, use_case)
    normalized_strategy = normalize_budget_strategy(budget_strategy)
    profile = _apply_allocation_shift(
        profile,
        PERFORMANCE_PRIORITY_ALLOCATION_SHIFTS.get(normalized_priority, {}),
    )
    profile = _apply_allocation_shift(
        profile,
        BUDGET_STRATEGY_ALLOCATION_SHIFTS.get(normalized_strategy, {}),
    )
    return _normalize_allocation_profile(profile, normalized_priority)


def normalize_marketplace_links(component: Optional[dict]) -> Optional[dict]:
    if component is None:
        return None
    collected: list[dict] = []
    seen_urls: set[str] = set()

    def add_link(marketplace: str, url: object) -> None:
        clean_url = str(url or "").strip()
        if not clean_url or clean_url in seen_urls:
            return
        collected.append({"marketplace": marketplace, "url": clean_url})
        seen_urls.add(clean_url)

    for link in component.get("marketplace_links") or []:
        if isinstance(link, dict):
            add_link(str(link.get("marketplace") or "marketplace").strip().lower(), link.get("url"))

    add_link("enterkomputer", component.get("product_url"))
    add_link("tokopedia", component.get("tokopedia_url"))
    add_link("shopee", component.get("shopee_url"))

    order = {"enterkomputer": 0, "tokopedia": 1, "shopee": 2}
    collected.sort(key=lambda link: order.get(link["marketplace"], 99))
    primary = collected[0]["url"] if collected else None
    return {**component, "marketplace_links": collected, "primary_url": primary}


def _owned_component(slot: str, name: str, specs: dict, confidence: str = "medium") -> dict:
    return {
        "sku": f"owned-{slot}",
        "id": f"owned-{slot}",
        "category": "cooler" if slot in {"cpu_cooler", "fan_cooler"} else slot,
        "slot": slot,
        "name": name,
        "brand": specs.get("brand"),
        "price_idr": 0,
        "source": "user_input",
        "detection_confidence": confidence,
        "specs": {key: value for key, value in specs.items() if value not in (None, "", 0)},
    }


def _parse_capacity_gb(text: str) -> Optional[int]:
    kit = re.search(r"(\d+)\s*[xX]\s*(\d+)\s*GB", text)
    if kit:
        return int(kit.group(1)) * int(kit.group(2))
    match = re.search(r"(\d+(?:\.\d+)?)\s*TB", text, re.I)
    if match:
        return int(float(match.group(1)) * 1024)
    match = re.search(r"(\d+)\s*GB", text, re.I)
    return int(match.group(1)) if match else None


def _infer_cpu_socket(text: str) -> Optional[str]:
    lower = text.lower()
    explicit = re.search(r"\b(AM[45]|LGA\s?1851|LGA\s?1700|LGA\s?1200|LGA\s?1151|LGA\s?1150)\b", text, re.I)
    if explicit:
        value = explicit.group(1).replace(" ", "").upper()
        return value.replace("LGA", "LGA ")
    ryzen = re.search(r"ryzen\s+[3579]\s+(\d{4})", lower)
    if ryzen:
        model = int(ryzen.group(1))
        return "AM5" if model >= 7000 else "AM4"
    core = re.search(r"i[3579][- ]?(\d{4,5})", lower)
    if core:
        model_text = core.group(1)
        generation = int(model_text[:2] if len(model_text) >= 5 else model_text[0])
        if generation >= 12:
            return "LGA 1700"
        if generation >= 10:
            return "LGA 1200"
        return "LGA 1151"
    if "core ultra" in lower:
        return "LGA 1851"
    return None


def _infer_motherboard_socket(text: str) -> Optional[str]:
    lower = text.lower()
    explicit = _infer_cpu_socket(text)
    if explicit:
        return explicit
    if re.search(r"\b(a320|b350|x370|b450|x470|a520|b550|x570)[a-z]?\b", lower):
        return "AM4"
    if re.search(r"\b(a620|b650|x670|x870)[a-z]?\b", lower):
        return "AM5"
    if re.search(r"\b(h610|b660|b760|z690|z790)[a-z]?\b", lower):
        return "LGA 1700"
    if re.search(r"\b(b860|z890)[a-z]?\b", lower):
        return "LGA 1851"
    return None


def _infer_form_factor(text: str) -> Optional[str]:
    lower = text.lower()
    if re.search(r"mini[- ]?itx|\bitx\b", lower):
        return "ITX"
    if re.search(r"micro[- ]?atx|m[- ]?atx|\bmatx\b|[abzxh]\d{3}m\b", lower):
        return "mATX"
    if re.search(r"e[- ]?atx|\beatx\b", lower):
        return "EATX"
    if "atx" in lower:
        return "ATX"
    return None


def _infer_ram_type(text: str, socket: Optional[str] = None) -> Optional[str]:
    match = re.search(r"\bDDR\s?([345])\b", text, re.I)
    if match:
        return f"DDR{match.group(1)}"
    if socket == "AM4":
        return "DDR4"
    if socket in {"AM5", "LGA 1851"}:
        return "DDR5"
    return None


def _infer_gpu_specs(text: str) -> dict:
    lower = f" {text.lower()} "
    vendor = None
    if any(token in lower for token in [" nvidia", " geforce", " rtx", " gtx"]):
        vendor = "Nvidia"
    elif any(token in lower for token in [" radeon", " rx "]):
        vendor = "AMD"
    elif " arc " in lower:
        vendor = "Intel"
    vram = _parse_capacity_gb(text)
    rec_psu = None
    match = re.search(r"\b(RTX|GTX|RX)\s*([0-9]{3,4})", text, re.I)
    if match:
        prefix = match.group(1).lower()
        model = int(match.group(2))
        if prefix in {"rtx", "gtx"}:
            generation = model // 1000
            model_class = model % 100
            rec_psu = 850 if model_class >= 80 else 750 if model_class >= 70 else 650 if model_class >= 60 and generation >= 4 else 550
        else:
            model_class = (model % 1000) // 100
            rec_psu = 850 if model_class >= 9 else 750 if model_class >= 8 else 650 if model_class >= 6 else 550
    return {"vendor": vendor, "vram_gb": vram, "recommended_psu_w": rec_psu}


def _infer_storage_specs(text: str, slot: str) -> dict:
    lower = text.lower()
    capacity = _parse_capacity_gb(text)

    if slot == "ssd":
        if any(token in lower for token in ["nvme", "m.2", "pcie", "pci-e"]):
            interface = "NVMe"
        elif "sata" in lower:
            interface = "SATA"
        else:
            interface = None
        form_factor = "M.2" if "m.2" in lower or "nvme" in lower else "2.5" if "2.5" in lower else None
        return {"capacity_gb": capacity, "interface": interface, "form_factor": form_factor}

    if slot == "hdd":
        form_factor = "2.5" if "2.5" in lower else "3.5" if "3.5" in lower else None
        interface = "SATA" if "sata" in lower or "hdd" in lower or "hard" in lower else None
        return {"capacity_gb": capacity, "interface": interface, "form_factor_in": form_factor}

    return {}


def parse_existing_component(slot: str, value: str) -> dict:
    """Infer lightweight compatibility specs from manually typed owned parts."""
    clean_slot = str(slot or "").strip().lower()
    name = str(value or "").strip()
    text = name
    specs: dict = {}

    if clean_slot == "cpu":
        socket = _infer_cpu_socket(text)
        lower = text.lower()
        specs = {
            "socket": socket,
            "brand": "AMD" if "ryzen" in lower or "amd" in lower else "Intel" if "intel" in lower or "core" in lower else None,
        }
    elif clean_slot == "motherboard":
        socket = _infer_motherboard_socket(text)
        specs = {
            "socket": socket,
            "form_factor": _infer_form_factor(text),
            "ram_type": _infer_ram_type(text, socket),
        }
    elif clean_slot == "ram":
        specs = {
            "type": _infer_ram_type(text),
            "capacity_gb": _parse_capacity_gb(text),
            "speed_mhz": int(match.group(1)) if (match := re.search(r"\b(\d{4,5})\s*(?:MHz)?\b", text, re.I)) else None,
        }
    elif clean_slot == "gpu":
        specs = _infer_gpu_specs(text)
    elif clean_slot in {"ssd", "hdd"}:
        specs = _infer_storage_specs(text, clean_slot)
    elif clean_slot == "psu":
        wattage = int(match.group(1)) if (match := re.search(r"(\d{3,4})\s*(?:W|Watt)", text, re.I)) else None
        rating = next((value for value in ["Titanium", "Platinum", "Gold", "Silver", "Bronze", "White"] if value.lower() in text.lower()), None)
        specs = {"wattage_w": wattage, "rating": rating}
    elif clean_slot == "case":
        max_form = _infer_form_factor(text)
        specs = {"max_form_factor": max_form, "form_factor": max_form}
    elif clean_slot in {"cpu_cooler", "fan_cooler"}:
        lower = text.lower()
        specs = {
            "type": "fan" if "fan" in lower else "liquid" if any(word in lower for word in ["aio", "liquid", "water"]) else "air",
            "fan_size_mm": int(match.group(1)) if (match := re.search(r"(\d{2,3})\s*mm", text, re.I)) else None,
        }

    confidence = "medium" if any(value not in (None, "", 0) for value in specs.values()) else "low"
    return _owned_component(clean_slot, name, specs, confidence=confidence)


def analyze_existing_components(existing_components: dict[str, str]) -> dict:
    recognized: dict[str, str] = {}
    detected_existing: dict[str, dict] = {}
    unknown: dict[str, str] = {}
    warnings: list[str] = []
    warning_objects: list[dict] = []

    for raw_slot, raw_value in (existing_components or {}).items():
        slot = str(raw_slot).strip().lower()
        value = str(raw_value or "").strip()
        if not value:
            continue
        if slot in KNOWN_UPGRADE_SLOTS:
            recognized[slot] = value
            detected_existing[slot] = parse_existing_component(slot, value)
        else:
            unknown[slot] = value

    for slot in ("cpu", "motherboard", "ram", "gpu", "psu"):
        if slot not in recognized:
            label = slot.replace("_", " ").title()
            message = f"{label} was not provided, so compatibility can only be estimated."
            warnings.append(message)
            warning_objects.append(
                {
                    "id": f"owned_{slot}_missing",
                    "severity": "info",
                    "slot": slot,
                    "slots": [slot],
                    "title": f"{label} not provided",
                    "message": message,
                    "recommendation": f"Type your current {slot.replace('_', ' ')} if you want a more precise upgrade check.",
                }
            )

    return {
        "recognized": recognized,
        "detected_existing": detected_existing,
        "unknown": unknown,
        "warnings": warnings,
        "warning_objects": warning_objects,
    }


def load_components(path: Path) -> dict[str, list[dict]]:
    raw = json.loads(path.read_text(encoding="utf-8"))
    by_cat: dict[str, list[dict]] = {}
    for c in raw:
        by_cat.setdefault(c["category"], []).append(c)
    return by_cat


def case_fits_mobo(case_max_ff: str, mobo_ff: str) -> bool:
    return CASE_FF_RANK.get(case_max_ff, 3) >= CASE_FF_RANK.get(mobo_ff, 3)


def _availability_score(component: dict) -> float:
    status = str(component.get("stock_status") or "").strip().lower()
    if status in {"in_stock", "instock", "ready", "available", "stock"}:
        return 30.0
    if "pre" in status:
        return 10.0
    if status in {"out_of_stock", "outofstock", "sold_out", "empty", "habis"}:
        return -80.0
    return 0.0


def _freshness_score(component: dict) -> float:
    raw = component.get("scraped_at")
    if not raw:
        return 3.0
    try:
        parsed = datetime.fromisoformat(str(raw).replace("Z", "+00:00"))
        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=timezone.utc)
        age_days = max(0, (datetime.now(timezone.utc) - parsed.astimezone(timezone.utc)).days)
    except (TypeError, ValueError):
        return 2.0
    if age_days <= 30:
        return 10.0
    if age_days <= 90:
        return 7.0
    if age_days <= 365:
        return 4.0
    return 1.0


def _quality_flag_score(component: dict) -> float:
    flags = set(component.get("quality_flags") or [])
    if "price_outlier_low" in flags:
        return -95.0
    return 0.0


def _price_fit_score(component: dict, budget: int) -> float:
    if budget <= 0:
        return 0.0
    price = max(int(component.get("price_idr", 0) or 0), 0)
    if price <= 0:
        return -5.0
    utilization = price / budget
    # Prefer healthy use of the slot budget without forcing "most expensive".
    return max(0.0, 1.0 - abs(utilization - 0.72) / 0.72) * 12.0


def _value_score(performance_units: float, component: dict) -> float:
    price_million = max((component.get("price_idr", 0) or 0) / 1_000_000, 0.1)
    return min((performance_units / price_million) * 3.0, 25.0)


def _socket_runway_score(socket: object) -> float:
    key = str(socket or "").replace(" ", "").replace("-", "").upper()
    if "AM5" in key:
        return 30.0
    if "LGA1851" in key:
        return 28.0
    if "LGA1700" in key:
        return 22.0
    if "AM4" in key:
        return 16.0
    if "LGA1200" in key:
        return 8.0
    if "LGA1151" in key:
        return -8.0
    return 0.0


def _gaming_gpu_fit_score(component: dict, target_specs: Optional[dict]) -> float:
    if (target_specs or {}).get("use_case") != "gaming":
        return 0.0
    name = (component.get("name") or "").lower()
    score = 0.0
    if any(token in name for token in ["geforce", "radeon", "gaming", "rtx ", "rx "]):
        score += 24.0
    if any(token in name for token in ["arc pro", " rtx a", "quadro", "workstation", "creator"]):
        score -= 120.0
    return score


def _cpu_gaming_tier_bonus(component: dict, target_specs: Optional[dict]) -> float:
    priority = (target_specs or {}).get("performance_priority")
    if priority != "gaming":
        return 0.0
    name = (component.get("name") or "").lower()
    if "9800x3d" in name:
        return 92.0
    if "7800x3d" in name or "7950x3d" in name:
        return 84.0
    if "x3d" in name:
        return 72.0
    return 0.0


def _gpu_model_tier_bonus(component: dict, target_specs: Optional[dict]) -> float:
    priority = (target_specs or {}).get("performance_priority")
    if priority not in {"gaming", "balanced", "productivity"}:
        return 0.0
    name = (component.get("name") or "").lower()
    score = 0.0

    nvidia = re.search(r"\brtx\s*([245]0[56789]0)\s*(ti|super)?", name)
    if nvidia:
        model = int(nvidia.group(1))
        suffix = nvidia.group(2) or ""
        model_class = (model % 1000) // 10
        generation = model // 1000
        score = generation * 18 + model_class * 11
        if "ti" in suffix:
            score += 24
        elif "super" in suffix:
            score += 14

    radeon = re.search(r"\brx\s*([679]0[56789]0)\s*(xt)?", name)
    if radeon:
        model = int(radeon.group(1))
        suffix = radeon.group(2) or ""
        model_class = (model % 1000) // 10
        generation = model // 1000
        score = max(score, generation * 17 + model_class * 10 + (24 if "xt" in suffix else 0))

    arc = re.search(r"\barc\s*([ab])\s*([0-9]{3})", name)
    if arc:
        tier = int(arc.group(2)[0])
        score = max(score, 45 + tier * 12)

    if any(term in name for term in ["quadro", "rtx a", "arc pro", "workstation"]):
        score -= 120
    return float(score)


def _performance_priority_bonus(component: dict, slot: str, target_specs: Optional[dict]) -> float:
    priority = (target_specs or {}).get("performance_priority")
    if slot == "cpu":
        return _cpu_gaming_tier_bonus(component, target_specs)
    if slot == "gpu":
        return _gpu_model_tier_bonus(component, target_specs)
    if priority == "upgrade_friendly" and slot in {"motherboard", "psu", "case"}:
        return 18.0
    if priority == "productivity" and slot in {"cpu", "ram", "ssd"}:
        return 14.0
    return 0.0


def _component_performance_units(component: dict, slot: str, target_specs: Optional[dict] = None) -> float:
    specs = component.get("specs") or {}
    category = "cooler" if slot in {"cpu_cooler", "fan_cooler"} else slot

    if category == "cpu":
        return (
            (specs.get("cores") or 0) * 8
            + (specs.get("threads") or 0) * 2
            + (specs.get("tdp_w") or 0) / 20
            + _socket_runway_score(specs.get("socket"))
            + _cpu_gaming_tier_bonus(component, target_specs)
        )
    if category == "gpu":
        current_vram = (target_specs or {}).get("current_vram_gb") or 0
        vram = specs.get("vram_gb") or 0
        upgrade_gain = max(0, vram - current_vram) * 5 if current_vram else 0
        psu_target = specs.get("recommended_psu_w") or 0
        efficiency_bonus = max(0, 900 - psu_target) / 120 if psu_target else 0
        return (
            vram * 10
            + upgrade_gain
            + efficiency_bonus
            + _gaming_gpu_fit_score(component, target_specs)
            + _gpu_model_tier_bonus(component, target_specs)
        )
    if category == "motherboard":
        ff = CASE_FF_RANK.get(specs.get("form_factor") or "ATX", 3)
        compact_bonus = 4 if ff <= 2 else 0
        chipset_bonus = 6 if specs.get("chipset") else 0
        return 28 + compact_bonus + chipset_bonus + _socket_runway_score(specs.get("socket"))
    if category == "ram":
        capacity = specs.get("capacity_gb") or 0
        target_capacity = (target_specs or {}).get("target_capacity_gb") or 0
        capacity_fit = 0.0
        if target_capacity:
            capacity_fit = 28.0 if capacity >= target_capacity else -18.0 * ((target_capacity - capacity) / target_capacity)
        return capacity * 2 + (specs.get("speed_mhz") or 0) / 160 + capacity_fit
    if category == "ssd":
        interface_bonus = 18 if specs.get("interface") == "NVMe" else 6
        return (specs.get("capacity_gb") or 0) / 64 + interface_bonus
    if category == "hdd":
        return (specs.get("capacity_gb") or 0) / 128 + (8 if specs.get("interface") == "SATA" else 0)
    if category == "psu":
        return (
            (specs.get("wattage_w") or 0) / 40
            + _PSU_RATING_SCORE.get(specs.get("rating") or "", 0) * 2
            + _PSU_MODULAR_SCORE.get(specs.get("modular") or "", 1)
        )
    if category == "cooler":
        if slot == "fan_cooler" or specs.get("type") == "fan":
            return (specs.get("fan_size_mm") or 0) / 8
        type_bonus = 12 if specs.get("type") == "liquid" else 8
        return (specs.get("tdp_w") or 0) / 8 + type_bonus
    if category == "case":
        return 22 + CASE_FF_RANK.get(specs.get("max_form_factor") or specs.get("form_factor") or "ATX", 3) * 3
    if category == "monitor":
        return (specs.get("size_inch") or 0) + (specs.get("refresh_hz") or 60) / 12
    if category == "ups":
        return (specs.get("capacity_va") or 0) / 60 + (specs.get("wattage_w") or 0) / 80
    return 10.0


def _component_score(component: dict, slot: str, budget: int, target_specs: Optional[dict] = None) -> float:
    performance_units = _component_performance_units(component, slot, target_specs)
    return (
        _availability_score(component)
        + _freshness_score(component)
        + _quality_flag_score(component)
        + performance_units
        + _performance_priority_bonus(component, slot, target_specs)
        + _value_score(performance_units, component)
        + _price_fit_score(component, budget)
    )


def _is_recent_catalog_row(component: dict) -> bool:
    raw = component.get("scraped_at")
    if not raw:
        return False
    try:
        parsed = datetime.fromisoformat(str(raw).replace("Z", "+00:00"))
        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=timezone.utc)
        return (datetime.now(timezone.utc) - parsed.astimezone(timezone.utc)).days <= 90
    except (TypeError, ValueError):
        return False


def _selection_rationale(
    slot: str,
    component: dict,
    slot_budget: int,
    use_case: str,
    target_specs: Optional[dict] = None,
) -> dict:
    specs = component.get("specs") or {}
    factors: list[str] = []
    stock = str(component.get("stock_status") or "").strip().lower()
    price = int(component.get("price_idr", 0) or 0)

    if stock in {"in_stock", "instock", "ready", "available", "stock"}:
        factors.append("In-stock listing")
    elif stock:
        factors.append("Availability needs checking")

    if _is_recent_catalog_row(component):
        factors.append("Recent marketplace data")

    if slot_budget > 0 and price > 0:
        factors.append(
            "Fits the slot budget with value headroom"
            if price <= slot_budget
            else "Uses leftover budget for a stronger compatible part"
        )

    if slot == "cpu" and specs.get("socket"):
        factors.append(f"{specs['socket']} platform runway")
    elif slot == "motherboard":
        platform = " and ".join(str(value) for value in [specs.get("socket"), specs.get("ram_type")] if value)
        if platform:
            factors.append(f"Matches the {platform} platform plan")
    elif slot == "ram":
        capacity = specs.get("capacity_gb")
        ram_type = specs.get("type")
        target_capacity = (target_specs or {}).get("target_capacity_gb")
        if capacity:
            label = f"{capacity} GB"
            if target_capacity and capacity >= target_capacity:
                label += f" meets the {target_capacity} GB target"
            factors.append(label)
        if ram_type:
            factors.append(f"{ram_type} memory generation")
    elif slot == "gpu":
        if specs.get("vram_gb"):
            factors.append(f"{specs['vram_gb']} GB VRAM for {use_case.replace('_', ' ')} workloads")
        if use_case == "gaming":
            factors.append("Gaming-focused GPU fit")
    elif slot == "ssd" and specs.get("capacity_gb"):
        factors.append(f"{specs['capacity_gb']} GB fast storage")
    elif slot == "hdd" and specs.get("capacity_gb"):
        factors.append(f"{specs['capacity_gb']} GB bulk storage")
    elif slot == "psu" and specs.get("wattage_w"):
        factors.append(f"{specs['wattage_w']}W power headroom")
    elif slot == "cpu_cooler":
        if specs.get("tdp_w"):
            factors.append(f"{specs['tdp_w']}W cooling capacity")
        elif specs.get("type"):
            factors.append(f"{str(specs['type']).title()} CPU cooling")
    elif slot == "fan_cooler":
        if specs.get("fan_size_mm"):
            factors.append(f"{specs['fan_size_mm']} mm case airflow support")
        else:
            factors.append("Case airflow support")
    elif slot == "case":
        form_factor = specs.get("max_form_factor") or specs.get("form_factor")
        if form_factor:
            factors.append(f"Fits up to {form_factor} motherboards")

    if not factors:
        factors.append("Best-ranked compatible catalog option")

    return {
        "summary": "Ranked for stock, freshness, value, compatibility, and upgrade fit.",
        "factors": factors[:5],
    }


def _best_ranked_component(
    components: list[dict],
    slot: str,
    budget: int,
    target_specs: Optional[dict] = None,
) -> Optional[dict]:
    if not components:
        return None
    return max(
        components,
        key=lambda component: (
            _component_score(component, slot, budget, target_specs),
            _component_performance_units(component, slot, target_specs),
            -(component.get("price_idr", 0) or 0),
        ),
    )


def pick_cpu(cpus: list[dict], budget: int,
             brand: Optional[str] = None,
             use_case: Optional[str] = None,
             performance_priority: Optional[str] = None) -> Optional[dict]:
    """Pick the most expensive CPU within budget that has a known socket.

    `brand` is an optional case-insensitive filter: 'Intel' or 'AMD'. If the
    filter would leave no candidates, we fall back to no-filter rather than
    return None (the user gets a build, with a warning the preference couldn't
    be honored — surfaced via compose_build's `unmet_preferences`).
    """
    base = [c for c in cpus if c["price_idr"] <= budget and c["specs"].get("socket")]
    if not base:
        return None
    target_specs = {
        "use_case": use_case,
        "performance_priority": performance_priority,
    }
    if brand:
        b = brand.strip().lower()
        filtered = [c for c in base if (c["specs"].get("brand") or "").lower() == b]
        if filtered:
            return _best_ranked_component(filtered, "cpu", budget, target_specs)
    return _best_ranked_component(base, "cpu", budget, target_specs)


def pick_motherboard(mobos: list[dict], budget: int, socket: str) -> Optional[dict]:
    candidates = [
        m for m in mobos
        if m["price_idr"] <= budget
        and m["specs"].get("socket") and socket and socket in m["specs"]["socket"]
    ]
    if not candidates:
        return None
    return _best_ranked_component(candidates, "motherboard", budget)


def pick_ram(
    rams: list[dict],
    budget: int,
    ram_type: Optional[str],
    target_capacity_gb: Optional[int] = None,
) -> Optional[dict]:
    """Pick RAM that matches the motherboard's required generation.

    `ram_type` is a HARD compatibility constraint, not a preference: a DDR5
    motherboard cannot run DDR4 modules at all. So if no in-budget module of
    the required type exists, we broaden to ALL modules of that type and pick
    the cheapest, accepting a small slot-budget overrun. Downstream slots will
    each take a tiny haircut via the existing leftover cascade.

    The previous behavior — falling through to any-type when slot budget was
    too tight — produced builds that triggered RAM-type mismatch warnings.
    """
    def prefer_sane_prices(candidates: list[dict]) -> list[dict]:
        sane = [
            r for r in candidates
            if "price_outlier_low" not in set(r.get("quality_flags") or [])
        ]
        return sane or candidates

    if ram_type:
        any_matching = [r for r in rams if r["specs"].get("type") == ram_type]
        sane_matching = prefer_sane_prices(any_matching)
        if target_capacity_gb:
            target_matching = [
                r for r in sane_matching
                if (r.get("specs") or {}).get("capacity_gb", 0) >= target_capacity_gb
            ]
            target_in_slot = [r for r in target_matching if r["price_idr"] <= budget]
            if target_in_slot:
                return _best_ranked_component(
                    target_in_slot,
                    "ram",
                    budget,
                    {"target_capacity_gb": target_capacity_gb},
                )
            if target_matching:
                return min(target_matching, key=lambda r: r["price_idr"])

        # Must match the mobo's DDR generation. Try slot budget first.
        in_slot = [r for r in rams if r["price_idr"] <= budget
                                   and r["specs"].get("type") == ram_type]
        if in_slot:
            return _best_ranked_component(
                prefer_sane_prices(in_slot),
                "ram",
                budget,
                {"target_capacity_gb": target_capacity_gb},
            )
        # Out of slot budget: take the cheapest matching module — never compromise type.
        if any_matching:
            return min(sane_matching, key=lambda r: r["price_idr"])
        return None  # genuinely no RAM of that type in the catalog

    # No type requirement — pick the priciest module within budget.
    in_budget = [r for r in rams if r["price_idr"] <= budget]
    if not in_budget:
        return None
    return _best_ranked_component(
        prefer_sane_prices(in_budget),
        "ram",
        budget,
        {"target_capacity_gb": target_capacity_gb},
    )


_GPU_VENDOR_ALIASES = {
    "nvidia": "nvidia",
    "geforce": "nvidia",
    "amd": "radeon",
    "radeon": "radeon",
    "intel": "intel",
    "arc": "intel",
}


def _target_ram_capacity(use_case: str, budget: int) -> int:
    if use_case in {"gaming", "productivity", "content_creation"} and budget >= 18_000_000:
        return 32
    return 16


def pick_gpu(gpus: list[dict], budget: int,
             vendor: Optional[str] = None,
             use_case: Optional[str] = None,
             performance_priority: Optional[str] = None) -> Optional[dict]:
    """Most expensive GPU within budget. `vendor` accepts Nvidia/AMD/Intel
    (or aliases like 'GeForce' / 'Radeon' / 'Arc'). Soft fallback if the
    filter empties the pool."""
    if budget <= 0:
        return None
    base = [g for g in gpus if g["price_idr"] <= budget]
    if not base:
        return None
    if vendor:
        normalized = _GPU_VENDOR_ALIASES.get(vendor.strip().lower())
        if normalized:
            filtered = [g for g in base
                        if (g["specs"].get("vendor") or "").lower() == normalized]
            if filtered:
                return _best_ranked_component(
                    filtered,
                    "gpu",
                    budget,
                    {"use_case": use_case, "performance_priority": performance_priority},
                )
    return _best_ranked_component(
        base,
        "gpu",
        budget,
        {"use_case": use_case, "performance_priority": performance_priority},
    )


_PSU_RATING_SCORE = {
    "Titanium": 10, "Platinum": 8, "Gold": 6, "Silver": 4, "Bronze": 3, "White": 1,
}
_PSU_MODULAR_SCORE = {"full": 3, "semi": 2, "none": 0}

# Higher scores are selected first by the upgrade recommender. Keep the numbers
# spaced apart so future heuristics can insert priorities without reshuffling the
# public response order unexpectedly.
UPGRADE_PRIORITY_SCORES = {
    "weak_gaming_gpu": 96,
    "missing_gpu_gaming": 92,
    "ram_capacity": 82,
    "psu_headroom": 78,
    "missing_ram": 76,
    "missing_psu": 74,
    "missing_gpu_general": 72,
    "missing_motherboard": 70,
    "missing_ssd": 58,
}


def _psu_quality_score(psu: dict, min_watts: int) -> float:
    """Composite score for PSU pick. Higher is better.

    Weights: wattage headroom up to 1.5×, then 80+ rating, then modular type.
    Uncertified low-wattage units score near zero so they won't beat a Bronze
    pick of similar wattage.
    """
    specs = psu.get("specs") or {}
    w = specs.get("wattage_w") or 0
    if w == 0:
        return 0.0  # don't pick PSUs we couldn't parse a wattage for
    headroom = w / max(min_watts, 1)
    headroom_score = min(headroom, 1.5) * 5  # 0 - 7.5
    rating_score = _PSU_RATING_SCORE.get(specs.get("rating") or "", 0)
    modular_score = _PSU_MODULAR_SCORE.get(specs.get("modular") or "", 1)
    return (
        headroom_score
        + rating_score
        + modular_score
        + _availability_score(psu) / 6
        + _freshness_score(psu) / 3
    )


def pick_psu(psus: list[dict], budget: int, min_watts: int) -> Optional[dict]:
    """Quality-aware PSU pick.

    Strategy:
    1. Filter to in-budget PSUs with a known wattage that meets `min_watts`.
    2. Among those, return the highest-scoring (rating + headroom + modular).
       Score caps headroom at 1.5× so we don't overspend on a 1500W unit
       when 750W would do — but bias toward Bronze-or-better units.
    3. If nothing meets wattage, fall back to the most powerful in-budget unit
       (still excluding wattage=None rows so we never pick a cable).
    """
    in_budget = [p for p in psus if p["price_idr"] <= budget
                 and (p["specs"].get("wattage_w") or 0) > 0]
    qualified = [p for p in in_budget if (p["specs"].get("wattage_w") or 0) >= min_watts]
    if qualified:
        return max(qualified, key=lambda p: _psu_quality_score(p, min_watts))
    if in_budget:
        return max(in_budget, key=lambda p: p["specs"].get("wattage_w") or 0)
    return None


def _is_real_ups_candidate(component: dict) -> bool:
    name = (component.get("name") or "").lower()
    specs = component.get("specs") or {}
    if not specs.get("capacity_va"):
        return False
    accessory_terms = [
        "line-r",
        "voltage regulator",
        "automatic voltage regulator",
        "stabilizer",
        "battery",
    ]
    if any(term in name for term in accessory_terms):
        return False
    if "inverter" in name and "ups" not in name:
        return False
    return "ups" in name or "back-ups" in name


def _estimated_ups_wattage(component: dict) -> int:
    specs = component.get("specs") or {}
    if specs.get("wattage_w"):
        return int(specs["wattage_w"])
    if specs.get("capacity_va"):
        return int((specs["capacity_va"] or 0) * 0.6)
    return 0


def _ups_requirements(build: dict[str, Optional[dict]]) -> dict[str, int]:
    cpu_specs = (build.get("cpu") or {}).get("specs") or {}
    gpu_specs = (build.get("gpu") or {}).get("specs") or {}
    psu_specs = (build.get("psu") or {}).get("specs") or {}

    psu_watts = int(psu_specs.get("wattage_w") or 0)
    gpu_psu_target = int(gpu_specs.get("recommended_psu_w") or 0)
    cpu_tdp = int(cpu_specs.get("tdp_w") or 0)
    gpu_tdp = int(gpu_specs.get("tdp_w") or 0)
    measured_draw = cpu_tdp + gpu_tdp + 150 if (cpu_tdp or gpu_tdp) else 0

    estimated_draw = max(
        measured_draw,
        int(gpu_psu_target * 0.7) if gpu_psu_target else 0,
        int(psu_watts * 0.6) if psu_watts else 0,
        300,
    )
    required_watts = int(math.ceil((estimated_draw * 1.2) / 50) * 50)
    required_va = int(math.ceil((required_watts / 0.6) / 100) * 100)
    if psu_watts >= 600 or gpu_psu_target >= 600:
        required_va = max(required_va, 1000)
    elif psu_watts >= 500 or gpu_psu_target >= 500:
        required_va = max(required_va, 850)
    return {"wattage_w": required_watts, "capacity_va": required_va}


def pick_ups(upss: list[dict], budget: int, build: dict[str, Optional[dict]]) -> Optional[dict]:
    requirements = _ups_requirements(build)
    candidates = [
        u for u in upss
        if u.get("price_idr", 0) <= budget
        and _is_real_ups_candidate(u)
        and ((u.get("specs") or {}).get("capacity_va") or 0) >= requirements["capacity_va"]
        and _estimated_ups_wattage(u) >= requirements["wattage_w"]
    ]
    if not candidates:
        return None

    def ups_score(component: dict) -> float:
        specs = component.get("specs") or {}
        excess_va = max(0, (specs.get("capacity_va") or 0) - requirements["capacity_va"])
        excess_watts = max(0, _estimated_ups_wattage(component) - requirements["wattage_w"])
        oversize_penalty = min(excess_va / 180, 12) + min(excess_watts / 120, 8)
        return _component_score(component, "ups", budget) - oversize_penalty

    pick = max(candidates, key=ups_score)
    pick.setdefault("selection_rationale", {})
    pick["selection_rationale"] = {
        "summary": f"Sized for at least {requirements['capacity_va']}VA / {requirements['wattage_w']}W output.",
        "factors": [
            "Actual UPS listing, not a voltage regulator or stabilizer",
            f"{(pick.get('specs') or {}).get('capacity_va')}VA capacity",
            f"Estimated {_estimated_ups_wattage(pick)}W usable output",
        ],
    }
    return pick


def _monitor_target(build: dict[str, Optional[dict]], use_case: str, budget: int) -> dict:
    gpu_specs = (build.get("gpu") or {}).get("specs") or {}
    vram = int(gpu_specs.get("vram_gb") or 0)
    gpu_psu_target = int(gpu_specs.get("recommended_psu_w") or 0)

    if use_case == "gaming":
        if budget >= 30_000_000 and (gpu_psu_target >= 750 or vram >= 16):
            return {"resolution": "4K", "min_refresh_hz": 120, "ideal_size_inch": 32}
        if budget >= 22_000_000 or gpu_psu_target >= 650 or vram >= 12:
            return {"resolution": "QHD", "min_refresh_hz": 144, "ideal_size_inch": 27}
        return {"resolution": "FHD", "min_refresh_hz": 144, "ideal_size_inch": 24}

    if use_case == "content_creation":
        if budget >= 30_000_000 and (gpu_psu_target >= 750 or vram >= 16):
            return {"resolution": "4K", "min_refresh_hz": 60, "ideal_size_inch": 32}
        return {"resolution": "QHD", "min_refresh_hz": 75, "ideal_size_inch": 27}

    if use_case == "productivity":
        return {"resolution": "QHD" if budget >= 16_000_000 else "FHD", "min_refresh_hz": 75, "ideal_size_inch": 27}

    return {"resolution": "FHD", "min_refresh_hz": 75, "ideal_size_inch": 24}


def pick_monitor(
    monitors: list[dict],
    budget: int,
    build: dict[str, Optional[dict]],
    use_case: str,
    total_budget: int,
) -> Optional[dict]:
    target = _monitor_target(build, use_case, total_budget)
    candidates = [m for m in monitors if m.get("price_idr", 0) <= budget]
    if not candidates:
        return None

    target_rank = MONITOR_RESOLUTION_RANK.get(target["resolution"], 1)

    def monitor_score(component: dict) -> float:
        specs = component.get("specs") or {}
        resolution = specs.get("resolution")
        resolution_rank = MONITOR_RESOLUTION_RANK.get(resolution, target_rank)
        rank_delta = resolution_rank - target_rank
        refresh = int(specs.get("refresh_hz") or 60)
        size = float(specs.get("size_inch") or target["ideal_size_inch"])

        if rank_delta == 0:
            resolution_score = 45
        elif rank_delta < 0:
            resolution_score = -18 * abs(rank_delta)
        else:
            resolution_score = -34 * rank_delta

        refresh_score = min(refresh - target["min_refresh_hz"], 90) / 6
        if refresh < target["min_refresh_hz"]:
            refresh_score -= (target["min_refresh_hz"] - refresh) / 3

        size_score = max(0, 18 - abs(size - target["ideal_size_inch"]) * 4)

        return (
            _availability_score(component)
            + _freshness_score(component)
            + _quality_flag_score(component)
            + resolution_score
            + refresh_score
            + size_score
            + _price_fit_score(component, budget)
        )

    pick = max(
        candidates,
        key=lambda component: (
            monitor_score(component),
            _component_performance_units(component, "monitor", target),
            -(component.get("price_idr", 0) or 0),
        ),
    )
    pick.setdefault("selection_rationale", {})
    pick["selection_rationale"] = {
        "summary": f"Matched to the build's {use_case.replace('_', ' ')} display target.",
        "factors": [
            f"{target['resolution']} target resolution",
            f"At least {target['min_refresh_hz']}Hz refresh target",
            "Balanced for the selected GPU and setup budget",
        ],
    }
    return pick


def pick_case(cases: list[dict], budget: int, mobo_ff: str) -> Optional[dict]:
    candidates = [
        c for c in cases
        if c["price_idr"] <= budget
        and case_fits_mobo(c["specs"].get("max_form_factor", "ATX"), mobo_ff)
    ]
    if not candidates:
        return None
    return _best_ranked_component(candidates, "case", budget)


def pick_cooler(coolers: list[dict], budget: int, prefer_liquid: bool = False) -> Optional[dict]:
    candidates = [c for c in coolers if c["price_idr"] <= budget
                  and c["specs"].get("type") in {"air", "liquid"}]
    if not candidates:
        return None
    if prefer_liquid:
        liq = [c for c in candidates if c["specs"].get("type") == "liquid"]
        if liq:
            return _best_ranked_component(liq, "cpu_cooler", budget)
    return _best_ranked_component(candidates, "cpu_cooler", budget)


def _is_case_fan_candidate(component: dict) -> bool:
    name = (component.get("name") or "").lower()
    specs = component.get("specs") or {}
    negative_terms = [
        "cpu cooler",
        "liquid cooler",
        "radiator",
        "heatsink",
        "hsf",
        "tower cooler",
        "shadow rock",
        "pure rock",
        "hyper 212",
        "assassin",
    ]
    if any(term in name for term in negative_terms):
        return False
    positive_terms = [
        "case fan",
        "casing fan",
        "fan case",
        "fan casing",
        "triple pack",
        "value pack",
        "single pack",
        "performance fan",
    ]
    if any(term in name for term in positive_terms):
        return True
    return specs.get("type") == "fan" and "fan" in name


def pick_fan_cooler(coolers: list[dict], budget: int) -> Optional[dict]:
    candidates = [
        c for c in coolers
        if c["price_idr"] <= budget
        and _is_case_fan_candidate(c)
    ]
    if not candidates:
        return None
    return _best_ranked_component(candidates, "fan_cooler", budget)


def pick_ssd(ssds: list[dict], budget: int) -> Optional[dict]:
    candidates = [s for s in ssds if s["price_idr"] <= budget
                  and (s["specs"].get("capacity_gb") or 0) >= 250]
    if not candidates:
        candidates = [s for s in ssds if s["price_idr"] <= budget]
    if not candidates:
        return None
    # Prefer NVMe, then largest capacity
    nvme = [s for s in candidates if s["specs"].get("interface") == "NVMe"]
    pool = nvme or candidates
    slot = "ssd" if any((s.get("category") == "ssd") for s in pool) else "hdd"
    return _best_ranked_component(pool, slot, budget)


def _component_specs(component: Optional[dict]) -> dict:
    return (component or {}).get("specs") or {}


def _normalize_spec_text(value: object) -> str:
    return str(value or "").replace(" ", "").replace("-", "").upper()


def compatibility_messages(warnings: list[dict]) -> list[str]:
    return [warning.get("message", "") for warning in warnings if warning.get("message")]


def _warning(
    warning_id: str,
    severity: str,
    slots: list[str],
    title: str,
    message: str,
    recommendation: str,
) -> dict:
    return {
        "id": warning_id,
        "severity": severity,
        "slot": slots[0] if slots else None,
        "slots": slots,
        "title": title,
        "message": message,
        "recommendation": recommendation,
    }


def validate_build(build: dict) -> list[dict]:
    """Return structured compatibility warnings. Empty list = fully compatible."""
    warnings: list[dict] = []
    cpu = build.get("cpu")
    mobo = build.get("motherboard")
    ram = build.get("ram")
    psu = build.get("psu")
    gpu = build.get("gpu")
    case = build.get("case")
    cpu_cooler = build.get("cpu_cooler") or build.get("cooler")

    if cpu and mobo:
        cpu_sock = (_component_specs(cpu).get("socket") or "").strip()
        mobo_sock = (_component_specs(mobo).get("socket") or "").strip()
        cpu_sock_key = _normalize_spec_text(cpu_sock)
        mobo_sock_key = _normalize_spec_text(mobo_sock)
        if cpu_sock_key and mobo_sock_key and cpu_sock_key not in mobo_sock_key and mobo_sock_key not in cpu_sock_key:
            warnings.append(_warning(
                "cpu_motherboard_socket_mismatch",
                "error",
                ["cpu", "motherboard"],
                "CPU and motherboard socket mismatch",
                f"CPU uses {cpu_sock}, but the motherboard uses {mobo_sock}.",
                "Choose a motherboard with the same CPU socket, or choose a CPU that matches this motherboard.",
            ))

    if mobo and ram:
        mobo_ddr = _component_specs(mobo).get("ram_type")
        ram_ddr = _component_specs(ram).get("type")
        if mobo_ddr and ram_ddr and mobo_ddr != ram_ddr:
            warnings.append(_warning(
                "motherboard_ram_type_mismatch",
                "error",
                ["motherboard", "ram"],
                "Motherboard and RAM generation mismatch",
                f"Motherboard requires {mobo_ddr}, but the selected RAM is {ram_ddr}.",
                "Use RAM with the same DDR generation as the motherboard.",
            ))

    if psu and gpu:
        watts = _component_specs(psu).get("wattage_w") or 0
        rec = _component_specs(gpu).get("recommended_psu_w") or 0
        if watts and rec and watts < rec:
            warnings.append(_warning(
                "psu_headroom_low",
                "warning",
                ["psu", "gpu"],
                "PSU wattage is below GPU recommendation",
                f"PSU provides {watts}W, while the GPU recommendation is {rec}W.",
                "Pick a higher wattage PSU to protect stability and future upgrades.",
            ))

    if case and mobo:
        max_ff = _component_specs(case).get("max_form_factor", "ATX")
        mobo_ff = _component_specs(mobo).get("form_factor", "ATX")
        if not case_fits_mobo(max_ff, mobo_ff):
            warnings.append(_warning(
                "case_motherboard_form_factor_mismatch",
                "error",
                ["case", "motherboard"],
                "Casing does not fit motherboard form factor",
                f"Casing supports up to {max_ff}, but the motherboard is {mobo_ff}.",
                "Choose a larger casing or a smaller motherboard form factor.",
            ))

    if cpu and cpu_cooler:
        cpu_tdp = _component_specs(cpu).get("tdp_w") or 0
        cooler_tdp = _component_specs(cpu_cooler).get("tdp_w") or 0
        if cpu_tdp and cooler_tdp and cooler_tdp < cpu_tdp:
            warnings.append(_warning(
                "cpu_cooler_capacity_low",
                "warning",
                ["cpu_cooler", "cpu"],
                "CPU cooler may be too small",
                f"CPU is rated around {cpu_tdp}W, while the cooler is rated around {cooler_tdp}W.",
                "Choose a stronger air cooler or liquid cooler for better thermal headroom.",
            ))

    return warnings


def _pick_upgrade_motherboard(
    motherboards: list[dict],
    budget: int,
    detected_existing: dict[str, dict],
) -> Optional[dict]:
    cpu_socket = _component_specs(detected_existing.get("cpu")).get("socket")
    ram_type = _component_specs(detected_existing.get("ram")).get("type")
    case_max_ff = _component_specs(detected_existing.get("case")).get("max_form_factor")

    candidates = [m for m in motherboards if m.get("price_idr", 0) <= budget]
    if cpu_socket:
        candidates = [
            m for m in candidates
            if _normalize_spec_text(cpu_socket) in _normalize_spec_text(_component_specs(m).get("socket"))
        ]
    if ram_type:
        candidates = [
            m for m in candidates
            if _component_specs(m).get("ram_type") == ram_type
        ]
    if case_max_ff:
        candidates = [
            m for m in candidates
            if case_fits_mobo(case_max_ff, _component_specs(m).get("form_factor", "ATX"))
        ]
    if not candidates:
        return None
    return _best_ranked_component(candidates, "motherboard", budget)


def _best_ram_upgrade(rams: list[dict], budget: int, detected_ram: Optional[dict], detected_mobo: Optional[dict]) -> Optional[dict]:
    ram_specs = _component_specs(detected_ram)
    mobo_specs = _component_specs(detected_mobo)
    ram_type = ram_specs.get("type") or mobo_specs.get("ram_type")
    current_capacity = ram_specs.get("capacity_gb") or 0
    candidates = [r for r in rams if r.get("price_idr", 0) <= budget]
    if ram_type:
        candidates = [r for r in candidates if _component_specs(r).get("type") == ram_type]
    better = [r for r in candidates if (_component_specs(r).get("capacity_gb") or 0) > current_capacity]
    if not better:
        return None
    return _best_ranked_component(
        better,
        "ram",
        budget,
        {"current_capacity_gb": current_capacity, "target_capacity_gb": max(current_capacity + 1, 32)},
    )


def _best_gpu_upgrade(gpus: list[dict], budget: int, detected_gpu: Optional[dict], use_case: str = "gaming") -> Optional[dict]:
    current_vram = _component_specs(detected_gpu).get("vram_gb") or 0
    candidates = [g for g in gpus if g.get("price_idr", 0) <= budget]
    better = [g for g in candidates if (_component_specs(g).get("vram_gb") or 0) > current_vram]
    pool = better or candidates
    if not pool:
        return None
    return _best_ranked_component(
        pool,
        "gpu",
        budget,
        {"current_vram_gb": current_vram, "use_case": use_case},
    )


def _build_upgrade_priorities(
    components: dict[str, list[dict]],
    budget: int,
    use_case: str,
    detected_existing: dict[str, dict],
    baseline: dict,
) -> list[dict]:
    """Rank missing and weak owned parts into budget-aware upgrade priorities.

    This is intentionally heuristic, not AI-driven. The goal is to produce a
    stable, explainable order that can be tested against typed inputs while the
    data pipeline matures.
    """
    priorities: list[dict] = []

    def add(slot: str, score: int, title: str, reason: str, candidate: Optional[dict]) -> None:
        if candidate is None:
            return
        priorities.append({
            "slot": slot,
            "score": score,
            "title": title,
            "reason": reason,
            "component": normalize_marketplace_links(candidate),
            "estimated_cost_idr": int(candidate.get("price_idr", 0)),
            "selected": False,
        })

    detected_gpu = detected_existing.get("gpu")
    gpu_specs = _component_specs(detected_gpu)
    if "gpu" not in detected_existing:
        add(
            "gpu",
            UPGRADE_PRIORITY_SCORES["missing_gpu_gaming"] if use_case == "gaming" else UPGRADE_PRIORITY_SCORES["missing_gpu_general"],
            "Add a dedicated GPU",
            "A GPU is the largest performance lever for gaming and visual workloads.",
            baseline.get("components", {}).get("gpu"),
        )
    elif use_case == "gaming" and (gpu_specs.get("vram_gb") or 0) < 8:
        add(
            "gpu",
            UPGRADE_PRIORITY_SCORES["weak_gaming_gpu"],
            "Upgrade GPU first",
            "Your typed GPU looks below the 8GB VRAM target, so this is likely the biggest gaming improvement.",
            _best_gpu_upgrade(components.get("gpu", []), budget, detected_gpu, use_case),
        )

    detected_ram = detected_existing.get("ram")
    ram_specs = _component_specs(detected_ram)
    if "ram" not in detected_existing:
        add(
            "ram",
            UPGRADE_PRIORITY_SCORES["missing_ram"],
            "Add RAM",
            "RAM is required for a complete build and affects multitasking smoothness.",
            baseline.get("components", {}).get("ram"),
        )
    elif (ram_specs.get("capacity_gb") or 0) < (32 if use_case in {"gaming", "content_creation", "productivity"} else 16):
        add(
            "ram",
            UPGRADE_PRIORITY_SCORES["ram_capacity"],
            "Increase RAM capacity",
            "Your typed RAM capacity is below the recommended target for this performance goal.",
            _best_ram_upgrade(components.get("ram", []), budget, detected_ram, detected_existing.get("motherboard")),
        )

    detected_psu = detected_existing.get("psu")
    psu_specs = _component_specs(detected_psu)
    gpu_rec = (
        _component_specs((priorities[0].get("component") if priorities and priorities[0]["slot"] == "gpu" else None)).get("recommended_psu_w")
        or _component_specs(detected_existing.get("gpu")).get("recommended_psu_w")
        or 550
    )
    if "psu" not in detected_existing:
        add(
            "psu",
            UPGRADE_PRIORITY_SCORES["missing_psu"],
            "Add PSU",
            "A known PSU gives the upgrade plan safer power headroom.",
            baseline.get("components", {}).get("psu"),
        )
    elif (psu_specs.get("wattage_w") or 0) < gpu_rec:
        add(
            "psu",
            UPGRADE_PRIORITY_SCORES["psu_headroom"],
            "Upgrade PSU headroom",
            f"Your typed PSU is below the {gpu_rec}W target for the planned graphics upgrade.",
            pick_psu(components.get("psu", []), budget, gpu_rec),
        )

    if "motherboard" not in detected_existing:
        add(
            "motherboard",
            UPGRADE_PRIORITY_SCORES["missing_motherboard"],
            "Choose compatible motherboard",
            "A motherboard is needed to anchor CPU socket, RAM generation, and case fit.",
            _pick_upgrade_motherboard(components.get("motherboard", []), budget, detected_existing)
            or baseline.get("components", {}).get("motherboard"),
        )

    if "ssd" not in detected_existing:
        add(
            "ssd",
            UPGRADE_PRIORITY_SCORES["missing_ssd"],
            "Add fast SSD storage",
            "An NVMe SSD is a low-risk upgrade that improves boot and load times.",
            baseline.get("components", {}).get("ssd"),
        )

    priorities.sort(key=lambda item: (-item["score"], item["estimated_cost_idr"]))
    return priorities


def _select_priority_upgrades(priorities: list[dict], budget: int) -> dict[str, Optional[dict]]:
    selected: dict[str, Optional[dict]] = {}
    spent = 0
    for item in priorities:
        cost = item.get("estimated_cost_idr") or 0
        if cost <= 0 or spent + cost <= budget:
            selected[item["slot"]] = item["component"]
            item["selected"] = True
            spent += cost
        else:
            item["selected"] = False
    return selected


def _component_ref(component: Optional[dict]) -> str:
    if not component:
        return ""
    return str(component.get("sku") or component.get("id") or "").strip()


def _component_price(component: Optional[dict]) -> int:
    try:
        return int((component or {}).get("price_idr") or 0)
    except (TypeError, ValueError):
        return 0


def _build_total(build: dict[str, Optional[dict]]) -> int:
    return sum(_component_price(build.get(slot)) for slot in REQUIRED_BUILD_SLOTS)


def _has_error_compatibility(warnings: list[dict]) -> bool:
    return any(warning.get("severity") == "error" for warning in warnings)


def _candidate_category(slot: str) -> str:
    return "cooler" if slot in {"cpu_cooler", "fan_cooler"} else slot


def _candidate_fits_slot(
    slot: str,
    candidate: dict,
    build: dict[str, Optional[dict]],
    *,
    cpu_brand: Optional[str],
    gpu_vendor: Optional[str],
) -> bool:
    specs = candidate.get("specs") or {}

    if slot == "cpu":
        if cpu_brand and (specs.get("brand") or "").lower() != cpu_brand.strip().lower():
            return False
        motherboard = build.get("motherboard")
        if motherboard:
            cpu_socket = _normalize_spec_text(specs.get("socket"))
            mobo_socket = _normalize_spec_text(_component_specs(motherboard).get("socket"))
            if cpu_socket and mobo_socket and cpu_socket not in mobo_socket and mobo_socket not in cpu_socket:
                return False
    elif slot == "gpu":
        if gpu_vendor:
            wanted = _GPU_VENDOR_ALIASES.get(gpu_vendor.strip().lower())
            got = (specs.get("vendor") or "").lower()
            if wanted and got != wanted:
                return False
    elif slot == "motherboard":
        cpu = build.get("cpu")
        ram = build.get("ram")
        if cpu:
            cpu_socket = _normalize_spec_text(_component_specs(cpu).get("socket"))
            mobo_socket = _normalize_spec_text(specs.get("socket"))
            if cpu_socket and mobo_socket and cpu_socket not in mobo_socket and mobo_socket not in cpu_socket:
                return False
        if ram:
            ram_type = _component_specs(ram).get("type")
            if ram_type and specs.get("ram_type") and ram_type != specs.get("ram_type"):
                return False
    elif slot == "ram":
        motherboard = build.get("motherboard")
        required = _component_specs(motherboard).get("ram_type") if motherboard else None
        if required and specs.get("type") != required:
            return False
    elif slot == "psu":
        gpu = build.get("gpu")
        min_watts = _component_specs(gpu).get("recommended_psu_w") if gpu else 450
        if (specs.get("wattage_w") or 0) < (min_watts or 450):
            return False
    elif slot == "case":
        motherboard = build.get("motherboard")
        mobo_ff = _component_specs(motherboard).get("form_factor", "ATX")
        if not case_fits_mobo(specs.get("max_form_factor", "ATX"), mobo_ff):
            return False
    elif slot == "cpu_cooler":
        if specs.get("type") not in {"air", "liquid"}:
            return False
    elif slot == "fan_cooler":
        if not _is_case_fan_candidate(candidate):
            return False
    elif slot == "ssd":
        if (specs.get("capacity_gb") or 0) < 250:
            return False

    return True


def _strategy_target_specs(slot: str, use_case: str, performance_priority: str) -> dict:
    target = {"use_case": use_case, "performance_priority": performance_priority}
    if slot == "ram":
        target["target_capacity_gb"] = 32 if performance_priority in {"gaming", "productivity"} else 16
    return target


def _strategy_candidate_score(
    component: Optional[dict],
    slot: str,
    budget: int,
    use_case: str,
    performance_priority: str,
    budget_strategy: str,
) -> float:
    if not component:
        return -1_000_000.0
    target = _strategy_target_specs(slot, use_case, performance_priority)
    score = _component_score(component, slot, budget, target)
    if budget_strategy == "maximize":
        score += _component_performance_units(component, slot, target) * 0.65
        if slot in {"gpu", "cpu"}:
            score += _component_price(component) / 150_000
    elif budget_strategy == "value":
        score += _value_score(_component_performance_units(component, slot, target), component)
        score -= _component_price(component) / 1_000_000
    return score


def _replacement_candidates(
    catalog: dict[str, list[dict]],
    build: dict[str, Optional[dict]],
    slot: str,
    budget: int,
    use_case: str,
    budget_strategy: str,
    performance_priority: str,
    *,
    cpu_brand: Optional[str],
    gpu_vendor: Optional[str],
) -> list[dict]:
    current = build.get(slot)
    current_price = _component_price(current)
    total = _build_total(build)
    max_price = current_price + max(0, budget - total)
    category = _candidate_category(slot)
    current_ref = _component_ref(current)
    target = _strategy_target_specs(slot, use_case, performance_priority)
    current_score = _strategy_candidate_score(
        current,
        slot,
        max(current_price, 1),
        use_case,
        performance_priority,
        budget_strategy,
    )

    candidates: list[dict] = []
    for candidate in catalog.get(category, []):
        candidate_price = _component_price(candidate)
        if candidate_price <= current_price or candidate_price > max_price:
            continue
        if _component_ref(candidate) == current_ref:
            continue
        if not _candidate_fits_slot(
            slot,
            candidate,
            build,
            cpu_brand=cpu_brand,
            gpu_vendor=gpu_vendor,
        ):
            continue
        next_build = {**build, slot: candidate}
        if slot == "cpu_cooler":
            next_build["cooler"] = candidate
        if _has_error_compatibility(validate_build(next_build)):
            continue
        candidate_score = _strategy_candidate_score(
            candidate,
            slot,
            max(max_price, candidate_price, 1),
            use_case,
            performance_priority,
            budget_strategy,
        )
        if (
            candidate_score <= current_score + 4
            and _component_performance_units(candidate, slot, target)
            <= _component_performance_units(current or {}, slot, target)
        ):
            continue
        candidates.append(candidate)

    return sorted(
        candidates,
        key=lambda component: (
            _strategy_candidate_score(component, slot, max(max_price, 1), use_case, performance_priority, budget_strategy),
            _component_price(component),
        ),
        reverse=True,
    )


def _upgrade_reason(slot: str, performance_priority: str) -> str:
    if slot == "gpu":
        return "Higher graphics tier improves gaming frame rate and visual settings first."
    if slot == "cpu":
        return "Stronger CPU improves minimum FPS, simulation, streaming, and multitasking headroom."
    if slot == "ram":
        return "More or faster memory improves modern game and workload headroom."
    if slot == "psu":
        return "Extra PSU headroom protects stability for stronger CPU/GPU combinations."
    if slot == "motherboard":
        return "A stronger platform improves upgrade runway and connectivity."
    if slot == "ssd":
        return "More NVMe storage improves application and game library flexibility."
    if slot == "cpu_cooler":
        return "More cooling headroom helps sustained boost clocks and noise."
    if slot == "case":
        return "Better case compatibility and airflow keeps future upgrades easier."
    return f"Improves the {performance_priority.replace('_', ' ')} balance of the build."


def _make_upgrade_suggestion(
    slot: str,
    current: Optional[dict],
    candidate: dict,
    build: dict[str, Optional[dict]],
    performance_priority: str,
) -> dict:
    added_cost = _component_price(candidate) - _component_price(current)
    return {
        "slot": slot,
        "current": normalize_marketplace_links(current),
        "candidate": normalize_marketplace_links(candidate),
        "added_cost_idr": added_cost,
        "projected_total_idr": _build_total(build) + added_cost,
        "reason": _upgrade_reason(slot, performance_priority),
    }


def _budget_usage(total: int, budget: int, budget_strategy: str, status: str) -> dict:
    targets = BUDGET_USAGE_TARGETS[budget_strategy]
    return {
        "strategy": budget_strategy,
        "used_percent": round((total / budget) * 100, 1) if budget else 0.0,
        "target_min_percent": round(targets["min"] * 100, 1),
        "target_max_percent": round(targets["max"] * 100, 1),
        "status": status,
    }


def _strategy_status(total: int, budget: int, budget_strategy: str, suggestions: list[dict], applied_count: int) -> str:
    if budget_strategy == "value":
        return "value_preserved"
    used_ratio = total / budget if budget else 0.0
    target = BUDGET_USAGE_TARGETS[budget_strategy]["min"]
    if used_ratio >= target:
        return "optimized" if applied_count else "target_met"
    return "under_target" if suggestions else "catalog_limited"


def _budget_warnings(total: int, budget: int, budget_strategy: str, status: str, suggestions: list[dict]) -> list[dict]:
    if budget_strategy == "value" or status in {"target_met", "optimized", "value_preserved"}:
        return []
    remaining = max(0, budget - total)
    used_percent = round((total / budget) * 100, 1) if budget else 0.0
    return [{
        "code": "budget_underused",
        "severity": "warning",
        "title": "Budget is not fully used",
        "message": (
            f"This build uses {used_percent}% of the available budget and leaves "
            f"{remaining:,} IDR unused."
        ),
        "recommendation": (
            "Review the suggested upgrades before buying."
            if suggestions
            else "No compatible high-impact catalog upgrade is available for the remaining budget."
        ),
        "suggested_slots": [suggestion["slot"] for suggestion in suggestions[:3]],
    }]


def _performance_balance_summary(build: dict[str, Optional[dict]], use_case: str, performance_priority: str) -> dict:
    cpu = build.get("cpu")
    gpu = build.get("gpu")
    ram = build.get("ram")
    cpu_name = (cpu or {}).get("name") or "CPU"
    gpu_name = (gpu or {}).get("name") or "GPU"
    ram_specs = _component_specs(ram)

    notes: list[str] = []
    if use_case == "gaming" and gpu:
        notes.append(f"GPU choice ({gpu_name}) is the primary gaming performance lever.")
    if cpu and "x3d" in cpu_name.lower():
        notes.append("X3D CPU cache helps gaming frame pacing and minimum FPS.")
    if ram_specs.get("capacity_gb"):
        notes.append(f"{ram_specs['capacity_gb']}GB RAM supports the selected workload target.")
    if not notes:
        notes.append(f"CPU ({cpu_name}) and GPU ({gpu_name}) are checked against compatibility and budget balance.")

    return {
        "priority": performance_priority,
        "summary": " ".join(notes),
        "bottleneck_risk": "low" if cpu and gpu else "review",
    }


def _build_alternative_options(
    catalog: dict[str, list[dict]],
    build: dict[str, Optional[dict]],
    budget: int,
    use_case: str,
    budget_strategy: str,
    performance_priority: str,
    *,
    cpu_brand: Optional[str],
    gpu_vendor: Optional[str],
) -> dict[str, list[dict]]:
    alternatives: dict[str, list[dict]] = {}
    for slot in ["cpu", "gpu", "ram", "ssd", "psu"]:
        candidates = _replacement_candidates(
            catalog,
            build,
            slot,
            budget,
            use_case,
            budget_strategy,
            performance_priority,
            cpu_brand=cpu_brand,
            gpu_vendor=gpu_vendor,
        )
        if candidates:
            alternatives[slot] = [
                _make_upgrade_suggestion(
                    slot,
                    build.get(slot),
                    candidate,
                    build,
                    performance_priority,
                )
                for candidate in candidates[:3]
            ]
    return alternatives


def _apply_budget_strategy(
    catalog: dict[str, list[dict]],
    build: dict[str, Optional[dict]],
    budget: int,
    use_case: str,
    *,
    budget_strategy: str,
    performance_priority: str,
    cpu_brand: Optional[str],
    gpu_vendor: Optional[str],
) -> tuple[dict[str, Optional[dict]], dict, list[dict], list[dict], dict[str, list[dict]], dict]:
    optimized = dict(build)
    applied_count = 0
    suggestions: list[dict] = []
    order = PRIORITY_UPGRADE_ORDER.get(performance_priority, PRIORITY_UPGRADE_ORDER["balanced"])

    for slot in REQUIRED_BUILD_SLOTS:
        if optimized.get(slot) is not None:
            continue
        candidates = _replacement_candidates(
            catalog,
            optimized,
            slot,
            budget,
            use_case,
            budget_strategy,
            performance_priority,
            cpu_brand=cpu_brand,
            gpu_vendor=gpu_vendor,
        )
        if not candidates:
            continue
        candidate = candidates[0]
        suggestions.append(_make_upgrade_suggestion(slot, optimized.get(slot), candidate, optimized, performance_priority))
        optimized[slot] = normalize_marketplace_links(candidate)
        if slot == "cpu_cooler":
            optimized["cooler"] = optimized[slot]
        applied_count += 1

    if budget_strategy == "value":
        for slot in order:
            candidates = _replacement_candidates(
                catalog,
                optimized,
                slot,
                budget,
                use_case,
                budget_strategy,
                performance_priority,
                cpu_brand=cpu_brand,
                gpu_vendor=gpu_vendor,
            )
            if candidates:
                suggestions.append(_make_upgrade_suggestion(slot, optimized.get(slot), candidates[0], optimized, performance_priority))
        status = _strategy_status(_build_total(optimized), budget, budget_strategy, suggestions, applied_count)
        usage = _budget_usage(_build_total(optimized), budget, budget_strategy, status)
        return optimized, usage, [], suggestions[:5], _build_alternative_options(
            catalog,
            optimized,
            budget,
            use_case,
            budget_strategy,
            performance_priority,
            cpu_brand=cpu_brand,
            gpu_vendor=gpu_vendor,
        ), _performance_balance_summary(optimized, use_case, performance_priority)

    target = BUDGET_USAGE_TARGETS[budget_strategy]["min"]
    for _ in range(3):
        if budget and _build_total(optimized) / budget >= target:
            break
        applied_this_pass = False
        for slot in order:
            if budget and _build_total(optimized) / budget >= target:
                break
            candidates = _replacement_candidates(
                catalog,
                optimized,
                slot,
                budget,
                use_case,
                budget_strategy,
                performance_priority,
                cpu_brand=cpu_brand,
                gpu_vendor=gpu_vendor,
            )
            if not candidates:
                continue
            candidate = candidates[0]
            suggestions.append(_make_upgrade_suggestion(slot, optimized.get(slot), candidate, optimized, performance_priority))
            optimized[slot] = normalize_marketplace_links(candidate)
            if slot == "cpu_cooler":
                optimized["cooler"] = optimized[slot]
            applied_count += 1
            applied_this_pass = True
        if not applied_this_pass:
            break

    remaining_suggestions: list[dict] = []
    for slot in order:
        candidates = _replacement_candidates(
            catalog,
            optimized,
            slot,
            budget,
            use_case,
            budget_strategy,
            performance_priority,
            cpu_brand=cpu_brand,
            gpu_vendor=gpu_vendor,
        )
        if candidates:
            remaining_suggestions.append(_make_upgrade_suggestion(slot, optimized.get(slot), candidates[0], optimized, performance_priority))

    total = _build_total(optimized)
    status = _strategy_status(total, budget, budget_strategy, remaining_suggestions, applied_count)
    usage = _budget_usage(total, budget, budget_strategy, status)
    warnings = _budget_warnings(total, budget, budget_strategy, status, remaining_suggestions)
    return optimized, usage, warnings, remaining_suggestions[:5], _build_alternative_options(
        catalog,
        optimized,
        budget,
        use_case,
        budget_strategy,
        performance_priority,
        cpu_brand=cpu_brand,
        gpu_vendor=gpu_vendor,
    ), _performance_balance_summary(optimized, use_case, performance_priority)


def compose_build(
    components: dict[str, list[dict]],
    budget: int,
    use_case: str,
    *,
    cpu_brand: Optional[str] = None,
    gpu_vendor: Optional[str] = None,
    include_optional_addons: bool = False,
    optional_addon_slots: Optional[list[str]] = None,
    budget_strategy: Optional[str] = None,
    performance_priority: Optional[str] = None,
    allocation_overrides: Optional[dict[str, int]] = None,
    _apply_budget_optimizer: bool = True,
) -> dict:
    if use_case not in USE_CASE_PROFILES:
        raise ValueError(f"Unknown use case: {use_case}. Valid: {list(USE_CASE_PROFILES)}")
    budget_strategy = normalize_budget_strategy(budget_strategy)
    performance_priority = normalize_performance_priority(performance_priority, use_case)
    initial_scoring_priority = performance_priority if _apply_budget_optimizer else None
    profile = strategy_allocation_profile(use_case, performance_priority, budget_strategy, allocation_overrides)

    alloc = {slot: int(budget * pct / 100) for slot, pct in profile.items()}
    build: dict[str, Optional[dict]] = {}
    slot_budgets: dict[str, int] = {}
    slot_targets: dict[str, dict] = {}
    leftover = 0
    unmet_preferences: list[str] = []

    def next_slot_budget(slot: str) -> int:
        return max(alloc[slot] + leftover, 1)

    # CPU first → fixes socket
    cpu_budget = alloc["cpu"]
    if budget_strategy == "maximize" and initial_scoring_priority == "gaming" and budget >= 22_000_000:
        cpu_budget = max(cpu_budget, int(budget * 0.24))
    slot_budgets["cpu"] = cpu_budget
    cpu = pick_cpu(
        components.get("cpu", []),
        cpu_budget,
        brand=cpu_brand,
        use_case=use_case,
        performance_priority=initial_scoring_priority,
    )
    build["cpu"] = cpu
    if cpu:
        leftover += alloc["cpu"] - cpu["price_idr"]
        if cpu_brand and (cpu["specs"].get("brand") or "").lower() != cpu_brand.strip().lower():
            unmet_preferences.append(
                f"Requested {cpu_brand} CPU, but no {cpu_brand} option fit the {alloc['cpu']:,} IDR allocation — picked best fit instead."
            )

    socket = cpu["specs"].get("socket") if cpu else None
    cpu_ddr = cpu["specs"].get("ram_type") if cpu else None

    # Motherboard — must match socket
    mobo_budget = alloc["motherboard"] + leftover
    slot_budgets["motherboard"] = mobo_budget
    mobo = pick_motherboard(components.get("motherboard", []), mobo_budget, socket or "")
    build["motherboard"] = mobo
    if mobo:
        leftover = alloc["motherboard"] + leftover - mobo["price_idr"]
    ram_type = (mobo["specs"].get("ram_type") if mobo else None) or cpu_ddr

    # RAM
    ram_budget = next_slot_budget("ram")
    ram_target = {"target_capacity_gb": _target_ram_capacity(use_case, budget)}
    slot_budgets["ram"] = ram_budget
    slot_targets["ram"] = ram_target
    ram = pick_ram(
        components.get("ram", []),
        ram_budget,
        ram_type,
        target_capacity_gb=ram_target["target_capacity_gb"],
    )
    build["ram"] = ram
    if ram:
        leftover = alloc["ram"] + leftover - ram["price_idr"]

    # GPU (skip for office unless CPU lacks iGPU)
    base_gpu_budget = next_slot_budget("gpu")
    gpu_budget = base_gpu_budget
    if budget_strategy == "maximize" and initial_scoring_priority == "gaming" and budget >= 22_000_000:
        gpu_budget = max(gpu_budget, int(budget * 0.42))
    slot_budgets["gpu"] = gpu_budget
    slot_targets["gpu"] = {"use_case": use_case, "performance_priority": initial_scoring_priority}
    if use_case == "office" and cpu and cpu["specs"].get("has_igpu"):
        build["gpu"] = None
        leftover += alloc["gpu"]
    else:
        gpu = pick_gpu(
            components.get("gpu", []),
            gpu_budget,
            vendor=gpu_vendor,
            use_case=use_case,
            performance_priority=initial_scoring_priority,
        )
        build["gpu"] = gpu
        if gpu:
            leftover = base_gpu_budget - gpu["price_idr"]
            if gpu_vendor:
                want = _GPU_VENDOR_ALIASES.get(gpu_vendor.strip().lower())
                got = (gpu["specs"].get("vendor") or "").lower()
                if want and got != want:
                    unmet_preferences.append(
                        f"Requested {gpu_vendor} GPU, but no {gpu_vendor} option fit the budget — picked best fit instead."
                    )
        else:
            leftover = base_gpu_budget

    # SSD
    ssd_budget = next_slot_budget("ssd")
    slot_budgets["ssd"] = ssd_budget
    ssd = pick_ssd(components.get("ssd", []), ssd_budget)
    build["ssd"] = ssd
    if ssd:
        leftover = alloc["ssd"] + leftover - ssd["price_idr"]

    # PSU — sized to GPU
    min_watts = 450
    if build.get("gpu"):
        min_watts = max(min_watts, build["gpu"]["specs"].get("recommended_psu_w") or 500)
    psu_budget = next_slot_budget("psu")
    slot_budgets["psu"] = psu_budget
    slot_targets["psu"] = {"min_watts": min_watts}
    psu = pick_psu(components.get("psu", []), psu_budget, min_watts)
    build["psu"] = psu
    if psu:
        leftover = alloc["psu"] + leftover - psu["price_idr"]

    # Case — fits motherboard
    mobo_ff = (mobo["specs"].get("form_factor") if mobo else None) or "ATX"
    case_budget = next_slot_budget("case")
    slot_budgets["case"] = case_budget
    slot_targets["case"] = {"mobo_ff": mobo_ff}
    case = pick_case(components.get("case", []), case_budget, mobo_ff)
    build["case"] = case
    if case:
        leftover = alloc["case"] + leftover - case["price_idr"]

    # CPU cooler - prefer liquid for high-TDP gaming/content builds.
    prefer_liquid = use_case in {"gaming", "content_creation"} and budget >= 15_000_000
    cpu_cooler_budget = next_slot_budget("cpu_cooler")
    slot_budgets["cpu_cooler"] = cpu_cooler_budget
    slot_targets["cpu_cooler"] = {"prefer_liquid": prefer_liquid}
    cpu_cooler = pick_cooler(
        components.get("cooler", []),
        cpu_cooler_budget,
        prefer_liquid,
    )
    build["cpu_cooler"] = cpu_cooler
    if cpu_cooler:
        leftover = alloc["cpu_cooler"] + leftover - cpu_cooler["price_idr"]

    # Fan cooler - case airflow support; may be absent in the current catalog.
    fan_cooler_budget = next_slot_budget("fan_cooler")
    slot_budgets["fan_cooler"] = fan_cooler_budget
    fan_cooler = pick_fan_cooler(
        components.get("cooler", []),
        fan_cooler_budget,
    )
    build["fan_cooler"] = fan_cooler

    # Preserve old key for callers during transition.
    build["cooler"] = cpu_cooler

    normalized_build = {}
    for slot in REQUIRED_BUILD_SLOTS:
        component = normalize_marketplace_links(build.get(slot))
        if component is not None:
            component["selection_rationale"] = _selection_rationale(
                slot,
                component,
                slot_budgets.get(slot, alloc.get(slot, 0)),
                use_case,
                slot_targets.get(slot),
            )
        normalized_build[slot] = component

    if _apply_budget_optimizer:
        (
            normalized_build,
            budget_usage,
            budget_warnings,
            upgrade_suggestions,
            alternative_options,
            performance_balance,
        ) = _apply_budget_strategy(
            components,
            normalized_build,
            budget,
            use_case,
            budget_strategy=budget_strategy,
            performance_priority=performance_priority,
            cpu_brand=cpu_brand,
            gpu_vendor=gpu_vendor,
        )
    else:
        total_before_optimization = _build_total(normalized_build)
        status = _strategy_status(total_before_optimization, budget, budget_strategy, [], 0)
        budget_usage = _budget_usage(total_before_optimization, budget, budget_strategy, status)
        budget_warnings = _budget_warnings(total_before_optimization, budget, budget_strategy, status, [])
        upgrade_suggestions = []
        alternative_options = {}
        performance_balance = _performance_balance_summary(normalized_build, use_case, performance_priority)

    for slot in REQUIRED_BUILD_SLOTS:
        component = normalized_build.get(slot)
        if component is not None:
            component["selection_rationale"] = _selection_rationale(
                slot,
                component,
                max(slot_budgets.get(slot, _component_price(component)), _component_price(component)),
                use_case,
                slot_targets.get(slot) or _strategy_target_specs(slot, use_case, performance_priority),
            )

    missing_slots = [slot for slot, value in normalized_build.items() if value is None]

    optional_addons = {slot: None for slot in OPTIONAL_ADDON_SLOTS}
    unavailable_optional_addons: list[str] = []
    requested_optional_addons = selected_optional_addon_slots(
        include_optional_addons,
        optional_addon_slots,
    )
    if requested_optional_addons:
        for slot in requested_optional_addons:
            candidates = components.get(slot, [])
            addon_budget = max(int(budget * 0.15), 1)
            if slot == "hdd":
                addon_budget = max(int(budget * 0.08), 1_000_000)
                pick = pick_ssd(candidates, addon_budget)
            elif slot == "ups":
                addon_budget = max(addon_budget, 1_500_000)
                pick = pick_ups(candidates, addon_budget, normalized_build)
            elif slot == "monitor":
                pick = pick_monitor(candidates, addon_budget, normalized_build, use_case, budget)
            else:
                pick = _best_ranked_component(
                    [c for c in candidates if c.get("price_idr", 0) <= addon_budget],
                    slot,
                    addon_budget,
                )
            normalized_pick = normalize_marketplace_links(pick)
            if normalized_pick is not None:
                normalized_pick.setdefault(
                    "selection_rationale",
                    _selection_rationale(
                        slot,
                        normalized_pick,
                        addon_budget,
                        use_case,
                    ),
                )
            optional_addons[slot] = normalized_pick
            if pick is None:
                unavailable_optional_addons.append(slot)

    total = sum(c["price_idr"] for c in normalized_build.values() if c)
    status = _strategy_status(total, budget, budget_strategy, upgrade_suggestions, 0)
    if budget_usage["used_percent"] != (round((total / budget) * 100, 1) if budget else 0.0):
        budget_usage = _budget_usage(total, budget, budget_strategy, status)
        budget_warnings = _budget_warnings(total, budget, budget_strategy, status, upgrade_suggestions)
    compatibility_warnings = validate_build({
        "cpu": normalized_build.get("cpu"),
        "motherboard": normalized_build.get("motherboard"),
        "ram": normalized_build.get("ram"),
        "gpu": normalized_build.get("gpu"),
        "psu": normalized_build.get("psu"),
        "case": normalized_build.get("case"),
        "cpu_cooler": normalized_build.get("cpu_cooler"),
    })
    issues = compatibility_messages(compatibility_warnings)

    return {
        "use_case": use_case,
        "budget_idr": budget,
        "total_idr": total,
        "remaining_idr": budget - total,
        "budget_band": budget_band_for(budget),
        "budget_strategy": budget_strategy,
        "performance_priority": performance_priority,
        "budget_usage": budget_usage,
        "budget_warnings": budget_warnings,
        "upgrade_suggestions": upgrade_suggestions,
        "alternative_options": alternative_options,
        "performance_balance": performance_balance,
        "components": normalized_build,
        "optional_addons": optional_addons,
        "missing_slots": missing_slots,
        "unavailable_optional_addons": unavailable_optional_addons,
        "compatibility_warnings": compatibility_warnings,
        "compatibility_issues": issues,
        "preferences": {
            "cpu_brand": cpu_brand,
            "gpu_vendor": gpu_vendor,
        },
        "unmet_preferences": unmet_preferences,
    }


def recommend_upgrade(
    components: dict[str, list[dict]],
    budget: int,
    use_case: str,
    existing_components: dict[str, str],
) -> dict:
    analysis = analyze_existing_components(existing_components)
    baseline = compose_build(components, budget, use_case, include_optional_addons=False)
    detected_existing = analysis["detected_existing"]
    upgrade_priorities = _build_upgrade_priorities(
        components,
        budget,
        use_case,
        detected_existing,
        baseline,
    )
    recommended_components = _select_priority_upgrades(upgrade_priorities, budget)

    combined_build = {
        slot: detected_existing.get(slot) or recommended_components.get(slot)
        for slot in REQUIRED_BUILD_SLOTS
    }
    compatibility_warnings = analysis["warning_objects"] + validate_build(combined_build)
    compatibility_notes = analysis["warnings"] + compatibility_messages(compatibility_warnings[len(analysis["warning_objects"]):])

    return {
        "mode": "upgrade",
        "budget_idr": budget,
        "use_case": use_case,
        "recognized_existing": analysis["recognized"],
        "detected_existing": detected_existing,
        "unknown_existing": analysis["unknown"],
        "recommendation": {
            "components": recommended_components,
            "total_idr": sum(
                (component or {}).get("price_idr", 0)
                for component in recommended_components.values()
            ),
        },
        "upgrade_priorities": [
            {
                key: value
                for key, value in priority.items()
                if key != "component"
            }
            for priority in upgrade_priorities
        ],
        "compatibility_notes": compatibility_notes,
        "compatibility_warnings": compatibility_warnings,
    }


def fmt_idr(n: int) -> str:
    return f"Rp {n:,.0f}".replace(",", ".")


def print_build(result: dict) -> None:
    print(f"\n=== Custom PC Build - {result['use_case']} @ {fmt_idr(result['budget_idr'])} ===\n")
    slot_order = ["cpu", "motherboard", "ram", "gpu", "ssd", "psu", "case", "cooler"]
    print(f"{'Slot':<13} {'Price (IDR)':>16}  Component")
    print("-" * 90)
    for slot in slot_order:
        c = result["components"].get(slot)
        if c is None:
            print(f"{slot:<13} {'-':>16}  (skipped)")
        else:
            name = c["name"]
            if len(name) > 60:
                name = name[:57] + "..."
            print(f"{slot:<13} {fmt_idr(c['price_idr']):>16}  {name}")
    print("-" * 90)
    print(f"{'TOTAL':<13} {fmt_idr(result['total_idr']):>16}  "
          f"(remaining: {fmt_idr(result['remaining_idr'])})")
    if result["compatibility_issues"]:
        print("\n[!] Compatibility issues:")
        for issue in result["compatibility_issues"]:
            print(f"  - {issue}")
    else:
        print("\n[OK] All components compatible.")

    unmet = result.get("unmet_preferences") or []
    if unmet:
        print("\n[!] Unmet preferences:")
        for u in unmet:
            print(f"  - {u}")


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("--budget", type=int, required=True, help="Budget in IDR (e.g. 20000000)")
    p.add_argument("--use-case", default="gaming", choices=list(USE_CASE_PROFILES))
    p.add_argument("--cpu-brand", default=None, choices=[None, "Intel", "AMD"],
                   help="Optional CPU brand preference.")
    p.add_argument("--gpu-vendor", default=None,
                   choices=[None, "Nvidia", "AMD", "Intel"],
                   help="Optional GPU vendor preference.")
    p.add_argument("--components-file", default="data/components.json")
    p.add_argument("--output", default="data/last_build.json",
                   help="Where to write the JSON build result. Pass '' to skip.")
    args = p.parse_args()

    components = load_components(Path(args.components_file))
    result = compose_build(components, args.budget, args.use_case,
                           cpu_brand=args.cpu_brand, gpu_vendor=args.gpu_vendor)
    print_build(result)

    if args.output:
        Path(args.output).parent.mkdir(parents=True, exist_ok=True)
        Path(args.output).write_text(
            json.dumps(result, indent=2, ensure_ascii=False), encoding="utf-8"
        )
        print(f"\nBuild saved to {args.output}")


if __name__ == "__main__":
    main()
