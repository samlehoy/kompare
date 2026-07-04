import numpy as np

from backend.utils.ai_rag_index import VectorIndex
from backend.utils.ai_rag_retrieval import (
    AI_REQUIRED_SLOTS,
    build_slot_query_texts,
    retrieve_build_candidates,
)


def _component(**overrides):
    component = {
        "sku": "cpu-1",
        "name": "Ryzen 5",
        "category": "cpu",
        "stock_status": "in_stock",
        "price_idr": 2_000_000,
    }
    component.update(overrides)
    return component


def _metadata(sku: str, category: str) -> dict:
    return {
        "chunk_id": f"component:{sku}",
        "sku": sku,
        "category": category,
        "text": f"{category} component {sku}",
        "metadata": {},
    }


def test_build_slot_query_texts_include_slots_use_case_and_budget():
    queries = build_slot_query_texts(15_000_000, "content_creation")

    assert set(queries) == set(AI_REQUIRED_SLOTS)
    for slot, query in queries.items():
        assert slot in query
        assert "content_creation" in query
        assert "15000000" in query
        assert f"balanced {slot} candidate" in query
        assert "compatibility" in query
        assert "upgrade flexibility" in query


def test_retrieve_build_candidates_filters_by_category_stock_and_price():
    components = [
        _component(sku="cpu-good", category="cpu", stock_status="available", price_idr=2_000_000),
        _component(sku="cpu-wrong-category", category="gpu", stock_status="available", price_idr=2_000_000),
        _component(sku="cpu-out-of-stock", category="cpu", stock_status="sold_out", price_idr=2_000_000),
        _component(sku="cpu-too-expensive", category="cpu", stock_status="available", price_idr=10_000_000),
    ]
    index = VectorIndex(
        embeddings=np.array(
            [
                [1.0, 0.0],
                [0.99, 0.01],
                [0.98, 0.02],
                [0.97, 0.03],
            ]
        ),
        metadata=[
            _metadata("cpu-good", "cpu"),
            _metadata("cpu-wrong-category", "cpu"),
            _metadata("cpu-out-of-stock", "cpu"),
            _metadata("cpu-too-expensive", "cpu"),
        ],
        manifest={},
    )
    query_vectors = {slot: [0.0, 0.0] for slot in AI_REQUIRED_SLOTS}
    query_vectors["cpu"] = [1.0, 0.0]

    results = retrieve_build_candidates(
        components,
        index,
        query_vectors,
        budget_idr=10_000_000,
        use_case="gaming",
        top_k=12,
    )

    assert [candidate["sku"] for candidate in results["cpu"]] == ["cpu-good"]
    assert results["cpu"][0]["retrieval_score"] == 1.0
    assert set(results) == set(AI_REQUIRED_SLOTS)
    for slot in set(AI_REQUIRED_SLOTS) - {"cpu"}:
        assert results[slot] == []


def test_retrieve_build_candidates_uses_default_top_k_limit():
    components = [
        _component(sku=f"cpu-{idx}", category="cpu", stock_status="ready", price_idr=1_000_000)
        for idx in range(14)
    ]
    embeddings = np.array([[1.0, idx / 100.0] for idx in range(14)])
    index = VectorIndex(
        embeddings=embeddings,
        metadata=[_metadata(f"cpu-{idx}", "cpu") for idx in range(14)],
        manifest={},
    )
    query_vectors = {slot: [0.0, 0.0] for slot in AI_REQUIRED_SLOTS}
    query_vectors["cpu"] = [1.0, 0.0]

    results = retrieve_build_candidates(
        components,
        index,
        query_vectors,
        budget_idr=10_000_000,
        use_case="gaming",
    )

    assert len(results["cpu"]) == 12


def test_retrieve_build_candidates_returns_empty_for_zero_or_empty_query_vectors():
    components = [
        _component(sku="cpu-1", category="cpu", stock_status="ready", price_idr=1_000_000),
        _component(sku="gpu-1", category="gpu", stock_status="ready", price_idr=1_000_000),
    ]
    index = VectorIndex(
        embeddings=np.array([[1.0, 0.0], [1.0, 0.0]]),
        metadata=[_metadata("cpu-1", "cpu"), _metadata("gpu-1", "gpu")],
        manifest={},
    )
    query_vectors = {slot: [1.0, 0.0] for slot in AI_REQUIRED_SLOTS}
    query_vectors["cpu"] = [0.0, 0.0]
    query_vectors["gpu"] = []

    results = retrieve_build_candidates(
        components,
        index,
        query_vectors,
        budget_idr=10_000_000,
        use_case="gaming",
        top_k=1,
    )

    assert results["cpu"] == []
    assert results["gpu"] == []
