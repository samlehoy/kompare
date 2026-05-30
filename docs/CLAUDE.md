# CLAUDE.md - Project Instructions

You are an AI coding assistant for **Kompare**, a localhost **PC Builder prototype** for the Indonesian PC market.

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

- Frontend: Next.js (App Router), React, Vitest, Playwright, custom CSS.
- Backend: FastAPI, Pydantic, local JSON data loaders.
- Tests: pytest for backend, Vitest and Playwright for frontend.
- AI provider: Google Gemini via `google-generativeai`.
- Market: Indonesia, IDR pricing, id-ID formatting.
- Database: none. The prototype is local-file based.

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

Removed legacy product runtime data:

- `data/catalog.json`
- `data/sample_products.json`

The backend loaders tolerate those files being absent. Old product endpoints may return empty product lists until the backend is fully pruned.

## AI Role

Gemini remains available, but its scope is narrowed to PC Builder reasoning:

- Explain build tradeoffs.
- Help summarize compatibility and upgrade guidance.
- Support future structured advisor features.
- Support future Phase 2 retrieval-augmented recommendations over a local vector index.

Do not position Gemini as a general electronics shopping assistant. Deterministic compatibility checks remain the source of truth.

For Phase 2 vector/RAG work, keep vectors local, retrieve candidate components before Gemini ranking, and reject AI output that introduces unknown SKUs, prices, categories, or compatibility-unsafe combinations. See `docs/AI_RAG_PHASE2.md`.

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
    utils/
      build_pc.py                  PC build composer and upgrade helper
      component_specs.py           component spec extraction helpers
      seed_components.py           source CSV to data/components.json
      seed_from_csv.py             legacy product seeder, kept for reference
  frontend/
    src/
      App.jsx                      routes and shell
      pages/BuilderPage.jsx        landing, builder, and upgrade modes
      components/                  builder forms, result cards, swap dialog
      services/api.js              API wrapper
      styles/                      tokens, layout, components, pages
    tests/responsive.spec.js       Playwright responsive checks
  data/
    components.json                runtime PC component catalog
    component_catalog_report.json  generated seeding validation report
    products_cleaned.csv           scraper-output source data
    curated_ram.json               RAM seed source
    price_overrides.json           runtime price overlay
  docs/
    BRIEF.md
    PRD.md
    UI_SPEC.md
    PRICE_UPDATES.md
    DEMO.md
    CLAUDE.md
  dev.ps1                          local dev launcher
```

## Coding Guidelines

- Preserve PC Builder-only visible navigation.
- Prefer existing project patterns over new abstractions.
- Keep frontend and backend separated through REST API calls.
- Use local JSON parsers/loaders rather than ad hoc text manipulation.
- Keep UI practical and component-focused.
- Use existing design tokens from `frontend/src/styles/tokens.css`.
- Avoid reviving old Browse, Compare, Best Value, Chat, Identify, or Add Product frontend routes.
- When updating data docs, distinguish source CSV, generated component data, validation reports, and runtime overlays.

## Verification Expectations

Before claiming a change is complete, run the relevant checks:

- `python -m pytest backend\tests -q`
- `npm run test:ui` from `frontend/`
- `npm run build` from `frontend/`

If a change only touches documentation, still verify that intentional data deletions do not break the app when practical.
