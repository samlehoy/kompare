# Kompare Demo Script

This demo presents Kompare as a PC Builder-only prototype website for budget-to-performance PC recommendations.

## Setup

Start the app:

```powershell
.\dev.ps1
```

Open:

```text
http://localhost:5173
```

Use `localhost:5173` for the frontend. The backend health route is available at:

```text
http://localhost:8000/health
```

If `dev.ps1` reports that `:8000` is still occupied, use the backend URL printed by the script instead. The frontend proxy is automatically pointed at that backend for the session.

## 1. Landing Page Positioning

Open `/`.

Show:

- The PC Builder headline and marketing copy.
- Sidebar navigation with PC Builder, Build from zero, Upgrade, and Audit build.
- Sidebar theme toggle and version marker.
- Two flow cards: Build from zero and Upgrade existing PC.
- Flow-card action labels: Start a new build and Plan an upgrade.
- Four budget cards:
  - Entry-level: Rp 7.000.000 - Rp 12.000.000
  - Mid-range: Rp 12.000.000 - Rp 22.000.000
  - High-end: Rp 22.000.000 - Rp 40.000.000
  - Custom budget: infinity symbol

Talking points:

- Kompare is no longer a broad electronics recommendation site.
- The visible product is a PC Part Picker-style website with a marketing landing page.
- Audit build is a dedicated route, not an embedded panel on the build or upgrade pages.
- Budget gaming and enthusiast tier cards have been removed from the current UI.
- The budget cards now focus on fewer, clearer price ranges.
- The app is built around compatibility, balanced spending, upgrade flexibility, and EnterKomputer links.

## 2. Build From Zero

Open `/builder`.

Steps:

1. Enter a budget such as `20jt` or `20000000`.
2. Choose a use case such as Gaming, Productivity, Content Creation, Office, or Student.
3. Optionally choose a CPU or GPU preference.
4. Choose `Fast compatibility` for the deterministic path, or choose `AI-assisted` to show the Phase 2 RAG path.
5. If `AI-assisted` is selected, choose `Local Qwen + Qdrant` or `Gemini free tier` in the AI profile field.
6. Select the optional add-ons you want to include: Hard Drive / HDD, Monitor, UPS, or any combination of them.
7. Click `Generate build`.

Show:

- Nine required component slots:
  - Processor / CPU
  - Motherboard
  - RAM
  - VGA / GPU
  - SSD
  - PSU
  - CPU Cooler
  - Fan Cooler
  - Casing
- Product image area or fallback slot thumbnail.
- Stock and scrape freshness pills when catalog data includes them.
- Buyer-friendly spec pills such as socket, VRAM, memory type, wattage, and capacity.
- EnterKomputer buying link when a component URL is available.
- Total price, budget, remaining budget, and allocation chart.
- Compatibility check panel.
- Optional add-on section showing only the selected HDD, monitor, and/or UPS recommendations when catalog data supports them.

Talking points:

- Full builds always render all required slots, even when a catalog recommendation is unavailable.
- HDD, monitor, and UPS are independent optional add-ons, not required tower components.
- SSD remains the required primary storage slot; HDD is optional bulk storage.
- Monitor add-ons are matched to the selected GPU tier, use case, target resolution, refresh rate, and add-on budget.
- UPS add-ons are sized from estimated build draw, selected PSU wattage, and GPU PSU recommendation; voltage regulators are filtered out.
- Component selection is score-based, not simply the most expensive in-budget item.
- The scorer considers stock status, freshness, useful specs, value, platform runway, and use-case fit.
- Compatibility checks are deterministic and do not depend on AI output.

## 3. Why This Part

On any generated build, click `Why this part` on a component card.

Show:

- Backend-provided `selection_rationale` when available.
- Ranking factors such as stock, recent catalog data, value fit, VRAM, platform runway, PSU headroom, or airflow support.

Talking points:

- The explanation is now connected to the backend ranking model.
- This helps users understand why a specific component was selected.
- If backend rationale is missing, the UI falls back to a local explanation.

