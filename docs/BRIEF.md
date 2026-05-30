# Project Brief - Kompare

## Kompare: AI-Powered PC Builder and Budget-to-Performance Decision Engine

Kompare is a localhost PC Builder prototype and focused marketing website for the Indonesian PC market. It helps users either build a custom PC from zero or plan upgrades for an existing PC by combining local component data, budget-to-performance guidance, compatibility checks, upgrade flexibility, and marketplace-ready links.

The product is focused exclusively on PC building. It is not a general electronics recommendation platform, laptop catalog, desktop catalog, gadget catalog, or broad shopping assistant.

## Capstone Criteria Context

The source capstone criteria in [CAPSTONE_CRITERIA.md](CAPSTONE_CRITERIA.md) describe an "AI-Powered Smart Shopping Assistant & Product Decision Engine" for e-commerce. Kompare adapts that rubric into a narrower and more defensible PC Builder domain:

- "Products" become PC components.
- "Shopping recommendations" become build and upgrade recommendations.
- "Product comparison" becomes component selection, swapping, budget allocation, and compatibility review.
- "Decision engine" becomes a deterministic PC build composer with optional AI explanation support.
- "Marketplace readiness" currently means EnterKomputer component links.

This scope change keeps the capstone in the e-commerce category while avoiding unrelated laptop, gadget, and general electronics features.

> Category: E-Commerce / PC Component Recommendation
> Duration: 6 Weeks
> Runtime Scope: Localhost prototype using FastAPI, Next.js, local component data, and optional Gemini reasoning

## Problem Statement

PC builders often struggle with:

- **Budget uncertainty** - knowing how much to allocate to CPU, GPU, motherboard, RAM, storage, PSU, cooling, and casing.
- **Compatibility risk** - matching sockets, RAM generation, PSU headroom, motherboard form factor, case fit, and cooler needs.
- **Upgrade ambiguity** - deciding what to replace when the user already owns some parts.
- **Marketplace readiness** - moving from a recommended build to real component listings.
- **Data quality risk** - marketplace exports can include unrelated categories that must be filtered before runtime use.

Kompare addresses these problems by grounding recommendations in a local component catalog, applying deterministic compatibility rules, ranking parts by value and fit, and exposing buyer-readable explanations and links.

## Objectives

| Capstone Objective | PC Builder Adaptation | Current Evidence / Status |
|---|---|---|
| Apply context engineering for product comparison and recommendations. | Ground recommendations in local PC component context: budget, use case, owned parts, required slots, specs, stock, and marketplace links. | Implemented through `data/components.json`, build allocation profiles, upgrade input parsing, and compatibility-aware recommendation APIs. |
| Design multimodal AI systems using image and text inputs. | Use cart screenshots and typed parts lists as PC build context through a focused build-audit flow instead of restoring general image identification. | Implemented through `/build/audit`, `backend/prompts/build_audit.py`, `BuildAuditPanel`, text fallback auditing, and upgrade-form apply behavior for supported PC slots. |
| Use structured prompts for consistent outputs. | Keep AI output constrained to PC build explanations and structured recommendation support; deterministic JSON schemas remain the UI contract. | Designed direction retained. Runtime recommendation output is structured; Gemini should stay grounded in local component data when used. |
| Implement context pruning for large product descriptions. | Filter scraper data into PC-only categories, extract useful specs, skip unrelated rows, and keep runtime catalog compact. | Implemented through `backend/utils/seed_components.py`, `backend/utils/component_specs.py`, and catalog reports. |
| Build multi-turn conversational assistants with memory. | Provide a constrained PC Build Advisor that discusses only the active build or upgrade result and remembers the current recommendation context. | Implemented through `/build/advisor`, `AdvisorPanel`, local conversation state, grounded context summaries, referenced component highlighting, evidence cards, and advisor-driven swap review actions. |
| Integrate AI reasoning into real-world decision-making systems. | Combine deterministic PC compatibility checks with explanation-ready ranking and marketplace links. | Implemented through build, upgrade, swap, compatibility warnings, selection rationale, and EnterKomputer links. |

## Bloom's Taxonomy Mapping

