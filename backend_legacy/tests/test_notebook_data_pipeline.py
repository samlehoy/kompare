import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
NOTEBOOKS = ROOT / "notebooks"


def _notebook_source(name: str) -> str:
    notebook = json.loads((NOTEBOOKS / name).read_text(encoding="utf-8"))
    return "\n".join(
        "".join(cell.get("source", []))
        for cell in notebook.get("cells", [])
        if cell.get("cell_type") == "code"
    )


def test_cleaning_notebook_preserves_marketplace_and_audit_fields():
    source = _notebook_source("02_clean_pc_components.ipynb")

    for column in ["product_url", "tokopedia_url", "shopee_url", "image_url", "scraped_at"]:
        assert column in source

    assert "marketplace_links" in source
    assert "normalize_app_category" in source


def test_validation_notebook_exports_reviewable_reports():
    source = _notebook_source("03_validate_component_candidates.ipynb")

    for category in ["cpu", "motherboard", "ram", "gpu", "ssd", "hdd", "psu", "cooler", "case"]:
        assert category in source

    assert "component_validation_report.json" in source
    assert "component_validation_issues.csv" in source
    assert "marketplace_link_missing" in source
