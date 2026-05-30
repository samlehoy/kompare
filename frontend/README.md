# Kompare Frontend

Next.js App Router frontend for the Kompare 95 desktop console. The app provides the main console at `/`, plus focused routes for `/builder`, `/upgrade`, and `/audit`.

## Setup

```powershell
npm install
```

## Commands

```powershell
npm run dev      # start the Next.js development server
npm run test     # run Vitest unit tests
npm run test:ui  # run Playwright browser tests
npm run build    # create the production Next.js build
```

Running `npm run dev` directly uses the Next.js default port, so open <http://localhost:3000>. When the repository-level `.\dev.ps1` helper starts the frontend, it passes an explicit port (`5173` by default).

## App Router Structure

```text
app/
  layout.jsx         shared document shell
  page.jsx           Kompare 95 desktop console
  builder/page.jsx   build-from-zero workflow
  upgrade/page.jsx   existing-PC upgrade workflow
  audit/page.jsx     cart/list audit workflow
components/          reusable console UI
lib/                 API client, formatting, and shared helpers
styles/              component-level styles
tests/               Vitest and Playwright coverage
```

## API Proxy

Frontend requests use `/api/*` by default. `next.config.mjs` rewrites those requests to `NEXT_PUBLIC_API_PROXY_TARGET` when set, or `http://localhost:8000` by default.

For local AI/RAG demos, prefer setting `NEXT_PUBLIC_API_BASE_URL` to the FastAPI origin. This makes the browser call FastAPI directly and avoids the Next dev proxy timing out on long local-model requests.

When running through the root `.\dev.ps1` helper, the script sets both `NEXT_PUBLIC_API_PROXY_TARGET` and `NEXT_PUBLIC_API_BASE_URL` to the backend port it selected for that session.
