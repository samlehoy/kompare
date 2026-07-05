# Kompare — Architecture & Application Flow

## Overview

Kompare is a cloud-deployed **AI-assisted PC Builder** for the Indonesian PC market. It recommends complete PC builds based on user budget, use case, and preferences — powered by a hybrid of deterministic compatibility rules and AI-based component ranking.

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        USER (Browser)                           │
│   http://127.0.0.1:3000 (dev) / kompare.pages.dev (prod)       │
└─────────────────────┬───────────────────────────────────────────┘
                      │ HTTP (JSON)
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                   FRONTEND (Next.js + React)                    │
│                                                                 │
│   app/page.jsx → ControlPanel (shell)                           │
│     ├── BuildWizard      → Build Recommender UI                 │
│     ├── BuildResults     → Result Display + Near-Budget Upgrades│
│     ├── SwapModal        → Component Swap UI                    │
│     ├── AdvisorConsole   → AI Chat Advisor                      │
│     ├── AuditTool        → Build Audit (Image Upload)           │
│     ├── UpgradeAdvisor   → Upgrade Recommendations              │
│     ├── Marketplace      → Component Browser                    │
│     └── ApiKeySettings   → LM Studio / Gemini Config            │
│                                                                 │
│   lib/api.js  → Centralized API client with BYOK headers        │
└─────────────────────┬───────────────────────────────────────────┘
                      │ HTTP (cross-origin dev / same-origin prod)
                      │ Custom headers: X-Gemini-Api-Key,
                      │   X-LMStudio-Base-Url, X-Qdrant-*
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│              BACKEND (Cloudflare Worker)                         │
│              http://127.0.0.1:8787 (dev)                        │
│              kompare-backend-api.workers.dev (prod)              │
│                                                                 │
│   index.js ─── Router + CORS + KV catalog init                  │
│     ├── pc-builder-core.js  → Deterministic engine              │
│     ├── ai-recommend.js     → AI pipeline (RAG + ranking)       │
│     ├── advisor.js          → AI chat advisor                   │
│     └── audit.js            → Build audit from image/text       │
│                                                                 │
│   Bindings:                                                     │
│     • KOMPARE_DATA (KV)  → Component catalog storage            │
│     • AI (Workers AI)    → Cloudflare embedding model           │
└────────┬──────────────┬─────────────────────────────────────────┘
         │              │
         ▼              ▼
