# Kompare Price and Data Update Playbook

This guide explains how to update PC component prices and how raw marketplace data should flow through the Kompare project.

Kompare is now a PC Builder-only prototype. The runtime recommendation flow should use PC component data, not broad laptop/desktop product catalog JSON.

## Current Data Roles

| File | Role | Runtime use |
|---|---|---|
| `data/products_cleaned.csv` | Cleaned scraper output from the data orchestration project. It can still include rows outside PC Builder scope, so it is treated as source input, not runtime data. | No direct runtime use. |
| `data/components.json` | Generated PC component catalog used by Builder, Upgrade, and Swap. | Yes. |
| `data/component_catalog_report.json` | Generated seeding report with category counts, skipped rows, validation issues, and catalog quality coverage. | Review only. |
| `data/curated_ram.json` | Optional curated RAM fallback when scrape coverage is weak. | Seed input only when requested. |
| `data/price_overrides.json` | Runtime SKU price overlay. | Yes. |
| `data/catalog.json` | Removed legacy laptop/desktop product catalog. | No. |
| `data/sample_products.json` | Removed legacy curated product sample catalog. | No. |
| `data/dataset_summary.md` / `data/spot_check_*` | Scraper-output audit notes and spot checks from orchestration. | Review only. |

## Source CSV Policy

Keep `data/products_cleaned.csv`.

It is the cleaned scraper export, but it can still include rows that should not become PC Builder runtime parts:

- laptops
- prebuilt desktops
- AIO systems
- accessories
- rows that are not useful for a PC Builder runtime catalog

The current data flow is:

```text
data/products_cleaned.csv
  -> python -m backend.utils.seed_components --fail-on-validation
  -> data/components.json
  -> data/component_catalog_report.json
  -> PC Builder recommendations
```

Do not point runtime frontend features directly at the source CSV.

The CSV format includes marketplace-ready columns such as `product_url`, `tokopedia_url`, `shopee_url`, `image_url`, and `scraped_at`. The component seeder preserves those fields as source URLs, `primary_url`, and `marketplace_links` so the website can link out to EnterKomputer now and display other marketplace links when those flows are ready.

The notebooks under `notebooks/` are still useful for exploration, spot checks, and future parser tuning. They are no longer required before every runtime catalog regeneration when `seed_components.py --fail-on-validation` passes.

## Primary Price Update Tool

Use `data/price_overrides.json` for normal price changes.

Shape:

```json
{
  "_doc": "Map of SKU -> price_idr. Keys starting with _ are ignored.",
  "example-sku": 1250000
}
```

Rules:

- Keys are SKUs.
- Values are integer IDR.
- No decimal values.
- No formatted strings.
- Removing an override returns the SKU to its source price from `data/components.json`.
- The backend applies overrides on the next request.

## Finding A Component SKU

With the API running:

```powershell
Invoke-RestMethod "http://localhost:8000/components?q=Ryzen&limit=5" |
  Select-Object -ExpandProperty items |
  Select-Object sku,name,price_idr
```

Direct file lookup:

```powershell
python -c "import json; items=json.load(open('data/components.json', encoding='utf-8')); [print(i['sku'], '|', i['name'], '|', i.get('price_idr')) for i in items if 'Ryzen' in i.get('name','')][:10]"
```

## Single Price Change

Example: change SKU `cpu-ryzen-5-7600` to Rp 3.000.000.

Edit `data/price_overrides.json`:

```json
{
  "_doc": "Map of SKU -> price_idr. Keys starting with _ are ignored.",
  "cpu-ryzen-5-7600": 3000000
}
```

Verify JSON:

```powershell
python -c "import json; json.load(open('data/price_overrides.json', encoding='utf-8')); print('ok')"
```

Verify effective price:

```powershell
Invoke-RestMethod "http://localhost:8000/components?q=7600&limit=5" |
  Select-Object -ExpandProperty items |
  Select-Object sku,name,price_idr
```

## RAM Updates

RAM now comes from `data/products_cleaned.csv` when the scraper contains standalone RAM rows.

Use `data/price_overrides.json` when only changing RAM prices.

Use `data/curated_ram.json` only as a fallback source when adding a temporary RAM SKU or when scrape coverage is weak. After editing curated RAM, regenerate components with `--include-curated-ram`:

```powershell
python -m backend.utils.seed_components --include-curated-ram --fail-on-validation
```

Then verify:

```powershell
python -c "from backend import services; [print(r['sku'], r['name'], r['price_idr']) for r in services.load_components() if r.get('category') == 'ram']"
```

## Regenerating Components From Source CSV

Use this only when you intentionally want to rebuild `data/components.json` from the raw scrape.

