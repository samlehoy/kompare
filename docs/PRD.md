# Product Requirements Document - Kompare

## Product Summary

Kompare is a localhost PC Builder prototype and marketing website for the Indonesian PC market. It helps users build a PC from zero or plan upgrades for an existing PC using budget-to-performance guidance, compatibility checks, upgrade flexibility, and marketplace-ready component links.

Gemini remains part of the technical direction, but its role is focused on PC build reasoning and structured explanations. Kompare is not a broad product decision platform.

## Goals

- Generate balanced custom PC build recommendations for multiple budgets.
- Explain component choices through budget allocation, compatibility, performance balance, and upgrade path rationale.
- Support build-from-zero and upgrade-existing-PC flows.
- Support a constrained PC Build Advisor for follow-up questions about the active recommendation.
- Preserve EnterKomputer links for recommended components when available.
- Keep HDD, monitor, and UPS as optional add-ons for full builds.
- Keep raw marketplace data available for future cleaning workflows without using it directly as runtime product data.

## Non-Goals

- Production checkout, payments, accounts, inventory sync, or order management.
- Marketplace integrations beyond EnterKomputer in the current prototype.
- Generic laptop, desktop, gadget, or electronics recommendations.
- Visible product catalog, generic comparison, generic image identification, or general shopping chat pages.
- Treating `data/products_cleaned.csv` as clean runtime data.

## Target Users

| Persona | Need |
|---|---|
| First-time PC builder | Wants a complete compatible component list for a clear budget. |
| Upgrader | Already owns some parts and wants to know what to replace or add next. |
| Value-focused gamer | Wants the strongest budget-to-performance mix for a target tier. |
| Creator or power user | Wants balanced CPU, GPU, RAM, storage, cooling, and PSU headroom. |

## User Stories

| ID | Story |
|---|---|
| US-1 | As a first-time builder, I want to enter a budget and receive a complete compatible PC build. |
| US-2 | As an upgrader, I want to type the parts I already own so recommendations respect my current setup. |
| US-3 | As a buyer, I want component marketplace links so I can inspect current listings. |
| US-4 | As a budget-focused user, I want clear price tiers so I understand realistic performance expectations. |
| US-5 | As a full-setup planner, I want to choose HDD, monitor, and UPS independently as optional add-ons. |
| US-6 | As a maintainer, I want raw marketplace data separated from runtime component data. |
| US-7 | As a buyer, I want to ask follow-up questions about the current recommendation so I understand tradeoffs before buying. |

## Functional Requirements

### FR-1 Component Data

- The system shall load PC component data from `data/components.json`.
- Component categories shall include CPU, motherboard, RAM, GPU, SSD, HDD, PSU, CPU cooler, fan cooler, and casing where data exists.
- Component records may include `product_url`, `tokopedia_url`, `shopee_url`, `image_url`, `stock_status`, `primary_url`, and `marketplace_links`.
- EnterKomputer URLs shall be normalized into `marketplace_links` and `primary_url`.
- `data/catalog.json` and `data/sample_products.json` are not required runtime inputs for the PC Builder.

### FR-2 Raw Data Staging

- `data/products_cleaned.csv` shall remain in the repository as scraper-output source data.
- The source CSV may still contain rows outside PC Builder scope.
- `backend/utils/seed_components.py` shall convert source rows into `data/components.json`.
- The seeding flow shall write `data/component_catalog_report.json` with category counts, skipped-row counts, and validation issues.
- Notebooks may be used for exploration and parser tuning, but they are not required for every runtime catalog refresh.
- Runtime recommendation logic shall not depend directly on the source CSV.

### FR-3 Budget Tiers

- The backend shall expose budget tiers for entry-level, mid-range, high-end, and custom budgets.
- Each tier shall include label, minimum budget, optional maximum budget, summary, target performance, and upgrade guidance.
- Preset ranges shall be Entry-level `Rp 7.000.000 - Rp 12.000.000`, Mid-range `Rp 12.000.000 - Rp 22.000.000`, and High-end `Rp 22.000.000 - Rp 40.000.000`.
- Custom budget shall display as an infinity symbol on the landing page.

### FR-4 Build From Zero

- The build endpoint shall accept budget, use case, soft CPU brand preference, soft GPU vendor preference, and selected optional add-on slots.
- The response shall include all required build slots, even when a catalog category is unavailable.
- Missing slots shall be reported explicitly.
- Component selection shall rank compatible candidates by stock status, scrape freshness, useful specs, value, platform runway, and use-case fit instead of simply choosing the most expensive in-budget row.
- Selected components shall include buyer-readable `selection_rationale` metadata when ranking signals are available.
- HDD, monitor, and UPS shall be returned only as optional add-ons.
- Users shall be able to request HDD, monitor, UPS, any combination of them, or no optional add-ons.
- HDD add-ons shall represent optional bulk storage; SSD remains the required primary storage slot.
- Monitor add-ons shall be matched to use case, selected GPU tier, target resolution, refresh rate, and setup budget.
- UPS add-ons shall be sized against estimated build wattage, selected PSU context, and GPU PSU recommendation while excluding regulators or stabilizers.

