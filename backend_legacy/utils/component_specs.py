"""Heuristic + curated spec extractors for PC components.

Parses product name + subcategory into structured specs needed by the build
composer (socket, ram_type, wattage, form_factor, vram, etc.). Free, instant,
deterministic. The curated RAM whitelist fills the gap left by enterkomputer.com
not stocking standalone DDR modules.
"""

from __future__ import annotations

import re
import json
from pathlib import Path
from typing import Optional

COMPONENT_CATEGORY_MAP = {
    "Processor": "cpu",
    "VGA": "gpu",
    "Motherboard": "motherboard",
    "RAM": "ram",
    "SSD": "ssd",
    "Hard Drive": "hdd",
    "PSU": "psu",
    "Casing": "case",
    "Cooler": "cooler",
    "LCD": "monitor",
    "UPS": "ups",
}

# Socket defaults used only when the board name does not explicitly state DDR generation.
DDR5_ONLY_SOCKETS = {"AM5", "LGA 1851", "LGA1851", "sTR5", "SP5", "LGA 4677"}
DDR4_ONLY_SOCKETS = {"AM4", "LGA 1200", "LGA1200", "LGA 1151", "LGA1151",
                     "LGA 1151V2", "LGA1151V2"}
DDR3_ONLY_SOCKETS = {"LGA 1150", "LGA1150", "LGA 1155", "LGA1155"}


def _norm(s: str) -> str:
    return (s or "").strip()


def parse_cpu(name: str, subcategory: str) -> dict:
    """Extract socket, brand, family, cores from CPU listing."""
    sub = _norm(subcategory)
    name_l = name.lower()

    # Socket comes straight from subcategory like "AMD Socket AM5" / "Intel Core i7 Socket LGA 1700"
    socket = None
    m = re.search(r"Socket\s+([A-Za-z0-9 ]+?)(?:\s*$)", sub)
    if m:
        socket = m.group(1).strip()
    elif "AM4" in sub:
        socket = "AM4"
    elif "AM5" in sub:
        socket = "AM5"

    brand = "AMD" if "AMD" in sub or any(token in name_l for token in ["ryzen", "epyc", "athlon", "bristol ridge"]) else ("Intel" if "Intel" in sub else None)

    family = None
    for fam in ("Ryzen Threadripper PRO", "Ryzen Threadripper", "EPYC", "Athlon", "Bristol Ridge",
                "Core Ultra 9", "Core Ultra 7", "Core Ultra 5",
                "Core i9", "Core i7", "Core i5", "Core i3", "Core 2 Duo", "Pentium",
                "Ryzen 9", "Ryzen 7", "Ryzen 5", "Ryzen 3"):
        if fam.lower() in name_l:
            family = fam
            break

    # Rough core count by family (used for tier/rank)
    cores_by_family = {
        "Ryzen 9": 12, "Ryzen 7": 8, "Ryzen 5": 6, "Ryzen 3": 4,
        "Core Ultra 9": 24, "Core Ultra 7": 20, "Core Ultra 5": 14,
        "Core i9": 16, "Core i7": 12, "Core i5": 10, "Core i3": 4,
        "Core 2 Duo": 2, "Pentium": 2, "Athlon": 2,
    }
    cores = cores_by_family.get(family)
    explicit_cores = re.search(r"\b(\d{1,3})\s*Core\b", name, re.IGNORECASE)
    if explicit_cores:
        cores = int(explicit_cores.group(1))

    # Has integrated graphics? (rough — F-suffix Intel and Ryzen non-G AM4 mostly don't)
    has_igpu = True
    # Intel F-suffix (e.g. 13700F, 245KF) has no iGPU
    if brand == "Intel" and re.search(r"\d{3,5}[A-Z]*F\b", name):
        has_igpu = False
    if "ryzen" in name_l and re.search(r"\b\d{4,5}X?\b", name) and "G" not in name.split()[-1].upper():
        # AM4 Ryzen non-G mostly lack iGPU; AM5 all have iGPU
        if socket == "AM4":
            has_igpu = False

    # DDR support inferred from socket
    ddr = None
    if socket and any(s in socket for s in DDR5_ONLY_SOCKETS):
        ddr = "DDR5"
    elif socket and any(s in socket for s in DDR4_ONLY_SOCKETS):
        ddr = "DDR4"
    elif socket and any(s in socket for s in DDR3_ONLY_SOCKETS):
        ddr = "DDR3"
    elif socket == "LGA 1700":
        ddr = "DDR5"  # treat LGA 1700 as DDR5 (modern boards). Validator allows mismatch warn.

    return {
        "socket": socket,
        "brand": brand,
        "family": family,
        "cores": cores,
        "has_igpu": has_igpu,
        "ram_type": ddr,
        "tdp_w": None,
    }


