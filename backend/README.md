# Kompare Backend

FastAPI service for the Kompare PC Builder prototype. It exposes local component data, build-from-zero recommendations, upgrade recommendations, swap validation, build audit, advisor, and supporting utility endpoints.

## Setup

```powershell
pip install -r requirements.txt
```

Copy `.env.example` to `.env` and set `GEMINI_API_KEY` only when working on Gemini-backed advisor or image audit features. Optional `GEMINI_API_KEY_1` through `GEMINI_API_KEY_4` values are used as a quota-rotation pool, and `GEMINI_MODEL` controls the runtime model.

The backend is local-data-first. Build composition, compatibility warnings, typed-list audit fallback, and advisor fallback still work without Gemini.

## AI Provider Profiles

Kompare now has a backend profile foundation for switching AI/RAG providers without changing the deterministic builder.

| Profile | LLM | Embeddings | Vector backend | Status |
|---|---|---|---|---|
| `gemini_free` | Gemini API | Gemini API | Local JSON vector index at `data/vector_index` | Current active AI-assisted path |
| `local_qwen` | LM Studio Qwen | LM Studio Qwen embedding | Qdrant collection `kompare_components_qwen` | Embedding retrieval is synced; strict SKU-choice JSON ranking works with deterministic compatibility and budget repair |

Relevant `.env` values:

```env
KOMPARE_AI_PROFILE=gemini_free
LMSTUDIO_BASE_URL=http://localhost:1234/v1
LMSTUDIO_LLM_MODEL=qwen/qwen3.6-27b
LMSTUDIO_EMBEDDING_MODEL=text-embedding-qwen3-embedding-4b
QDRANT_URL=http://localhost:6333
QDRANT_COLLECTION_QWEN=kompare_components_qwen
QDRANT_VECTOR_SIZE=2560
QDRANT_DISTANCE=cosine
```

Keep Gemini and Qwen embeddings in separate vector stores or collections. The vector spaces are not interchangeable.

Prepare the Qdrant collection for the local Qwen profile with:

```powershell
python -m backend.utils.qdrant_sync --profile local_qwen --dry-run
python -m backend.utils.qdrant_sync --profile local_qwen --recreate
```

The dry run validates catalog chunking without calling LM Studio or Qdrant. The real sync expects LM Studio and Qdrant to be running.

Before running a long sync, check local model readiness with:

```powershell
python -m backend.utils.local_ai_readiness --profile local_qwen --timeout 90 --fail-on-error
```

This reports LM Studio embedding health, Qdrant retrieval health, and strict JSON chat health as separate checks.

After syncing, smoke-test retrieval with:

```powershell
python -m backend.utils.qdrant_smoke --profile local_qwen --category gpu --query "RTX 4060 under 6 juta" --top-k 5
```

Local diagnostic note: Qwen embeddings are now synced in `kompare_components_qwen`. A temporary retrieval-only collection was also proven with Nomic embeddings:

```powershell
$env:LMSTUDIO_EMBEDDING_MODEL='text-embedding-nomic-embed-text-v1.5'
$env:QDRANT_VECTOR_SIZE='768'
$env:QDRANT_COLLECTION_QWEN='kompare_components_nomic'
python -m backend.utils.qdrant_sync --profile local_qwen --recreate --batch-size 64
python -m backend.utils.qdrant_smoke --profile local_qwen --category gpu --query "RTX 4060 under 6 juta" --top-k 5
python -m backend.utils.local_ai_readiness --profile local_qwen --skip-chat --timeout 90
```

Do not mix vectors from the Nomic diagnostic collection with the intended Qwen embedding collection.

Compare deterministic and AI-assisted build behavior across the standard budget scenarios with:

```powershell
python -m backend.utils.ai_build_comparison --profile local_qwen --output data/ai_comparison_report.json
```

The report records fallback reasons, selected SKUs, validation warnings, retrieval metadata, and total-budget deltas for entry-level, mid-range, high-end, and custom-budget scenarios.

`POST /build/ai-recommend` accepts an optional request field:

```json
{
  "budget_idr": 20000000,
  "use_case": "gaming",
  "ai_profile": "local_qwen"
}
```

When omitted, the backend uses `KOMPARE_AI_PROFILE` and falls back to `gemini_free` when that env value is not set. Provider failures return deterministic recommendations instead of breaking the builder response. For `local_qwen`, Kompare asks the local model for constrained SKU choices, then applies deterministic socket, RAM generation, budget, PSU, and casing validation before accepting the result.

