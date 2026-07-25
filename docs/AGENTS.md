# AGENTS.md - Project Instructions

You are an AI coding assistant working on **Kompare**, a **cloud-deployed PC Builder** for the Indonesian PC market.

Kompare is a PC Part Picker-style tool with a marketing landing page, a build-from-zero flow, an upgrade-existing-PC flow, and a focused PC build audit page.

## Project Overview

Kompare helps users choose balanced custom PC component combinations based on budget, performance goal, compatibility, upgrade flexibility, and marketplace-ready component links.

The current connected marketplace source is EnterKomputer. Shopee and Tokopedia are future marketplace link targets, not current product flows.

## Architecture

> Deep dive: [ARCHITECTURE.md](ARCHITECTURE.md) (system flows, API reference, deployment) · [PRODUCT.md](PRODUCT.md) (scope, requirements, API contracts) · [PROJECT_STATUS.md](PROJECT_STATUS.md) (what is done vs backlog). This file stays self-contained for the invariants an agent must not break.

Kompare uses a **fully serverless Cloudflare** architecture:

- **Frontend**: Cloudflare Pages (Next.js static export)
- **Backend**: Standalone Cloudflare Worker (`backend_worker/`) with JavaScript-based API endpoints
- **Vector Database**: Qdrant Cloud (managed, free tier)
- **AI/LLM**: Google Gemini API (key pool rotation), Cloudflare Workers AI (embeddings)
- **Data Store**: Cloudflare KV (component catalog)

> **Note**: The old Python FastAPI backend code exists in `backend_legacy/` as historical reference only. It is NOT used in production.

### Request Flow
```
Browser → Cloudflare Pages (UI) → Cloudflare Worker (API at /api/*) → Qdrant Cloud & Gemini API
```

The frontend's `lib/api.js` reads `NEXT_PUBLIC_API_BASE_URL` (set at Cloudflare Pages build time) and auto-appends `/api` for `.workers.dev` domains.

## Core Scope

Visible frontend routes:

- `/` - PC Builder marketing landing page.
- `/builder` - full PC build from zero.
- `/upgrade` - upgrade recommendations from manually typed existing parts.
- `/audit` - cart screenshot and typed parts-list audit for PC build compatibility.

Every full build recommendation should cover these required slots:

- Processor / CPU
- Motherboard
- RAM
- VGA / GPU
- SSD
- PSU
- CPU Cooler
- Fan Cooler
- Casing

Optional full-setup add-ons:

- Hard Drive / HDD
- Monitor
- UPS

Upgrade users type existing components manually. The only upload flow is the scoped `/audit` PC build audit for cart screenshots or typed parts lists. Do not add generic image identification, generic catalog browsing, or broad electronics recommendation flows unless the project direction changes explicitly.

## Tech Stack

- Frontend: Next.js App Router, React 19, Zustand, Vitest, Playwright, custom retro CSS.
- Backend: Cloudflare Worker (JavaScript ES Modules), KV storage, Workers AI.
- Tests: Vitest and Playwright for frontend.
- AI providers: Google Gemini API (key pool with rotation), Cloudflare Workers AI (BGE embeddings), Local Qwen through LM Studio (optional dev mode).
- Vector DB: Qdrant Cloud (collection: `kompare_components_gemini`).
- Market: Indonesia, IDR pricing, id-ID formatting.
- Database: Cloudflare KV for component catalog. Qdrant Cloud for vector search.

## Data Policy

Runtime PC Builder data comes from:

- `data/components.json` - generated PC component catalog (uploaded to Cloudflare KV as `components` key).
- `data/price_overrides.json` - runtime SKU price overlay.

Source and review data:

- `data/products_cleaned.csv` is scraper-output source data from orchestration.
- It may still contain rows outside PC Builder scope.
- It should not be treated as runtime data.
- `backend_legacy/utils/seed_components.py` converts it into `data/components.json`.
- `data/component_catalog_report.json` records category counts, skipped rows, and validation issues.
- `data/curated_ram.json` is an optional RAM fallback when scrape coverage is weak.

Vector/RAG data:

- `data/vector_chunks.jsonl` contains component chunks.
- Qdrant Cloud hosts the production vector index (collection: `kompare_components_gemini`).

## AI Recommendation Pipeline

The AI-assisted build recommendation (`/api/build/ai-recommend`) follows this pipeline:

1. **Embedding Generation**: Cloudflare Workers AI (`@cf/baai/bge-small-en-v1.5`) generates query embeddings.
2. **Vector Retrieval**: Qdrant Cloud returns candidate components per slot.
3. **LLM Ranking**: Gemini API ranks candidates by value, compatibility, and use-case fit.
4. **Deterministic Validation**: `pc-builder-core.js` validates compatibility (socket, RAM type, PSU wattage, form factor).
5. **Fallback**: If any AI step fails, the system falls back to deterministic recommendation.

Key files:
- `backend_worker/ai-recommend.js` - Full AI recommendation pipeline
- `backend_worker/pc-builder-core.js` - Deterministic compatibility engine
- `backend_worker/index.js` - Worker entry point and router

Gemini API keys are stored as encrypted Cloudflare Worker secrets (`GEMINI_API_KEY`, `GEMINI_API_KEY_1` through `GEMINI_API_KEY_4`) with automatic rotation on 429/503 errors.

