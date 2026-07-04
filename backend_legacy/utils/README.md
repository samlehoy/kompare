# Backend Utilities

Utility modules for turning raw marketplace data into PC Builder runtime data and composing build or upgrade recommendations.

## seed_components.py

Builds `data/components.json` for the PC Builder from `data/products_cleaned.csv`.

```powershell
python -m backend.utils.seed_components --input data/products_cleaned.csv --output data/components.json --report data/component_catalog_report.json --limit-per-category 0 --fail-on-validation
```

| Flag | Default | Purpose |
|---|---|---|
| `--input` | `data/products_cleaned.csv` | Scraper-output CSV input path. |
| `--output` | `data/components.json` | Runtime component JSON output path. |
| `--report` | `data/component_catalog_report.json` | Validation and seeding report output path. |
| `--limit-per-category` | `1500` | Cap per runtime category; use `0` to include all rows. |
| `--include-curated-ram` | off | Merge `data/curated_ram.json` as a fallback source. |
| `--fail-on-validation` | off | Exit non-zero when fatal validation issues remain. |

Specs extracted by the seeding flow include CPU socket/family/iGPU, GPU vendor/VRAM/recommended PSU, motherboard socket/form-factor/RAM-type, RAM capacity/type/speed, SSD/HDD capacity/interface, PSU wattage/rating, case max form-factor, cooler type, monitor size/refresh/resolution, and UPS capacity.

RAM normally comes from `data/products_cleaned.csv`. `data/curated_ram.json` is now an optional fallback when the scrape lacks reliable standalone RAM rows.

The seeding flow flags suspiciously low RAM prices against the median for the same RAM type and capacity. These rows stay in `data/components.json` with `quality_flags: ["price_outlier_low"]` so they can be reviewed, but the runtime picker avoids them when normal candidates exist.

UPS rows are filtered to remove batteries, stabilizers, voltage regulators, and standalone inverters. Optional UPS recommendations are sized from the selected build's CPU/GPU/PSU context rather than chosen only by price or VA.

Before promoting regenerated runtime data, review `data/component_catalog_report.json` and keep fatal validation issues at zero.

## build_pc.py

Composes build-from-zero recommendations and upgrade-existing-PC recommendations from local component data.

```powershell
python backend/utils/build_pc.py --budget 20000000 --use-case gaming
python backend/utils/build_pc.py --budget 12000000 --use-case office --output=""
```

| Flag | Default | Purpose |
|---|---|---|
| `--budget` | required | Total budget in IDR. |
| `--use-case` | `gaming` | One of `gaming`, `productivity`, `content_creation`, `office`, or `student`. |
| `--components-file` | `data/components.json` | Component catalog input. |
| `--output` | `data/last_build.json` | JSON build dump; pass `--output=""` to skip. |

### Build From Zero

`compose_build()` uses `USE_CASE_PROFILES` to allocate budget across required slots, then picks compatible components where catalog data exists.

Picker selection is score-based rather than simple highest-price selection. The shared scorer rewards:

- in-stock rows over preorder, unknown, or out-of-stock rows
- recent scrape timestamps
- component-specific specs such as GPU VRAM, RAM capacity/speed, PSU rating, SSD/HDD capacity, and platform socket runway
- value for money inside the slot budget
- use-case fit, including avoiding workstation/creator GPUs for gaming builds when gaming cards fit
- data-quality flags, including penalizing low RAM price outliers

RAM capacity targets are allowed to overrun the RAM slot budget when the alternative would be an undersized stick. That overrun is carried forward as reduced budget for later slots so the total build stays budget-aware.

Selected full-build components include `selection_rationale` with a short summary and buyer-readable ranking factors. The frontend uses this field for "Why this part" explanations when it is present.

Compatibility warnings are structured objects and cover:

- CPU to motherboard socket.
- Motherboard to RAM DDR generation.
- PSU wattage against GPU recommendation.
- Case form factor against motherboard form factor.
- CPU cooler capacity against CPU TDP.

The legacy `compatibility_issues` string list is still returned for older UI compatibility, but new code should prefer `compatibility_warnings`.

### Upgrade Strategy

`recommend_upgrade()` returns a strategic upgrade response, not only missing slots.

Pipeline:

1. `analyze_existing_components()` groups manual inputs by known PC slots.
2. `parse_existing_component()` infers conservative specs from typed text.
3. `_build_upgrade_priorities()` ranks upgrade-worthy slots by use-case impact.
4. `_select_priority_upgrades()` walks priorities in order and marks each as `selected` only if it fits the remaining upgrade budget.
5. `validate_build()` checks compatibility using the combined detected-owned and selected-upgrade parts.

`parse_existing_component()` currently infers:

| Slot | Inferred specs |
|---|---|
| `cpu` | Likely socket and brand. |
| `motherboard` | Likely socket, form factor, and RAM type. |
| `ram` | DDR generation, capacity, and speed. |
| `gpu` | Vendor, VRAM, and estimated PSU target. |
| `ssd` | Capacity, interface, and likely form factor. |
| `hdd` | Capacity, interface, and likely drive size. |
| `psu` | Wattage and efficiency rating. |
| `case` | Supported form factor. |

Current ranking heuristics:

| Slot | When it ranks highly |
|---|---|
| `gpu` | Gaming use case and owned GPU appears below 8GB VRAM, or GPU is missing. |
| `ram` | Owned RAM capacity is below the target for the selected use case, or RAM is missing. |
| `psu` | Owned PSU wattage is below the planned GPU power target, or PSU is missing. |
| `motherboard` | Motherboard is missing and must anchor CPU socket, RAM generation, and case fit. |
| `ssd` | SSD is missing; treated as useful but lower impact than GPU/RAM/PSU for gaming. |

Upgrade response fields to preserve:

```json
{
  "recognized_existing": {
    "cpu": "Ryzen 5 5600"
  },
  "detected_existing": {
    "cpu": {
      "name": "Ryzen 5 5600",
      "specs": {"socket": "AM4"}
    }
  },
  "upgrade_priorities": [
    {
      "slot": "gpu",
      "score": 96,
      "title": "Upgrade GPU first",
      "reason": "Your typed GPU looks below the 8GB VRAM target...",
      "estimated_cost_idr": 5000000,
      "selected": true
    }
  ],
  "recommendation": {
    "components": {
      "gpu": {}
    },
    "total_idr": 5000000
  }
}
```

Keep `upgrade_priorities` free of full component payloads. Full selected component payloads belong in `recommendation.components`.

## component_specs.py

Shared deterministic parsing helpers used by component seeding. Keep these rules conservative and test any broad pattern changes against notebook validation output.
