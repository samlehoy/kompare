from backend.utils.component_specs import parse_component


def test_parse_cpu_prefers_explicit_core_count_in_name():
    specs = parse_component(
        "Processor",
        "AMD Ryzen Threadripper PRO 9975WX 4GHz Up To 5.4GHz Cache 128MB 350W sTR5 [BOX] - 32 Core - 100-100000723WOF",
        "AMD Socket sTR5",
    )

    assert specs["cores"] == 32
    assert specs["family"] == "Ryzen Threadripper PRO"


def test_parse_cpu_extracts_enterprise_core_counts_from_name():
    specs = parse_component(
        "Processor",
        "AMD EPYC 9654 2.4GHz Up To 3.7GHz Cache 384MB 360W SP5 [Tray] - 96 Core - 100-000000789",
        "AMD Socket SP5",
    )

    assert specs["cores"] == 96
    assert specs["family"] == "EPYC"


def test_parse_cpu_handles_legacy_core_2_duo_names():
    specs = parse_component(
        "Processor",
        "Intel Core 2 Duo E8500 3.16Ghz FSB 1333 Mhz Cache 6MB [Tray] Socket LGA 775",
        "Intel Socket LGA 775",
    )

    assert specs["cores"] == 2
    assert specs["family"] == "Core 2 Duo"


def test_parse_monitor_keeps_explicit_refresh_rate():
    specs = parse_component("LCD", "LG UltraGear 27GR75Q-B 27 QHD IPS 165Hz Gaming Monitor", "")

    assert specs["refresh_hz"] == 165
    assert specs["refresh_hz_inferred"] is False


def test_parse_monitor_infers_freesync_refresh_when_name_omits_hz():
    specs = parse_component("LCD", "LG 29 LED 29WP500B - UltraWide IPS Gaming Monitor With AMD FreeSync", "")

    assert specs["refresh_hz"] == 75
    assert specs["refresh_hz_inferred"] is True


def test_parse_monitor_infers_standard_refresh_when_name_omits_hz():
    specs = parse_component("LCD", "ASUS ProArt PA248QV 24.1 WUXGA IPS Professional Monitor", "")

    assert specs["refresh_hz"] == 60
    assert specs["refresh_hz_inferred"] is True


def test_parse_monitor_infers_gaming_refresh_when_name_omits_hz():
    specs = parse_component("LCD", "AOC 31.5 CQ32G3SE QHD Gaming Monitor", "")

    assert specs["refresh_hz"] == 144
    assert specs["refresh_hz_inferred"] is True


def test_parse_ups_extracts_kva_and_watt_words():
    specs = parse_component("UPS", "APC Easy UPS On-Line, 3kVA/2700W - SRV3KIL-E", "")

    assert specs["capacity_va"] == 3000
    assert specs["wattage_w"] == 2700

    specs = parse_component(
        "UPS",
        "APC Smart UPS SRT 2200VA/1980WATT On-Line 230v LCD - SRT2200XLI",
        "",
    )

    assert specs["capacity_va"] == 2200
    assert specs["wattage_w"] == 1980


def test_parse_ups_infers_conservative_wattage_from_va_when_missing():
    specs = parse_component("UPS", "APC Easy UPS BVX 1200VA, 230V, AVR", "")

    assert specs["capacity_va"] == 1200
    assert specs["wattage_w"] == 720
    assert specs["wattage_inferred"] is True
