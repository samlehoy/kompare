from backend.utils.build_pc import (
    BUDGET_TIERS,
    OPTIONAL_ADDON_SLOTS,
    REQUIRED_BUILD_SLOTS,
    USE_CASE_PROFILES,
    analyze_existing_components,
    compose_build,
    normalize_marketplace_links,
    parse_existing_component,
    pick_cpu,
    pick_fan_cooler,
    pick_gpu,
    pick_motherboard,
    pick_ram,
    recommend_upgrade,
    strategy_allocation_profile,
    validate_build,
)
from fastapi.testclient import TestClient

from backend.app import app


def component(category, sku, name, price, specs=None, product_url=None, brand="Test Lab", **extra):
    return {
        "sku": sku,
        "id": sku,
        "category": category,
        "name": name,
        "brand": brand,
        "price_idr": price,
        "product_url": product_url,
        "specs": specs or {},
        **extra,
    }


def sample_components():
    return {
        "cpu": [
            component(
                "cpu",
                "cpu-am5",
                "AMD Ryzen 5 7600",
                3_000_000,
                {
                    "socket": "AM5",
                    "brand": "AMD",
                    "cores": 6,
                    "threads": 12,
                    "tdp_w": 65,
                },
                "https://enterkomputer.com/cpu-am5",
            )
        ],
        "motherboard": [
            component(
                "motherboard",
                "mobo-am5",
                "B650M Motherboard",
                2_000_000,
                {
                    "socket": "AM5",
                    "form_factor": "mATX",
                    "ram_type": "DDR5",
                },
                "https://enterkomputer.com/mobo-am5",
            )
        ],
        "ram": [
            component(
                "ram",
                "ram-ddr5",
                "32GB DDR5 Kit",
                1_500_000,
                {
                    "type": "DDR5",
                    "capacity_gb": 32,
                    "speed_mhz": 6000,
                },
            )
        ],
        "gpu": [
            component(
                "gpu",
                "gpu-4060",
                "GeForce RTX 4060",
                5_000_000,
                {
                    "vendor": "nvidia",
                    "vram_gb": 8,
                    "tdp_w": 115,
                    "recommended_psu_w": 550,
                },
            )
        ],
        "ssd": [
            component(
                "ssd",
                "ssd-1tb",
                "1TB NVMe SSD",
                1_000_000,
                {
                    "capacity_gb": 1024,
                    "interface": "NVMe",
                },
            )
        ],
        "hdd": [
            component(
                "hdd",
                "hdd-2tb",
                "2TB SATA HDD",
                700_000,
                {
                    "capacity_gb": 2048,
                    "interface": "SATA",
                },
            )
        ],
        "psu": [
            component(
                "psu",
                "psu-650",
                "650W Gold PSU",
                1_000_000,
                {
                    "wattage_w": 650,
                    "rating": "Gold",
                    "modular": "full",
                },
            )
        ],
        "case": [
            component(
                "case",
                "case-matx",
                "Airflow mATX Case",
                700_000,
                {
                    "max_form_factor": "mATX",
                    "form_factor": "mATX",
                },
            )
        ],
        "cooler": [
            component(
                "cooler",
                "cooler-air",
                "120mm Tower Cooler",
                500_000,
                {
                    "type": "air",
                    "tdp_w": 180,
                    "fan_size_mm": 120,
                },
            ),
            component(
                "cooler",
                "fan-pack",
                "3-Pack 120mm Case Fan",
                250_000,
                {
                    "type": "fan",
                    "fan_size_mm": 120,
                },
            ),
        ],
    }


def sample_upgrade_components():
    catalog = sample_components()
    catalog["motherboard"] = [
        *catalog["motherboard"],
        component(
            "motherboard",
            "mobo-am4",
            "B550M DDR4 Motherboard",
            1_400_000,
            {
                "socket": "AM4",
                "form_factor": "mATX",
                "ram_type": "DDR4",
            },
        ),
    ]
    catalog["ram"] = [
        *catalog["ram"],
        component(
            "ram",
            "ram-ddr4-32",
            "32GB DDR4 3200 Kit",
            1_200_000,
            {
                "type": "DDR4",
                "capacity_gb": 32,
                "speed_mhz": 3200,
            },
        ),
    ]
    return catalog


