# Kompare UI Specification

## Design Direction

Kompare should feel like a modern PC Part Picker-style tool with a focused marketing landing page. The first screen should immediately communicate PC building, budget-to-performance guidance, compatibility, upgrade flexibility, and marketplace-ready component recommendations.

The interface should be practical and component-focused rather than a broad shopping catalog.

## Visible Routes

| Route | Purpose |
|---|---|
| `/` | PC Builder marketing landing with budget tier cards and flow selection. |
| `/builder` | Build-from-zero form and full component recommendation result. |
| `/upgrade` | Manual existing-part form and upgrade recommendation result. |
| `/audit` | Dedicated Audit a PC Build page for cart screenshots and typed parts lists. |

No visible route should lead to generic product browsing, generic comparison, best-value product picks, generic image identification, add-product, or general assistant flows.

## Navigation

Primary navigation contains only:

- PC Builder
- Build from zero
- Upgrade
- Audit build

## Landing Page

The landing page includes:

- Clear PC Builder positioning.
- Two primary actions: Start from zero and Upgrade my PC.
- Mode cards for full tower and existing PC flows.
- Budget tier cards for entry-level, mid-range, high-end, and custom budget.
- Copy that emphasizes compatibility, balanced performance, upgrade flexibility, and EnterKomputer links.

Budget tier cards should show:

- Tier label
- Budget range
- Short summary
- Performance goal
- Upgrade note
- Clear action or selected state

Current tier ranges:

| Tier | Displayed Range |
|---|---|
| Entry-level | Rp 7.000.000 - Rp 12.000.000 |
| Mid-range | Rp 12.000.000 - Rp 22.000.000 |
| High-end | Rp 22.000.000 - Rp 40.000.000 |
| Custom budget | ♾️ |

## Build From Zero Form

Fields:

- Budget
- Use case
- CPU brand preference
- GPU vendor preference
- Optional add-ons group with individual Hard Drive / HDD, Monitor, and UPS checkboxes

Behavior:

- Users submit a budget and receive a full PC tower build.
- HDD, monitor, and UPS are optional setup add-ons, not required tower components.
- SSD is the required primary storage slot; HDD appears only when the HDD add-on is selected.
- Users can include HDD, monitor, UPS, any combination of them, or no optional add-ons at all.
- Soft brand preferences may fall back when they do not fit budget or compatibility constraints.

## Upgrade Existing PC Form

Users manually type components they already own.

Fields:

- Processor / CPU
- Motherboard
- RAM
- VGA / GPU
- SSD
- Hard Drive / HDD (optional)
- PSU
- CPU Cooler
- Fan Cooler
- Casing
- Notes

Behavior:

- Empty fields are allowed.
- Submitted values are grouped by slot.
- Missing important slots produce compatibility context warnings.
- Result cards focus on recommended missing or upgrade-worthy components.

## Audit a PC Build

The `/audit` page includes a focused multimodal build-audit panel. The builder and upgrade pages should stay focused on their primary forms and results.

Fields:

- Optional cart screenshot upload
- Build goal preset select
- Parts list textarea

Result content:

- Audit status
- Summary
- Detected parts mapped to PC Builder slots
- Confidence and source for each detected part
- Extracted specs
- Compatibility findings
- Missing required slots
- Budget notes
- Suggested next steps

Behavior:

- Results must map only to PC Builder slots.
- The panel must not expose generic product identification.
- Text-only audit fallback must work when image analysis is unavailable.
- Preset goals should include general gaming, esports/FPS, 1080p gaming, 1440p gaming, content creation, and office/student contexts.
- Supported detected parts can be applied into matching manual fields by opening `/upgrade` with a prefilled handoff.
- Apply support covers CPU, motherboard, RAM, GPU, SSD, HDD, PSU, CPU cooler, fan cooler, and casing.

## Build Result Cards

Required slots render in this order:

1. Processor / CPU
2. Motherboard
3. RAM
4. VGA / GPU
5. SSD
6. PSU
7. CPU Cooler
8. Fan Cooler
9. Casing

Optional add-ons render separately:

- Hard Drive / HDD
- Monitor
- UPS

Each card should show:

- Slot label
- Component name
- Brand when available
- Price
- Key specs as compact pills
- Marketplace link when available
- Why-this-part rationale from backend `selection_rationale` when available
- Swap action when supported
- Buyer-friendly spec labels rather than raw parser field names

Missing catalog recommendations should render as explicit unavailable states.

Swap dialogs should list compatible alternatives for the active build context. Candidates that create hard CPU socket, RAM generation, or case fit errors should be filtered out before the user chooses them. Warning-level candidates may appear with a clear compatibility note.

## PC Build Advisor

The build and upgrade result pages include a constrained advisor panel after a recommendation exists.

The advisor panel should show:

- Suggested follow-up questions.
- A conversation thread for the active build or upgrade result.
- Referenced part chips that focus matching component cards.
- Evidence cards with component names, prices, specs, and rationale.
- Cost-saving swap suggestions when the user asks about reducing total price.

Behavior:

- Advisor answers are scoped to the active PC build or upgrade recommendation.
- Local conversation history resets when the active recommendation changes.
- Cost-saving advisor actions should open the swap dialog for the referenced slot.
- When an advisor suggestion includes a candidate SKU, that candidate should be preselected in the swap dialog.
- The advisor should not expose generic product chat, laptop recommendations, gadget recommendations, or broad electronics advice.

## Phase 2 AI-Assisted Recommendation UI

Future vector/RAG recommendation work should reuse the existing build and upgrade result surfaces.

If AI-assisted retrieval is enabled, the UI should show:

- A subtle "AI-assisted" badge on the result.
- Whether the result used local vector retrieval.
- Retrieved-candidate rationale inside the existing "Why this part" or advisor evidence areas.
- Deterministic compatibility status in the existing summary panel.
- Clear fallback messaging when Gemini or the local vector index is unavailable.

The UI should not add a generic product search page or broad shopping chatbot. Manual deterministic build mode should remain available.

## Build Summary

The summary panel shows:

- Total price
- Original budget
- Remaining or over-budget amount
- Compatibility status
- Compatibility issue chips when present
- Allocation chart across selected parts

## Marketplace Links

Current source:

- EnterKomputer

Future sources:

- Shopee
- Tokopedia

Future marketplace names should appear as additional per-component links, not as new primary app flows.

## Responsive Requirements

- Mobile widths stack forms and cards into one column.
- Wide desktop widths should use readable card grids without stretching cards excessively.
- Text must not overflow cards, buttons, or form controls.
- Required component slots should remain stable in count and order across breakpoints.

## Loading And Error States

- Async regions use skeletons or loading button states.
- Errors render inline alerts and keep prior successful results visible when possible.
- Compatibility issues are warnings, not fatal UI failures.
- Missing data is shown as unavailable, not hidden.

## Accessibility

- Inputs require labels.
- Keyboard focus must be visible.
- Buttons must use clear command labels.
- Selection state should use accessible state such as `aria-pressed`.
- Component cards should not rely on color alone to communicate compatibility state.

## Acceptance Criteria

- The visible app exposes only the PC Builder landing, build-from-zero flow, and upgrade flow.
- A full build result renders nine required component slots.
- Upgrade users can manually type existing components.
- HDD, monitor, and UPS are optional add-ons for full builds.
- EnterKomputer links render when component URLs exist.
- The advisor can answer questions about the active build or upgrade result with referenced parts and evidence cards.
- The build-audit panel accepts cart screenshot and/or typed parts-list input and can apply supported results to upgrade fields.
- Responsive Playwright tests pass for mobile, tablet, and desktop viewports.
