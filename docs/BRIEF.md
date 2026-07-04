# Project Brief - Kompare

## Kompare: AI-Powered PC Builder and Budget-to-Performance Decision Engine

Kompare is a cloud-deployed PC Builder and marketing website for the Indonesian PC market. It helps users either build a custom PC from zero or plan upgrades for an existing PC by combining local component data, budget-to-performance guidance, compatibility checks, upgrade flexibility, and marketplace-ready links.

The product is focused exclusively on PC building. It is not a general electronics recommendation platform, laptop catalog, desktop catalog, gadget catalog, or broad shopping assistant.

---

## Problem Statement

PC builders often struggle with:

- **Budget uncertainty** - knowing how much to allocate to CPU, GPU, motherboard, RAM, storage, PSU, cooling, and casing.
- **Compatibility risk** - matching sockets, RAM generation, PSU headroom, motherboard form factor, case fit, and cooler needs.
- **Upgrade ambiguity** - deciding what to replace when the user already owns some parts.
- **Marketplace readiness** - moving from a recommended build to real component listings.
- **Data quality risk** - marketplace exports can include unrelated categories that must be filtered before runtime use.

Kompare addresses these problems by caching a cleaned component catalog, applying deterministic compatibility rules, ranking parts by value and fit, and exposing buyer-readable explanations and links.

---

## Key Features

| Page / Flow | Description |
|---|---|
| **Desktop Console** | Retro PC-style shell with compact navigation for builder, upgrade, and audit workflows. |
| **Build From Zero** | Generates a complete PC tower build including CPU, Motherboard, RAM, GPU, SSD, HDD, PSU, Coolers, and Casing. |
| **Upgrade Existing PC** | Accepts parts you already own and returns compatible upgrade or missing-part recommendations. |
| **Audit a PC Build** | Upload a cart screenshot or pasted parts list to flag compatibility risks before buying. |
| **PC Build Advisor** | Answers grounded follow-up questions about the active build or upgrade result. |
| **Budget Tiers** | Presents entry-level, mid-range, high-end, and custom-budget guidance. |
| **Marketplace Links** | Links recommended components directly to EnterKomputer (when product URLs are available). |
| **Optional Add-ons** | Suggests monitors and UPS as optional setup recommendations for full first-time builds. |

---

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

---

## Data Scope

Runtime data:
- `data/components.json` (uploaded to Cloudflare KV for serverless access)
- `data/price_overrides.json`

Source and review data:
- `data/products_cleaned.csv`
- `data/component_catalog_report.json`
- `data/curated_ram.json` as an optional RAM fallback only

---

## User Flows

| Flow | Purpose |
|---|---|
| PC Builder Landing | Marketing entry point for the PC Builder with budget tier guidance. |
| Build From Zero | Generate a complete PC tower recommendation from a budget and use case. |
| Upgrade Existing PC | Accept manually typed existing parts and recommend compatible upgrades. |
| Swap A Component | Let users inspect compatible alternatives for a selected build slot. |
| Audit a PC Build | Accept a cart screenshot and/or pasted parts list on `/audit`, detect PC Builder slots, show compatibility and missing-part findings, and hand supported results into the upgrade form. |
| PC Build Advisor | Let users ask follow-up questions about the active build or upgrade result, with local conversation history and grounded evidence cards. |
| Budget Tier Guidance | Help users understand performance expectations across price ranges. |

---

## Deployment Architecture

- **Frontend**: Cloudflare Pages (Next.js static export)
- **Backend**: Cloudflare Worker (`backend_worker/`)
- **Database**: Cloudflare KV (component catalog)
- **Vector Database**: Qdrant Cloud (embeddings generated via Workers AI)
- **AI Models**: Google Gemini 2.5 Flash (for ranking, auditing, and advisor console)

---

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

---

## Risks and Mitigation

| Risk | Mitigation |
|---|---|
| Soft brand preferences do not fit the budget | Fall back to compatible parts and report unmet preferences. |
| AI advice diverges from deterministic checks | Treat deterministic compatibility rules as the final source of truth. |
| Source CSV includes non-component rows | Filter through `seed_components.py` and compile a clean `components.json` catalog. |
| Gemini API quota limits | Implement key rotation pool across multiple API keys in the Worker backend. |
