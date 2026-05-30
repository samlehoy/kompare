from __future__ import annotations

from collections.abc import Sequence
from typing import Any

from backend.utils.ai_rag_index import VectorIndex, cosine_search
from backend.utils.build_pc import USE_CASE_PROFILES


AI_REQUIRED_SLOTS = ["cpu", "motherboard", "ram", "gpu", "ssd", "psu", "case"]
SLOT_CATEGORY = {slot: slot for slot in AI_REQUIRED_SLOTS}
STOCK_OK = {"in_stock", "instock", "ready", "available", "stock"}


def build_slot_query_texts(budget_idr: int, use_case: str) -> dict[str, str]:
    return {
        slot: (
            f"{use_case} PC build with budget {budget_idr} IDR. "
            f"Find a balanced {slot} candidate with compatibility, upgrade flexibility, "
            "and good value for the overall build."
        )
        for slot in AI_REQUIRED_SLOTS
    }


def _slot_budget_limit(slot: str, budget_idr: int, use_case: str) -> int:
    profile = USE_CASE_PROFILES.get(use_case) or USE_CASE_PROFILES["gaming"]
    pct = profile.get(slot, 0)
    return max(1, int(budget_idr * (pct / 100) * 1.8))


def _component_sku(component: dict) -> str:
    return str(component.get("sku") or component.get("id") or "").strip()


def _normalized(value: Any) -> str:
    return str(value or "").strip().lower()


def _price_idr(component: dict) -> int:
    try:
        return int(component.get("price_idr") or 0)
    except (TypeError, ValueError):
        return 0


def retrieve_build_candidates(
    components: Sequence[dict],
    index: VectorIndex,
    query_vectors: dict[str, Sequence[float]],
    *,
    budget_idr: int,
    use_case: str,
    top_k: int = 12,
) -> dict[str, list[dict]]:
    components_by_sku = {_component_sku(component): component for component in components if _component_sku(component)}
    candidates_by_slot: dict[str, list[dict]] = {}

    for slot in AI_REQUIRED_SLOTS:
        category = SLOT_CATEGORY[slot]
        slot_results: list[dict] = []
        query_vector = query_vectors.get(slot)
        if query_vector is not None and len(query_vector) > 0:
            search_results = cosine_search(
                index.embeddings,
                index.metadata,
                query_vector,
                category=category,
                top_k=top_k * 3,
            )
        else:
            search_results = []

        budget_limit = _slot_budget_limit(slot, budget_idr, use_case)
        for result in search_results:
            component = components_by_sku.get(str(result.get("sku") or "").strip())
            if not component:
                continue
            if _normalized(component.get("category")) != category:
                continue
            if _normalized(component.get("stock_status") or component.get("stock")) not in STOCK_OK:
                continue
            if _price_idr(component) > budget_limit:
                continue

            candidate = dict(component)
            candidate["retrieval_score"] = result.get("score")
            slot_results.append(candidate)
            if len(slot_results) >= top_k:
                break

        candidates_by_slot[slot] = slot_results

    return candidates_by_slot