┌────────────────┐ ┌──────────────────────────────────────────────┐
│  Qdrant Cloud  │ │  AI Model Provider (one of):                 │
│                │ │    • Gemini 2.5 Flash (Google, cloud)         │
│  Vector DB for │ │    • LM Studio (local, OpenAI-compatible)    │
│  semantic      │ │      e.g., Qwen 2.5 27B                     │
│  component     │ │                                              │
│  retrieval     │ │  Selected at runtime via:                    │
│                │ │    • X-Gemini-Api-Key header (cloud)          │
│                │ │    • X-LMStudio-Base-Url header (local)       │
└────────────────┘ └──────────────────────────────────────────────┘
```

## Technology Stack

| Layer | Technology | Notes |
|-------|-----------|-------|
| **Frontend** | Next.js 15 + React 19 | Single-page app, Windows 95 retro theme |
| **Backend** | Cloudflare Workers | Serverless, edge-deployed |
| **Catalog Storage** | Cloudflare KV | `KOMPARE_DATA` namespace |
| **Vector DB** | Qdrant Cloud | Semantic search for components |
| **Embedding** | Cloudflare Workers AI | `bge-large-en-v1.5` model |
| **AI Ranking** | Gemini 2.5 Flash / LM Studio | Switchable at request time |
| **Dev Server** | `dev.ps1` (PowerShell) | Manages both frontend + backend locally |
| **Styling** | Vanilla CSS | `98.css` base + custom retro theme |

## Project File Structure

```
kompare/
├── backend_worker/           # Cloudflare Worker backend
│   ├── index.js              # Router, CORS, KV init, all API routes
│   ├── pc-builder-core.js    # Deterministic build engine (92KB)
│   ├── ai-recommend.js       # AI pipeline: embed → retrieve → rank
│   ├── advisor.js            # AI chat advisor endpoint
│   ├── audit.js              # Build audit endpoint
│   ├── wrangler.toml         # Cloudflare Worker config
│   └── .dev.vars             # Local dev secrets (gitignored)
│
├── frontend/                 # Next.js frontend
│   ├── app/                  # Next.js App Router
│   │   ├── layout.jsx        # Root layout
│   │   ├── page.jsx          # Single entry point → ControlPanel
│   │   └── providers.jsx     # React context providers
│   ├── components/
│   │   ├── shell/            # App shell, sidebar, settings
│   │   ├── builder/          # BuildWizard form
│   │   ├── results/          # BuildResults display
│   │   ├── swap/             # SwapModal component
│   │   ├── advisor/          # AdvisorConsole AI chat
│   │   ├── audit/            # AuditTool image upload
│   │   ├── upgrade/          # UpgradeAdvisor
│   │   ├── marketplace/      # Component browser
│   │   ├── control-panel/    # Main ControlPanel layout
│   │   ├── ui/               # Reusable UI primitives
│   │   └── readme/           # In-app documentation
│   ├── lib/
│   │   ├── api.js            # API client + BYOK header injection
│   │   ├── allocation.js     # Budget allocation helpers
│   │   ├── format.js         # IDR currency formatting
│   │   ├── slots.js          # Slot labels, ordering, spec pills
│   │   └── storage.js        # localStorage helpers
│   └── public/               # Static assets
│
├── data/
│   └── components.json       # Master component catalog (~3200 items)
│
├── docs/                     # Documentation
├── dev.ps1                   # Dev server orchestrator (PowerShell)
└── design/                   # Design assets
```

## API Endpoints

### Core Build APIs

| Method | Path | Handler | Purpose |
|--------|------|---------|---------|
| `GET` | `/api/health` | `index.js` | Health check + catalog count |
| `GET` | `/api/components` | `index.js` | Browse/search component catalog |
| `POST` | `/api/build/recommend` | `index.js` → `composeBuild` | Fast deterministic build recommendation |
| `POST` | `/api/build/ai-recommend` | `ai-recommend.js` | AI-assisted build recommendation (RAG) |
| `POST` | `/api/build/swap-candidates` | `index.js` | List compatible swap options for a slot |
| `POST` | `/api/build/swap` | `index.js` | Execute a component swap |
| `POST` | `/api/build/upgrade` | `index.js` → `recommendUpgrade` | Upgrade recommendation for existing build |

### AI / LLM APIs

| Method | Path | Handler | Purpose |
|--------|------|---------|---------|
| `POST` | `/api/build/advisor` | `advisor.js` | AI chat advisor for build questions |
| `POST` | `/api/build/audit` | `audit.js` | Audit a build from image/text |
| `GET` | `/api/lm-studio/detect` | `ai-recommend.js` | Detect LM Studio model |

### Infrastructure APIs

| Method | Path | Handler | Purpose |
|--------|------|---------|---------|
| `POST` | `/api/build/seed-qdrant` | `ai-recommend.js` | Seed Qdrant with component embeddings |
| `POST` | `/api/build/embed` | `ai-recommend.js` | Generate embedding for text |
| `GET` | `/api/build/use-cases` | `index.js` | List available use case profiles |
| `GET` | `/api/build/budget-tiers` | `index.js` | List budget tier definitions |
| `GET` | `/api/build/allocation-presets` | `index.js` | Get allocation presets metadata |

---

## Application Flow

### Flow 1: AI-Assisted Build Recommendation (Primary)

This is the main user flow — the full RAG pipeline.

```
USER INPUT                           FRONTEND                              BACKEND
─────────                           ────────                              ───────
Budget: 15,000,000 IDR    ──►  BuildWizard.jsx
Use case: Gaming                  │
CPU: Any                          │ POST /api/build/ai-recommend
GPU: Nvidia                       │ + X-LMStudio-Base-Url (optional)
                                  │ + X-Gemini-Api-Key (optional)
                                  ▼
                             api.js request()  ──────────────────►  handleAiRecommend()
                                                                        │
                                                                   ┌────┴────┐
                                                                   │ Step 1  │
                                                                   │ Baseline│ composeBuild()
                                                                   │ Build   │ (deterministic)
                                                                   └────┬────┘
                                                                        │
                                                                   ┌────┴────┐
                                                                   │ Step 2  │
                                                                   │ Embed   │ embedTexts()
                                                                   │ Queries │ → Cloudflare AI
                                                                   └────┬────┘
                                                                        │
                                                                   ┌────┴────┐
                                                                   │ Step 3  │
                                                                   │ Qdrant  │ queryQdrant()
                                                                   │ Search  │ per slot (7 slots)
                                                                   └────┬────┘
                                                                        │
                                                                   ┌────┴────┐
                                                                   │ Step 4  │ Filter by:
                                                                   │ Filter  │ - budget limit
                                                                   │ Cands.  │ - stock status
                                                                   │         │ - brand pref
                                                                   └────┬────┘
                                                                        │
                                                                   ┌────┴────┐
                                                                   │ Step 5  │ buildAiRankerPrompt()
                                                                   │ AI Rank │ → callGemini()
                                                                   │         │ → Gemini / LM Studio
                                                                   └────┬────┘
                                                                        │
                                                                   ┌────┴────┐
                                                                   │ Step 6  │ Parse AI JSON
                                                                   │ Parse & │ Map SKUs → components
                                                                   │ Compose │ composeBuild() validate
                                                                   └────┬────┘
                                                                        │
                                                                   ┌────┴────┐
                                                                   │ Step 7  │ validateBuild()
                                                                   │ Compat  │ Socket, RAM, PSU checks
                                                                   │ Check   │ compatibilityMessages()
                                                                   └────┬────┘
                                                                        │
                             BuildResults.jsx  ◄──────────────────  JSON Response
                                  │                                 {components, total_idr,
                                  │                                  ai_assisted, model_used,
                                  │                                  near_budget_upgrades, ...}
                                  ▼
                             Display build with:
                             - Component cards
                             - Spec pills
                             - Budget usage bar
                             - AI/Local model label
                             - Near-budget upgrade suggestions
                             - Swap buttons
