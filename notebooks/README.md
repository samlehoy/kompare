# Kompare Data Cleaning Notebooks

These notebooks help turn the raw EnterKomputer scrape into PC Builder-ready component data.

## Notebook Order

1. `01_explore_products_cleaned.ipynb`
   - Profiles `products_cleaned.csv`.
   - Shows category and subcategory counts.
   - Exports lightweight reports under `data/cleaning_reports/`.

2. `02_clean_pc_components.ipynb`
   - Filters raw rows into PC Builder component candidates.
   - Keeps CPU, motherboard, RAM, GPU, SSD, HDD, PSU, cooler, casing, monitor, and UPS categories.
   - Preserves EnterKomputer, Tokopedia, and Shopee URL columns when they are present.
   - Preserves image URL and scrape timestamp fields for later UI/catalog work.
   - Drops obvious accessories and non-runtime product rows.
   - Exports review files:
     - `data/component_candidates.csv`
     - `data/component_candidates.json`
     - `data/cleaning_reports/component_cleaning_report.json`

3. `03_validate_component_candidates.ipynb`
   - Validates cleaned candidates before runtime promotion.
   - Checks required categories, missing compatibility specs, duplicate SKUs, suspicious rows, price outliers, and marketplace link coverage.
   - Exports review files:
     - `data/cleaning_reports/component_validation_report.json`
     - `data/cleaning_reports/component_validation_issues.csv`

## Safety

The cleaning notebook does not overwrite `data/components.json` by default.

Review the candidate exports and validation report first. Only set `WRITE_RUNTIME_COMPONENTS = True` inside the cleaning notebook when you intentionally want to replace the runtime component catalog.

## Colab Usage

Upload `products_cleaned.csv` when prompted, or place it beside the notebook before running all cells.
