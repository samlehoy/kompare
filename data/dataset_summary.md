# Enterkomputer Dataset Summary

Generated at: `2026-05-11T08:35:09.898846+00:00`

## Totals

- Raw rows: `17121`
- Cleaned rows: `17121`
- Unique product URLs: `17121`
- Categories: `30`

## Cleaning Rules

- Keep output/products.csv as raw acquisition data.
- Write cleaned rows to output/products_cleaned.csv.
- Use product_url as the canonical deduplication key.
- Preserve rows that share the same SKU when product_url differs.
- Trim whitespace from string fields.
- Convert invalid price_idr values to 0.
- Clear the known site-wide generic description.
- Replace malformed or non-object specifications JSON with {}.
- Report, but do not drop, rows with empty image_url or price_idr = 0.

## Data Quality Notes

- Duplicate rows removed: `0`
- Generic descriptions cleared: `15001`
- Invalid specifications JSON replaced with empty objects: `0`
- Zero-price rows retained for downstream review: `3`
- Missing image URLs retained: `9952`
- External product URLs: `0`

## Category Counts

| Category | Products |
|---|---:|
| Accessories | 1874 |
| Keyboard | 1606 |
| Cooler | 1446 |
| Networking | 1212 |
| Casing | 1174 |
| Notebook | 982 |
| Printer | 771 |
| LCD | 762 |
| Notebook Accessories | 660 |
| Motherboard | 634 |
| RAM | 595 |
| All In One | 588 |
| PSU | 588 |
| SSD | 570 |
| Headset | 486 |
| VGA | 451 |
| UPS | 445 |
| Hard Drive | 402 |
| Gadget | 374 |
| Server | 268 |
| Processor | 267 |
| Memory Card | 214 |
| Flash Drive | 212 |
| Projector | 179 |
| Speaker | 134 |
| Gaming Chair | 115 |
| Drawer | 69 |
| Software | 31 |
| Optical | 10 |
| Soundcard | 2 |

## Stock Status Counts

| Stock status | Products |
|---|---:|
| in_stock | 17121 |

## Field Completeness

| Field | Present | Missing |
|---|---:|---:|
| sku | 17121 | 0 |
| name | 17121 | 0 |
| category | 17121 | 0 |
| subcategory | 13158 | 3963 |
| price_idr | 17121 | 0 |
| stock_status | 17121 | 0 |
| description | 2120 | 15001 |
| specifications | 17121 | 0 |
| image_url | 7169 | 9952 |
| product_url | 17121 | 0 |
| tokopedia_url | 7447 | 9674 |
| shopee_url | 7406 | 9715 |
| scraped_at | 17121 | 0 |

## Known Limitations

- Product count accuracy still depends on the discovery URL files.
- Empty descriptions may mean the product used the site's generic meta description.
- Empty image URLs are expected when Enterkomputer only exposes a placeholder image.
- Specifications can be empty when the site omits or AJAX-loads the table.
