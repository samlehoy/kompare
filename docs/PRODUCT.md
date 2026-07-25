# Kompare — Product Document

> **What Kompare is, who it is for, and what it must do.** Merges the former product brief and PRD.
> For *current status* see [PROJECT_STATUS.md](PROJECT_STATUS.md) · for *system design* see [ARCHITECTURE.md](ARCHITECTURE.md) · for *UI* see [UI_SPEC.md](UI_SPEC.md).

---

## 1. Summary

Kompare is a cloud-deployed **PC Builder** and marketing website for the Indonesian PC market. It helps users **build a custom PC from zero** or **plan upgrades for an existing PC** by combining a cleaned local component catalog, budget-to-performance guidance, deterministic compatibility checks, upgrade flexibility, and marketplace-ready links.

Kompare is focused exclusively on PC building. It is **not** a general electronics recommendation platform, laptop/desktop/gadget catalog, or broad shopping assistant.

Gemini is part of the technical direction, but its role is scoped to PC build reasoning and structured explanations. Deterministic compatibility rules remain the source of truth.

---

## 2. Problem Statement

PC builders struggle with:

- **Budget uncertainty** — how much to allocate to CPU, GPU, motherboard, RAM, storage, PSU, cooling, and casing.
- **Compatibility risk** — matching sockets, RAM generation, PSU headroom, motherboard form factor, case fit, and cooler needs.
- **Upgrade ambiguity** — deciding what to replace when some parts are already owned.
- **Marketplace readiness** — moving from a recommended build to real component listings.
- **Data quality risk** — marketplace exports can include unrelated categories that must be filtered before runtime use.

Kompare addresses these by caching a cleaned catalog, applying deterministic compatibility rules, ranking parts by value and fit, and exposing buyer-readable explanations and links.

---

## 3. Goals & Non-Goals

### Goals

- Generate balanced custom PC build recommendations across multiple budgets.
- Explain choices via budget allocation, compatibility, performance balance, and upgrade path.
- Support build-from-zero and upgrade-existing-PC flows.
- Provide a constrained PC Build Advisor for follow-up questions about the active recommendation.
- Preserve EnterKomputer links for recommended components when available.
- Keep HDD, monitor, and UPS as optional add-ons for full builds.
- Keep raw marketplace data available for future cleaning without using it directly as runtime data.

### Non-Goals

- Production checkout, payments, accounts, inventory sync, or order management.
- Marketplace integrations beyond EnterKomputer in the current prototype.
- Generic laptop, desktop, gadget, or electronics recommendations.
- Visible product catalog, generic comparison, image identification, or general shopping chat pages.
- Treating `data/products_cleaned.csv` as clean runtime data.

---

## 4. Target Users

| Persona | Need |
|---|---|
| First-time PC builder | A complete compatible component list for a clear budget. |
| Upgrader | Knows what to replace or add next given owned parts. |
| Value-focused gamer | Strongest budget-to-performance mix for a target tier. |
| Creator / power user | Balanced CPU, GPU, RAM, storage, cooling, PSU headroom. |

### User Stories

| ID | Story |
|---|---|
| US-1 | Enter a budget, receive a complete compatible PC build. |
| US-2 | Type parts already owned so recommendations respect the current setup. |
| US-3 | See component marketplace links to inspect current listings. |
| US-4 | See clear price tiers to understand realistic performance expectations. |
| US-5 | Choose HDD, monitor, and UPS independently as optional add-ons. |
| US-6 | Keep raw marketplace data separated from runtime component data. |
| US-7 | Ask follow-up questions about the current recommendation before buying. |

---

## 5. Core Build Scope

**Required full-build slots (9):** Processor / CPU · Motherboard · RAM · VGA / GPU · SSD · PSU · CPU Cooler · Fan Cooler · Casing.

**Optional add-ons:** Hard Drive / HDD · Monitor · UPS.

SSD is the required primary storage slot; HDD is optional bulk storage.

---

## 6. Key Features

| Feature | Description |
|---|---|
| Desktop Console | Retro PC-style shell with compact navigation for builder, upgrade, and audit workflows. |
| Build From Zero | Generates a complete PC tower build across all nine required slots. |
| Upgrade Existing PC | Accepts owned parts and returns compatible upgrade / missing-part recommendations. |
| Audit a PC Build | Cart screenshot and/or pasted parts list to flag compatibility risks before buying. |
| PC Build Advisor | Grounded follow-up questions about the active build or upgrade result. |
| Budget Tiers | Entry-level, mid-range, high-end, and custom-budget guidance. |
| Marketplace Links | Links recommended components to EnterKomputer when product URLs exist. |
| Optional Add-ons | Monitors and UPS as optional setup recommendations for full first-time builds. |

---

## 7. Functional Requirements

### FR-1 Component Data

- Load PC component data from `data/components.json`.
- Categories: CPU, motherboard, RAM, GPU, SSD, HDD, PSU, CPU cooler, fan cooler, casing (where data exists).
- Records may include `product_url`, `tokopedia_url`, `shopee_url`, `image_url`, `stock_status`, `primary_url`, `marketplace_links`.
- EnterKomputer URLs are normalized into `marketplace_links` and `primary_url`.