| Objective | Bloom's Level | Kompare Evidence |
|---|---|---|
| Use local component context to recommend PC builds and upgrades. | Apply | Build-from-zero and upgrade APIs use budget, use case, owned parts, and catalog specs. |
| Break a target budget into component allocations and compatibility constraints. | Analyze | Allocation profiles, compatibility validators, and missing-slot warnings identify constraints. |
| Compare component combinations for balance, bottlenecks, upgrade path, and fit. | Evaluate | Ranking considers value, stock, freshness, specs, platform runway, and use-case fit. |
| Generate full build and upgrade recommendation outputs with marketplace-ready links. | Create | UI renders required slots, optional add-ons, swap candidates, summaries, and EnterKomputer links. |
| Explain why each selected component fits the user's goal. | Reflect | Component cards show selection rationale, compatibility notes, and budget context. |

## Current Mission

Kompare now satisfies the PC Builder data, recommendation, compatibility, marketplace-link, optional add-on targeting, multi-turn advisor, multimodal build-audit, localhost integration, and legacy-surface cleanup objectives. The remaining mission is product hardening: keep catalog quality high and prepare final capstone evidence.

1. **PC Builder-only surface lock**
   - Keep visible navigation limited to `/`, `/builder`, `/upgrade`, and `/audit`.
   - Keep backend API exposure limited to PC Builder component, build, upgrade, swap, advisor, and build-audit routes.
   - Preserve only the shared utilities that still support PC component data, marketplace links, Gemini access, or tests.

2. **Catalog quality polish**
   - Continue reviewing generated catalog reports, especially RAM price outliers, missing images, and spec extraction quality for RAM, coolers, cases, monitors, and UPS rows.
   - Keep runtime recommendations based on `data/components.json`, not raw CSV reads.

3. **Optional add-on quality checks**
- Treat HDD as optional bulk storage; SSD remains the required primary storage slot.
- Let users select HDD, monitor, and UPS independently so optional add-ons do not feel like one unclear bundle.
- Keep UPS sizing tied to estimated build wattage, PSU context, and GPU power target.
   - Keep monitor recommendations tied to use case, selected GPU tier, target resolution, refresh rate, and setup budget.

The PC Build Advisor and Audit a PC Build flow are now part of the implemented product, so the capstone-alignment gap has shifted from missing features to evidence and recommendation-quality polish.

## Core Build Scope

Required full-build slots:

- Processor / CPU
- Motherboard
- RAM
- VGA / GPU
- SSD
- PSU
- CPU Cooler
- Fan Cooler
- Casing

Optional add-ons:

- Hard Drive / HDD
- Monitor
- UPS

## Data Scope

Runtime data:

- `data/components.json`
- `data/price_overrides.json`

Source and review data:

- `data/products_cleaned.csv`
- `data/component_catalog_report.json`
- `data/dataset_summary.md`
- `data/spot_check_sample.csv`
- `data/spot_check_notes.md`
- `data/curated_ram.json` as an optional RAM fallback only

Removed legacy product runtime data:

- `data/catalog.json`
- `data/sample_products.json`

`data/products_cleaned.csv` remains because it is the marketplace scrape output from the orchestration project. It is cleaner than the original raw scrape, but it can still include rows outside PC Builder scope, so runtime features must use the generated `data/components.json` catalog instead.

## User Flows

| Flow | Purpose |
|---|---|
| PC Builder Landing | Marketing entry point for the PC Builder prototype with budget tier guidance. |
| Build From Zero | Generate a complete PC tower recommendation from a budget and use case. |
| Upgrade Existing PC | Accept manually typed existing parts and recommend compatible upgrades. |
| Swap A Component | Let users inspect compatible alternatives for a selected build slot. |
| Audit a PC Build | Accept a cart screenshot and/or pasted parts list on `/audit`, detect PC Builder slots, show compatibility and missing-part findings, and hand supported results into the upgrade form. |
| PC Build Advisor | Let users ask follow-up questions about the active build or upgrade result, with local conversation history and grounded evidence cards. |
| Budget Tier Guidance | Help users understand performance expectations across price ranges. |

Visible routes:

