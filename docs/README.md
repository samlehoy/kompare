# Kompare Docs

Documentation for Kompare — a cloud-deployed PC Builder for the Indonesian PC market.

## Where to start

| If you want to know… | Read |
|---|---|
| **What's done, what's left, what's out of scope** | [PROJECT_STATUS.md](PROJECT_STATUS.md) |
| **What the product is & must do** (scope, requirements, API contracts, response shapes) | [PRODUCT.md](PRODUCT.md) |
| **How it's built** (architecture, request flow, API handlers, deployment) | [ARCHITECTURE.md](ARCHITECTURE.md) |
| **How the UI should look & behave** (routes, forms, cards, responsive, a11y) | [UI_SPEC.md](UI_SPEC.md) |
| **How the AI pipeline works** (RAG, guardrails, local model setup) | [AI_PIPELINE.md](AI_PIPELINE.md) |
| **How to update catalog data & prices** | [CATALOG_PLAYBOOK.md](CATALOG_PLAYBOOK.md) |
| **How to release, verify, and roll back production** | [DEPLOY_PROD_RUNBOOK.md](DEPLOY_PROD_RUNBOOK.md) |
| **Rules for AI coding agents** (invariants, tech stack, verification) | [AGENTS.md](AGENTS.md) |

## One fact, one home

Each topic is authoritative in exactly one doc; others link to it.

- **Scope / goals / requirements** → PRODUCT (PROJECT_STATUS holds only *status* and links here).
- **Architecture / API handlers / deployment** → ARCHITECTURE (PRODUCT lists API contracts, links here for internals).
- **AI pipeline / local model setup** → AI_PIPELINE.
- **Production release / rollback procedure** → DEPLOY_PROD_RUNBOOK.
- **Agent invariants** → AGENTS stays self-contained by design.

## Documentation Rule

When development changes product direction, data contracts, AI/RAG behavior, or user-visible flows, update:

1. [PROJECT_STATUS.md](PROJECT_STATUS.md) — if feature status, backlog, or scope changed
2. [PRODUCT.md](PRODUCT.md) — if product scope, requirements, or API contracts changed
3. [ARCHITECTURE.md](ARCHITECTURE.md) — if system design, API handlers, or deployment changed
4. [AI_PIPELINE.md](AI_PIPELINE.md) — if AI pipeline, retrieval logic, or local model setup changed
5. [UI_SPEC.md](UI_SPEC.md) — if UI behavior changed
6. [AGENTS.md](AGENTS.md) — if agent invariants or verification commands changed
