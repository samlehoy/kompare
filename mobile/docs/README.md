# Kompare Mobile (Jetpack Compose) - Design & Specification Docs

This folder contains the full blueprint for a native Android port of **Kompare**, the
AI-powered PC build planning assistant for the Indonesian market. These documents are
specification only - no Kotlin or Gradle code is written yet. They exist so an Android
engineer (or a coding agent) can implement the app top-to-bottom from a single source
of truth.

The mobile app reuses the **existing FastAPI backend unchanged** (see
[`../../backend/app.py`](../../backend/app.py)). The web client in
[`../../frontend`](../../frontend) is the reference implementation for all flows, data
shapes, and visual styling.

## Confirmed decisions

| Topic | Decision |
|---|---|
| UI toolkit | Kotlin + Jetpack Compose, single-Activity |
| Aesthetic | Replicate the **"Kompare 95"** retro Windows 95 look on mobile (teal desktop, gray beveled panels, navy title bars, pixel fonts) |
| Scope (v1) | **Core trio**: Build From Zero (fast + AI) with in-results Swap, Build Audit (image + text), Build Advisor chat |
| Out of scope (v1) | Upgrade Planner (the web `UpgradePlanner` is a "Coming Soon" stub), standalone component browser |
| Backend access | Configurable base URL, default emulator host `http://10.0.2.2:8000`, editable in-app and persisted |
| Market | Indonesia, IDR pricing, `id-ID` number formatting |

## What the app does (feature parity target)

1. **Build From Zero** - user enters a budget + use case + soft brand preferences and gets
   a full compatible PC tower (CPU, motherboard, RAM, GPU, SSD, PSU, CPU cooler, fan
   cooler, casing) with optional add-ons (HDD, monitor, UPS). Two modes: *fast*
   (deterministic) and *AI-assisted*. Advanced budget allocation sliders are supported.
2. **Swap** - inside a build result, replace a single component slot with a compatible
   candidate and re-validate.
3. **Build Audit** - upload a cart screenshot and/or paste a parts list to flag
   compatibility risks, missing slots, and next steps before buying (multimodal).
4. **Build Advisor** - grounded multi-turn chat about the active build, with referenced
   slots, evidence cards, cost-saving swap suggestions, and suggested follow-up questions.

## How these docs fit together

Read them in order; each builds on the previous.

| # | Document | Purpose |
|---|---|---|
| - | [`README.md`](README.md) | This overview, decisions, and index |
| 01 | [`01-architecture.md`](01-architecture.md) | App layers (MVVM), DI, navigation, package structure |
| 02 | [`02-tech-stack.md`](02-tech-stack.md) | Kotlin/Compose/Gradle dependencies, SDK levels, fonts/assets |
| 03 | [`03-api-integration.md`](03-api-integration.md) | Retrofit interface per endpoint, base-URL config, multipart audit, error handling |
| 04 | [`04-data-models.md`](04-data-models.md) | Kotlin data classes, JSON mapping, slot/spec helpers |
| 05 | [`05-design-system.md`](05-design-system.md) | Retro 95 tokens, bevel modifiers, typography, reusable composables |
| 06 | [`06-screens-and-flows.md`](06-screens-and-flows.md) | Per-screen UX (Build/Audit/Advisor), swap modal, state & navigation |
| 07 | [`07-implementation-roadmap.md`](07-implementation-roadmap.md) | Phased milestones, testing approach, open questions |

## Reference map (web -> mobile)

| Concept | Web reference | Mobile doc |
|---|---|---|
| API client | [`frontend/lib/api.js`](../../frontend/lib/api.js) | [03-api-integration](03-api-integration.md) |
| Build form | [`frontend/components/builder/BuildWizard.jsx`](../../frontend/components/builder/BuildWizard.jsx) | [06-screens-and-flows](06-screens-and-flows.md) |
| Build results | [`frontend/components/results/BuildResults.jsx`](../../frontend/components/results/BuildResults.jsx) | [04-data-models](04-data-models.md), [06-screens-and-flows](06-screens-and-flows.md) |
| Swap modal | [`frontend/components/swap/SwapModal.jsx`](../../frontend/components/swap/SwapModal.jsx) | [06-screens-and-flows](06-screens-and-flows.md) |
| Audit | [`frontend/components/audit/BuildAudit.jsx`](../../frontend/components/audit/BuildAudit.jsx) | [06-screens-and-flows](06-screens-and-flows.md) |
| Advisor | [`frontend/components/advisor/AdvisorConsole.jsx`](../../frontend/components/advisor/AdvisorConsole.jsx) | [06-screens-and-flows](06-screens-and-flows.md) |
| Slots/specs | [`frontend/lib/slots.js`](../../frontend/lib/slots.js) | [04-data-models](04-data-models.md) |
| Money format | [`frontend/lib/format.js`](../../frontend/lib/format.js) | [04-data-models](04-data-models.md) |
| Styling | [`frontend/styles/kompare95.css`](../../frontend/styles/kompare95.css), [`design/DESIGN.md`](../../design/DESIGN.md) | [05-design-system](05-design-system.md) |

## Status

Documentation phase complete. Implementation has not started; see
[07-implementation-roadmap](07-implementation-roadmap.md) for the build sequence.