def parse_gpu(name: str, subcategory: str) -> dict:
    """Extract vendor, VRAM, recommended PSU."""
    name_l = name.lower()
    vendor = subcategory.strip().lower() or (
        "nvidia" if "geforce" in name_l or "rtx" in name_l or "gtx" in name_l
        else "radeon" if "radeon" in name_l or " rx " in name_l
        else "intel" if "arc" in name_l else None
    )

    vram_gb = None
    m = re.search(r"(\d+)\s*GB", name, re.IGNORECASE)
    if m:
        vram_gb = int(m.group(1))

    # Recommended PSU heuristic from model class, not raw model number.
    # RTX 5060 is a 60-class card, while RTX 5080 is an 80-class card.
    rec_psu = 500
    tier_match = re.search(r"\b(RTX|GTX|RX|Arc)\s*([A-Z]?\d{3,4})", name, re.IGNORECASE)
    if tier_match:
        prefix = tier_match.group(1).lower()
        n = re.sub(r"\D", "", tier_match.group(2))
        if n:
            num = int(n)
            if prefix in {"rtx", "gtx"}:
                generation = num // 1000
                model_class = num % 100
                if model_class >= 80:
                    rec_psu = 850
                elif model_class >= 70:
                    rec_psu = 750
                elif model_class >= 60:
                    rec_psu = 650 if generation >= 4 else 550
                else:
                    rec_psu = 550
            elif prefix == "rx":
                model_class = (num % 1000) // 100
                if model_class >= 9:
                    rec_psu = 850
                elif model_class >= 8:
                    rec_psu = 750
                elif model_class >= 6:
                    rec_psu = 650
                else:
                    rec_psu = 550
            else:
                rec_psu = 550

    return {
        "vendor": vendor,
        "vram_gb": vram_gb,
        "recommended_psu_w": rec_psu,
    }


def parse_motherboard(name: str, subcategory: str) -> dict:
    """Extract socket, ram_type, form_factor."""
    sub = _norm(subcategory)
    name_l = name.lower()

    socket = None
    m = re.search(r"Motherboard\s+(?:AMD|Intel)\s+(.+)", sub)
    if m:
        socket = m.group(1).strip()

    # Form factor from name
    form_factor = "ATX"
    if "mini-itx" in name_l or "mini itx" in name_l or " itx" in name_l or name_l.endswith("itx"):
        form_factor = "ITX"
    elif "micro" in name_l or "matx" in name_l or "m-atx" in name_l or " mATX" in name:
        form_factor = "mATX"
    elif "e-atx" in name_l or "eatx" in name_l:
        form_factor = "EATX"

    # RAM type
    ram_type = None
    if "ddr5" in name_l:
        ram_type = "DDR5"
    elif "ddr4" in name_l:
        ram_type = "DDR4"
    elif "ddr3" in name_l:
        ram_type = "DDR3"
    elif socket:
        if any(s in socket for s in DDR5_ONLY_SOCKETS):
            ram_type = "DDR5"
        elif any(s in socket for s in DDR4_ONLY_SOCKETS):
            ram_type = "DDR4"
        elif any(s in socket for s in DDR3_ONLY_SOCKETS):
            ram_type = "DDR3"
        elif "1700" in socket:
            ram_type = "DDR5"  # default newer boards

    return {
        "socket": socket,
        "form_factor": form_factor,
        "ram_type": ram_type,
    }