### FR-5 Upgrade Existing PC

- The upgrade endpoint shall accept manually typed existing components keyed by slot.
- Supported typed slots shall include CPU, motherboard, RAM, GPU, SSD, HDD, PSU, CPU cooler, fan cooler, and casing.
- The system shall group recognized slots, retain unknown entries, and warn when important context is missing.
- The system shall infer conservative compatibility specs from typed owned parts where possible.
- The recommendation shall rank missing or upgrade-worthy slots by expected impact for the selected use case.
- The recommendation shall select upgrade components in priority order while staying inside the upgrade budget.

### FR-6 Compatibility

- The system shall check CPU and motherboard socket compatibility.
- The system shall check motherboard and RAM generation compatibility.
- The system shall check PSU headroom against GPU and system power needs.
- The system shall check casing support for motherboard form factor.
- Cooling choices shall be represented separately as CPU cooler and fan cooler.

### FR-7 Frontend

- The visible app shall expose only `/`, `/builder`, `/upgrade`, and `/audit`.
- The landing page shall work as both a marketing page and entry point for the PC Builder tool.
- The builder page shall render component cards, cost summary, compatibility notes, optional add-ons, and marketplace links.
- Component cards shall prefer backend `selection_rationale` for "why this part" explanations, falling back to local UI text only when the field is absent.
- The upgrade page shall use manual text inputs for existing parts.
- The audit page shall expose the Audit a PC Build panel.
- The audit panel shall accept a cart screenshot and/or pasted parts list plus a preset performance goal.
- Detected audit parts shall be applicable to matching manual existing-component fields on the upgrade page.

### FR-8 AI Reasoning

- Gemini may be used for focused PC build explanations, structured guidance, and advisor answers.
- AI output shall remain grounded in local component data where possible.
- Deterministic compatibility checks shall not depend on AI output.
- Advisor answers shall remain scoped to PC building, compatibility, budget tradeoffs, upgrade planning, and EnterKomputer-linked components.
- Advisor history shall be bounded so follow-up questions retain local context without sending unbounded conversation state.
- The advisor shall provide deterministic fallback answers when Gemini is unavailable.

### FR-8.1 Phase 2 Retrieval-Augmented Recommendation

- Phase 2 may add a local vector index over chunked `data/components.json` records.
- The vector index shall be local-file based for capstone alignment, not an external vector database.
- Retrieval may be used to select candidate components before Gemini comparison or ranking.
- Gemini shall only rank or explain retrieved candidates and shall not invent SKUs, prices, categories, or marketplace links.
- The backend shall run deterministic compatibility and budget validation after any AI-assisted recommendation.
- AI-assisted recommendation results shall expose whether vector retrieval and Gemini were used.
- The existing deterministic recommendation flow shall remain available as fallback.

### FR-9 Multimodal Build Audit

- The build audit shall accept a cart screenshot and/or pasted parts list plus selected goal context.
- The output shall map detected parts to PC Builder slots and compatibility relevance.
- The output shall include audit status, summary, detected parts, compatibility issues, missing slots, budget notes, and suggested next steps.
- The audit page shall allow supported detected parts to open the upgrade page with matching manual fields prefilled.
- The feature shall not restore a generic image-identification or broad product-identification page.

## API Design

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/health` | Liveness and data counts |
| GET | `/components` | Component catalog lookup |
| GET | `/build/use-cases` | Build allocation profiles |
| GET | `/build/budget-tiers` | Budget tier guidance |
| POST | `/build/recommend` | Full build recommendation |
| POST | `/build/upgrade` | Upgrade recommendation from manual existing parts |
| POST | `/build/swap-candidates` | Compatible, in-budget replacement candidates for a build slot |
| POST | `/build/swap` | Component replacement and compatibility re-check |
| POST | `/build/advisor` | Constrained advisor for follow-up questions about the active build or upgrade result |
| POST | `/build/audit` | Cart screenshot or typed parts-list audit mapped to PC Builder slots |

Future experimental endpoints may include:

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/build/ai-recommend` | AI-assisted full build recommendation using local retrieval and deterministic validation |
| POST | `/build/ai-upgrade` | AI-assisted upgrade recommendation using local retrieval and deterministic validation |

Legacy generic product, comparison, best-value, broad chat, and generic image-identification endpoints are not part of the PC Builder API surface.

## Advisor Response Shape

