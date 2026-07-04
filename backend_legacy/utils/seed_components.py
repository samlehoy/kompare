"""Build data/components.json from the cleaned EnterKomputer CSV.

The scraper/orchestration layer produces acquisition-clean rows in
data/products_cleaned.csv. This utility turns those rows into the runtime
PC Builder component catalog expected by backend.utils.build_pc.

Usage:
    python -m backend.utils.seed_components
    python backend/utils/seed_components.py --input data/products_cleaned.csv --output data/components.json
"""

from __future__ import annotations

import argparse
import csv
import json
from collections import Counter
from pathlib import Path
from statistics import median
from typing import Iterable

try:
    from .component_specs import (
        COMPONENT_CATEGORY_MAP,
        get_ram_catalog,
        is_psu_accessory,
        parse_component,
    )
except ImportError:  # Allows direct execution: python backend/utils/seed_components.py
    from component_specs import (  # type: ignore
        COMPONENT_CATEGORY_MAP,
        get_ram_catalog,
        is_psu_accessory,
        parse_component,
    )


ROOT = Path(__file__).resolve().parents[2]

RUNTIME_CATEGORIES = [
    "cpu",
    "motherboard",
    "ram",
    "gpu",
    "ssd",
    "hdd",
    "psu",
    "cooler",
    "case",
    "monitor",
    "ups",
]

REQUIRED_SPEC_FIELDS = {
    "cpu": ["socket", "brand", "cores"],
    "motherboard": ["socket", "form_factor", "ram_type"],
    "ram": ["type", "capacity_gb", "speed_mhz"],
    "gpu": ["vendor", "vram_gb", "recommended_psu_w"],
    "ssd": ["capacity_gb", "interface"],
    "hdd": ["capacity_gb", "interface"],
    "psu": ["wattage_w"],
    "cooler": ["type"],
    "case": ["max_form_factor"],
    "monitor": ["size_inch", "refresh_hz", "resolution"],
    "ups": ["capacity_va", "wattage_w"],
}

SPEC_COVERAGE_WARN_THRESHOLD = 0.9

RAM_PRICE_OUTLIER_RATIO = 0.45
RAM_PRICE_REFERENCE_MIN_ROWS = 5

KNOWN_BRANDS = [
    "AMD", "Intel", "ASUS", "ASRock", "MSI", "Gigabyte", "Biostar", "Colorful",
    "Palit", "Galax", "Zotac", "PNY", "Inno3D", "Sapphire", "PowerColor", "XFX",
    "Corsair", "Cooler Master", "NZXT", "Fractal", "Lian Li", "Phanteks",
    "be quiet!", "Thermaltake", "Seasonic", "FSP", "Antec", "Deepcool", "ID-COOLING",
    "Noctua", "Arctic", "Samsung", "WD", "Western Digital", "Seagate", "Crucial",
    "Kingston", "Adata", "ADATA", "Team", "TeamGroup", "Klevv", "KLEVV", "Patriot",
    "Lexar", "SilverStone", "Aerocool", "Cougar", "InWin", "Montech", "Tecware",
    "APC", "Eaton", "ICA", "Prolink", "LG", "AOC", "ViewSonic", "Acer",
]


def detect_brand(name: str) -> str | None:
    upper = name.upper()
    for brand in sorted(KNOWN_BRANDS, key=len, reverse=True):
        if upper.startswith(brand.upper()) or f" {brand.upper()} " in f" {upper} ":
            return brand
    return None


def _int_price(value: object) -> int:
    try:
        return int(float(value or 0))
    except (TypeError, ValueError):
        return 0


def _has_value(value: object) -> bool:
    return value not in (None, "", [])


def _coverage(present: int, total: int) -> float:
    if total <= 0:
        return 1.0
    return round(present / total, 4)