- `/`
- `/builder`
- `/upgrade`
- `/audit`

No visible route should expose generic product browsing, generic comparison, generic image identification, add-product, laptop/gadget pages, or general shopping chat.

## Milestones Breakdown

### Week 1 - PC Component Data Acquisition and Preprocessing

Capstone mapping: Product Data Acquisition and Preprocessing.

- Select EnterKomputer as the current marketplace source.
- Preserve marketplace scrape output in `data/products_cleaned.csv`.
- Clean and filter source rows into PC component categories through `backend/utils/seed_components.py`.
- Normalize prices, names, categories, specs, stock status, images, and product URLs.
- Generate `data/components.json`.
- Generate `data/component_catalog_report.json`.
- Require zero fatal validation issues before runtime promotion.

### Week 2 - Structured PC Build Prompt and Schema Design

Capstone mapping: Structured Prompt Design for Product Comparison.

- Define required build slots and optional add-ons.
- Shape build, upgrade, and swap responses for deterministic UI rendering.
- Keep AI prompts focused on PC Builder reasoning.
- Keep deterministic JSON contracts as the frontend source of truth.
- Avoid broad shopping-assistant prompts and unrelated category recommendations.

### Week 3 - Context Pruning and Catalog Grounding

Capstone mapping: Context Pruning for Long Product Descriptions.

- Filter out laptop, desktop bundle, software, soundcard, peripheral, and unrelated rows from runtime PC Builder categories.
- Extract only useful buyer and compatibility specs from long product names and descriptions.
- Keep source CSV and runtime catalog separate.
- Use notebooks for data exploration, spot checks, and parser tuning.
- Keep runtime recommendations independent from raw CSV reads.

### Week 4 - Compatibility and Media-Aware Component Understanding

Capstone mapping: Multimodal Prompting for Image-Based Product Understanding.

- Render component images in cards when `image_url` is available.
- Pair image media with structured text specs, price, stock status, and marketplace link.
- Validate CPU socket, motherboard socket, RAM generation, PSU headroom, case fit, and cooler context.
- Treat deterministic compatibility rules as source of truth.
- Implement the constrained `/build/audit` flow for cart screenshot + typed parts-list build validation.
- Keep audit output mapped to PC Builder slots, extracted specs, compatibility issues, missing slots, budget notes, and next steps.
- Allow supported build-audit results to fill matching upgrade-form fields without reintroducing generic product identification.

### Week 5 - Upgrade Advisor and Multi-Step Decision Context

Capstone mapping: Conversational Shopping Assistant with Multi-Turn Context.

- Support the two primary user intents: build from zero and upgrade existing PC.
- Accept manually typed existing components.
- Infer conservative owned-part specs from user text.
- Rank upgrade priorities by expected impact for the selected budget and use case.
- Preserve current build context through swap candidate lookup and compatibility re-checks.
- Implement the constrained PC Build Advisor conversation for the active build or upgrade result.
- Preserve local advisor history and send bounded history to the backend for follow-up questions.
- Show referenced component chips, evidence cards, cost-saving suggestions, and advisor-driven swap review actions.

### Week 6 - Integration, Testing, and Demonstration

Capstone mapping: Integration and Deployment.

- Keep FastAPI and Next.js integration working.
- Demonstrate landing, build-from-zero, upgrade, and swap flows.
- Run backend tests.
- Run frontend production build.
- Run Playwright responsive UI tests.
- Document demo steps in [DEMO.md](DEMO.md).

## Capstone Verification Matrix

| Criteria Area | Verification Artifact | Status |
|---|---|---|
| Data acquisition and preprocessing | `data/products_cleaned.csv`, `data/components.json`, `data/component_catalog_report.json`, notebooks | Implemented / active data workflow |
| Structured prompt and output design | Build, upgrade, and swap response schemas in backend and UI | Implemented for deterministic recommendation flow |
| Context pruning | `seed_components.py`, `component_specs.py`, catalog reports, skipped category handling | Implemented |
| Multimodal AI | `/build/audit`, `BuildAuditPanel`, PC slot mapping, compatibility findings, text fallback, and upgrade-form apply behavior | Implemented |
| Multi-turn assistant | `/build/advisor`, `AdvisorPanel`, bounded local history, evidence cards, referenced component focus, and cost-saving swap actions | Implemented |
| Real-world decision engine | Compatibility checks, ranking model, budget summaries, EnterKomputer links | Implemented |
| Localhost integration | FastAPI backend, Next.js frontend, local JSON catalog | Implemented |
| Testing and demo | Backend tests, Playwright tests, `DEMO.md` | Implemented and evolving |