```

### Flow 2: Fast Deterministic Build (Non-AI)

```
USER INPUT ──► BuildWizard ──► POST /api/build/recommend
                                    │
                               composeBuild() only
                               (no embedding, no Qdrant, no AI)
                                    │
                               BuildResults ◄── JSON Response
```

### Flow 3: Component Swap

```
User clicks "Swap" on a component
       │
       ▼
  SwapModal opens
       │
  POST /api/build/swap-candidates
  (filtered by budget, compatibility)
       │
       ▼
  User picks alternative
       │
  POST /api/build/swap
  (validate + return new build)
       │
       ▼
  BuildResults updated
```

### Flow 4: AI Chat Advisor

```
User opens Advisor Console
       │
  POST /api/build/advisor
  {mode, question, context (current build), history}
       │
  advisor.js → callGemini/LM Studio
       │
  Streaming-style response with
  slot references and swap suggestions
```

---

## AI Pipeline Detail

### Embedding & Retrieval

```
Component Catalog              Qdrant Cloud
(components.json)              (kompare_components_gemini)
       │                              ▲
       │  seed-qdrant                 │
       ▼                              │
  Cloudflare Workers AI        queryQdrant()
  (bge-large-en-v1.5)         7 parallel searches
  384-dim vectors              (1 per required slot)
       │                              │
       └──────────────────────────────┘
```

**Embedding model**: `@cf/baai/bge-large-en-v1.5` (384 dimensions)
**Collection**: `kompare_components_gemini` on Qdrant Cloud
**Batch size**: 50 texts per embedding call
**Search**: 36 candidates per slot, filtered by category + budget limit

### AI Ranker Prompt

The AI receives a structured JSON prompt with:
- **Budget IDR** and **Use case** as context
- **Candidate list** per slot (SKU, name, price, key specs)
- **Hard rules**: only choose from provided SKUs, respect budget, return JSON

The AI returns:
```json
{
  "selected_skus": { "cpu": "SKU-123", "gpu": "SKU-456", ... },
  "slot_rationales": { "cpu": "Best value for gaming...", ... },
  "summary": "Balanced gaming build...",
  "tradeoffs": ["Single-channel RAM limits bandwidth"]
}
```

### Fallback Cascade

If any AI pipeline step fails, the system falls back gracefully:

| Failure | Fallback |
|---------|----------|
| Embedding fails | → deterministic `composeBuild()` |
| Qdrant retrieval fails | → deterministic `composeBuild()` |
| AI returns invalid JSON | → use retrieval-ranked candidates directly |
| AI returns unknown SKUs | → filter out, use valid ones |
| Not enough slots filled | → fill missing from deterministic |
| Final composition fails | → deterministic `composeBuild()` |

Every fallback path sets `ai_assisted: false` and `fallback_reason` in the response.

---

## Local AI Model Support (LM Studio)

The backend supports **runtime switching** between Gemini (cloud) and LM Studio (local):

```
Frontend                          Backend (callGemini)
────────                          ──────────────────
localStorage:                     Check header:
kompare_user_lmstudio_url         X-LMStudio-Base-Url
       │                                │
       │  api.js injects header         │
       ▼                                ▼
  X-LMStudio-Base-Url:           if header present:
  http://127.0.0.1:1234            → POST to LM Studio /v1/chat/completions
                                   → Translate Gemini format ↔ OpenAI format
                                   → Return with _lm_studio: true, _model_used

                                 if header absent:
                                   → POST to Gemini API (generativelanguage.googleapis.com)
                                   → Return with _lm_studio: false