def _read_specifications(value: str) -> dict:
    try:
        parsed = json.loads(value or "{}")
    except json.JSONDecodeError:
        return {}
    return parsed if isinstance(parsed, dict) else {}


def _marketplace_links(row: dict) -> list[dict]:
    links: list[dict] = []
    seen: set[str] = set()

    def add(marketplace: str, url: object) -> None:
        clean = str(url or "").strip()
        if not clean or clean in seen:
            return
        links.append({"marketplace": marketplace, "url": clean})
        seen.add(clean)

    add("enterkomputer", row.get("product_url"))
    add("tokopedia", row.get("tokopedia_url"))
    add("shopee", row.get("shopee_url"))
    return links


def _skip_reason(runtime_category: str, name: str, subcategory: str, specs: dict) -> str | None:
    sub = (subcategory or "").lower()
    lower_name = (name or "").lower()

    if runtime_category == "ram" and ("notebook" in sub or "server" in sub):
        return "non_desktop_ram"
    if runtime_category == "ssd" and "external" in sub:
        return "external_ssd"
    if runtime_category == "hdd":
        if any(token in sub for token in ["eksternal", "external", "bracket", "nas", "notebook", "server"]):
            return "non_desktop_hdd"
    if runtime_category == "cooler":
        if specs.get("type") == "other":
            return "cooler_accessory"
        if any(token in sub for token in ["memory cooler", "vga cooler", "ssd cooler", "mounting", "accessories"]):
            return "cooler_accessory"
    if runtime_category == "monitor" and "bracket" in sub:
        return "monitor_accessory"
    if runtime_category == "ups":
        if any(token in sub for token in ["battery", "stabilizer"]):
            return "ups_accessory"
        if any(token in lower_name for token in [
            "replacement battery",
            "battery cartridge",
            "battery pack",
            "rail kit",
            "rack netshelter",
            "server rack",
            "surgearrest",
            "surge arrest",
            "surge protector",
            "power distribution unit",
            " pdu ",
        ]):
            return "ups_accessory"
        if any(token in lower_name for token in ["line-r", "voltage regulator", "automatic voltage regulator", "stabilizer"]):
            return "ups_accessory"
        if "inverter" in lower_name and "ups" not in lower_name:
            return "ups_accessory"
    if runtime_category == "psu" and is_psu_accessory(name, specs.get("wattage_w")):
        return "psu_accessory"
    if "garansi" == lower_name.strip():
        return "invalid_name"
    return None


def _unique_sku(raw_sku: str, product_url: str | None, seen: Counter) -> str:
    sku = raw_sku or (product_url or "component").rstrip("/").split("/")[-1]
    seen[sku] += 1
    if seen[sku] == 1:
        return sku
    return f"{sku}-{seen[sku]}"


def _ram_price_references(rows: Iterable[dict]) -> dict[tuple[str, int], int]:
    groups: dict[tuple[str, int], list[int]] = {}
    for row in rows:
        if (row.get("category") or "").strip() != "RAM":
            continue
        name = (row.get("name") or "").strip()
        subcategory = (row.get("subcategory") or "").strip()
        price = _int_price(row.get("price_idr"))
        if not name or price <= 0:
            continue
        specs = parse_component("RAM", name, subcategory)
        if _skip_reason("ram", name, subcategory, specs):
            continue
        ram_type = specs.get("type")
        capacity = specs.get("capacity_gb")
        if ram_type and isinstance(capacity, int) and capacity > 0:
            groups.setdefault((ram_type, capacity), []).append(price)

    references: dict[tuple[str, int], int] = {}
    for key, prices in groups.items():
        if len(prices) >= RAM_PRICE_REFERENCE_MIN_ROWS:
            references[key] = int(median(prices))
    return references