## Run

```powershell
uvicorn backend.app:app --reload --port 8000
```

Interactive docs: <http://localhost:8000/docs> and <http://localhost:8000/redoc>

## Endpoints

| Method | Path | Purpose |
|---|---|---|
| GET | `/health` | Liveness probe and catalog counts. |
| GET | `/components` | Paged PC component list; filters include `category`, `q`, and `max_price`. |
| GET | `/build/use-cases` | Builder profiles and budget allocation percentages. |
| GET | `/build/budget-tiers` | Budget-tier cards for the PC Builder landing page. |
| POST | `/build/recommend` | Compose a balanced full PC build from budget and use case. |
| POST | `/build/ai-recommend` | Experimental AI-assisted build from zero; accepts `ai_profile` for Gemini/local Qwen selection. |
| POST | `/build/upgrade` | Parse manually typed owned parts, rank upgrade priorities, and select upgrades within budget. |
| POST | `/build/swap-candidates` | List compatible, in-budget replacement candidates for one build slot. |
| POST | `/build/swap` | Swap one build slot and re-run compatibility warnings. |
| POST | `/build/audit` | Audit a cart screenshot and/or typed parts list for detected parts, compatibility risks, and missing slots. |
| POST | `/build/advisor` | Ask grounded follow-up questions about the active build or upgrade result. |

Legacy generic product, comparison, best-value, broad chat, and generic image-identification endpoints are not part of the PC Builder API surface.

## Data Sources

- `data/components.json` - runtime PC component catalog.
- `data/price_overrides.json` - SKU price overlay applied at runtime.
- `data/products_cleaned.csv` - scraper-output source data used by `backend/utils/seed_components.py`, not direct runtime use.
- `data/component_catalog_report.json` - generated category, skip, and validation report for catalog refreshes.
- `data/curated_ram.json` - optional RAM fallback during component seeding when scrape coverage is weak.

The runtime PC Builder flow should not depend on removed broad product catalog files such as `data/catalog.json` or `data/sample_products.json`.

Regenerate the runtime catalog with:

```powershell
python -m backend.utils.seed_components --input data/products_cleaned.csv --output data/components.json --report data/component_catalog_report.json --limit-per-category 0 --fail-on-validation
```

## Upgrade Strategy

`POST /build/upgrade` is deterministic and local-data-first:

1. Group manually typed owned parts by slot.
2. Parse lightweight specs from text, including CPU socket, RAM generation/capacity, GPU VRAM, SSD/HDD capacity and interface, PSU wattage, and case form factor.
3. Rank upgrade-worthy slots by expected impact for the selected use case.
4. Select recommended upgrades in priority order while staying inside `budget_idr`.
5. Validate the combined owned-plus-recommended build and return structured warnings.

Response fields to preserve:

- `recognized_existing`: raw typed values by slot.
- `detected_existing`: inferred owned-part specs.
- `upgrade_priorities`: ranked reasons, estimated costs, and `selected` / `deferred` state.
- `recommendation.components`: selected upgrade components only.
- `compatibility_warnings`: structured compatibility warnings.
- `compatibility_notes`: legacy text compatibility messages for older UI compatibility.

## Quick Smoke Test

```powershell
# Start server in another terminal first.
$body = @{budget_idr=20000000; use_case='gaming'} | ConvertTo-Json
Invoke-RestMethod -Method POST http://localhost:8000/build/recommend -ContentType application/json -Body $body

$upgrade = @{
  budget_idr = 7500000
  use_case = 'gaming'
  existing_components = @{
    cpu = 'Ryzen 5 5600'
    motherboard = 'B550M Pro4'
    ram = '8GB DDR4 2400'
    gpu = 'GTX 1050 Ti 4GB'
    psu = '450W Bronze'
  }
} | ConvertTo-Json -Depth 4
Invoke-RestMethod -Method POST http://localhost:8000/build/upgrade -ContentType application/json -Body $upgrade
```

## Gemini Demo Checks

Use these before a capstone demo when `.env` contains Gemini credentials:

1. `POST /build/advisor` with a generated build context should return `fallback: false` when Gemini is available.
2. `POST /build/audit` with an image and/or pasted parts list should return a structured `audit` object. Image analysis is Gemini-backed; text-only audits are deterministic fallback.
3. Run `python -m pytest backend/tests/test_build_advisor.py backend/tests/test_build_audit.py -q` to verify the deterministic fallback paths remain available when Gemini fails, quota is exhausted, or no image analysis can be used.