### FR-2 Raw Data Staging

- `data/products_cleaned.csv` remains scraper-output source data and may contain out-of-scope rows.
- The seeder converts source rows into `data/components.json` and writes `data/component_catalog_report.json` (category counts, skipped rows, validation issues).
- Runtime logic must not depend directly on the source CSV. See [CATALOG_PLAYBOOK.md](CATALOG_PLAYBOOK.md).

### FR-3 Budget Tiers

- Expose tiers for entry-level, mid-range, high-end, and custom budgets, each with label, min budget, optional max, summary, target performance, and upgrade guidance.
- Preset ranges: Entry-level `Rp 7.000.000–12.000.000`, Mid-range `Rp 12.000.000–22.000.000`, High-end `Rp 22.000.000–40.000.000`. Custom budget shows an infinity symbol on the landing page.
- **FR-3.1 Per-use-case ranges:** each use case defines a recommended budget range surfaced via `/api/build/use-cases`. Budgets below the minimum trigger a visible warning but do not block the request.

### FR-4 Build From Zero

- Accept budget, use case, soft CPU brand preference, soft GPU vendor preference, and selected optional add-on slots.
- Response includes all required slots even when a category is unavailable; missing slots are reported explicitly.
- Rank compatible candidates by stock, scrape freshness, useful specs, value, platform runway, and use-case fit — not just the most expensive in-budget row.
- Include buyer-readable `selection_rationale` when ranking signals exist.
- HDD, monitor, UPS returned only as optional add-ons; any combination (or none) is allowed.
- Monitor add-ons matched to use case, GPU tier, resolution, refresh rate, budget. UPS sized against estimated wattage, PSU context, GPU PSU recommendation (excludes regulators/stabilizers).

### FR-5 Upgrade Existing PC

- Accept manually typed existing components keyed by slot (CPU, motherboard, RAM, GPU, SSD, HDD, PSU, CPU cooler, fan cooler, casing).
- Group recognized slots, retain unknown entries, warn when important context is missing.
- Infer conservative compatibility specs from typed owned parts where possible.
- Rank missing / upgrade-worthy slots by expected impact for the use case, selecting upgrades within budget in priority order.

### FR-6 Compatibility

- CPU ↔ motherboard socket; motherboard ↔ RAM generation; PSU headroom vs GPU + system load; casing support for motherboard form factor.
- CPU cooler and fan cooler represented as separate slots.

### FR-7 Frontend

- Visible routes: `/`, `/builder`, `/upgrade`, `/audit` only. (Detail in [UI_SPEC.md](UI_SPEC.md).)
- Builder renders component cards, cost summary, compatibility notes, optional add-ons, marketplace links; cards prefer backend `selection_rationale`.
- Upgrade uses manual text inputs. Audit exposes the multimodal audit panel; detected parts applicable to upgrade fields.

### FR-8 AI Reasoning

- Gemini may be used for focused build explanations, structured guidance, and advisor answers, grounded in local data.
- Deterministic compatibility checks must not depend on AI output.
- Advisor is scoped to PC building, compatibility, budget tradeoffs, upgrade planning, and EnterKomputer-linked components; history is bounded; deterministic fallback when Gemini is unavailable.

### FR-8.1 Phase 2 Retrieval-Augmented Recommendation

- Optional vector index over chunked `data/components.json`; retrieval narrows candidates before Gemini ranking.
- Gemini only ranks/explains retrieved candidates — never invents SKUs, prices, categories, or links.
- Deterministic compatibility + budget validation runs after any AI-assisted recommendation; the deterministic flow remains the fallback. Design detail in [AI_PIPELINE.md](AI_PIPELINE.md).

### FR-9 Multimodal Build Audit

- Accept cart screenshot and/or pasted parts list plus goal context.
- Map detected parts to PC Builder slots; output audit status, summary, detected parts, compatibility issues, missing slots, budget notes, next steps.
- Supported detected parts open `/upgrade` with matching manual fields prefilled. Must not restore generic image/product identification.

---

## 8. API Design