## Current Deliverables

- PC Builder-only frontend routes: `/`, `/builder`, `/upgrade`, `/audit`.
- Backend build composer with compatibility checks.
- Upgrade API with manual existing-part input.
- Component ranking by value, freshness, stock, specs, use-case fit, and upgrade runway.
- Swap candidate flow with compatibility context, specs, price delta, projected total, and marketplace link.
- Component card UI for required build slots.
- Optional HDD, monitor, and UPS add-on handling.
- EnterKomputer link normalization.
- PC Build Advisor UI and API flow with bounded conversation history.
- Gemini-backed advisor path with deterministic fallback answers grounded in local build data.
- Advisor evidence cards, referenced component highlighting, and cost-saving swap review actions.
- Audit a PC Build UI and API flow.
- Multimodal Gemini prompt constrained to PC cart/list auditing and compatibility validation.
- Build-audit apply behavior for supported upgrade fields, including GPU, storage, cooling, PSU, and casing slots.
- Responsive Playwright coverage.
- React code-splitting and direct component imports for frontend performance.

## Remaining Development Deliverables

- Continued catalog quality review for price outliers, missing images, and component spec extraction.
- Final capstone/demo verification pass using the updated [DEMO.md](DEMO.md).

## Success Metrics

| Metric | Target |
|---|---|
| Build slot completeness | Full-build responses expose all nine required component slots and keep HDD as an optional add-on. |
| Compatibility visibility | Generated builds and swaps include compatibility issue data. |
| Upgrade input support | Users can manually submit existing component text, including SSD, HDD, CPU cooler, and fan cooler. |
| UI focus | No visible navigation to non-PC-builder flows. |
| Marketplace readiness | Components with source URLs show EnterKomputer links. |
| Data clarity | Source CSV, generated component JSON, validation report, and runtime overrides are clearly separated. |
| Multimodal support | Users can submit a cart screenshot and/or typed parts list and receive slot-mapped compatibility findings. |
| Capstone alignment | The brief explicitly maps PC Builder scope to the original capstone objectives and tracks remaining hardening work. |

## Risks and Scope Notes

| Risk | Mitigation |
|---|---|
| Capstone rubric expects a broad shopping assistant | Use this brief to explain the intentional PC Builder-only specialization. |
| Capstone rubric strictly requires live multimodal image input | The focused PC build audit satisfies this with cart screenshots and typed parts lists without restoring general product identification. |
| Capstone rubric strictly requires a conversational assistant | The constrained PC Build Advisor now covers the active build or upgrade result with bounded conversation history. |
| Future scrape output has category gaps | Return explicit missing or unavailable states and review `data/component_catalog_report.json`. |
| Soft brand preferences do not fit the budget | Fall back to compatible parts and report unmet preferences. |
| AI advice diverges from deterministic checks | Treat deterministic compatibility rules as source of truth. |
| Source CSV includes non-component rows | Filter through `seed_components.py` and use notebooks only for investigation. |

## Future Extensions

- Add a Phase 2 AI retrieval-augmented recommendation mode using local embeddings and chunked component data. See [AI_RAG_PHASE2.md](AI_RAG_PHASE2.md).
- Keep Phase 2 AI recommendations grounded in retrieved local component candidates and validated by deterministic compatibility checks.
- Polish build-audit confidence messaging, unsupported cart/list states, and spec handoff behavior.
- Extend Colab-ready notebooks for data exploration, spot checks, and parser-rule experiments.
- Add Shopee and Tokopedia as additional per-component marketplace links.
- Improve spec extraction quality for RAM kits, coolers, cases, monitors, and UPS rows as scraper coverage grows.
