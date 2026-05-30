"""Data-loading services for the Kompare PC Builder API.

In-memory caches for the component JSON files. Reload-on-mtime so dev edits to
data/*.json are visible without restarting uvicorn.
"""

from __future__ import annotations

import json
from pathlib import Path
from threading import RLock
from typing import Optional

DATA_DIR = Path(__file__).resolve().parent.parent / "data"

COMPONENTS_PATH = DATA_DIR / "components.json"
CURATED_RAM_PATH = DATA_DIR / "curated_ram.json"
PRICE_OVERRIDES_PATH = DATA_DIR / "price_overrides.json"


class _JsonCache:
    """Thread-safe lazy-loader that reloads when the file mtime changes."""

    def __init__(self, path: Path, default: list | dict):
        self.path = path
        self.default = default
        self._data = None
        self._mtime: Optional[float] = None
        self._lock = RLock()

    def get(self):
        with self._lock:
            if not self.path.exists():
                return self.default
            mtime = self.path.stat().st_mtime
            if self._data is None or mtime != self._mtime:
                self._data = json.loads(self.path.read_text(encoding="utf-8"))
                self._mtime = mtime
            return self._data


_components_cache = _JsonCache(COMPONENTS_PATH, [])
_curated_ram_cache = _JsonCache(CURATED_RAM_PATH, [])
_price_overrides_cache = _JsonCache(PRICE_OVERRIDES_PATH, {})


def load_curated_ram() -> list[dict]:
    """Optional curated RAM fallback for seed_components.py.

    Runtime RAM should normally come from data/products_cleaned.csv. Use this
    file only when scrape coverage is weak, then regenerate components.json
    with --include-curated-ram.
    """
    return _curated_ram_cache.get() or []


def load_price_overrides() -> dict[str, int]:
    """Optional SKU -> price_idr overlay for runtime component data.

    Mtime-watched, so edits to data/price_overrides.json land without a server
    restart. The leading '_doc' / '_example' keys are ignored.
    """
    raw = _price_overrides_cache.get() or {}
    if not isinstance(raw, dict):
        return {}
    out: dict[str, int] = {}
    for k, v in raw.items():
        if k.startswith("_"):
            continue
        try:
            out[str(k)] = int(v)
        except (TypeError, ValueError):
            continue
    return out


def _apply_price_override(item: dict, overrides: dict[str, int]) -> dict:
    if not overrides:
        return item
    sku = item.get("sku") or item.get("id")
    if sku and sku in overrides:
        return {**item, "price_idr": overrides[sku]}
    return item


def load_components() -> list[dict]:
    overrides = load_price_overrides()
    items = _components_cache.get() or []
    if not overrides:
        return items
    return [_apply_price_override(c, overrides) for c in items]


def find_component(component_id: str) -> Optional[dict]:
    for c in load_components():
        if c.get("sku") == component_id:
            return c
    return None


def components_by_category() -> dict[str, list[dict]]:
    out: dict[str, list[dict]] = {}
    for c in load_components():
        out.setdefault(c["category"], []).append(c)
    return out