```

Model detection: `GET /api/lm-studio/detect` queries `{lmStudioUrl}/v1/models` to identify the loaded model dynamically.

---

## Deterministic Engine (pc-builder-core.js)

The core deterministic engine handles:

| Function | Purpose |
|----------|---------|
| `composeBuild()` | Build a complete PC from budget + use case |
| `validateBuild()` | Check socket, RAM type, PSU wattage, form factor compatibility |
| `compatibilityMessages()` | Generate human-readable compatibility warnings |
| `recommendUpgrade()` | Suggest upgrades for an existing build |
| `normalizeMarketplaceLinks()` | Clean up and normalize product URLs |
| `USE_CASE_PROFILES` | Budget allocation % per slot per use case |

### Use Case Profiles (Budget Allocation)

| Profile | CPU | GPU | RAM | Mobo | SSD | PSU | Case | Cooler | Fan |
|---------|-----|-----|-----|------|-----|-----|------|--------|-----|
| gaming | 18% | 33% | 7% | 10% | 10% | 8% | 7% | 5% | 2% |
| productivity | 27% | 17% | 12% | 12% | 14% | 7% | 6% | 4% | 1% |
| content_creation | 24% | 26% | 12% | 10% | 13% | 7% | 4% | 3% | 1% |
| office | 28% | 0% | 12% | 18% | 20% | 8% | 8% | 5% | 1% |
| student | 22% | 16% | 12% | 14% | 14% | 8% | 8% | 5% | 1% |

---

## Data Flow: Component Catalog

```
data/components.json
       │
       │ (dev) npx wrangler kv key put ... --local
       │ (prod) npx wrangler kv key put ... --remote
       ▼
  Cloudflare KV: KOMPARE_DATA["components"]
       │
       │ ensureCatalog(env)
       ▼
  core.initCatalog(list)
       │
       │ loadComponents()
       │ componentsByCategoryMap()
       ▼
  In-memory catalog ready for all endpoints
```

The catalog contains ~3200 components from Indonesian retailers (EnterKomputer) with:
- Category (cpu, gpu, ram, motherboard, ssd, psu, case, cooler, hdd, monitor, ups)
- SKU, name, price (IDR), specs, stock status
- Marketplace links

---

## Dev Environment

```powershell
# Start both servers
.\dev.ps1

# What happens:
# 1. Kill zombie processes on :8787 / :3000
# 2. Set NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8787
# 3. Seed KV with components.json (wrangler kv key put --local)
# 4. Start backend: wrangler dev --port 8787
# 5. Start frontend: npm run dev --port 3000
# 6. Log to .dev-logs/

# Check status
.\dev.ps1 -Status

# Stop
.\dev.ps1 -Stop
```

---

## Deployment

| Component | Platform | URL |
|-----------|----------|-----|
| Backend Worker | Cloudflare Workers | `kompare-backend-api.muttaqien0111.workers.dev` |
| Frontend | Cloudflare Pages | Connected to GitHub `development-branch` |
| Vector DB | Qdrant Cloud | `c0224a0e-d76c-49ea-a87e-043a3...` |
| Catalog KV | Cloudflare KV | `KOMPARE_DATA` namespace |

### Deploy Commands

```bash
# Deploy backend worker
cd backend_worker && npx wrangler deploy

# Frontend deploys automatically via Cloudflare Pages on git push
git push origin development-branch
```
