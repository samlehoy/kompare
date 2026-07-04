# Kompare Session Handoff - 2026-06-30

This file is a continuation backup for moving Kompare development to another agent platform.

## Project Snapshot

Kompare is now a PC Builder-only prototype for the Indonesian PC component market. The product helps users:

- build a full PC from zero,
- upgrade an existing PC,
- audit a cart or pasted parts list before buying,
- compare/swap compatible components,
- use optional AI-assisted recommendations while keeping deterministic compatibility rules as the final authority.

The project should not return to generic electronics, laptop, desktop bundle, gadget, or broad shopping-assistant flows.

## Current Stack

- Backend: FastAPI, Pydantic, local JSON catalog, deterministic PC build logic.
- Frontend: Next.js App Router, React 19, retro Windows 95-inspired UI.
- AI providers:
  - Gemini free tier as secondary remote AI provider.
  - Local Qwen through LM Studio as primary local AI experiment.
  - Qdrant as the current vector database for the local Qwen RAG path.
- Data:
  - Runtime catalog: `data/components.json`
  - Source scrape: `data/products_cleaned.csv`
  - Vector chunks/index: `data/vector_chunks.jsonl`, `data/vector_index/`
  - Qdrant collection: `kompare_components_qwen`

## Important Files

- `docs/BRIEF.md` - current PC Builder product brief.
- `docs/PRD.md` - product requirements.
- `docs/UI_SPEC.md` - UI direction.
- `docs/DEMO.md` - demo script.
- `docs/AI_RAG_PHASE2.md` - AI/RAG phase 2 plan and progress.
- `docs/FUTURE_DEVELOPMENT.md` - roadmap and remaining work.
- `docs/LOCAL_MODEL_READY.md` - local model setup notes.
- `docs/CAPSTONE_CRITERIA.md` - archived historical criteria; no longer the active planning target.
- `backend/utils/build_pc.py` - deterministic build, allocation, compatibility, optional add-ons.
- `backend/utils/ai_build_recommendation.py` - AI-assisted build route logic.
- `backend/utils/ai_rag_retrieval.py` - local retrieval helpers.
- `backend/utils/qdrant_sync.py` - Qdrant sync utility.
- `backend/utils/qdrant_smoke.py` - Qdrant retrieval smoke test.
- `backend/utils/local_ai_readiness.py` - local AI readiness checks.
- `frontend/components/builder/BuildWizard.jsx` - main build form, AI mode, budget strategy, allocation controls, optional add-ons.
- `frontend/components/results/BuildResults.jsx` - build output, budget guidance, optional add-on rendering.
- `frontend/components/upgrade/UpgradePlanner.jsx` - upgrade flow.
- `frontend/components/audit/BuildAudit.jsx` - build audit flow.

## Major Decisions Made In This Session History

1. Kompare was refactored from a general product recommendation concept into a pure PC Builder prototype.
2. Required core build slots are:
   - CPU
   - Motherboard
   - RAM
   - VGA/GPU
   - SSD
   - PSU
   - CPU Cooler
   - Fan Cooler
   - Casing
3. Optional add-ons are independent:
   - HDD
   - Monitor
   - UPS
4. HDD was moved out of required core slots and is now optional bulk storage.
5. Users manually type existing parts for upgrade planning.
6. The frontend currently uses one `Generate build` button. Recommendation mode controls whether it calls deterministic or AI-assisted backend logic.
7. AI-assisted mode is not allowed to freely invent products. It must retrieve candidates, rank them, then pass deterministic validation.
8. Fast compatibility remains the safe primary path for product reliability.
9. Local Qwen + Qdrant is the preferred Phase 2 experiment. Gemini is secondary and may fall back due to quota or rejected AI output.
10. Budget strategy and performance priority were added:
    - `budget_strategy`: `value`, `balanced`, `maximize`
    - `performance_priority`: `gaming`, `productivity`, `best_value`, `balanced`, `upgrade_friendly`
11. Advanced allocation sliders exist and should follow backend-owned presets unless users manually customize them.
12. Optional add-ons must be selectable separately. Selecting only HDD should not render monitor or UPS.
13. The old `docs/superpowers/` historical planning content was considered safe to remove because it was stale and not referenced by active docs/code.

## Current Implemented Status

### Build From Zero

Implemented:

- Budget input.
- Use case input.
- CPU brand preference.
- GPU vendor preference.
- Budget strategy selector.
- Performance priority selector.
- Advanced allocation panel.
- Recommendation mode selector:
  - Fast compatibility
  - AI-assisted
- AI profile selector when AI-assisted is selected:
  - Local Qwen + Qdrant
  - Gemini free tier
- Independent optional add-ons:
  - HDD
  - Monitor
  - UPS
- Build results with core components, optional add-ons, budget summary, compatibility summary, and marketplace links.
- Swap flow for component alternatives.
- Advisor console for build follow-up.

Recent important concern:

- The user noticed some invalid or suboptimal build behavior around selected CPU/GPU preferences and budget usage. The project has added strategy/allocation logic, but practical quality must keep being audited across arbitrary budgets.

### Upgrade Existing PC

Implemented:

- User manually types owned parts.
- Supports CPU, motherboard, RAM, GPU, SSD, HDD, PSU, casing, and related notes.
- Upgrade logic ranks upgrade priorities instead of only filling missing slots.
- Compatibility warnings and recognized component output exist.

### Audit Build

