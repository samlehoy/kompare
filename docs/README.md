# Kompare Docs

Project documentation for Kompare — a cloud-deployed PC Builder for the Indonesian PC market.

## Active Docs

- [AGENTS.md](AGENTS.md) - **Start here.** Universal instructions for AI coding agents (architecture, tech stack, file structure, guidelines).
- [AI_PIPELINE.md](AI_PIPELINE.md) - AI recommendation pipeline architecture, embedding strategy, and guardrails.
- [BRIEF.md](BRIEF.md) - Product brief, scope, and milestones.
- [PRD.md](PRD.md) - Product requirements, API contracts, and response shapes.
- [UI_SPEC.md](UI_SPEC.md) - UI specification, routes, forms, result cards, and responsive requirements.
- [LOCAL_DEV_SETUP.md](LOCAL_DEV_SETUP.md) - Local Qwen/LM Studio development setup.
- [CATALOG_PLAYBOOK.md](CATALOG_PLAYBOOK.md) - Catalog update and quality playbook.

## Archived / Unused Reference

- [unused_docs/](unused_docs/) - Historical handoff docs, old roadmaps, demo scripts, and academic milestone documents.

## Documentation Rule

When development changes product direction, data contracts, AI/RAG behavior, or user-visible flows, update:

1. [AGENTS.md](AGENTS.md) - if architecture, project structure, or verification commands changed
2. [AI_PIPELINE.md](AI_PIPELINE.md) - if AI pipeline or retrieval logic changed
3. [PRD.md](PRD.md) or [UI_SPEC.md](UI_SPEC.md) - if API contracts or UI behavior changed
4. [BRIEF.md](BRIEF.md) - if product scope changed