def strategic_budget_components():
    catalog = sample_components()
    catalog["cpu"] = [
        component(
            "cpu",
            "cpu-am5-value",
            "AMD Ryzen 5 7600",
            3_000_000,
            {"socket": "AM5", "brand": "AMD", "cores": 6, "threads": 12, "tdp_w": 65},
        ),
        component(
            "cpu",
            "cpu-am5-x3d",
            "AMD Ryzen 7 9800X3D",
            8_000_000,
            {"socket": "AM5", "brand": "AMD", "cores": 8, "threads": 16, "tdp_w": 120},
        ),
    ]
    catalog["motherboard"] = [
        component(
            "motherboard",
            "mobo-am5-value",
            "B650M DDR5 Motherboard",
            2_000_000,
            {"socket": "AM5", "form_factor": "mATX", "ram_type": "DDR5"},
        ),
        component(
            "motherboard",
            "mobo-am5-premium",
            "X870 DDR5 Motherboard",
            4_000_000,
            {"socket": "AM5", "form_factor": "ATX", "ram_type": "DDR5", "chipset": "X870"},
        ),
    ]
    catalog["ram"] = [
        component(
            "ram",
            "ram-ddr5-16",
            "16GB DDR5 Kit",
            900_000,
            {"type": "DDR5", "capacity_gb": 16, "speed_mhz": 5600},
        ),
        component(
            "ram",
            "ram-ddr5-32",
            "32GB DDR5 Kit",
            1_600_000,
            {"type": "DDR5", "capacity_gb": 32, "speed_mhz": 6000},
        ),
    ]
    catalog["gpu"] = [
        component(
            "gpu",
            "gpu-4060",
            "GeForce RTX 4060",
            5_000_000,
            {"vendor": "nvidia", "vram_gb": 8, "tdp_w": 115, "recommended_psu_w": 550},
        ),
        component(
            "gpu",
            "gpu-5070-ti",
            "GeForce RTX 5070 Ti 16GB",
            14_000_000,
            {"vendor": "nvidia", "vram_gb": 16, "tdp_w": 300, "recommended_psu_w": 750},
        ),
        component(
            "gpu",
            "gpu-9070-xt",
            "Radeon RX 9070 XT 16GB",
            13_000_000,
            {"vendor": "radeon", "vram_gb": 16, "tdp_w": 300, "recommended_psu_w": 750},
        ),
    ]
    catalog["ssd"] = [
        component(
            "ssd",
            "ssd-1tb",
            "1TB NVMe SSD",
            1_000_000,
            {"capacity_gb": 1024, "interface": "NVMe"},
        ),
        component(
            "ssd",
            "ssd-2tb",
            "2TB NVMe SSD",
            2_000_000,
            {"capacity_gb": 2048, "interface": "NVMe"},
        ),
    ]
    catalog["psu"] = [
        component(
            "psu",
            "psu-650",
            "650W Gold PSU",
            1_000_000,
            {"wattage_w": 650, "rating": "Gold", "modular": "full"},
        ),
        component(
            "psu",
            "psu-850",
            "850W Gold PSU",
            1_800_000,
            {"wattage_w": 850, "rating": "Gold", "modular": "full"},
        ),
    ]
    catalog["case"] = [
        component(
            "case",
            "case-matx",
            "Airflow mATX Case",
            800_000,
            {"max_form_factor": "mATX", "form_factor": "mATX"},
        ),
        component(
            "case",
            "case-atx",
            "Airflow ATX Case",
            1_500_000,
            {"max_form_factor": "ATX", "form_factor": "ATX"},
        ),
    ]
    catalog["cooler"] = [
        component(
            "cooler",
            "cooler-air",
            "120mm Tower Cooler",
            500_000,
            {"type": "air", "tdp_w": 180, "fan_size_mm": 120},
        ),
        component(
            "cooler",
            "cooler-liquid",
            "240mm Liquid Cooler",
            1_600_000,
            {"type": "liquid", "tdp_w": 280, "fan_size_mm": 240},
        ),
        component(
            "cooler",
            "fan-pack",
            "3-Pack 120mm Case Fan",
            250_000,
            {"type": "fan", "fan_size_mm": 120},
        ),
    ]
    return catalog


def test_budget_tiers_include_pc_builder_ranges():
    keys = [tier["key"] for tier in BUDGET_TIERS]
    assert keys == [
        "entry_level",
        "mid_range",
        "high_end",
        "custom",
    ]
    assert "budget_gaming" not in keys
    assert "enthusiast" not in keys
    ranges = {tier["key"]: (tier["min_idr"], tier["max_idr"]) for tier in BUDGET_TIERS}
    assert ranges["entry_level"] == (7_000_000, 12_000_000)
    assert ranges["mid_range"] == (12_000_000, 22_000_000)
    assert ranges["high_end"] == (22_000_000, 40_000_000)
    assert next(tier for tier in BUDGET_TIERS if tier["key"] == "custom")["display_range"] == "♾️"
    assert BUDGET_TIERS[0]["min_idr"] > 0
    assert "1080p" in " ".join(tier["target"] for tier in BUDGET_TIERS).lower()


def test_budget_tiers_include_decision_metadata_for_cards():
    for tier in BUDGET_TIERS:
        assert tier["summary"]
        assert tier["performance_goal"]
        assert tier["upgrade_note"]
        assert len(tier["summary"]) <= 90
        assert len(tier["performance_goal"]) <= 42
        assert len(tier["upgrade_note"]) <= 70


def test_use_case_profiles_exclude_optional_hdd_and_sum_to_100_percent():
    for profile in USE_CASE_PROFILES.values():
        assert "hdd" not in profile
        assert sum(profile.values()) == 100


def test_strategy_allocation_profile_applies_priority_and_strategy_presets_without_manual_overrides():
    profile = strategy_allocation_profile(
        "gaming",
        "gaming",
        budget_strategy="balanced",
    )

    assert profile == {
        "cpu": 20,
        "gpu": 37,
        "ram": 7,
        "motherboard": 9,
        "ssd": 8,
        "psu": 8,
        "case": 5,
        "cpu_cooler": 5,
        "fan_cooler": 1,
    }
    assert sum(profile.values()) == 100


def test_strategy_allocation_profile_combines_performance_priority_and_budget_strategy():
    profile = strategy_allocation_profile(
        "gaming",
        "productivity",
        budget_strategy="maximize",
    )

    assert profile == {
        "cpu": 25,
        "gpu": 29,
        "ram": 10,
        "motherboard": 9,
        "ssd": 12,
        "psu": 8,
        "case": 2,
        "cpu_cooler": 5,
        "fan_cooler": 0,
    }
    assert sum(profile.values()) == 100