Implemented:

- Dedicated Audit page.
- Accepts cart screenshot and/or pasted parts list.
- Checks CPU/motherboard socket matching, RAM generation, PSU overhead, and physical clearance.
- Can hand supported detected parts into upgrade flow.

Known polish:

- UI has been iterated several times; keep checking responsive behavior after changes.

### AI/RAG Phase 2

Implemented or documented:

- Component chunk generation.
- Local vector index and manifest.
- Gemini embeddings path.
- Gemini ranker path.
- Local Qwen provider profile.
- LM Studio adapter.
- Qdrant REST adapter.
- Qdrant sync/smoke utilities.
- Local AI readiness script.
- `POST /build/ai-recommend`.
- Frontend AI profile selection.
- Fallback metadata/copy when AI cannot safely return an accepted recommendation.

Current documented local status from `docs/AI_RAG_PHASE2.md`:

- Local vector index contains 6476 component vectors.
- Qdrant collection `kompare_components_qwen` has been synced with 6476 vectors.
- Local Qwen path has produced `ai_assisted: true`, `fallback: false`, `ranker_mode: json_ranker` in previous smoke/demo checks.
- Gemini path may return deterministic fallback, for example `fallback_reason: ai_ranker_rejected`.
- Local Qwen can take about one minute for a build result, so UI copy already warns users.

## Current Data Contract Notes

Runtime should use `data/components.json`, not raw CSV.

`data/products_cleaned.csv` is still important as the cleaned scrape source, but it can still contain rows outside runtime scope. The cleaning/seed pipeline should keep producing a PC-only component catalog.

`data/curated_ram.json` exists as optional fallback when scraped RAM quality is weak.

`data/price_overrides.json` exists for price correction.

## Commands And Runbook

Start local development:

```powershell
rtk .\dev.ps1
```

Regenerate runtime components:

```powershell
rtk python -m backend.utils.seed_components
```

Run backend tests:

```powershell
rtk python -m pytest backend\tests -q
```

Run frontend unit tests:

```powershell
rtk npm --prefix frontend test -- --run
```

Run frontend production build:

```powershell
rtk npm --prefix frontend run build
```

Run Playwright UI tests:

```powershell
rtk npm --prefix frontend run test:ui
```

Run local AI readiness:

```powershell
rtk python -m backend.utils.local_ai_readiness --profile local_qwen --timeout 90 --fail-on-error
```

Smoke-test Qdrant retrieval:

```powershell
rtk python -m backend.utils.qdrant_smoke --profile local_qwen --category gpu --query "RTX 4060 under 6 juta" --top-k 5
```

Regenerate AI comparison report:

```powershell
rtk python -m backend.utils.ai_build_comparison --output data/ai_comparison_report.json
```

Run preset quality audit:

```powershell
rtk python -m backend.utils.preset_quality_audit --output data/preset_quality_report.json
```

## Important AGENTS/Environment Rule

This workspace uses RTK. Shell commands should be prefixed with:

```powershell
rtk
```

Current workspace root:

```text
F:\Project\kompare
```

## Known Risks / Things To Recheck

1. Build quality across arbitrary budgets, not only fixed examples like 30m or 45m.
2. Whether selected CPU/GPU preferences are always respected in both Fast compatibility and AI-assisted mode.
3. Whether `maximize` strategy spends budget on meaningful CPU/GPU/platform upgrades instead of low-impact parts.
4. Whether `value` strategy explains unused budget clearly.
5. Whether optional add-ons stay independent in both backend response and frontend rendering.
6. Whether Gemini fallback is framed clearly in the product UI.
7. Whether local Qwen latency is acceptable for live demo.
8. Whether the advanced allocation UI is understandable enough for users.
9. Whether catalog quality reports still have parser-quality warnings after future data updates.
10. Whether frontend responsive layout still works after retro UI revisions.

## Recommended Next Steps

1. Run the preset quality audit and inspect `data/preset_quality_report.json`.
2. Test build generation manually for several budgets:
   - Rp 5m
   - Rp 7m
   - Rp 10m
   - Rp 15m
   - Rp 20m
   - Rp 30m
   - Rp 45m
   - Rp 60m+
3. For each budget, test:
   - Fast compatibility
   - AI-assisted Local Qwen + Qdrant
   - AI-assisted Gemini free tier
4. Specifically verify CPU/GPU preferences:
   - Intel CPU + Intel Arc GPU
   - AMD CPU + Nvidia GPU
   - Any CPU + Any GPU
5. Verify optional add-ons:
   - no add-ons selected
   - HDD only
   - monitor only
   - UPS only
   - all selected
6. Fix any backend contract issue before more UI polish.
7. Update `docs/DEMO.md`, `docs/AI_RAG_PHASE2.md`, and `docs/FUTURE_DEVELOPMENT.md` after each verified milestone.
8. Use `docs/FUTURE_DEVELOPMENT.md` as the active roadmap for future product work.

## How To Explain The Project To A New Agent

Kompare is not a general shopping AI. It is a PC Builder decision engine. The AI/RAG layer is optional and experimental; deterministic compatibility validation is the authority. The current product story is: local component data, context pruning, structured PC build recommendations, compatibility checks, marketplace links, audit/advisor flows, and optional Gemini/local-AI reasoning over grounded candidates.

## Last User Intent

The user wants to continue development on another agent platform. They asked to scan this session and create a backup/handoff so progress is not lost.
