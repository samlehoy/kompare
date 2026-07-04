import argparse
import hashlib
import json
from collections.abc import Iterable
from pathlib import Path
from typing import Any


PC_BUILDER_CATEGORIES = {
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
}


def _component_sort_key(component: dict) -> tuple[str, str, str]:
    category = str(component.get("category") or "").strip().lower()
    sku = str(component.get("sku") or component.get("id") or "").strip()
    identity = json.dumps(component, sort_keys=True, ensure_ascii=False, separators=(",", ":"))
    return category, sku, identity


def catalog_hash(components: list[dict]) -> str:
    canonical_components = sorted(components, key=_component_sort_key)
    payload = json.dumps(canonical_components, sort_keys=True, ensure_ascii=False, separators=(",", ":"))
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def _component_sku(component: dict) -> str:
    return str(component.get("sku") or component.get("id") or "").strip()


def _as_int(value: Any) -> int:
    try:
        return int(value)
    except (TypeError, ValueError):
        return 0


def _format_price_idr(price: int) -> str:
    return f"IDR {price:,}".replace(",", ".")


def _specs_text(specs: Any) -> str:
    if not isinstance(specs, dict) or not specs:
        return ""

    parts = []
    for key in sorted(specs):
        value = specs[key]
        if value in (None, "", [], {}):
            continue
        label = str(key).replace("_", " ")
        parts.append(f"{label} {value}")
        if len(parts) >= 8:
            break
    return ", ".join(parts)


def _marketplace_names(component: dict) -> list[str]:
    names = []
    for link in component.get("marketplace_links") or []:
        if isinstance(link, dict):
            name = link.get("marketplace") or link.get("name")
        else:
            name = link
        if name:
            names.append(str(name).strip())

    direct_fields = {
        "product_url": "enterkomputer",
        "tokopedia_url": "tokopedia",
        "shopee_url": "shopee",
    }
    for field, name in direct_fields.items():
        if component.get(field):
            names.append(name)

    deduped = []
    seen = set()
    for name in names:
        key = name.lower()
        if key and key not in seen:
            deduped.append(name)
            seen.add(key)
    return deduped


def component_to_chunk(component: dict) -> dict:
    sku = _component_sku(component)
    category = str(component.get("category") or "").strip().lower()
    brand = str(component.get("brand") or "").strip()
    name = str(component.get("name") or sku).strip()
    price_idr = _as_int(component.get("price_idr"))
    stock_status = str(component.get("stock_status") or "").strip()

    text_parts = [
        f"{category} component: {name}",
        f"brand {brand}" if brand else "",
        f"price {_format_price_idr(price_idr)}",
        f"stock {stock_status}" if stock_status else "",
    ]

    specs = _specs_text(component.get("specs"))
    if specs:
        text_parts.append(f"specs: {specs}")

    rationale = component.get("selection_rationale") or component.get("rationale")
    if rationale:
        text_parts.append(f"rationale: {str(rationale).strip()}")

    marketplaces = _marketplace_names(component)
    if marketplaces:
        text_parts.append(f"marketplaces: {', '.join(marketplaces)}")

    return {
        "chunk_id": f"component:{sku}",
        "sku": sku,
        "category": category,
        "text": ". ".join(part for part in text_parts if part),
        "metadata": {
            "price_idr": price_idr,
            "stock_status": stock_status,
            "brand": brand,
        },
    }


def build_component_chunks(components: Iterable[dict]) -> list[dict]:
    chunks = []
    for component in components:
        category = str(component.get("category") or "").strip().lower()
        if category not in PC_BUILDER_CATEGORIES:
            continue
        if not _component_sku(component):
            continue
        chunks.append(component_to_chunk(component))
    return sorted(chunks, key=lambda chunk: (chunk["category"], chunk["sku"]))


def write_jsonl(chunks: Iterable[dict], path: str | Path) -> None:
    output_path = Path(path)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with output_path.open("w", encoding="utf-8", newline="\n") as f:
        for chunk in chunks:
            f.write(json.dumps(chunk, ensure_ascii=False, sort_keys=True, separators=(",", ":")))
            f.write("\n")


def read_jsonl(path: str | Path) -> list[dict]:
    input_path = Path(path)
    if not input_path.exists():
        return []

    chunks = []
    with input_path.open("r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line:
                chunks.append(json.loads(line))
    return chunks


def main() -> None:
    parser = argparse.ArgumentParser(description="Build buyer-relevant AI/RAG chunks from component catalog JSON.")
    parser.add_argument("--components", required=True, help="Path to components JSON file.")
    parser.add_argument("--output", required=True, help="Path to output JSONL file.")
    args = parser.parse_args()

    components_path = Path(args.components)
    with components_path.open("r", encoding="utf-8") as f:
        components = json.load(f)

    chunks = build_component_chunks(components)
    write_jsonl(chunks, args.output)
    print(f"Wrote {len(chunks)} chunks to {args.output}")


if __name__ == "__main__":
    main()