# Heuristic accessory detector — runs against PSU category to drop cables /
# adapters that the upstream scrape miscategorizes alongside real units.
_PSU_ACCESSORY_RE = re.compile(
    r"(?i)\b("
    r"cable\s+connector|adapter\s+cable|cable\s+extension|"
    r"pci-?e\s+(?:5\.0\s+)?adapter|"
    r"\d+\s*-?\s*pin\s+to\s+(?:dual\s+)?\d+\s*-?\s*pin|"
    r"to\s+dual\s+\d+\s*-?\s*pin|"
    r"sleeved\s+cable"
    r")\b"
)


def is_psu_accessory(name: str, wattage_w: int | None) -> bool:
    """A row in the PSU category is an accessory if its name matches the
    cable/adapter pattern AND we couldn't extract a real wattage figure."""
    if wattage_w is not None:
        return False
    return bool(_PSU_ACCESSORY_RE.search(name or ""))


def parse_psu(name: str, subcategory: str) -> dict:
    """Extract wattage, 80+ rating, and modular type from a PSU listing.

    Wattage extraction has two stages:
    1. Explicit '500W' / '500 Watt' (highest confidence)
    2. Embedded model-number wattage like 'PS-500AX', 'W500', 'A650BN' —
       any 3-4 digit number in the PSU sanity range (250-1600 W).
    """
    wattage: int | None = None
    m = re.search(r"(\d{3,4})\s*(?:W\b|Watt)", name, re.IGNORECASE)
    if m:
        w = int(m.group(1))
        if 100 <= w <= 3000:  # flagship workstation PSUs go up to 2800W
            wattage = w
    if wattage is None:
        # Fallback for model-number-encoded wattages like PS-500AX, W500, A650.
        for cand in re.findall(r"\d{3,4}", name):
            n = int(cand)
            if 250 <= n <= 3000:
                wattage = n
                break

    rating = None
    for r in ("Titanium", "Platinum", "Gold", "Silver", "Bronze", "White"):
        if r.lower() in name.lower():
            rating = r
            break

    modular = None
    nl = name.lower()
    if "full modular" in nl or "fully modular" in nl:
        modular = "full"
    elif "semi modular" in nl or "semi-modular" in nl:
        modular = "semi"
    elif "non modular" in nl or "non-modular" in nl:
        modular = "none"

    return {"wattage_w": wattage, "rating": rating, "modular": modular}


def parse_case(name: str, subcategory: str) -> dict:
    nl = name.lower()
    # Cases support up to a max form factor; we record the largest mobo accepted.
    if "e-atx" in nl or "eatx" in nl or "full tower" in nl:
        max_ff = "EATX"
    elif "mini-itx" in nl or "mini itx" in nl or "itx tower" in nl:
        max_ff = "ITX"
    elif "micro" in nl or "matx" in nl or "m-atx" in nl or "mini tower" in nl:
        max_ff = "mATX"
    else:
        max_ff = "ATX"  # default mid tower
    return {"max_form_factor": max_ff, "form_factor": max_ff}


def parse_cooler(name: str, subcategory: str) -> dict:
    sub = _norm(subcategory).lower()
    nl = name.lower()
    if "liquid" in sub or "water" in sub or "aio" in nl or "liquid" in nl:
        ctype = "liquid"
    elif "air" in sub or "heatsink" in sub:
        ctype = "air"
    elif "fan casing" in sub or "fan case" in sub:
        ctype = "fan"
    else:
        ctype = "other"
    # Radiator size for liquid
    rad = None
    m = re.search(r"(120|140|240|280|360|420)\s*mm", name, re.IGNORECASE)
    if m:
        rad = int(m.group(1))
    fan_size = rad
    cm = re.search(r"(\d{1,2})\s*CM", f"{subcategory} {name}", re.IGNORECASE)
    if cm:
        fan_size = int(cm.group(1)) * 10
    if fan_size is None:
        mm = re.search(r"(80|92|120|140)\s*mm", name, re.IGNORECASE)
        if mm:
            fan_size = int(mm.group(1))
    tdp_w = None
    if ctype == "liquid":
        tdp_w = 300 if (rad or 0) >= 360 else 240 if (rad or 0) >= 240 else 180
    elif ctype == "air":
        tdp_w = 180
    sockets_supported = None  # unknown without datasheet; assume universal
    return {
        "type": ctype,
        "radiator_mm": rad,
        "fan_size_mm": fan_size,
        "tdp_w": tdp_w,
        "sockets_supported": sockets_supported,
    }