def _component_from_row(
    row: dict,
    runtime_category: str,
    sku: str,
    *,
    quality_flags: list[str] | None = None,
    reference_price_idr: int | None = None,
    price_floor_idr: int | None = None,
) -> dict:
    name = (row.get("name") or "").strip()
    subcategory = (row.get("subcategory") or "").strip()
    source_specs = _read_specifications(row.get("specifications") or "{}")
    parsed_specs = parse_component(row.get("category") or "", name, subcategory)
    specs = {**source_specs, **{k: v for k, v in parsed_specs.items() if v not in (None, "", [])}}
    image_url = (row.get("image_url") or "").strip() or None
    if image_url and "noimage" in image_url.lower():
        image_url = None
    links = _marketplace_links(row)
    primary_url = links[0]["url"] if links else None

    component = {
        "sku": sku,
        "raw_sku": (row.get("sku") or "").strip() or sku,
        "id": sku,
        "name": name,
        "brand": detect_brand(name),
        "category": runtime_category,
        "source_category": (row.get("category") or "").strip(),
        "subcategory": subcategory or None,
        "price_idr": _int_price(row.get("price_idr")),
        "stock_status": (row.get("stock_status") or "").strip() or "unknown",
        "description": (row.get("description") or "").strip() or None,
        "image_url": image_url,
        "image_path": image_url,
        "product_url": (row.get("product_url") or "").strip() or None,
        "tokopedia_url": (row.get("tokopedia_url") or "").strip() or None,
        "shopee_url": (row.get("shopee_url") or "").strip() or None,
        "marketplace_links": links,
        "primary_url": primary_url,
        "scraped_at": (row.get("scraped_at") or "").strip() or None,
        "specs": specs,
        "source": "enterkomputer",
    }
    if quality_flags:
        component["quality_flags"] = sorted(set(quality_flags))
    if reference_price_idr:
        component["reference_price_idr"] = reference_price_idr
    if price_floor_idr:
        component["price_floor_idr"] = price_floor_idr
    return component


def build_components(
    input_path: str | Path,
    *,
    limit_per_category: int | None = 1500,
    include_curated_ram: bool = False,
) -> tuple[list[dict], dict]:
    input_path = Path(input_path)
    components: list[dict] = []
    counts: Counter = Counter()
    skipped: Counter = Counter()
    quality_flags: Counter = Counter()
    seen_skus: Counter = Counter()

    with input_path.open("r", encoding="utf-8", newline="") as f:
        rows = list(csv.DictReader(f))
    source_rows = len(rows)
    ram_price_references = _ram_price_references(rows)

    for row in rows:
            source_category = (row.get("category") or "").strip()
            runtime_category = COMPONENT_CATEGORY_MAP.get(source_category)
            if not runtime_category:
                skipped["unsupported_category"] += 1
                continue
            if limit_per_category is not None and counts[runtime_category] >= limit_per_category:
                skipped["category_limit"] += 1
                continue

            name = (row.get("name") or "").strip()
            if not name:
                skipped["missing_name"] += 1
                continue
            price = _int_price(row.get("price_idr"))
            if price <= 0:
                skipped["missing_price"] += 1
                continue

            subcategory = (row.get("subcategory") or "").strip()
            parsed_specs = parse_component(source_category, name, subcategory)
            reason = _skip_reason(runtime_category, name, subcategory, parsed_specs)
            if reason:
                skipped[reason] += 1
                continue

            sku = _unique_sku((row.get("sku") or "").strip(), row.get("product_url"), seen_skus)
            component_quality_flags: list[str] = []
            reference_price = None
            price_floor = None
            if runtime_category == "ram":
                ram_key = (parsed_specs.get("type"), parsed_specs.get("capacity_gb"))
                if isinstance(ram_key[0], str) and isinstance(ram_key[1], int):
                    reference_price = ram_price_references.get(ram_key)
                    if reference_price:
                        price_floor = int(reference_price * RAM_PRICE_OUTLIER_RATIO)
                        if price < price_floor:
                            component_quality_flags.append("price_outlier_low")
                            quality_flags["price_outlier_low"] += 1

            component = _component_from_row(
                row,
                runtime_category,
                sku,
                quality_flags=component_quality_flags,
                reference_price_idr=reference_price,
                price_floor_idr=price_floor,
            )
            components.append(component)
            counts[runtime_category] += 1

    curated_rows = 0
    if include_curated_ram:
        existing = {item["sku"] for item in components}
        for item in get_ram_catalog():
            if item["sku"] in existing:
                continue
            normalized = {
                **item,
                "id": item.get("sku"),
                "raw_sku": item.get("sku"),
                "stock_status": item.get("stock_status") or "unknown",
                "image_url": item.get("image_url") or item.get("image_path"),
                "marketplace_links": item.get("marketplace_links") or [],
                "primary_url": item.get("primary_url") or item.get("product_url"),
            }
            components.append(normalized)
            counts[normalized["category"]] += 1
            curated_rows += 1

    report = {
        "input": str(input_path),
        "source_rows": source_rows,
        "written_rows": len(components),
        "curated_rows": curated_rows,
        "counts": dict(sorted(counts.items())),
        "quality_flags": dict(sorted(quality_flags.items())),
        "skipped": dict(sorted(skipped.items())),
    }
    return components, report


