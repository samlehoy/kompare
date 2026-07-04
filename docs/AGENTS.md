# AGENTS.md - Project Instructions

You are an AI coding assistant working on **Kompare**, a localhost **PC Builder prototype** for the Indonesian PC market.

Kompare is no longer a broad product shopping assistant. Treat the product as a PC Part Picker-style tool with a marketing landing page, a build-from-zero flow, an upgrade-existing-PC flow, and a focused PC build audit page.

## Project Overview

Kompare helps users choose balanced custom PC component combinations based on budget, performance goal, compatibility, upgrade flexibility, and marketplace-ready component links.

The current connected marketplace source is EnterKomputer. Shopee and Tokopedia are future marketplace link targets, not current product flows.

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
- Backend: FastAPI, Pydantic, local JSON data loaders.
- Tests: pytest for backend, Vitest and Playwright for frontend.
- AI providers: Google Gemini via `google-genai`, Local Qwen through LM Studio, optional Qdrant vector retrieval.
- Market: Indonesia, IDR pricing, id-ID formatting.
- Database: no required relational database. Runtime data is local-file based; Qdrant is optional for the Local Qwen AI/RAG profile.

## Data Policy

Runtime PC Builder data comes from:

- `data/components.json` - generated PC component catalog.
- `data/price_overrides.json` - runtime SKU price overlay.

Source and review data:

- `data/products_cleaned.csv` is scraper-output source data from orchestration.
- It may still contain rows outside PC Builder scope.
- It should not be treated as runtime data.
- `backend/utils/seed_components.py` converts it into `data/components.json`.
- `data/component_catalog_report.json` records category counts, skipped rows, and validation issues.
- `data/curated_ram.json` is an optional RAM fallback when scrape coverage is weak.
- Colab notebooks are for exploration, spot checks, and parser-rule tuning.

Vector/RAG data:

- `data/vector_chunks.jsonl` contains component chunks.
- `data/vector_index/` contains local vector-index artifacts.
- Qdrant may be used for the `local_qwen` profile.

Removed legacy product runtime data:

- `data/catalog.json`
- `data/sample_products.json`

The backend loaders tolerate those files being absent. Do not revive old generic product routes unless the product direction changes explicitly.

## AI Role

AI remains available, but its scope is narrowed to PC Builder reasoning:

- Explain build tradeoffs.
- Help summarize compatibility and upgrade guidance.
- Support the PC Build Advisor and Audit a PC Build flows.
- Support Phase 2 retrieval-augmented recommendations over local vectors or Qdrant.

Do not position Gemini, Local Qwen, or any future model as a general electronics shopping assistant. Deterministic compatibility checks remain the source of truth.

For Phase 2 vector/RAG work, retrieve candidate components before AI ranking and reject AI output that introduces unknown SKUs, prices, categories, or compatibility-unsafe combinations. See `docs/AI_RAG_PHASE2.md`.

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
  backend/
    app.py                         FastAPI app
    services.py                    local JSON data loading and price overlays
    gemini_client.py               Gemini SDK wrapper
    ai_providers.py                Gemini and local AI provider profiles
    utils/
      build_pc.py                  PC build composer and upgrade helper
      component_specs.py           component spec extraction helpers
      seed_components.py           source CSV to data/components.json
      ai_rag_chunks.py             component chunk generation
      ai_rag_index.py              local vector index generation
      ai_rag_retrieval.py          retrieval helpers
      ai_build_recommendation.py   AI-assisted build recommendation
      qdrant_sync.py               Qdrant sync utility
      qdrant_smoke.py              Qdrant retrieval smoke check
  frontend/
    app/
      layout.jsx                   app shell layout
      page.jsx                     main desktop-style entry
      globals.css                  global CSS import
    components/
      builder/BuildWizard.jsx      build-from-zero form
      results/BuildResults.jsx     build result rendering
      upgrade/UpgradePlanner.jsx   upgrade planner
      audit/BuildAudit.jsx         build audit page
      advisor/AdvisorConsole.jsx   advisor console
      shell/                       retro desktop/window shell
      swap/SwapModal.jsx           component swap dialog
      ui/                          shared form/status controls
    lib/
      api.js                       API wrapper
      format.js                    IDR and display formatting
      slots.js                     slot labels/order
      storage.js                   local storage helpers
    store/useWindowStore.js        desktop window state
    styles/kompare95.css           retro UI styles
    tests/                         Vitest and Playwright tests
  data/
    components.json                runtime PC component catalog
    component_catalog_report.json  generated seeding validation report
    products_cleaned.csv           scraper-output source data
    curated_ram.json               RAM seed source
    price_overrides.json           runtime price overlay
    vector_chunks.jsonl            AI/RAG chunks
    vector_index/                  local vector index artifacts
  docs/
    AGENTS.md
    README.md
    BRIEF.md
    PRD.md
    UI_SPEC.md
    FUTURE_DEVELOPMENT.md
    AI_RAG_PHASE2.md
    LOCAL_MODEL_READY.md
    PRICE_UPDATES.md
    DEMO.md
    unused_docs/
  dev.ps1                          local dev launcher
```

## Coding Guidelines

- Preserve PC Builder-only visible navigation.
- Prefer existing project patterns over new abstractions.
- Keep frontend and backend separated through REST API calls.
- Use local JSON parsers/loaders rather than ad hoc text manipulation.
- Keep UI practical and component-focused.
- Use existing shared UI patterns and styles from `frontend/components/` and `frontend/styles/kompare95.css`.
- Avoid reviving old Browse, Compare, Best Value, Chat, Identify, or Add Product frontend routes.
- When updating data docs, distinguish source CSV, generated component data, validation reports, runtime overlays, and vector artifacts.
- Treat `docs/FUTURE_DEVELOPMENT.md` as the active roadmap. `docs/unused_docs/` contains historical material only.

## Verification Expectations

Before claiming a change is complete, run the relevant checks:

- `rtk python -m pytest backend\tests -q`
- `rtk npm --prefix frontend test -- --run`
- `rtk npm --prefix frontend run build`
- `rtk npm --prefix frontend run test:ui` for browser/UI flow changes

If a change only touches documentation, still verify that intentional file moves do not leave stale references.