def parse_ram(name: str, subcategory: str) -> dict:
    nl = name.lower()
    ram_type = None
    m = re.search(r"\bDDR\s?([345])\b", name, re.IGNORECASE)
    if m:
        ram_type = f"DDR{m.group(1)}"

    speed = None
    mhz = re.search(r"\b(\d{4,5})\s*MHz\b", name, re.IGNORECASE)
    if mhz:
        speed = int(mhz.group(1))
    elif (pc := re.search(r"\bPC\s?(\d{4,5})\b", name, re.IGNORECASE)):
        speed = int(round(int(pc.group(1)) / 8))

    capacity = None
    kit = re.search(r"(\d+)\s*[xX]\s*(\d+)\s*GB", name, re.IGNORECASE)
    if kit:
        capacity = int(kit.group(1)) * int(kit.group(2))
    else:
        gb = re.search(r"(\d+)\s*GB", name, re.IGNORECASE)
        if gb:
            capacity = int(gb.group(1))

    module_count = None
    module = re.search(r"\((\d+)\s*[xX]\s*\d+\s*GB\)", name, re.IGNORECASE)
    if module:
        module_count = int(module.group(1))

    return {
        "type": ram_type,
        "capacity_gb": capacity,
        "speed_mhz": speed,
        "module_count": module_count,
        "desktop": "notebook" not in (subcategory or "").lower(),
    }


def parse_ssd(name: str, subcategory: str) -> dict:
    nl = name.lower()
    cap_gb = None
    m = re.search(r"(\d+(?:\.\d+)?)\s*TB", name, re.IGNORECASE)
    if m:
        cap_gb = int(float(m.group(1)) * 1024)
    else:
        m = re.search(r"(\d{3,4})\s*GB", name, re.IGNORECASE)
        if m:
            cap_gb = int(m.group(1))
    interface = "NVMe" if "nvme" in nl or "m.2" in nl or "pcie" in nl else "SATA"
    external = "External" in (subcategory or "")
    return {"capacity_gb": cap_gb, "interface": interface, "external": external}


def parse_hdd(name: str, subcategory: str) -> dict:
    nl = name.lower()
    cap_gb = None
    m = re.search(r"(\d+(?:\.\d+)?)\s*TB", name, re.IGNORECASE)
    if m:
        cap_gb = int(float(m.group(1)) * 1024)
    else:
        m = re.search(r"(\d{3,5})\s*GB", name, re.IGNORECASE)
        if m:
            cap_gb = int(m.group(1))
    form_factor = "2.5" if "2.5" in name or "2.5" in subcategory else "3.5" if "3.5" in name or "3.5" in subcategory else None
    return {
        "capacity_gb": cap_gb,
        "interface": "SATA",
        "form_factor_in": form_factor,
        "external": "external" in (subcategory or "").lower() or "external" in nl,
    }


