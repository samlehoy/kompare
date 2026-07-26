# Kompare

AI-assisted PC Builder for the Indonesian PC market. Cloudflare Pages frontend,
Cloudflare Worker backend, deterministic compatibility engine with an AI
ranking layer on top.

## Read this first

The full instructions for working in this repository live in
[docs/AGENTS.md](docs/AGENTS.md) — invariants, tech stack, data policy,
compatibility rules, and verification commands. Read it before changing code.

This file exists only so those instructions are actually loaded: agent tooling
looks for `CLAUDE.md` at the repository root, not inside `docs/`.

| Question | Document |
|---|---|
| What must I not break? | [docs/AGENTS.md](docs/AGENTS.md) |
| What is done vs backlog? | [docs/PROJECT_STATUS.md](docs/PROJECT_STATUS.md) |
| What is the product? | [docs/PRODUCT.md](docs/PRODUCT.md) |
| How is it built? | [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) |
| Full index | [docs/README.md](docs/README.md) |

## Non-negotiables

- Deterministic compatibility checks are the source of truth. AI ranks and
  explains; it never invents SKUs, prices, or links.
- Visible routes are `/`, `/builder`, `/upgrade`, `/audit` only. Do not revive
  generic browse, compare, chat, or image-identification flows.
- Missing catalog data is reported as missing, never fabricated.
- `backend_legacy/` is historical Python reference. Production is
  `backend_worker/`.

## Verify before claiming done

```powershell
npm --prefix frontend test -- --run     # unit tests, including the docs checks
npm --prefix frontend run build         # static export
npm --prefix frontend run test:ui       # Playwright, for UI flow changes
```

## Docs are checked, not trusted

`frontend/tests/unit/docs.test.js` fails the build when `docs/` names a file,
directory, command, link, or API endpoint that does not exist. If you rename
something, the docs check will tell you which document still points at the old
name.

Do not write commit SHAs, deployment IDs, or test counts into `docs/`. They go
stale on the commit that records them. Record what must be true and the command
that proves it.
