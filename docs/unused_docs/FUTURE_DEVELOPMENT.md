# Future Development Roadmap

This document tracks recommended next development work for Kompare after the PC Builder refactor. It focuses on getting the project ready for capstone verification first, then lists useful post-capstone improvements.

## Current Project Direction

Kompare is a PC Builder-only prototype and marketing website. It helps users build a PC from zero or plan upgrades for an existing PC using local component data, budget-to-performance guidance, compatibility checks, upgrade reasoning, and EnterKomputer marketplace links.

The project should remain focused on PC components. Do not reintroduce generic laptop, desktop, gadget, or broad electronics recommendation flows.

## Immediate Capstone Readiness Priorities

### 1. Fix Remaining Catalog Quality Gaps

The current generated catalog has zero fatal validation issues, but `data/component_catalog_report.json` still reports parser-quality action items.

Completed on 2026-05-14:

- HDD `capacity_gb` quality gap was resolved by filtering NAS appliances/enclosures out of the runtime HDD catalog while keeping internal SATA drives. HDD is now treated as optional bulk storage, and the HDD catalog-quality action item is gone.
- Monitor `refresh_hz` quality gap was resolved by preserving explicit Hz values and adding conservative inferred rates for omitted-Hz monitor names. The inferred values are marked with `refresh_hz_inferred` so future data work can still distinguish exact specs from fallback assumptions.
- CPU `cores` quality gap was resolved by preferring explicit core counts in product names and adding deterministic support for EPYC, Threadripper, Athlon, Bristol Ridge, and legacy Core 2 Duo naming.

Why this matters:

- Complete required-spec coverage keeps ranking, rationale, compatibility checks, and optional add-on matching grounded in structured catalog data.

Expected artifacts:

- Parser or catalog-filter improvements in `backend/utils/component_specs.py` and `backend/utils/seed_components.py`.
- Regression tests in `backend/tests/test_component_specs.py` or `backend/tests/test_component_catalog_pipeline.py`.
- Regenerated `data/components.json`.
- Regenerated `data/component_catalog_report.json`.
- Updated notes in `docs/PRICE_UPDATES.md` if the quality backlog changes.

Verification:

```powershell
rtk python -m backend.utils.seed_components
rtk python -m pytest backend/tests -q
rtk npm run build
```

### 2. Run A Final Demo Pass

Use `docs/DEMO.md` as the capstone demo script and check each flow manually before presentation.

Demo flows to verify:

- Landing page positioning.
- Build from zero.
- Why this part.
- Upgrade existing PC.
- Audit a PC Build.
- Swap a component.
- PC Build Advisor.
- Data story.
- Gemini role.

Expected artifacts:

- Updated `docs/DEMO.md` if any UI flow changes.
- Screenshots for the final report or slide deck.
- Notes for any known limitation that should be explained during the demo.

### 3. Prepare Gemini Demo Configuration

Gemini is still part of the project, but the deterministic fallback path should keep the app usable when Gemini is unavailable.

Completed on 2026-05-15:

- `.env` was checked without printing secrets. `GEMINI_API_KEY`, `GEMINI_API_KEY_1` through `GEMINI_API_KEY_4`, and `GEMINI_MODEL` are configured locally.
- `google-genai` is installed in the active Python environment.
- The live backend on `localhost:8000` exposes `/build/advisor` and `/build/audit`.
- `/build/advisor` was smoke-tested with a generated build context and returned `fallback: false`.
- `/build/audit` was smoke-tested with an image-backed request and returned a structured audit without the image-unavailable fallback note.
- Deterministic fallback behavior remains covered by `backend/tests/test_build_advisor.py` and `backend/tests/test_build_audit.py`.

Checklist for future demo reruns:

- Confirm `.env` setup for the Gemini API key.
- Test `/build/advisor` with Gemini available.
- Test `/build/audit` with Gemini available.
- Confirm deterministic fallback still works without quota or key.