```powershell
python -m backend.utils.seed_components --input data/products_cleaned.csv --output data/components.json --report data/component_catalog_report.json --limit-per-category 0 --fail-on-validation
```

Current source:

```text
data/products_cleaned.csv
```

Important:

- The CSV is orchestration-cleaned, but still needs PC Builder filtering.
- The seeding script filters unsupported categories and common non-runtime rows.
- The report at `data/component_catalog_report.json` must show zero fatal validation issues before promotion.
- The same report also includes `validation.quality`, which tracks image coverage, marketplace link coverage, required spec coverage, price summaries, quality flags, and actionable parser gaps per category.
- The notebooks under `notebooks/` are for exploration, review, and improving parser rules when the report exposes suspicious gaps.

## Catalog Quality Review

After regenerating components, review both the fatal validation result and the quality audit:

```powershell
python -c "import json; r=json.load(open('data/component_catalog_report.json', encoding='utf-8')); [print(i) for i in r['validation']['quality']['action_items']]"
```

The current report has no required-spec parser action items.

The former HDD `capacity_gb` gap was resolved on 2026-05-14 by filtering NAS appliances/enclosures from the runtime HDD catalog. Internal SATA drives marketed for NAS use remain valid PC Builder storage candidates.

The former monitor `refresh_hz` gap was resolved on 2026-05-14 by preserving explicit Hz values and adding conservative inferred values for names that omit refresh rate. Rows using fallback values include `refresh_hz_inferred: true` in `data/components.json`.

The former CPU `cores` gap was resolved on 2026-05-14 by preferring explicit core counts in product names and adding deterministic support for EPYC, Threadripper, Athlon, Bristol Ridge, and legacy Core 2 Duo naming.

When future reports expose new parser backlog items, fix them in `backend/utils/component_specs.py` or the catalog filter in `backend/utils/seed_components.py`, then rerun:

```powershell
python -m backend.utils.seed_components --fail-on-validation
python -m pytest backend/tests/test_component_catalog_pipeline.py -q
```

## Adding A New Component SKU

For durable updates, prefer adding the row to the source that feeds the next component seed.

For a quick prototype-only addition, add a row to `data/components.json`:

```json
{
  "sku": "gpu-example-rtx-4070",
  "name": "Example GeForce RTX 4070 12GB",
  "brand": "NVIDIA",
  "category": "gpu",
  "subcategory": "VGA NVIDIA Series",
  "price_idr": 9500000,
  "product_url": "https://www.enterkomputer.com/example",
  "specs": {
    "vendor": "Nvidia",
    "vram_gb": 12,
    "tdp_w": 200,
    "recommended_psu_w": 650
  }
}
```

Be careful: manual edits to `data/components.json` can be overwritten by `seed_components.py`.

## Required Spec Fields

| Category | Important spec fields |
|---|---|
| `cpu` | `socket`, `cores`, `threads`, `tdp_w`, `brand` |
| `motherboard` | `socket`, `form_factor`, `ram_type`, `chipset` |
| `ram` | `type`, `capacity_gb`, `speed_mhz`, `module_count` |
| `gpu` | `vendor`, `vram_gb`, `tdp_w`, `recommended_psu_w` |
| `ssd` | `capacity_gb`, `interface`, `form_factor` |
| `hdd` | `capacity_gb`, `interface`, `form_factor_in` |
| `psu` | `wattage_w`, `rating`, `modular` |
| `cooler` | `type`, `tdp_w`, `fan_size_mm` |
| `case` | `form_factor`, `max_form_factor` |
| `monitor` | `size_inch`, `resolution`, `refresh_hz` |
| `ups` | `capacity_va`, `wattage_w` |

## Common Issues

| Symptom | Likely cause | Fix |
|---|---|---|
| Override does not apply | Wrong SKU or invalid JSON | Verify SKU and parse `price_overrides.json`. |
| Builder still picks old price | Backend process has stale state after code changes | Retry request or restart dev server. |
| RAM change not in build | Edited `curated_ram.json` but did not regenerate components with the fallback flag | Run `python -m backend.utils.seed_components --include-curated-ram --fail-on-validation`. |
| New component skipped | Missing compatibility spec fields | Add the required fields for that category. |
| Source CSV has unrelated products | Expected source-state issue | Let `seed_components.py` filter them, then review `data/component_catalog_report.json`; use notebooks only when parser rules need investigation. |

## Agent Checklist

When asked to update prices:

1. Confirm the SKU exists in `data/components.json` or via `/components`.
2. Default to `data/price_overrides.json`.
3. Preserve `_doc` keys.
4. Validate JSON after editing.
5. Verify the effective price through the API or `services.load_components()`.
6. Do not edit `data/catalog.json` or `data/sample_products.json`; those legacy files are removed.
7. Do not call Gemini for price updates.