Do not position Gemini, Local Qwen, or any future model as a general electronics shopping assistant. Deterministic compatibility checks remain the source of truth.

## Compatibility Rules

When working on PC build logic, preserve these checks:

- CPU and motherboard socket compatibility.
- Motherboard and RAM generation compatibility.
- PSU wattage headroom for GPU and system load.
- Case support for motherboard form factor.
- Separate CPU cooler and fan cooler slots.
- Hard vs soft preferences:
  - RAM generation is hard compatibility.
  - CPU brand and GPU vendor are soft preferences.

Missing catalog rows must be shown honestly as missing or unavailable, not fabricated.

## File Structure

```text
kompare/
  backend_worker/
    index.js                         Cloudflare Worker entry point & router
    pc-builder-core.js               Deterministic compatibility engine
    ai-recommend.js                  AI-assisted recommendation pipeline
    advisor.js                       PC build advisor endpoint
    audit.js                         PC build audit endpoint
    wrangler.toml                    Worker configuration (KV, AI, env vars)
  backend_legacy/                    Old Python FastAPI code (NOT in production)
  frontend/
    app/
      layout.jsx                     app shell layout
      page.jsx                       main desktop-style entry
      globals.css                    global CSS import
    components/
      builder/BuildWizard.jsx        build-from-zero form
      results/BuildResults.jsx       build result rendering
      upgrade/UpgradePlanner.jsx     upgrade planner
      audit/BuildAudit.jsx           build audit page
      advisor/AdvisorConsole.jsx     advisor console
      shell/                         retro desktop/window shell
      swap/SwapModal.jsx             component swap dialog
      ui/                            shared form/status controls
    lib/
      api.js                         API wrapper (auto-detects workers.dev)
      format.js                      IDR and display formatting
      slots.js                       slot labels/order
      storage.js                     local storage helpers
    store/useWindowStore.js          desktop window state
    styles/kompare95.css             retro UI styles
    tests/                           Vitest and Playwright tests
  data/
    components.json                  runtime PC component catalog
    component_catalog_report.json    generated seeding validation report
    products_cleaned.csv             scraper-output source data
    curated_ram.json                 RAM seed source
    price_overrides.json             runtime price overlay
    vector_chunks.jsonl              AI/RAG chunks
  docs/
    PROJECT_STATUS.md                Goals & progress source of truth (done/experimental/backlog/out-of-scope)
    AGENTS.md                        This file - project instructions
    README.md                        Docs index
    PRODUCT.md                       Product scope, requirements, API contracts, response shapes
    UI_SPEC.md                       UI specification
    AI_PIPELINE.md                   AI recommendation pipeline + local model setup appendix
    ARCHITECTURE.md                  System architecture, flows, API reference, deployment
    CATALOG_PLAYBOOK.md              Catalog update and quality playbook
```

## Environment & Secrets

**Cloudflare Worker secrets** (set via `wrangler secret put`):
- `QDRANT_API_KEY` - Qdrant Cloud API key
- `GEMINI_API_KEY` - Primary Gemini API key
- `GEMINI_API_KEY_1` through `GEMINI_API_KEY_4` - Rotation pool keys

**Cloudflare Worker vars** (in `wrangler.toml`):
- `QDRANT_URL` - Qdrant Cloud endpoint

**Cloudflare Pages env vars** (set in Pages dashboard):
- `NEXT_PUBLIC_API_BASE_URL` - Backend Worker URL

**Local development secrets** belong in the gitignored `.dev.vars` file or
the developer's local environment. Production Worker secrets must be set with
`wrangler secret put`. Never commit secret values, `.dev.vars`, `.env` files,
credential exports, or API key material. Documentation may name required
variables and bindings, but must never contain their values.

## Coding Guidelines

- Preserve PC Builder-only visible navigation.
- Prefer existing project patterns over new abstractions.
- Keep frontend and backend separated through REST API calls.
- Backend code is JavaScript ES Modules running on Cloudflare Workers edge runtime.
- Use Cloudflare KV for data storage, not local file I/O.
- Keep UI practical and component-focused.
- Use existing shared UI patterns and styles from `frontend/components/` and `frontend/styles/kompare95.css`.
- Avoid reviving old Browse, Compare, Best Value, Chat, Identify, or Add Product frontend routes.
- When updating data docs, distinguish source CSV, generated component data, validation reports, runtime overlays, and vector artifacts.

## Verification Expectations

Before claiming a change is complete, run the relevant checks:

- `rtk npm --prefix frontend test -- --run` - Frontend unit tests
- `rtk npm --prefix frontend run build` - Frontend production build
- `rtk npm --prefix frontend run test:ui` - Browser/UI flow changes (Playwright)
- `npx wrangler deploy --cwd backend_worker` - Deploy backend Worker

If a change only touches documentation, still verify that intentional file moves do not leave stale references.

## Deployment

- **Frontend**: Auto-deploys via GitHub push to `main` branch → Cloudflare Pages.
- **Backend**: Manual deploy via `npx wrangler deploy` from `backend_worker/` directory.
- **Data updates**: Upload new `components.json` to Cloudflare KV, then re-sync Qdrant vectors.