def validate_components(components: Iterable[dict]) -> dict:
    items = list(components)
    counts = Counter(item.get("category") for item in items)
    missing_categories = [category for category in RUNTIME_CATEGORIES if counts.get(category, 0) <= 0]
    issues: list[dict] = []
    seen_skus: set[str] = set()

    for index, item in enumerate(items):
        sku = item.get("sku")
        if not sku:
            issues.append({"index": index, "code": "sku_missing", "message": "Component SKU is required."})
        elif sku in seen_skus:
            issues.append({"index": index, "sku": sku, "code": "sku_duplicate", "message": "Component SKU must be unique."})
        else:
            seen_skus.add(sku)

        for field in ("name", "category", "price_idr"):
            if item.get(field) in (None, ""):
                issues.append({"index": index, "sku": sku, "code": f"{field}_missing", "message": f"{field} is required."})
        if item.get("price_idr", 0) <= 0:
            issues.append({"index": index, "sku": sku, "code": "price_invalid", "message": "price_idr must be positive."})
        if not item.get("product_url") and not item.get("marketplace_links"):
            issues.append({"index": index, "sku": sku, "code": "marketplace_link_missing", "message": "At least one marketplace link is expected."})

    for category in missing_categories:
        issues.append({"code": "category_missing", "category": category, "message": f"No {category} rows generated."})

    fatal_codes = {"sku_missing", "sku_duplicate", "name_missing", "category_missing", "price_invalid"}
    return {
        "ok": not any(issue["code"] in fatal_codes for issue in issues),
        "total": len(items),
        "counts": dict(sorted((str(k), v) for k, v in counts.items() if k)),
        "missing_categories": missing_categories,
        "issue_count": len(issues),
        "issues": issues[:500],
        "quality": audit_component_quality(items),
    }