## 4. Upgrade Existing PC

Open `/upgrade`.

Steps:

1. Type existing components manually.
2. Use examples such as:
   - CPU: `Ryzen 5 5600`
   - RAM: `16GB DDR4 3200`
   - GPU: `GTX 1050 Ti 4GB`
   - SSD: `1TB NVMe SSD`
   - Hard Drive / HDD (optional): `2TB SATA HDD`
   - PSU: `450W Bronze`
   - CPU Cooler: `DeepCool AK400`
   - Fan Cooler: `3x 120mm case fans`
   - Casing: `mATX airflow case`
3. Leave one or more important fields empty to show missing-context warnings.
4. Submit the upgrade request.

Show:

- Recognized existing components.
- Detected specs inferred from typed text, such as AM4, DDR4, VRAM, or PSU wattage.
- Upgrade priority cards.
- Recommended upgrade components.
- Compatibility warnings for missing or uncertain context.

Talking points:

- Upgrade users type what they already have.
- Manual input covers the same core PC Builder slots as the full-build contract, including storage and cooling.
- Kompare does not assume a complete current build.
- The recommender ranks upgrade-worthy parts before filling missing slots.
- Gaming upgrades currently prioritize weak GPU, RAM capacity, and PSU headroom when those are the limiting factors.

## 5. Audit a PC Build

Open `/audit`.

Steps:

1. Find the `Audit a PC Build` panel.
2. Upload a cart screenshot, quote, invoice, or parts-list image when available.
3. Paste a typed parts list, for example:
   - `CPU: Ryzen 5 5600`
   - `Motherboard: B450M`
   - `RAM: 16GB DDR4 3200`
   - `GPU: RTX 3060 12GB`
   - `PSU: 450W Bronze`
4. Pick a build goal preset such as `General Gaming`, `1080p Gaming`, or `Content Creation`.
5. Click `Audit build`.
6. Click `Apply detected parts` to open `/upgrade` with supported existing-component fields prefilled.

Show:

- Audit status such as compatible, incomplete, or needs attention.
- Detected parts mapped to PC Builder slots.
- Extracted specs such as socket, DDR type, VRAM, wattage, storage capacity, or form factor.
- Compatibility findings such as PSU headroom, socket mismatch, RAM generation mismatch, missing motherboard, or missing casing.
- Missing required tower slots.
- Suggested next steps before buying.
- Supported detected parts filling the upgrade form after applying the result from the audit page.

Talking points:

- This is the capstone multimodal image + text feature.
- The feature is more useful than a single-component identifier because users often already have a cart or parts list and need to know whether it is safe to buy.
- Gemini is constrained by a PC build-audit schema and PC Builder slot list.
- The endpoint also has a deterministic typed-list fallback, so the demo remains useful without image analysis or quota.
- The output supports compatibility reasoning, but deterministic compatibility checks still remain the source of truth.
- The feature does not restore the old broad product image identifier.

## 6. Swap A Component

On a generated full build:

1. Click Swap on a component card.
2. Review compatible alternatives.
3. Pick an alternative when available.

Show:

- Compatible alternatives only.
- Candidate compatibility summary.
- Updated total after swap.
- Updated compatibility status.

Talking points:

- Swap candidates are checked against the current build context.
- Hard incompatibilities such as CPU socket mismatch, RAM generation mismatch, and case fit mismatch are filtered out.
- CPU cooler and fan cooler are separate build slots.

## 7. PC Build Advisor

On a generated full build or upgrade result:

1. Find the PC Build Advisor or PC Upgrade Advisor panel below the result.
2. Ask a follow-up question such as:
   - `Why this GPU and is the PSU enough?`
   - `What should I upgrade first?`
   - `Can I reduce the total price?`
3. Use suggested advisor questions when useful.
4. If the advisor references components, click the referenced part chips.
5. If cost-saving swaps are shown, click `Review alternatives`.

Show:

- The advisor conversation thread.
- Referenced part chips that focus the matching component cards.
- Evidence cards showing grounded component names, prices, specs, and ranking rationale.
- Cost-saving swap cards when the question asks about reducing price.
- Swap dialog opening with the advisor-recommended cheaper candidate preselected when available.

Talking points:

- The advisor is constrained to the active PC build or upgrade result.
- Local conversation history is sent as bounded context for follow-up questions.
- Gemini may answer when configured, but deterministic fallback answers keep the demo working without quota.
- The advisor does not restore generic shopping chat or unrelated electronics recommendations.
- Deterministic compatibility checks remain the source of truth.

## 8. Data Story

Talking points:

- Runtime recommendations use `data/components.json`.
- `data/products_cleaned.csv` is kept as scraper-output source data from the orchestration project.
- `backend/utils/seed_components.py` filters scraper output into PC Builder runtime categories.
- `data/component_catalog_report.json` records category counts, skipped rows, validation issues, and parser-quality action items.
- The current runtime catalog has zero fatal validation issues and zero required-spec parser action items.
- NAS appliances/enclosures are filtered out of HDD recommendations, while internal SATA NAS drives remain valid storage candidates.
- Monitor rows that omit refresh rate receive conservative inferred `refresh_hz` values marked with `refresh_hz_inferred`.
- CPU core counts are parsed from explicit product-name core counts and supported family naming.
- `data/dataset_summary.md`, `data/spot_check_sample.csv`, and `data/spot_check_notes.md` document the current scrape output review.
- Notebooks under `notebooks/` are for exploration, cleaning, and validation support.
- Runtime recommendations do not read notebooks or the source CSV directly.
- Legacy `data/catalog.json` and `data/sample_products.json` are removed from the runtime data set.
- Optional Phase 2 RAG check: `POST /build/ai-recommend` now has a complete local vector index available in this workspace. It should return an AI-assisted result when Gemini quota is available, otherwise it returns deterministic fallback metadata.

## 9. Gemini Role

Before the demo:

- Confirm `.env` contains `GEMINI_API_KEY` or a key pool with `GEMINI_API_KEY_1` through `GEMINI_API_KEY_4`.
- Keep `GEMINI_MODEL=gemini-2.5-flash-lite` for free-tier-friendly demo runs unless paid quota is available.
- Verify `/build/advisor` once with a generated build and confirm the response is not using fallback.
- Verify `/build/audit` once with an image-backed request and confirm image analysis is available.
- If demonstrating Phase 2 RAG, first verify the existing local index with `python -m backend.utils.ai_rag_index --status --chunks data/vector_chunks.jsonl --index-dir data/vector_index --model gemini-embedding-001`; the expected status is `complete: true`, `index_exists: true`, and `cached_count: 6476`.
- On `/builder`, use `Fast compatibility` + `Generate build` for the deterministic path. Use `AI-assisted`, choose `local_qwen` or `gemini_free`, then click `Generate build` for the Phase 2 RAG path.
- Keep the deterministic fallback talking point ready in case quota is exhausted during presentation.

Talking points:

- Gemini is still available in the project.
- The AI scope is focused on PC Builder reasoning, advisor answers, structured explanations, and PC build audits.
- Gemini is not positioned as a broad electronics shopping assistant.
- Deterministic build composition, compatibility checks, and catalog grounding remain the source of truth.
- Future AI work should focus on better grounded explanations, confidence messaging, unsupported-component handling, and a possible AI-assisted upgrade route.
- Phase 2 adds an experimental local vector retrieval path over component chunks. Gemini-selected builds must still pass deterministic compatibility validation, and the backend can repair known safe issues such as RAM generation mismatch before accepting an AI-assisted build.

## Wrap

Kompare is now a focused PC Builder prototype with a marketing landing page, build-from-zero flow, upgrade-existing-PC flow, Audit a PC Build flow, compatibility checks, score-based component ranking, buyer-readable rationale, PC Build Advisor, and EnterKomputer-ready marketplace links.
