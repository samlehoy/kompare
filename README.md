# Kompare

Kompare is an AI-Powered Smart Shopping Assistant & Product Decision Engine for Indonesian PC build planning. It keeps the product focused on practical builder workflows: assemble a balanced PC from a budget, upgrade an existing machine, audit a cart or parts list, and ask grounded follow-up questions about the active recommendation.

The frontend is built with Next.js (App Router). The FastAPI backend remains local-first and uses the curated component catalog for deterministic recommendations, compatibility checks, and AI-assisted decision making when Gemini is configured.

## Capstone AI Features

Kompare fulfills all core capstone requirements for an intelligent shopping assistant:
- **Context Engineering**: Recommendations are grounded in component compatibility rules, budget constraints, and user-specified use cases.
- **Multimodal AI (Image + Text)**: The `/audit` flow allows users to upload a screenshot of their cart or a parts list for compatibility verification.
- **Context Pruning**: Large datasets are pruned and extracted so only relevant specs and components are fed to the reasoning engine.
- **Conversational Assistant with Memory**: The **PC Build Advisor** maintains multi-turn context to answer detailed follow-up questions about the active build or upgrade.
- **Structured Outputs**: Prompts enforce structured JSON responses that drive deterministic UI renders.

## Features

| Page / Flow | What it does |
|---|---|
| **Desktop Console** | Kompare 95 shell with compact navigation for builder, upgrade, and audit workflows. |
| **Build From Zero** | Generates a complete PC tower build with CPU, motherboard, RAM, GPU, SSD, HDD, PSU, CPU cooler, fan cooler, and casing. |
| **Upgrade Existing PC** | Accepts parts users already own and returns compatible upgrade or missing-part recommendations. |
| **Audit a PC Build** | Uploads a cart screenshot and/or pasted parts list to flag compatibility risks before buying. |
| **PC Build Advisor** | Answers grounded follow-up questions about the active build or upgrade result. |
| **Budget Tiers** | Presents entry-level, mid-range, high-end, and custom-budget guidance. |
| **Marketplace Links** | Links recommended components to EnterKomputer when product URLs are available. |
| **Optional Add-ons** | Shows monitor and UPS as optional setup recommendations for full first-time builds. |

## Architecture

```text
Next.js frontend
  /          Kompare 95 desktop console
  /builder   build from zero
  /upgrade   upgrade existing PC
  /audit     cart/list build audit
        |
        | Next.js /api rewrite
        v
FastAPI backend
  /components
  /build/use-cases
  /build/budget-tiers
  /build/recommend
  /build/upgrade
  /build/swap-candidates
  /build/swap
  /build/audit
  /build/advisor
        |
        v
Local JSON data
  data/components.json
  data/component_catalog_report.json
  data/products_cleaned.csv
  data/curated_ram.json
  data/price_overrides.json
```

The backend can call the Gemini API for focused PC build reasoning where configured. Without Gemini, deterministic compatibility checks, typed-list audit fallback, and advisor fallback still run from local component data.

## Tech Stack

- Backend: Python, FastAPI, Pydantic, pytest
- Frontend: Next.js, React, Playwright, Vitest
- AI: Google Gemini API
- Data: Local JSON component catalog and EnterKomputer product URLs
- Market: Indonesia, IDR pricing, id-ID formatting

## Quick Start

### 1. Install

```powershell
pip install -r requirements.txt
cd frontend
npm install
cd ..
```

### 2. Configure

```powershell
Copy-Item .env.example .env
```

Set `GEMINI_API_KEY` in `.env` if you want AI-assisted advisor and screenshot audit behavior. You can also set `GEMINI_API_KEY_1` through `GEMINI_API_KEY_4` for quota rotation and `GEMINI_MODEL` to choose the runtime model.

### 3. Run Both Servers

```powershell
.\dev.ps1
```

The helper starts FastAPI and Next.js together, then opens the frontend at the configured `FrontendPort` from `dev.ps1` (`5173` by default). The API rewrite points at the backend port selected by the script.

### 4. Run The Frontend Directly

```powershell
cd frontend
npm run dev
```

Open `http://localhost:3000` when running Next.js directly with its default port.

## API Surface

| Route | Method | Description |
|---|---|---|
| `/health` | GET | Liveness and catalog counts |
| `/components` | GET | PC component catalog filtered by category, query, and max price |
| `/build/use-cases` | GET | Builder use-case profiles and budget allocation weights |
| `/build/budget-tiers` | GET | Entry-level, mid-range, high-end, and custom-budget guidance |
| `/build/recommend` | POST | Compose a full PC build from budget, use case, and soft brand preferences |
| `/build/upgrade` | POST | Accept manually typed existing parts and recommend upgrade or missing components |
| `/build/swap-candidates` | POST | List compatible replacement candidates for one component slot |
| `/build/swap` | POST | Replace one component slot and re-check compatibility |
| `/build/audit` | POST | Audit a cart screenshot and/or typed parts list for compatibility risks |
| `/build/advisor` | POST | Ask grounded follow-up questions about a build or upgrade result |

## Required Build Slots

- Processor / CPU
- Motherboard
- RAM
- VGA / GPU
- SSD
- Hard Drive / HDD
- PSU
- CPU Cooler
- Fan Cooler
- Casing

Optional setup add-ons for build-from-zero users: Monitor and UPS.

## Testing

```powershell
python -m pytest backend/tests -q
cd frontend
npm run test
npm run test:ui
npm run build
```

## Documentation

- [Project brief](docs/BRIEF.md)
- [Product requirements](docs/PRD.md)
- [UI specification](docs/UI_SPEC.md)
- [Demo script](docs/DEMO.md)