def parse_monitor(name: str, subcategory: str) -> dict:
    size = None
    size_match = re.search(r"\b(\d{2}(?:\.\d)?)\s*(?:inch|in|\"|\b)", name, re.IGNORECASE)
    if size_match:
        size = float(size_match.group(1))
    refresh = None
    refresh_inferred = False
    hz = re.search(r"(\d{2,3})\s*Hz", name, re.IGNORECASE)
    if hz:
        refresh = int(hz.group(1))
    nl = name.lower()
    if refresh is None:
        refresh_inferred = True
        if "freesync" in nl or "free sync" in nl:
            refresh = 75
        elif "gaming" in nl:
            refresh = 144
        else:
            refresh = 60
    resolution = "4K" if "4k" in nl or "uhd" in nl else "QHD" if "qhd" in nl or "1440" in nl else "FHD" if "fhd" in nl or "1080" in nl else None
    return {
        "size_inch": size,
        "refresh_hz": refresh,
        "refresh_hz_inferred": refresh_inferred,
        "resolution": resolution,
    }


def parse_ups(name: str, subcategory: str) -> dict:
    va = None
    va_match = re.search(r"(\d{3,5})\s*VA\b", name, re.IGNORECASE)
    if va_match:
        va = int(va_match.group(1))
    else:
        kva_match = re.search(r"(\d+(?:[\.,]\d+)?)\s*kVA\b", name, re.IGNORECASE)
        if kva_match:
            va = int(float(kva_match.group(1).replace(",", ".")) * 1000)
    wattage = None
    watts = re.search(r"(\d{3,5})\s*(?:W|WATT|WATTS)\b", name, re.IGNORECASE)
    if watts:
        wattage = int(watts.group(1))
    wattage_inferred = False
    if wattage is None and va:
        # Many marketplace UPS names list only apparent power. Use a conservative
        # 0.6 power factor so recommendations do not overstate usable wattage.
        wattage = int(round(va * 0.6))
        wattage_inferred = True
    return {"capacity_va": va, "wattage_w": wattage, "wattage_inferred": wattage_inferred}


def parse_component(category: str, name: str, subcategory: str) -> dict:
    """Dispatch by category. Returns {} for unsupported."""
    fn = {
        "Processor": parse_cpu,
        "VGA": parse_gpu,
        "Motherboard": parse_motherboard,
        "RAM": parse_ram,
        "PSU": parse_psu,
        "Casing": parse_case,
        "Cooler": parse_cooler,
        "SSD": parse_ssd,
        "Hard Drive": parse_hdd,
        "LCD": parse_monitor,
        "UPS": parse_ups,
    }.get(category)
    if not fn:
        return {}
    try:
        return fn(name or "", subcategory or "")
    except Exception:
        return {}


# Curated RAM whitelist — enterkomputer.com scrape lacks standalone DDR modules.
#
# The actual data now lives in data/curated_ram.json so prices can be refreshed
# without editing Python. Re-run seed_components.py after editing the JSON so
# components.json picks up the new figures (the runtime Builder reads from
# components.json, not from this list directly).
#
# For one-off price tweaks across any SKU (RAM, CPU, GPU, laptop), prefer
# data/price_overrides.json — applied at runtime, no re-seed needed.
def _load_curated_ram() -> list[dict]:
    # Imported lazily to avoid a circular import (services may grow imports
    # from this module in the future).
    try:
        from .. import services
        return services.load_curated_ram()
    except ImportError:
        path = Path(__file__).resolve().parents[2] / "data" / "curated_ram.json"
        if not path.exists():
            return []
        return json.loads(path.read_text(encoding="utf-8"))


# Back-compat: legacy callers can still iterate `CURATED_RAM`. New code should
# call _load_curated_ram() so it picks up live edits to curated_ram.json.
CURATED_RAM = _load_curated_ram()


def get_ram_catalog() -> list[dict]:
    """Return curated RAM modules normalized to the components schema.
    Reads from data/curated_ram.json on every call so seed_components.py
    always sees the latest prices without restarting."""
    out = []
    for r in _load_curated_ram():
        out.append({
            "sku": r["sku"],
            "name": r["name"],
            "brand": r["brand"],
            "category": "ram",
            "subcategory": r["specs"]["type"],
            "price_idr": r["price_idr"],
            "image_path": None,
            "product_url": None,
            "specs": r["specs"],
            "source": "curated",
        })
    return out