Expected artifacts:

- Clear setup instructions in `README.md`, `backend/README.md`, or `docs/DEMO.md`.
- A short explanation that deterministic compatibility checks remain the source of truth.

### 4. Prepare Final Capstone Evidence

The project should be presented as a focused PC Builder adaptation of the original "AI-Powered Smart Shopping Assistant & Product Decision Engine" criteria.

Evidence to prepare:

- Mapping from `docs/CAPSTONE_CRITERIA.md` to `docs/BRIEF.md`.
- Test output summary.
- Data pipeline explanation.
- Screenshots of the four visible routes: `/`, `/builder`, `/upgrade`, `/audit`.
- Screenshot or short recording of advisor behavior.
- Screenshot or short recording of Audit a PC Build behavior.
- Explanation of why the project intentionally excludes general electronics, laptops, gadgets, and broad shopping chat.

## Post-Capstone Product Improvements

### 1. Improve Catalog Data Coverage

Continue improving scraper and parser quality for:

- Missing product images.
- Missing or weak component specs.
- RAM price outliers.
- Monitor specs.
- UPS specs.
- Cooler compatibility details.
- Case form-factor and airflow details.

### 2. Add Marketplace Expansion

EnterKomputer is the current marketplace source. Future marketplace expansion can add richer comparison links.

Recommended future order:

1. Keep EnterKomputer as the primary source.
2. Display Tokopedia links when present.
3. Display Shopee links when present.
4. Add marketplace availability and price comparison only after source data is reliable.

### 3. Refine Phase 2 AI Retrieval-Augmented Recommendations

Dataset chunking, embedding, vector search, Gemini ranking, deterministic validation, `POST /build/ai-recommend`, and the Build from zero AI-assisted recommendation mode are now implemented. The current local vector index contains 6476 component vectors. The local Qwen + Qdrant path can return `ai_assisted: true`, `fallback: false`, and `ranker_mode: json_ranker` after deterministic validation.

Completed on 2026-05-22:

- Build from zero now has a `Recommendation mode` control with `Fast compatibility` and `AI-assisted`.
- Build from zero shows the `AI profile` selector for `Local Qwen + Qdrant` and `Gemini free tier` only when `AI-assisted` mode is selected.
- The frontend sends the selected profile as `ai_profile` only for the AI-assisted route; Fast compatibility remains deterministic.
- Local Qwen loading copy now explains that the app is ranking real catalog candidates and checking compatibility, because a live Rp 20.000.000 gaming build timing check took about 55.54 seconds.
- The four-budget comparison report at `data/ai_comparison_report.json` shows local Qwen AI-assisted output without fallback or hard compatibility errors for entry-level, mid-range, high-end, and custom-budget scenarios.
- `dev.ps1` now sets `NEXT_PUBLIC_API_BASE_URL` so the browser calls FastAPI directly during local demos; this avoids the Next dev proxy timing out on long Local Qwen requests.
- The final live `/builder` demo pass completed against the real backend:
  - Fast compatibility: HTTP 200, no fallback, no compatibility warnings or issues.
  - AI-assisted Local Qwen: HTTP 200, `ai_assisted: true`, `fallback: false`, `ranker_mode: json_ranker`, no compatibility warnings or issues.
  - AI-assisted Gemini: HTTP 200 with deterministic safety fallback, `fallback_reason: ai_ranker_rejected`, no compatibility warnings or issues.

Completed on 2026-05-23:

- Build from zero now uses a backend-owned allocation preset contract for the advanced allocation UI, including canonical slot order, performance-priority shifts, and budget-strategy shifts.
- The backend now applies the same strategy and priority allocation preset even when the user does not enable manual allocation overrides, so `Budget strategy` and `Performance priority` affect both Fast compatibility and AI-assisted baseline recommendations.
- Valid manual allocation overrides that total 100% remain authoritative, while default allocations are normalized back to 100% after strategy and priority shifts.

Completed on 2026-05-24:

- Added a repeatable preset quality audit utility at `backend/utils/preset_quality_audit.py`.
- Generated `data/preset_quality_report.json` from the runtime `data/components.json` catalog across Rp 5m, 10m, 15m, 20m, 30m, 45m, and 60m budgets for `value`, `balanced`, and `maximize` strategies.
- Fixed a mid-budget maximize edge case where the recommender could treat budget usage as successful before filling an affordable required slot.
- The latest preset audit reports no hard compatibility errors, missing required slots, or strategy usage misses in the checked core-tower scenarios.

Fast compatibility remains the primary safe path. The remaining product work is to refine the AI-assisted experience and decide how much of it belongs in the capstone demo.

Recommended next implementation order:

1. Run the final demo pass in the browser with `docs/DEMO.md`, including screenshots for `/`, `/builder`, `/upgrade`, and `/audit`.
2. Decide how to frame Gemini fallback in the capstone demo: safety guardrail, optional comparison path, or hidden unless Gemini produces an accepted AI-ranked build.
3. Add a lightweight provider readiness/status surface only if the demo flow needs it; avoid adding noisy infrastructure details to the main builder.
4. Expand visible AI metadata only if it helps decision-making instead of adding noise.
5. Keep fallback messaging visible when the vector index is unavailable, stale, Gemini quota is exhausted, local services are offline, or AI validation fails.
6. Only after the Build from zero AI flow is stable, evaluate a future `/build/ai-upgrade` route.

Why this fits the capstone criteria:

- It strengthens context engineering by retrieving focused component context.
- It is a concrete context-pruning strategy for larger product data.
- It allows Gemini to perform comparison and recommendation reasoning over grounded candidates.
- It still keeps the project local-first if vectors are stored in local files instead of an external vector database.

Guardrail:

- Do not use embeddings as a replacement for deterministic compatibility checks.
- Do not use vector similarity as proof of CPU socket, RAM generation, PSU, casing, or cooler compatibility.
- Do not send the whole catalog to Gemini.
- Do not reintroduce broad electronics recommendations.
- Do not hide deterministic fallback behavior from the user.

### 4. Improve Advisor Quality

Future advisor work should stay grounded in the active build or upgrade result.

Useful improvements:

- Better confidence messaging.
- More explicit "what changed if you swap this part" explanations.
- More budget-saving suggestions.
- More user-friendly warnings when the question is outside PC Builder scope.

### 5. Improve Build Audit

Future multimodal improvements:

- Better unsupported cart/list messaging.
- Better confidence thresholds.
- More robust field apply behavior for storage, cooling, monitor, and UPS inputs.
- Side-by-side comparison between typed parts, image evidence, and catalog candidates.
- Better OCR-like handling for marketplace cart screenshots when Gemini is available.

### 6. Improve UI Polish After Data Quality

UI polish should continue after the data contract is stable.

Recommended focus:

- Final responsive pass on all route widths.
- Cleaner empty and loading states.
- More polished build summary and optional add-on cards.
- Better visual hierarchy for warning and rationale sections.
- Demo-friendly screenshots.

## Recommended Development Order

1. Final demo pass across deterministic, Local Qwen, and Gemini build modes.
2. Gemini demo verification.
3. Final capstone evidence package.
4. Optional provider readiness/status polish.
5. Post-capstone marketplace expansion.
6. Post-capstone advisor, build-audit, and AI-upgrade polish.

## Definition Of Ready For Final Capstone Demo

Kompare is ready for final capstone demo when:

- Backend tests pass.
- Frontend production build passes.
- Responsive Playwright tests pass.
- `data/component_catalog_report.json` has zero fatal validation issues.
- Remaining quality gaps are documented and explainable.
- Gemini-backed features are either working or have a clear fallback demo path.
- `docs/DEMO.md` matches the current UI.
- `docs/BRIEF.md` clearly explains the PC Builder adaptation of the original capstone criteria.