```json
{
  "answer": "The GPU is the best first upgrade because it has the largest gaming impact.",
  "referenced_slots": ["gpu", "psu"],
  "evidence_cards": [],
  "cost_saving_suggestions": [],
  "suggested_questions": ["Can I reduce the total price?"],
  "fallback": false
}
```

## Build Response Shape

```json
{
  "components": {
    "cpu": {},
    "motherboard": {},
    "ram": {},
    "gpu": {},
    "ssd": {},
    "psu": {},
    "cpu_cooler": {},
    "fan_cooler": {},
    "case": {}
  },
  "optional_addons": {
    "hdd": null,
    "monitor": null,
    "ups": null
  },
  "missing_slots": [],
  "compatibility_issues": []
}
```

## Upgrade Response Shape

```json
{
  "mode": "upgrade",
  "recognized_existing": {
    "cpu": "Ryzen 5 5600"
  },
  "detected_existing": {
    "cpu": {
      "name": "Ryzen 5 5600",
      "specs": {
        "socket": "AM4"
      }
    }
  },
  "upgrade_priorities": [
    {
      "slot": "gpu",
      "score": 96,
      "title": "Upgrade GPU first",
      "reason": "Your typed GPU looks below the 8GB VRAM target.",
      "estimated_cost_idr": 5000000,
      "selected": true
    }
  ],
  "recommendation": {
    "components": {
      "gpu": {}
    },
    "total_idr": 5000000
  },
  "compatibility_warnings": []
}
```

## Build Audit Response Shape

```json
{
  "filename": "cart.jpg",
  "image_meta": {
    "processed_bytes": 150528
  },
  "audit": {
    "status": "needs_attention",
    "summary": "Good start, but the PSU and motherboard need review before buying.",
    "detected_parts": [
      {
        "slot": "gpu",
        "slot_label": "VGA / GPU",
        "name": "ASUS GeForce RTX 3060 12GB",
        "confidence": 0.82,
        "source": "image_and_text",
        "extracted_specs": {
          "vram_gb": 12,
          "recommended_psu_w": 550
        }
      }
    ],
    "compatibility_issues": [],
    "missing_slots": ["motherboard"],
    "budget_notes": ["Budget target: 1080p gaming under 12 juta."],
    "suggested_next_steps": ["Confirm the motherboard model before buying."]
  }
}
```

## Success Metrics

| Metric | Target |
|---|---|
| Build slot completeness | 100% of build responses include all required slots. |
| Compatibility visibility | 100% of generated builds include compatibility issue data. |
| Upgrade input support | Users can manually submit all core existing component slots, including storage and cooling. |
| UI focus | No visible navigation to non-PC-builder flows. |
| Marketplace readiness | Components with source URLs show EnterKomputer links. |
| Data clarity | Source CSV, generated component JSON, validation report, and runtime overrides are clearly separated. |
| Advisor grounding | Advisor responses reference only the active build or upgrade context. |
| Multimodal support | Users can submit a cart screenshot and/or typed parts list, then apply supported detected parts to upgrade inputs. |

## Risks

| Risk | Mitigation |
|---|---|
| Future scrape output has category gaps | Return explicit missing or unavailable states and review `data/component_catalog_report.json`. |
| Soft brand preferences do not fit the budget | Fall back to compatible parts and report unmet preferences. |
| AI advice diverges from deterministic checks | Treat deterministic compatibility rules as source of truth. |
| Phase 2 vector retrieval returns semantically similar but incompatible parts | Use retrieval only for candidate narrowing, then validate sockets, RAM generation, PSU headroom, case fit, cooler context, budget, and slots deterministically. |
| Gemini invents parts or prices in AI-assisted mode | Restrict prompts to retrieved candidate SKUs and reject unknown SKUs in the response parser. |
| Advisor becomes broad generic shopping chat | Scope `/build/advisor` prompts and UI copy to active PC Builder context only. |
| Multimodal feature reintroduces generic product identification | Implement only the PC build audit tied to parts lists, cart screenshots, slots, and compatibility. |
| Marketplace prices change | Use local price overlays and future marketplace refresh work. |
| Source CSV includes non-component rows | Filter through `seed_components.py` and use notebooks only for investigation. |

## Resolved Decisions

| Decision | Result |
|---|---|
| Core product direction | PC Builder-only prototype website. |
| Full-build vs upgrade flow | Ask whether the user is building from zero or upgrading existing parts. |
| Upgrade input method | Users manually type the components they already have. |
| Optional add-ons | HDD, monitor, and UPS are optional for build-from-zero users. |
| Current marketplace | EnterKomputer links only. |
| Future marketplaces | Shopee and Tokopedia can be added later. |
| Source data | Keep `data/products_cleaned.csv` as scraper output and generate runtime data from it. |
| Legacy product JSON | Remove `data/catalog.json` and `data/sample_products.json` from runtime data. |