Endpoints are served under `/api/*`. See [ARCHITECTURE.md](ARCHITECTURE.md) for handlers, request flow, and the AI pipeline.

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/health` | Liveness and data counts |
| GET | `/components` | Component catalog lookup |
| GET | `/build/use-cases` | Build allocation profiles + budget ranges |
| GET | `/build/budget-tiers` | Budget tier guidance |
| POST | `/build/recommend` | Full deterministic build recommendation |
| POST | `/build/upgrade` | Upgrade recommendation from manual existing parts |
| POST | `/build/swap-candidates` | Compatible, in-budget replacement candidates for a slot |
| POST | `/build/swap` | Component replacement and compatibility re-check |
| POST | `/build/advisor` | Constrained advisor for follow-up questions |
| POST | `/build/audit` | Cart screenshot / typed parts-list audit mapped to slots |
| POST | `/build/ai-recommend` | **Experimental** AI-assisted build using retrieval + deterministic validation |

Planned (not yet implemented): `POST /build/ai-upgrade`. Legacy generic product / comparison / best-value / broad chat / image-identification endpoints are not part of the API surface.

---

## 9. Response Shapes

### Advisor

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

### Build

```json
{
  "use_case": "gaming",
  "budget_idr": 15000000,
  "total_idr": 14600000,
  "remaining_idr": 400000,
  "budget_band": "mid_range",
  "components": {
    "cpu": {}, "motherboard": {}, "ram": {}, "gpu": {}, "ssd": {},
    "psu": {}, "cpu_cooler": {}, "fan_cooler": {}, "case": {}
  },
  "optional_addons": { "hdd": null, "monitor": null, "ups": null },
  "budget_usage": { "used_percent": 97.3, "target_min_percent": 96.7, "target_max_percent": 100, "status": "target_met" },
  "near_budget_upgrades": [
    {
      "slot": "gpu",
      "current": { "name": "GeForce RTX 4060" },
      "upgrade": { "name": "GeForce RTX 4060 Ti" },
      "new_total_idr": 15400000,
      "over_budget_idr": 400000,
      "over_budget_percent": 2.7,
      "reason": "Higher graphics tier improves gaming frame rate."
    }
  ],
  "budget_range_warning": null,
  "missing_slots": [],
  "compatibility_issues": [],
  "preferences": { "cpu_brand": null, "gpu_vendor": null }
}
```

### Upgrade

```json
{
  "mode": "upgrade",
  "recognized_existing": { "cpu": "Ryzen 5 5600" },
  "detected_existing": { "cpu": { "name": "Ryzen 5 5600", "specs": { "socket": "AM4" } } },
  "upgrade_priorities": [
    {
      "slot": "gpu", "score": 96, "title": "Upgrade GPU first",
      "reason": "Your typed GPU looks below the 8GB VRAM target.",
      "estimated_cost_idr": 5000000, "selected": true
    }
  ],
  "recommendation": { "components": { "gpu": {} }, "total_idr": 5000000 },
  "compatibility_warnings": []
}
```

### Build Audit

```json
{
  "filename": "cart.jpg",
  "image_meta": { "processed_bytes": 150528 },
  "audit": {
    "status": "needs_attention",
    "summary": "Good start, but the PSU and motherboard need review before buying.",
    "detected_parts": [
      {
        "slot": "gpu", "slot_label": "VGA / GPU", "name": "ASUS GeForce RTX 3060 12GB",
        "confidence": 0.82, "source": "image_and_text",
        "extracted_specs": { "vram_gb": 12, "recommended_psu_w": 550 }
      }
    ],
    "compatibility_issues": [],
    "missing_slots": ["motherboard"],
    "budget_notes": ["Budget target: 1080p gaming under 12 juta."],
    "suggested_next_steps": ["Confirm the motherboard model before buying."]
  }
}
```

---

## 10. Success Metrics

| Metric | Target |
|---|---|
| Build slot completeness | 100% of build responses include all nine required slots; HDD stays optional. |
| Compatibility visibility | 100% of generated builds include compatibility issue data. |
| Upgrade input support | Users can submit all core existing slots, including storage and cooling. |
| UI focus | No visible navigation to non-PC-builder flows. |
| Marketplace readiness | Components with source URLs show EnterKomputer links. |
| Data clarity | Source CSV, generated JSON, validation report, and runtime overrides clearly separated. |
| Advisor grounding | Advisor responses reference only the active build or upgrade context. |
| Multimodal support | Users can submit a screenshot and/or parts list and apply supported detected parts to upgrade inputs. |

---

## 11. Risks & Mitigation

| Risk | Mitigation |
|---|---|
| Scrape output has category gaps | Return explicit missing/unavailable states; review `component_catalog_report.json`. |
| Soft brand preferences don't fit budget | Fall back to compatible parts; report unmet preferences. |
| AI advice diverges from deterministic checks | Deterministic rules are the source of truth. |
| Vector retrieval returns similar-but-incompatible parts | Use retrieval only for narrowing; validate deterministically. |
| Gemini invents parts/prices | Restrict prompts to retrieved SKUs; reject unknown SKUs in the parser. |
| Advisor becomes broad shopping chat | Scope advisor prompts and UI copy to active PC Builder context. |
| Multimodal reintroduces generic identification | Implement only the PC build audit tied to slots and compatibility. |
| Gemini API quota limits | Key-rotation pool across multiple keys in the Worker backend. |
| Source CSV includes non-component rows | Filter through the seeder; use notebooks only for investigation. |

---

## 12. Resolved Decisions

| Decision | Result |
|---|---|
| Core product direction | PC Builder-only prototype website. |
| Full-build vs upgrade | Ask whether building from zero or upgrading existing parts. |
| Upgrade input method | Users manually type owned components. |
| Optional add-ons | HDD, monitor, UPS optional for build-from-zero. |
| Current marketplace | EnterKomputer links only. |
| Future marketplaces | Shopee and Tokopedia can be added later. |
| Source data | Keep `products_cleaned.csv` as scraper output; generate runtime data from it. |
| Legacy product JSON | `catalog.json` and `sample_products.json` removed from runtime data. |