def test_strategy_allocation_profile_keeps_valid_manual_allocation_overrides_authoritative():
    overrides = {
        "cpu": 20,
        "gpu": 35,
        "ram": 10,
        "motherboard": 10,
        "ssd": 10,
        "psu": 8,
        "case": 4,
        "cpu_cooler": 2,
        "fan_cooler": 1,
    }

    assert strategy_allocation_profile(
        "gaming",
        "productivity",
        budget_strategy="maximize",
        allocation_overrides=overrides,
    ) == overrides


def test_compose_build_returns_required_slots_and_optional_addon_states():
    result = compose_build(sample_components(), 18_000_000, "gaming", include_optional_addons=False)

    assert REQUIRED_BUILD_SLOTS == [
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
    assert set(REQUIRED_BUILD_SLOTS).issubset(result["components"].keys())
    assert "hdd" not in result["components"]
    assert result["components"]["cpu"]["sku"] == "cpu-am5"
    assert result["components"]["cpu_cooler"]["sku"] == "cooler-air"
    assert result["components"]["fan_cooler"]["sku"] == "fan-pack"
    assert "hdd" not in result["missing_slots"]
    assert result["total_idr"] <= result["budget_idr"]
    assert OPTIONAL_ADDON_SLOTS == ["hdd", "monitor", "ups"]


def test_compose_build_reports_dynamic_budget_band_and_usage_for_any_budget():
    cases = [
        (5_000_000, "below_entry"),
        (10_000_000, "entry_level"),
        (18_000_000, "mid_range"),
        (30_000_000, "high_end"),
        (45_000_000, "custom_high"),
    ]

    for budget, expected_band in cases:
        result = compose_build(
            sample_components(),
            budget,
            "gaming",
            budget_strategy="balanced",
            performance_priority="gaming",
        )

        assert result["budget_band"]["key"] == expected_band
        assert result["budget_usage"]["strategy"] == "balanced"
        assert result["budget_usage"]["used_percent"] == round(result["total_idr"] / budget * 100, 1)
        assert "target_min_percent" in result["budget_usage"]
        assert isinstance(result["budget_warnings"], list)
        assert isinstance(result["upgrade_suggestions"], list)
        assert isinstance(result["alternative_options"], dict)
        assert result["performance_balance"]["priority"] == "gaming"


def test_balanced_strategy_upgrades_meaningful_parts_before_warning_about_unused_budget():
    result = compose_build(
        strategic_budget_components(),
        30_000_000,
        "gaming",
        budget_strategy="balanced",
        performance_priority="gaming",
        cpu_brand="AMD",
        gpu_vendor="Nvidia",
    )

    assert result["components"]["gpu"]["sku"] == "gpu-5070-ti"
    assert result["budget_usage"]["status"] in {"target_met", "optimized"}
    assert result["budget_usage"]["used_percent"] >= result["budget_usage"]["target_min_percent"]
    assert result["remaining_idr"] < 4_500_000
    assert not any(warning["code"] == "budget_underused" for warning in result["budget_warnings"])


def test_value_strategy_allows_unused_budget_but_returns_upgrade_suggestions():
    result = compose_build(
        strategic_budget_components(),
        30_000_000,
        "gaming",
        budget_strategy="value",
        performance_priority="best_value",
    )

    assert result["budget_usage"]["strategy"] == "value"
    assert result["budget_usage"]["used_percent"] < 85
    assert not result["budget_warnings"]
    assert result["upgrade_suggestions"]
    assert any(suggestion["slot"] in {"cpu", "gpu"} for suggestion in result["upgrade_suggestions"])


def test_maximize_strategy_pushes_high_budget_gaming_build_to_performance_tier():
    result = compose_build(
        strategic_budget_components(),
        45_000_000,
        "gaming",
        budget_strategy="maximize",
        performance_priority="gaming",
        cpu_brand="AMD",
        gpu_vendor="Nvidia",
    )

    assert result["budget_band"]["key"] == "custom_high"
    assert result["components"]["cpu"]["sku"] == "cpu-am5-x3d"
    assert result["components"]["gpu"]["sku"] == "gpu-5070-ti"
    assert result["components"]["psu"]["sku"] == "psu-850"
    assert result["budget_usage"]["status"] == "catalog_limited"
    assert any(warning["code"] == "budget_underused" for warning in result["budget_warnings"])
    assert "gpu" in result["performance_balance"]["summary"].lower()


def test_maximize_strategy_fills_missing_required_slots_before_accepting_target_usage():
    result = compose_build(
        sample_components(),
        15_000_000,
        "gaming",
        budget_strategy="maximize",
        performance_priority="gaming",
    )

    assert result["missing_slots"] == []
    assert result["total_idr"] <= result["budget_idr"]
    assert all(result["components"].get(slot) for slot in REQUIRED_BUILD_SLOTS)


def test_gaming_priority_prefers_x3d_platform_over_more_legacy_cores():
    catalog = strategic_budget_components()
    catalog["cpu"].append(
        component(
            "cpu",
            "cpu-am4-many-cores",
            "AMD Ryzen 9 5900XT",
            5_600_000,
            {"socket": "AM4", "brand": "AMD", "cores": 16, "threads": 32, "tdp_w": 105},
        )
    )
    catalog["motherboard"].append(
        component(
            "motherboard",
            "mobo-am4",
            "B550 DDR4 Motherboard",
            2_000_000,
            {"socket": "AM4", "form_factor": "ATX", "ram_type": "DDR4"},
        )
    )
    catalog["ram"].append(
        component(
            "ram",
            "ram-ddr4-64",
            "64GB DDR4 Kit",
            4_500_000,
            {"type": "DDR4", "capacity_gb": 64, "speed_mhz": 3600},
        )
    )

    result = compose_build(
        catalog,
        45_000_000,
        "gaming",
        budget_strategy="maximize",
        performance_priority="gaming",
        cpu_brand="AMD",
        gpu_vendor="Nvidia",
    )

    assert result["components"]["cpu"]["sku"] == "cpu-am5-x3d"
    assert result["components"]["motherboard"]["sku"].startswith("mobo-am5")
    assert result["optional_addons"]["hdd"] is None
    assert result["optional_addons"]["monitor"] is None
    assert result["optional_addons"]["ups"] is None
    assert result["unavailable_optional_addons"] == []


def test_compose_build_returns_hdd_only_when_optional_addons_are_requested():
    result = compose_build(sample_components(), 18_000_000, "gaming", include_optional_addons=True)

    assert "hdd" not in result["components"]
    assert result["optional_addons"]["hdd"]["sku"] == "hdd-2tb"
    assert result["optional_addons"]["monitor"] is None
    assert result["optional_addons"]["ups"] is None
    assert "hdd" not in result["missing_slots"]
    assert "monitor" in result["unavailable_optional_addons"]
    assert "ups" in result["unavailable_optional_addons"]


def test_compose_build_only_attempts_selected_optional_addons():
    result = compose_build(
        sample_components(),
        18_000_000,
        "gaming",
        include_optional_addons=True,
        optional_addon_slots=["hdd"],
    )

    assert result["optional_addons"]["hdd"]["sku"] == "hdd-2tb"
    assert result["optional_addons"]["monitor"] is None
    assert result["optional_addons"]["ups"] is None
    assert result["unavailable_optional_addons"] == []


def test_compose_build_picks_safely_sized_ups_not_low_va_or_regulator():
    catalog = sample_components()
    catalog["monitor"] = [
        component(
            "monitor",
            "monitor-24",
            "24 inch FHD 144Hz Monitor",
            1_500_000,
            {"size_inch": 24, "refresh_hz": 144, "resolution": "FHD"},
        )
    ]
    catalog["ups"] = [
        component(
            "ups",
            "small-ups",
            "Entry UPS 600VA / 360W",
            600_000,
            {"capacity_va": 600, "wattage_w": 360},
        ),
        component(
            "ups",
            "voltage-regulator",
            "APC Line-R 3000VA Automatic Voltage Regulator",
            700_000,
            {"capacity_va": 3000},
        ),
        component(
            "ups",
            "safe-ups",
            "APC Easy UPS 1200VA / 720W",
            1_200_000,
            {"capacity_va": 1200, "wattage_w": 720},
        ),
    ]

    result = compose_build(catalog, 12_000_000, "gaming", include_optional_addons=True)

    assert result["optional_addons"]["ups"]["sku"] == "safe-ups"


def test_compose_build_matches_monitor_to_mainstream_gpu_target():
    catalog = sample_components()
    catalog["monitor"] = [
        component(
            "monitor",
            "fhd-high-refresh",
            "LG UltraGear 24 inch FHD IPS 180Hz Gaming Monitor",
            1_600_000,
            {"size_inch": 24, "refresh_hz": 180, "resolution": "FHD"},
        ),
        component(
            "monitor",
            "qhd-overkill",
            "Cube Gaming 27 inch QHD IPS 240Hz Gaming Monitor",
            2_750_000,
            {"size_inch": 27, "refresh_hz": 240, "resolution": "QHD"},
        ),
        component(
            "monitor",
            "4k-office",
            "Samsung 32 inch 4K UHD 60Hz Monitor",
            2_900_000,
            {"size_inch": 32, "refresh_hz": 60, "resolution": "4K"},
        ),
    ]

    result = compose_build(catalog, 20_000_000, "gaming", include_optional_addons=True)

    monitor = result["optional_addons"]["monitor"]
    assert monitor["sku"] == "fhd-high-refresh"
    assert monitor["selection_rationale"]["summary"] == "Matched to the build's gaming display target."
    assert "FHD target resolution" in monitor["selection_rationale"]["factors"]


def test_compose_build_carries_ram_overrun_into_gpu_budget():
    catalog = {
        "cpu": [
            component("cpu", "cpu", "AMD Ryzen 5 7600", 1_500_000, {"socket": "AM5", "brand": "AMD"})
        ],
        "motherboard": [
            component("motherboard", "mobo", "B650M DDR5", 800_000, {"socket": "AM5", "form_factor": "mATX", "ram_type": "DDR5"})
        ],
        "ram": [
            component("ram", "ram-16", "DDR5 16GB", 2_000_000, {"type": "DDR5", "capacity_gb": 16, "speed_mhz": 6000})
        ],
        "gpu": [
            component("gpu", "gpu-expensive", "GeForce RTX 4070 12GB", 3_200_000, {"vendor": "nvidia", "vram_gb": 12, "recommended_psu_w": 650}),
            component("gpu", "gpu-balanced", "GeForce RTX 4060 8GB", 2_400_000, {"vendor": "nvidia", "vram_gb": 8, "recommended_psu_w": 550}),
        ],
        "ssd": [
            component("ssd", "ssd", "1TB NVMe SSD", 400_000, {"capacity_gb": 1024, "interface": "NVMe"})
        ],
        "hdd": [
            component("hdd", "hdd", "1TB HDD", 300_000, {"capacity_gb": 1024, "interface": "SATA"})
        ],
        "psu": [
            component("psu", "psu", "650W Bronze PSU", 600_000, {"wattage_w": 650, "rating": "Bronze"})
        ],
        "case": [
            component("case", "case", "mATX Case", 400_000, {"max_form_factor": "mATX"})
        ],
        "cooler": [
            component("cooler", "cooler", "Air Cooler", 300_000, {"type": "air", "tdp_w": 150}),
            component("cooler", "fan", "Case Fan", 100_000, {"type": "fan", "fan_size_mm": 120}),
        ],
    }

    result = compose_build(catalog, 10_000_000, "gaming")

    assert result["components"]["gpu"]["sku"] == "gpu-balanced"


def test_gpu_picker_scores_stock_freshness_specs_and_value_over_price_only():
    gpus = [
        component(
            "gpu",
            "expensive-stale-out",
            "Old Premium RTX 4060 8GB",
            7_900_000,
            {"vendor": "nvidia", "vram_gb": 8, "recommended_psu_w": 650},
            stock_status="out_of_stock",
            scraped_at="2024-01-01T00:00:00+00:00",
        ),
        component(
            "gpu",
            "balanced-fresh",
            "Fresh RTX 4060 Ti 8GB",
            6_100_000,
            {"vendor": "nvidia", "vram_gb": 8, "recommended_psu_w": 650},
            stock_status="in_stock",
            scraped_at="2026-05-10T00:00:00+00:00",
        ),
        component(
            "gpu",
            "cheap-weak",
            "Fresh GTX 1650 4GB",
            2_500_000,
            {"vendor": "nvidia", "vram_gb": 4, "recommended_psu_w": 450},
            stock_status="in_stock",
            scraped_at="2026-05-10T00:00:00+00:00",
        ),
    ]

    assert pick_gpu(gpus, 8_000_000, vendor="Nvidia")["sku"] == "balanced-fresh"


def test_cpu_picker_scores_modern_platform_runway_over_old_value_cpu():
    cpus = [
        component(
            "cpu",
            "old-lga1151",
            "Intel Core i7-8700 3.2GHz Socket LGA 1151V2",
            1_900_000,
            {"socket": "LGA 1151V2", "brand": "Intel", "cores": 6, "threads": 12, "tdp_w": 65},
            stock_status="in_stock",
            scraped_at="2026-05-10T00:00:00+00:00",
        ),
        component(
            "cpu",
            "modern-am5",
            "AMD Ryzen 5 7500F Socket AM5",
            2_200_000,
            {"socket": "AM5", "brand": "AMD", "cores": 6, "threads": 12, "tdp_w": 65},
            stock_status="in_stock",
            scraped_at="2026-05-10T00:00:00+00:00",
        ),
    ]

    assert pick_cpu(cpus, 2_500_000)["sku"] == "modern-am5"


def test_gaming_gpu_picker_penalizes_workstation_pro_cards_when_gaming_cards_fit():
    gpus = [
        component(
            "gpu",
            "arc-pro",
            "ASRock Intel Arc Pro B60 24GB GDDR6 Creator",
            13_000_000,
            {"vendor": "intel", "vram_gb": 24, "recommended_psu_w": 650},
            stock_status="in_stock",
            scraped_at="2026-05-10T00:00:00+00:00",
        ),
        component(
            "gpu",
            "rtx4070",
            "GeForce RTX 4070 Super 12GB Gaming",
            11_000_000,
            {"vendor": "nvidia", "vram_gb": 12, "recommended_psu_w": 650},
            stock_status="in_stock",
            scraped_at="2026-05-10T00:00:00+00:00",
        ),
    ]

    assert pick_gpu(gpus, 14_000_000, use_case="gaming")["sku"] == "rtx4070"


def test_ram_picker_scores_capacity_speed_stock_and_freshness_within_ddr_generation():
    rams = [
        component(
            "ram",
            "expensive-stale-ddr5",
            "Old Premium DDR5 32GB 5200",
            2_800_000,
            {"type": "DDR5", "capacity_gb": 32, "speed_mhz": 5200},
            stock_status="out_of_stock",
            scraped_at="2024-01-01T00:00:00+00:00",
        ),
        component(
            "ram",
            "balanced-fresh-ddr5",
            "Fresh DDR5 32GB 6000",
            1_650_000,
            {"type": "DDR5", "capacity_gb": 32, "speed_mhz": 6000},
            stock_status="in_stock",
            scraped_at="2026-05-10T00:00:00+00:00",
        ),
    ]

    assert pick_ram(rams, 3_000_000, "DDR5")["sku"] == "balanced-fresh-ddr5"


def test_ram_picker_respects_practical_capacity_target_before_speed_value():
    rams = [
        component(
            "ram",
            "fast-8gb",
            "Fast DDR4 8GB 4000",
            900_000,
            {"type": "DDR4", "capacity_gb": 8, "speed_mhz": 4000},
            stock_status="in_stock",
            scraped_at="2026-05-10T00:00:00+00:00",
        ),
        component(
            "ram",
            "steady-16gb",
            "DDR4 16GB 3200",
            1_200_000,
            {"type": "DDR4", "capacity_gb": 16, "speed_mhz": 3200},
            stock_status="in_stock",
            scraped_at="2026-05-10T00:00:00+00:00",
        ),
    ]

    assert pick_ram(rams, 1_500_000, "DDR4", target_capacity_gb=16)["sku"] == "steady-16gb"


def test_ram_picker_avoids_price_outlier_flag_when_normal_candidate_exists():
    rams = [
        component(
            "ram",
            "too-cheap-ddr5",
            "Suspicious DDR5 64GB 6400",
            1_100_000,
            {"type": "DDR5", "capacity_gb": 64, "speed_mhz": 6400},
            stock_status="in_stock",
            scraped_at="2026-05-10T00:00:00+00:00",
            quality_flags=["price_outlier_low"],
        ),
        component(
            "ram",
            "market-ddr5",
            "Market DDR5 32GB 6000",
            3_200_000,
            {"type": "DDR5", "capacity_gb": 32, "speed_mhz": 6000},
            stock_status="in_stock",
            scraped_at="2026-05-10T00:00:00+00:00",
        ),
    ]

    assert pick_ram(rams, 4_000_000, "DDR5", target_capacity_gb=32)["sku"] == "market-ddr5"


def test_ram_picker_allows_slot_overrun_to_meet_capacity_target():
    rams = [
        component(
            "ram",
            "tiny-ddr5",
            "DDR5 8GB 6000",
            900_000,
            {"type": "DDR5", "capacity_gb": 8, "speed_mhz": 6000},
            stock_status="in_stock",
            scraped_at="2026-05-10T00:00:00+00:00",
        ),
        component(
            "ram",
            "target-ddr5",
            "DDR5 32GB 6000",
            3_200_000,
            {"type": "DDR5", "capacity_gb": 32, "speed_mhz": 6000},
            stock_status="in_stock",
            scraped_at="2026-05-10T00:00:00+00:00",
        ),
    ]

    assert pick_ram(rams, 1_400_000, "DDR5", target_capacity_gb=32)["sku"] == "target-ddr5"


def test_motherboard_picker_scores_platform_fit_without_overbuying_stale_board():
    boards = [
        component(
            "motherboard",
            "expensive-stale-atx",
            "Old Expensive X670 ATX Motherboard",
            4_000_000,
            {"socket": "AM5", "form_factor": "ATX", "ram_type": "DDR5"},
            stock_status="out_of_stock",
            scraped_at="2024-01-01T00:00:00+00:00",
        ),
        component(
            "motherboard",
            "fresh-matx",
            "Fresh B650M DDR5 Motherboard",
            2_200_000,
            {"socket": "AM5", "form_factor": "mATX", "ram_type": "DDR5"},
            stock_status="in_stock",
            scraped_at="2026-05-10T00:00:00+00:00",
        ),
    ]

    assert pick_motherboard(boards, 4_500_000, "AM5")["sku"] == "fresh-matx"


def test_fan_cooler_picker_avoids_cpu_coolers_that_only_mention_fan():
    coolers = [
        component(
            "cooler",
            "cpu-cooler-with-fan",
            "be quiet! Shadow Rock Slim 2 - 14CM FAN Silent and Premium Cooling Technologies",
            720_000,
            {"type": "fan", "fan_size_mm": 140},
            stock_status="in_stock",
            scraped_at="2026-05-10T00:00:00+00:00",
        ),
        component(
            "cooler",
            "case-fan-pack",
            "Arctic P14 PWM PST A-RGB 14CM Case Fan - White",
            205_000,
            {"type": "fan", "fan_size_mm": 140},
            stock_status="in_stock",
            scraped_at="2026-05-10T00:00:00+00:00",
        ),
    ]

    assert pick_fan_cooler(coolers, 800_000)["sku"] == "case-fan-pack"


def test_components_include_enterkomputer_marketplace_links_when_product_url_exists():
    result = compose_build(sample_components(), 18_000_000, "gaming")

    cpu = result["components"]["cpu"]
    assert cpu["primary_url"] == "https://enterkomputer.com/cpu-am5"
    assert cpu["marketplace_links"] == [
        {"marketplace": "enterkomputer", "url": "https://enterkomputer.com/cpu-am5"}
    ]


def test_compose_build_attaches_selection_rationale_to_picked_components():
    result = compose_build(sample_components(), 18_000_000, "gaming")

    gpu_rationale = result["components"]["gpu"]["selection_rationale"]
    cpu_rationale = result["components"]["cpu"]["selection_rationale"]

    assert "summary" in gpu_rationale
    assert "factors" in gpu_rationale
    assert any("VRAM" in factor for factor in gpu_rationale["factors"])
    assert any("gaming" in factor.lower() for factor in gpu_rationale["factors"])
    assert any("platform" in factor.lower() for factor in cpu_rationale["factors"])


def test_normalize_marketplace_links_preserves_existing_links():
    item = {
        "sku": "gpu-a",
        "marketplace_links": [{"marketplace": "enterkomputer", "url": "https://example.com/a"}],
    }

    assert normalize_marketplace_links(item)["primary_url"] == "https://example.com/a"


def test_normalize_marketplace_links_collects_marketplace_url_fields():
    item = {
        "sku": "gpu-a",
        "product_url": "https://enterkomputer.com/detail/gpu-a",
        "tokopedia_url": "https://tokopedia.com/enterkomputer/gpu-a",
        "shopee_url": "https://shopee.co.id/product/gpu-a",
    }

    normalized = normalize_marketplace_links(item)

    assert normalized["primary_url"] == "https://enterkomputer.com/detail/gpu-a"
    assert normalized["marketplace_links"] == [
        {"marketplace": "enterkomputer", "url": "https://enterkomputer.com/detail/gpu-a"},
        {"marketplace": "tokopedia", "url": "https://tokopedia.com/enterkomputer/gpu-a"},
        {"marketplace": "shopee", "url": "https://shopee.co.id/product/gpu-a"},
    ]


def test_analyze_existing_components_groups_manual_text_by_slot():
    result = analyze_existing_components({
        "cpu": "Ryzen 5 5600",
        "gpu": "RTX 3060 12GB",
        "ram": "16GB DDR4 3200",
        "notes": "I already have a 550W PSU but I am unsure about the motherboard.",
    })

    assert result["recognized"]["cpu"] == "Ryzen 5 5600"
    assert result["recognized"]["gpu"] == "RTX 3060 12GB"
    assert result["recognized"]["ram"] == "16GB DDR4 3200"
    assert any("motherboard" in warning.lower() for warning in result["warnings"])


def test_parse_existing_component_infers_common_upgrade_specs():
    cpu = parse_existing_component("cpu", "Ryzen 5 5600")
    ram = parse_existing_component("ram", "16GB DDR4 3200")
    gpu = parse_existing_component("gpu", "RTX 3060 12GB")
    modern_gpu = parse_existing_component("gpu", "RTX 5060 Ti 8GB")
    psu = parse_existing_component("psu", "550W Bronze")
    motherboard = parse_existing_component("motherboard", "B550M Pro4")
    ssd = parse_existing_component("ssd", "1TB NVMe M.2 SSD")
    hdd = parse_existing_component("hdd", "2TB SATA 3.5 HDD")

    assert cpu["specs"]["socket"] == "AM4"
    assert cpu["specs"]["brand"] == "AMD"
    assert ram["specs"] == {"type": "DDR4", "capacity_gb": 16, "speed_mhz": 3200}
    assert gpu["specs"]["vendor"] == "Nvidia"
    assert gpu["specs"]["vram_gb"] == 12
    assert gpu["specs"]["recommended_psu_w"] == 550
    assert modern_gpu["specs"]["recommended_psu_w"] == 650
    assert psu["specs"]["wattage_w"] == 550
    assert psu["specs"]["rating"] == "Bronze"
    assert motherboard["specs"]["socket"] == "AM4"
    assert motherboard["specs"]["form_factor"] == "mATX"
    assert motherboard["specs"]["ram_type"] == "DDR4"
    assert ssd["specs"] == {"capacity_gb": 1024, "interface": "NVMe", "form_factor": "M.2"}
    assert hdd["specs"] == {"capacity_gb": 2048, "interface": "SATA", "form_factor_in": "3.5"}


def test_upgrade_recommendation_uses_detected_owned_specs_for_motherboard_choice():
    result = recommend_upgrade(
        sample_upgrade_components(),
        7_000_000,
        "gaming",
        {
            "cpu": "Ryzen 5 5600",
            "ram": "16GB DDR4 3200",
            "gpu": "RTX 3060 12GB",
            "psu": "550W Bronze",
        },
    )

    assert result["detected_existing"]["cpu"]["specs"]["socket"] == "AM4"
    assert result["detected_existing"]["ram"]["specs"]["type"] == "DDR4"
    assert result["recommendation"]["components"]["motherboard"]["sku"] == "mobo-am4"
    assert not any(
        warning["id"] in {"cpu_motherboard_socket_mismatch", "motherboard_ram_type_mismatch"}
        for warning in result["compatibility_warnings"]
    )


def test_upgrade_recommendation_ranks_weak_owned_parts_by_impact():
    result = recommend_upgrade(
        sample_upgrade_components(),
        7_500_000,
        "gaming",
        {
            "cpu": "Ryzen 5 5600",
            "motherboard": "B550M Pro4",
            "ram": "8GB DDR4 2400",
            "gpu": "GTX 1050 Ti 4GB",
            "psu": "450W Bronze",
        },
    )

    priority_slots = [item["slot"] for item in result["upgrade_priorities"]]
    assert priority_slots[:3] == ["gpu", "ram", "psu"]
    assert result["upgrade_priorities"][0]["selected"] is True
    assert "gaming" in result["upgrade_priorities"][0]["reason"].lower()
    assert result["recommendation"]["components"]["gpu"]["sku"] == "gpu-4060"
    assert result["recommendation"]["components"]["ram"]["sku"] == "ram-ddr4-32"
    assert result["recommendation"]["components"]["psu"]["sku"] == "psu-650"
    assert result["recommendation"]["total_idr"] <= result["budget_idr"]


def test_validate_build_returns_structured_compatibility_warnings():
    warnings = validate_build({
        "cpu": component("cpu", "cpu-am5", "AM5 CPU", 1, {"socket": "AM5", "tdp_w": 125}),
        "motherboard": component(
            "motherboard",
            "mobo-lga",
            "LGA1700 DDR4 ATX Motherboard",
            1,
            {"socket": "LGA 1700", "ram_type": "DDR4", "form_factor": "ATX"},
        ),
        "ram": component("ram", "ram-ddr5", "DDR5 RAM", 1, {"type": "DDR5"}),
        "gpu": component("gpu", "gpu-big", "Large GPU", 1, {"recommended_psu_w": 750}),
        "psu": component("psu", "psu-small", "Small PSU", 1, {"wattage_w": 550}),
        "case": component("case", "case-small", "Small Case", 1, {"max_form_factor": "mATX"}),
        "cpu_cooler": component("cooler", "cooler-small", "Small Cooler", 1, {"tdp_w": 95}),
    })

    warning_ids = {warning["id"] for warning in warnings}
    assert "cpu_motherboard_socket_mismatch" in warning_ids
    assert "motherboard_ram_type_mismatch" in warning_ids
    assert "psu_headroom_low" in warning_ids
    assert "case_motherboard_form_factor_mismatch" in warning_ids
    assert "cpu_cooler_capacity_low" in warning_ids
    assert {warning["severity"] for warning in warnings} >= {"error", "warning"}
    assert all(warning["message"] for warning in warnings)


def test_compose_build_exposes_structured_warnings_and_legacy_issue_text():
    catalog = sample_components()
    catalog["psu"] = [
        component("psu", "psu-450", "450W PSU", 500_000, {"wattage_w": 450})
    ]

    result = compose_build(catalog, 18_000_000, "gaming")

    assert any(warning["id"] == "psu_headroom_low" for warning in result["compatibility_warnings"])
    assert any("PSU" in issue for issue in result["compatibility_issues"])


def test_upgrade_endpoint_accepts_manual_components_and_returns_recommendation(monkeypatch):
    monkeypatch.setattr("backend.services.components_by_category", sample_components)
    client = TestClient(app)

    response = client.post("/build/upgrade", json={
        "budget_idr": 7_000_000,
        "use_case": "gaming",
        "existing_components": {
            "cpu": "Ryzen 5 5600",
            "gpu": "RTX 3060 12GB",
            "ram": "16GB DDR4 3200",
        },
    })

    assert response.status_code == 200
    body = response.json()
    assert body["mode"] == "upgrade"
    assert body["recognized_existing"]["cpu"] == "Ryzen 5 5600"
    assert body["detected_existing"]["cpu"]["specs"]["socket"] == "AM4"
    assert "recommendation" in body
    assert "compatibility_notes" in body
    assert "compatibility_warnings" in body
    assert any(warning["severity"] == "info" for warning in body["compatibility_warnings"])


def test_upgrade_gpu_recommendation_prefers_available_value_upgrade_over_unavailable_flagship():
    catalog = sample_upgrade_components()
    catalog["gpu"] = [
        component(
            "gpu",
            "gpu-flagship-out",
            "Unavailable RTX 4080 16GB",
            9_000_000,
            {"vendor": "nvidia", "vram_gb": 16, "recommended_psu_w": 850},
            stock_status="out_of_stock",
            scraped_at="2024-01-01T00:00:00+00:00",
        ),
        component(
            "gpu",
            "gpu-value-fresh",
            "Fresh RTX 4060 Ti 8GB",
            5_500_000,
            {"vendor": "nvidia", "vram_gb": 8, "recommended_psu_w": 650},
            stock_status="in_stock",
            scraped_at="2026-05-10T00:00:00+00:00",
        ),
    ]

    result = recommend_upgrade(
        catalog,
        10_000_000,
        "gaming",
        {"gpu": "GTX 1050 Ti 4GB", "ram": "32GB DDR4 3200", "psu": "750W Gold"},
    )

    assert result["recommendation"]["components"]["gpu"]["sku"] == "gpu-value-fresh"


def test_swap_endpoint_accepts_split_cooler_slots(monkeypatch):
    catalog = sample_components()
    build = compose_build(catalog, 18_000_000, "gaming")

    def find_component(sku):
        for items in catalog.values():
            for item in items:
                if item["sku"] == sku:
                    return item
        return None

    monkeypatch.setattr("backend.services.find_component", find_component)
    client = TestClient(app)

    response = client.post("/build/swap", json={
        "budget_idr": 18_000_000,
        "use_case": "gaming",
        "slot": "cpu_cooler",
        "new_component_id": "fan-pack",
        "current_build": build["components"],
    })

    assert response.status_code == 200
    body = response.json()
    assert body["components"]["cpu_cooler"]["sku"] == "fan-pack"
    assert body["swap"]["slot"] == "cpu_cooler"


def test_swap_candidates_filter_by_current_build_compatibility(monkeypatch):
    catalog = sample_components()
    catalog["motherboard"] = [
        *catalog["motherboard"],
        component(
            "motherboard",
            "mobo-am5-alt",
            "B650M WiFi Plus Motherboard",
            2_250_000,
            {"socket": "AM5", "form_factor": "mATX", "ram_type": "DDR5"},
        ),
        component(
            "motherboard",
            "mobo-lga-ddr4",
            "B660M DDR4 Motherboard",
            1_600_000,
            {"socket": "LGA1700", "form_factor": "mATX", "ram_type": "DDR4"},
        ),
    ]

    def load_components():
        return [item for items in catalog.values() for item in items]

    monkeypatch.setattr("backend.services.load_components", load_components)
    build = compose_build(catalog, 18_000_000, "gaming")
    client = TestClient(app)

    response = client.post("/build/swap-candidates", json={
        "budget_idr": 18_000_000,
        "use_case": "gaming",
        "slot": "motherboard",
        "current_build": build["components"],
        "limit": 20,
    })

    assert response.status_code == 200
    body = response.json()
    candidate_skus = [item["sku"] for item in body["items"]]
    assert "mobo-am5-alt" in candidate_skus
    assert "mobo-am5" not in candidate_skus
    assert "mobo-lga-ddr4" not in candidate_skus
    assert body["items"][0]["compatibility_summary"]


def test_swap_candidates_keep_cpu_and_case_cooler_slots_separate(monkeypatch):
    catalog = sample_components()

    def load_components():
        return [item for items in catalog.values() for item in items]

    monkeypatch.setattr("backend.services.load_components", load_components)
    build = compose_build(catalog, 18_000_000, "gaming")
    client = TestClient(app)

    cpu_response = client.post("/build/swap-candidates", json={
        "budget_idr": 18_000_000,
        "use_case": "gaming",
        "slot": "cpu_cooler",
        "current_build": build["components"],
    })
    fan_response = client.post("/build/swap-candidates", json={
        "budget_idr": 18_000_000,
        "use_case": "gaming",
        "slot": "fan_cooler",
        "current_build": build["components"],
    })

    assert cpu_response.status_code == 200
    assert fan_response.status_code == 200
    assert [item["sku"] for item in cpu_response.json()["items"]] == []
    assert [item["sku"] for item in fan_response.json()["items"]] == []
