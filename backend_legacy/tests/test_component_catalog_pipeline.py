import csv
import json
from pathlib import Path

from backend.utils.seed_components import build_components, validate_components


ROOT = Path(__file__).resolve().parents[2]


def _write_csv(path: Path, rows: list[dict]) -> None:
    fields = [
        "sku",
        "name",
        "category",
        "subcategory",
        "price_idr",
        "stock_status",
        "description",
        "specifications",
        "image_url",
        "product_url",
        "tokopedia_url",
        "shopee_url",
        "scraped_at",
    ]
    with path.open("w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fields)
        writer.writeheader()
        writer.writerows(rows)


def _row(sku: str, name: str, category: str, subcategory: str = "", price: int = 1_000_000) -> dict:
    return {
        "sku": sku,
        "name": name,
        "category": category,
        "subcategory": subcategory,
        "price_idr": str(price),
        "stock_status": "in_stock",
        "description": "",
        "specifications": "{}",
        "image_url": f"https://img.example/{sku}.png",
        "product_url": f"https://enterkomputer.com/detail/{sku}/{name.replace(' ', '-')}",
        "tokopedia_url": f"https://tokopedia.com/enterkomputer/{sku}",
        "shopee_url": f"https://shopee.co.id/product/{sku}",
        "scraped_at": "2026-05-11T08:35:09+00:00",
    }


def test_build_components_maps_cleaned_csv_to_runtime_catalog(tmp_path):
    csv_path = tmp_path / "products_cleaned.csv"
    _write_csv(
        csv_path,
        [
            _row("cpu1", "AMD Ryzen 5 7600 65W AM5", "Processor", "AMD Socket AM5"),
            _row("mobo1", "MSI B650M DDR5 mATX Motherboard", "Motherboard", "Motherboard AMD AM5"),
            _row("ram1", "TeamGroup DDR5 6000MHz 32GB (2x16GB)", "RAM", "PC - Desktop"),
            _row("gpu1", "GALAX GeForce RTX 4060 8GB", "VGA", "nvidia"),
            _row("ssd1", "KLEVV CRAS C925G 1TB M.2 NVMe", "SSD", "Internal SSD (SOLID STATE DISK)"),
            _row("hdd1", "Seagate Barracuda 2TB 3.5 Internal HDD", "Hard Drive", "Harddisk Internal 3.5 For Desktop PC"),
            _row("psu1", "Cooler Master MWE 650W 80+ Bronze", "PSU"),
            _row("air1", "Deepcool AG400 120mm Air Cooler", "Cooler", "Air Cooler / Heatsink Cooler"),
            _row("fan1", "ID-Cooling 120mm Case Fan", "Cooler", "Fan Casing 12CM Fan Case"),
            _row("case1", "Deepcool CH370 mATX Mesh Case", "Casing"),
            _row("mon1", "LG 24GS60F-B 24 FHD IPS 180Hz Gaming Monitor", "LCD"),
            _row("ups1", "APC Back-UPS 1200VA", "UPS"),
            _row("nb1", "Acer Nitro Notebook", "Notebook"),
        ],
    )

    components, report = build_components(csv_path, limit_per_category=50, include_curated_ram=False)

    categories = {item["category"] for item in components}
    assert categories >= {"cpu", "motherboard", "ram", "gpu", "ssd", "hdd", "psu", "cooler", "case", "monitor", "ups"}
    assert "notebook" not in categories
    assert report["source_rows"] == 13
    assert report["written_rows"] == 12

    by_sku = {item["sku"]: item for item in components}
    assert by_sku["cpu1"]["specs"]["socket"] == "AM5"
    assert by_sku["ram1"]["specs"]["type"] == "DDR5"
    assert by_sku["ram1"]["specs"]["capacity_gb"] == 32
    assert by_sku["gpu1"]["specs"]["vram_gb"] == 8
    assert by_sku["gpu1"]["specs"]["recommended_psu_w"] == 650
    assert by_sku["hdd1"]["category"] == "hdd"
    assert by_sku["psu1"]["specs"]["wattage_w"] == 650
    assert {item["specs"]["type"] for item in components if item["category"] == "cooler"} >= {"air", "fan"}
    assert by_sku["mon1"]["category"] == "monitor"
    assert by_sku["ups1"]["specs"]["capacity_va"] == 1200
    assert by_sku["gpu1"]["marketplace_links"] == [
        {"marketplace": "enterkomputer", "url": by_sku["gpu1"]["product_url"]},
        {"marketplace": "tokopedia", "url": by_sku["gpu1"]["tokopedia_url"]},
        {"marketplace": "shopee", "url": by_sku["gpu1"]["shopee_url"]},
    ]

    validation = validate_components(components)
    assert validation["ok"] is True
    assert validation["missing_categories"] == []


def test_build_components_flags_suspiciously_low_ram_prices(tmp_path):
    csv_path = tmp_path / "products_cleaned.csv"
    _write_csv(
        csv_path,
        [
            _row("ram-low", "Patriot DDR5 6000MHz 32GB (2x16GB)", "RAM", "PC - Desktop", 1_100_000),
            _row("ram-a", "Kingston DDR5 6000MHz 32GB (2x16GB)", "RAM", "PC - Desktop", 3_400_000),
            _row("ram-b", "Corsair DDR5 6000MHz 32GB (2x16GB)", "RAM", "PC - Desktop", 3_800_000),
            _row("ram-c", "G.Skill DDR5 6000MHz 32GB (2x16GB)", "RAM", "PC - Desktop", 4_200_000),
            _row("ram-d", "KLEVV DDR5 6000MHz 32GB (2x16GB)", "RAM", "PC - Desktop", 4_400_000),
            _row("ram-e", "ADATA DDR5 6000MHz 32GB (2x16GB)", "RAM", "PC - Desktop", 4_600_000),
        ],
    )

    components, report = build_components(csv_path, limit_per_category=50, include_curated_ram=False)
    low_ram = next(item for item in components if item["sku"] == "ram-low")

    assert "price_outlier_low" in low_ram["quality_flags"]
    assert low_ram["reference_price_idr"] >= 3_800_000
    assert report["quality_flags"]["price_outlier_low"] == 1


def test_build_components_keeps_legacy_ddr3_motherboard_memory_type(tmp_path):
    csv_path = tmp_path / "products_cleaned.csv"
    _write_csv(
        csv_path,
        [
            _row(
                "h61",
                "Gigabyte GA-H61M-DS2 (LGA1155, H61, DDR3) - Garansi Distributor",
                "Motherboard",
                "Motherboard Intel LGA 1155",
                470_000,
            ),
        ],
    )

    components, _report = build_components(csv_path, limit_per_category=50, include_curated_ram=False)
    motherboard = next(item for item in components if item["sku"] == "h61")

    assert motherboard["specs"]["socket"] == "LGA 1155"
    assert motherboard["specs"]["ram_type"] == "DDR3"


def test_build_components_skips_ups_accessories_and_rack_rows(tmp_path):
    csv_path = tmp_path / "products_cleaned.csv"
    _write_csv(
        csv_path,
        [
            _row("ups-real", "APC Easy UPS BVX 1200VA, 230V, AVR", "UPS"),
            _row("ups-rail", "APC Smart-UPS SRT 19 Rail Kit for Smart-UPS SRT 2.2/3kVA - SRTRK4", "UPS"),
            _row("ups-rack", "APC Rack NetShelter SX 42U, 600mm Wide x 1070mm Deep Enclosure - AR3100", "UPS"),
            _row("ups-surge", "APC Essential SurgeArrest, 5 Outlets 230V - PM5-GR", "UPS"),
            _row("ups-battery", "APC Replacement Battery Cartridge APCRBC140", "UPS"),
        ],
    )

    components, report = build_components(csv_path, limit_per_category=50, include_curated_ram=False)

    assert [item["sku"] for item in components] == ["ups-real"]
    assert report["skipped"]["ups_accessory"] == 4


def test_build_components_skips_nas_enclosures_but_keeps_internal_nas_hdds(tmp_path):
    csv_path = tmp_path / "products_cleaned.csv"
    _write_csv(
        csv_path,
        [
            _row(
                "hdd-nas-drive",
                "WDC Red Plus NAS 4TB SATA3 5400RPM 128MB - WD40EFZZ - Garansi 3 Th",
                "Hard Drive",
                "Harddisk Internal 3.5 For Desktop PC",
            ),
            _row(
                "nas-box",
                "Synology DiskStation DS725+ 2 Bay",
                "Hard Drive",
                "NAS",
            ),
            _row(
                "nas-expansion",
                "Synology Expansion Unit DX517 - 5 Bay",
                "Hard Drive",
                "NAS",
            ),
        ],
    )

    components, report = build_components(csv_path, limit_per_category=50, include_curated_ram=False)

    assert [item["sku"] for item in components] == ["hdd-nas-drive"]
    assert components[0]["specs"]["capacity_gb"] == 4096
    assert report["skipped"]["non_desktop_hdd"] == 2


def test_validate_components_reports_category_quality_gaps(tmp_path):
    csv_path = tmp_path / "products_cleaned.csv"
    row_with_gaps = _row(
        "ram-gap",
        "Generic DDR4 16GB Desktop Memory",
        "RAM",
        "PC - Desktop",
        750_000,
    )
    row_with_gaps["image_url"] = ""
    row_with_gaps["product_url"] = ""
    row_with_gaps["tokopedia_url"] = ""
    row_with_gaps["shopee_url"] = ""
    _write_csv(
        csv_path,
        [
            _row("ram-ok", "Kingston DDR4 3200MHz 16GB (1x16GB)", "RAM", "PC - Desktop", 1_200_000),
            row_with_gaps,
        ],
    )

    components, _report = build_components(csv_path, limit_per_category=50, include_curated_ram=False)
    validation = validate_components(components)

    assert "quality" in validation
    ram_quality = validation["quality"]["category_metrics"]["ram"]
    assert ram_quality["total"] == 2
    assert ram_quality["images"]["missing"] == 1
    assert ram_quality["marketplace_links"]["missing"] == 1
    assert ram_quality["required_spec_coverage"]["speed_mhz"]["missing"] == 1
    assert {
        "category": "ram",
        "code": "required_spec_coverage_low",
        "field": "speed_mhz",
        "missing": 1,
        "total": 2,
        "coverage": 0.5,
    } in validation["quality"]["action_items"]


def test_real_cleaned_csv_produces_pc_builder_category_coverage():
    components, _report = build_components(
        ROOT / "data" / "products_cleaned.csv",
        limit_per_category=25,
        include_curated_ram=False,
    )

    validation = validate_components(components)

    assert validation["ok"] is True
    assert validation["missing_categories"] == []
    assert validation["counts"]["cooler"] >= 2
    assert validation["counts"]["monitor"] > 0
    assert validation["counts"]["ups"] > 0


def test_gpu_psu_heuristic_handles_modern_midrange_model_numbers(tmp_path):
    csv_path = tmp_path / "products_cleaned.csv"
    _write_csv(
        csv_path,
        [
            _row("gpu5060", "Inno3D GeForce RTX 5060 Ti 8GB GDDR7", "VGA", "nvidia"),
            _row("gpu5080", "MSI GeForce RTX 5080 16GB GDDR7", "VGA", "nvidia"),
        ],
    )

    components, _report = build_components(csv_path, limit_per_category=10, include_curated_ram=False)
    by_sku = {item["sku"]: item for item in components}

    assert by_sku["gpu5060"]["specs"]["recommended_psu_w"] == 650
    assert by_sku["gpu5080"]["specs"]["recommended_psu_w"] == 850
