from pathlib import Path

from backend.utils.ai_rag_chunks import (
    build_component_chunks,
    catalog_hash,
    component_to_chunk,
    read_jsonl,
    write_jsonl,
)


def _component(**overrides):
    component = {
        "sku": "cpu-amd-7600",
        "name": "AMD Ryzen 5 7600",
        "category": "CPU",
        "brand": "AMD",
        "price_idr": 3_250_000,
        "stock_status": "in_stock",
        "specs": {"socket": "AM5", "cores": 6, "base_clock_ghz": 3.8},
        "selection_rationale": "Strong gaming value for AM5 builds.",
        "marketplace_links": [
            {"marketplace": "enterkomputer", "url": "https://enterkomputer.com/detail/cpu-amd-7600"},
            {"marketplace": "tokopedia", "url": "https://tokopedia.com/example/cpu-amd-7600"},
        ],
    }
    component.update(overrides)
    return component


def test_component_to_chunk_keeps_identity_metadata_and_buyer_text():
    chunk = component_to_chunk(_component())

    assert chunk["chunk_id"] == "component:cpu-amd-7600"
    assert chunk["sku"] == "cpu-amd-7600"
    assert chunk["category"] == "cpu"
    assert chunk["metadata"] == {
        "price_idr": 3_250_000,
        "stock_status": "in_stock",
        "brand": "AMD",
    }
    assert "AMD Ryzen 5 7600" in chunk["text"]
    assert "socket AM5" in chunk["text"]
    assert "cores 6" in chunk["text"]
    assert "enterkomputer" in chunk["text"]


def test_build_component_chunks_excludes_non_pc_builder_categories():
    chunks = build_component_chunks(
        [
            _component(sku="gpu-1", category="GPU"),
            _component(sku="notebook-1", category="notebook"),
            _component(sku="sound-1", category="soundcard"),
            _component(sku="", category="cpu"),
        ]
    )

    assert [chunk["sku"] for chunk in chunks] == ["gpu-1"]


def test_catalog_hash_is_stable_for_same_content():
    components = [_component(sku="cpu-1"), _component(sku="gpu-1", category="gpu")]

    assert catalog_hash(components) == catalog_hash(list(components))


def test_catalog_hash_is_not_sensitive_to_component_order():
    components = [
        _component(sku="cpu-1", category="cpu"),
        _component(sku="gpu-1", category="gpu"),
        _component(sku="ram-1", category="ram"),
    ]

    assert catalog_hash(components) == catalog_hash(list(reversed(components)))


def test_jsonl_round_trip(tmp_path: Path):
    chunks = [
        component_to_chunk(_component(sku="cpu-1")),
        component_to_chunk(_component(sku="gpu-1", category="gpu")),
    ]
    path = tmp_path / "chunks.jsonl"

    write_jsonl(chunks, path)

    assert read_jsonl(path) == chunks


def test_read_jsonl_returns_empty_list_for_missing_path(tmp_path: Path):
    assert read_jsonl(tmp_path / "missing.jsonl") == []