def audit_component_quality(components: Iterable[dict]) -> dict:
    items = list(components)
    categories = sorted(set(RUNTIME_CATEGORIES) | {str(item.get("category")) for item in items if item.get("category")})
    category_metrics: dict[str, dict] = {}
    action_items: list[dict] = []

    for category in categories:
        category_items = [item for item in items if item.get("category") == category]
        total = len(category_items)
        prices = sorted(_int_price(item.get("price_idr")) for item in category_items if _int_price(item.get("price_idr")) > 0)
        image_present = sum(1 for item in category_items if item.get("image_url") or item.get("image_path"))
        link_present = sum(1 for item in category_items if item.get("product_url") or item.get("marketplace_links"))
        flag_counts: Counter = Counter()
        samples: list[dict] = []

        for item in category_items:
            sku = item.get("sku")
            if not item.get("image_url") and not item.get("image_path"):
                samples.append({"sku": sku, "code": "image_missing", "name": item.get("name")})
            if not item.get("product_url") and not item.get("marketplace_links"):
                samples.append({"sku": sku, "code": "marketplace_link_missing", "name": item.get("name")})
            for flag in item.get("quality_flags") or []:
                flag_counts[str(flag)] += 1
                samples.append({"sku": sku, "code": str(flag), "name": item.get("name")})

        required_spec_coverage: dict[str, dict] = {}
        for field in REQUIRED_SPEC_FIELDS.get(category, []):
            present = sum(1 for item in category_items if _has_value((item.get("specs") or {}).get(field)))
            missing = total - present
            field_coverage = _coverage(present, total)
            required_spec_coverage[field] = {
                "present": present,
                "missing": missing,
                "coverage": field_coverage,
            }
            if total and field_coverage < SPEC_COVERAGE_WARN_THRESHOLD:
                action_items.append({
                    "category": category,
                    "code": "required_spec_coverage_low",
                    "field": field,
                    "missing": missing,
                    "total": total,
                    "coverage": field_coverage,
                })
                for item in category_items:
                    if not _has_value((item.get("specs") or {}).get(field)):
                        samples.append({
                            "sku": item.get("sku"),
                            "code": "required_spec_missing",
                            "field": field,
                            "name": item.get("name"),
                        })

        category_metrics[category] = {
            "total": total,
            "images": {
                "present": image_present,
                "missing": total - image_present,
                "coverage": _coverage(image_present, total),
            },
            "marketplace_links": {
                "present": link_present,
                "missing": total - link_present,
                "coverage": _coverage(link_present, total),
            },
            "required_spec_coverage": required_spec_coverage,
            "price_idr": {
                "min": prices[0] if prices else None,
                "median": int(median(prices)) if prices else None,
                "max": prices[-1] if prices else None,
            },
            "quality_flags": dict(sorted(flag_counts.items())),
            "sample_issues": samples[:20],
        }

    action_items.sort(key=lambda item: (item["category"], item["code"], item.get("field") or ""))
    return {
        "required_spec_fields": REQUIRED_SPEC_FIELDS,
        "category_metrics": category_metrics,
        "action_items": action_items,
    }


def write_outputs(components: list[dict], output_path: Path, report_path: Path | None, report: dict) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(components, indent=2, ensure_ascii=False), encoding="utf-8")
    if report_path:
        report_path.parent.mkdir(parents=True, exist_ok=True)
        report_path.write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", default=str(ROOT / "data" / "products_cleaned.csv"))
    parser.add_argument("--output", default=str(ROOT / "data" / "components.json"))
    parser.add_argument("--report", default=str(ROOT / "data" / "component_catalog_report.json"))
    parser.add_argument("--limit-per-category", type=int, default=1500, help="Cap each runtime category; use 0 for no cap.")
    parser.add_argument("--include-curated-ram", action="store_true", help="Merge data/curated_ram.json as a fallback source.")
    parser.add_argument("--fail-on-validation", action="store_true", help="Exit non-zero if validation reports fatal issues.")
    args = parser.parse_args()

    limit = None if args.limit_per_category == 0 else args.limit_per_category
    components, build_report = build_components(
        args.input,
        limit_per_category=limit,
        include_curated_ram=args.include_curated_ram,
    )
    validation = validate_components(components)
    report = {**build_report, "validation": validation}

    write_outputs(components, Path(args.output), Path(args.report) if args.report else None, report)

    print(f"Wrote {len(components)} components -> {args.output}")
    for category, count in validation["counts"].items():
        print(f"  {category:12s} {count}")
    if validation["missing_categories"]:
        print(f"Missing categories: {', '.join(validation['missing_categories'])}")
    print(f"Validation issues: {validation['issue_count']}")

    if args.fail_on_validation and not validation["ok"]:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
