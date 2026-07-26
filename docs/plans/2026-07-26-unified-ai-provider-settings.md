# Unified AI Provider Settings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expose Settings, Gemini BYOK, Local Qwen/LM Studio, and custom Qdrant overrides consistently in local, preview, and production builds.

**Architecture:** Remove environment-dependent feature gates from the desktop shell, build wizard, and browser override headers while retaining `NODE_ENV` solely for production API-base fallback. Keep Worker routing unchanged and record the accepted provider-override security risks as explicit post-MVP debt.

**Tech Stack:** React 19, Next.js 16 static export, Zustand 5, Vitest 4, Testing Library, Cloudflare Pages, Cloudflare Worker.

## Global Constraints

- Settings and provider profiles behave identically in local, preview, and production builds.
- `gemini_free` remains the default profile, but `local_qwen` remains selectable everywhere.
- Gemini, LM Studio, Qdrant URL, and Qdrant key browser overrides remain enabled everywhere.
- Keep `NODE_ENV` only for production API-base fallback when `NEXT_PUBLIC_API_BASE_URL` is absent.
- Do not change Worker provider routing or add security hardening in this implementation.
- Deterministic compatibility validation remains authoritative and remains the AI failure fallback.
- Do not overwrite the existing local changes in `RetroWindow.jsx`, `kompare95.css`, or `ui.test.jsx`.
- Implement on `development-branch`, verify the Cloudflare preview, then fast-forward the same commit to `main` according to `docs/DEPLOY_PROD_RUNBOOK.md`.

## File Map

| File | Responsibility |
|---|---|
| `frontend/components/shell/DesktopShell.jsx` | Always expose the Settings desktop application. |
| `frontend/tests/unit/desktop-shell.test.jsx` | Verify Settings remains visible in a production build. |
| `frontend/components/builder/BuildWizard.jsx` | Always expose and submit the selected AI profile. |
| `frontend/tests/unit/builder.test.jsx` | Verify production profile visibility and submission behavior. |
| `frontend/lib/api.js` | Forward browser provider overrides in every environment while preserving API fallback. |
| `frontend/tests/unit/api.test.jsx` | Verify all provider headers in production and production API fallback. |
| `docs/PROJECT_STATUS.md` | Record the new production contract and accepted security backlog. |
| `docs/AI_PIPELINE.md` | Remove development-only provider-selection statements. |
| `docs/ARCHITECTURE.md` | Document provider override flow in all deployments. |
| `docs/UI_SPEC.md` | Define Settings and AI Profile as production-visible UI. |
| `docs/AGENTS.md` | Remove the obsolete “optional dev mode” characterization of Local Qwen. |

---

### Task 1: Make Settings Visible in Production

**Files:**
- Create: `frontend/tests/unit/desktop-shell.test.jsx`
- Modify: `frontend/components/shell/DesktopShell.jsx:8-15`

**Interfaces:**
- Consumes: `DesktopShell({ children })` and the existing Zustand window-store contract.
- Produces: A Settings desktop button with accessible name `Settings` in every build environment.

- [ ] **Step 1: Write the failing production-visibility test**

Create `frontend/tests/unit/desktop-shell.test.jsx`:

```jsx
import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, test, vi } from 'vitest';

vi.mock('@/store/useWindowStore', () => ({
  useWindowStore: () => ({
    windows: [],
    activeWindowId: null,
    openWindow: vi.fn(),
    focusWindow: vi.fn(),
    toggleMinimize: vi.fn(),
  }),
}));

describe('DesktopShell', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  test('shows Settings in production builds', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.resetModules();
    const { default: DesktopShell } = await import('@/components/shell/DesktopShell.jsx');

    render(<DesktopShell><div>Desktop content</div></DesktopShell>);

    expect(screen.getByRole('button', { name: 'Settings' })).toBeVisible();
  });
});
```

- [ ] **Step 2: Run the focused test and verify failure**

Run:

```powershell
npm --prefix frontend test -- --run tests/unit/desktop-shell.test.jsx
```

Expected: FAIL because `DesktopShell.jsx` filters `settings` when `NODE_ENV` is `production`.

- [ ] **Step 3: Remove the production filter**

In `frontend/components/shell/DesktopShell.jsx`, replace the filtered declaration with the unfiltered array:

```jsx
const DESKTOP_ICONS = [
  { id: 'builder', label: 'Build PC', icon: <img src="/icons/Computer3_32x32_4.png" alt="Build PC" width="32" height="32" /> },
  { id: 'upgrade', label: 'Upgrade', icon: <img src="/icons/HardwareDiag_32x32_4.png" alt="Upgrade" width="32" height="32" /> },
  { id: 'audit', label: 'Audit', icon: <img src="/icons/ComputerFind_32x32_4.png" alt="Audit" width="32" height="32" /> },
  { id: 'settings', label: 'Settings', icon: <img src="/icons/Folder_32x32_4.png" alt="Settings" width="32" height="32" /> },
  { id: 'marketplace', label: 'Marketplace', icon: <img src="/icons/Explorer100_32x32_4.png" alt="Marketplace" width="32" height="32" /> },
  { id: 'readme', label: 'Readme', icon: <img src="/icons/HelpBook_32x32_4.png" alt="Readme" width="32" height="32" /> },
];
```

- [ ] **Step 4: Run the focused test and verify success**

Run:

```powershell
npm --prefix frontend test -- --run tests/unit/desktop-shell.test.jsx
```

Expected: 1 test file passed; Settings is visible with `NODE_ENV=production`.

- [ ] **Step 5: Commit the isolated Settings change**

```powershell
git add frontend/components/shell/DesktopShell.jsx frontend/tests/unit/desktop-shell.test.jsx
git commit -m "feat(shell): expose Settings in all deployments"
```

---

### Task 2: Keep AI Profiles Selectable in Production

**Files:**
- Modify: `frontend/components/builder/BuildWizard.jsx:33-40,313-320,619-627`
- Modify: `frontend/tests/unit/builder.test.jsx:66-92`

**Interfaces:**
- Consumes: `aiProfile` state with values `gemini_free | local_qwen`.
- Produces: `api.recommendAiBuild({ aiProfile, ... })` with the exact selected profile in every environment.

- [ ] **Step 1: Replace the obsolete production test with a failing unified-contract test**

In `frontend/tests/unit/builder.test.jsx`, replace `hides provider selection and submits Gemini in production` with:

```jsx
test('shows and submits the selected AI profile in production', async () => {
  vi.stubEnv('NODE_ENV', 'production');
  api.recommendAiBuild.mockResolvedValue({
    budget_idr: 20_000_000,
    total_idr: 0,
    components: {},
  });

  render(<BuildWizard />);

  const profile = screen.getByLabelText('AI profile');
  expect(profile).toBeVisible();
  await userEvent.selectOptions(profile, 'local_qwen');
  await userEvent.type(screen.getByLabelText('Budget (IDR)'), '20000000');
  await userEvent.click(screen.getByRole('button', { name: 'Generate build' }));

  expect(api.recommendAiBuild).toHaveBeenCalledWith(expect.objectContaining({
    aiProfile: 'local_qwen',
  }));
});
```

- [ ] **Step 2: Run the focused test and verify failure**

Run:

```powershell
npm --prefix frontend test -- --run tests/unit/builder.test.jsx
```

Expected: FAIL because the profile select is absent in production and production forces `gemini_free`.

- [ ] **Step 3: Remove the environment-based profile branches**

In `frontend/components/builder/BuildWizard.jsx`:

1. Delete:

```jsx
function isProductionEnvironment() {
  return process.env.NODE_ENV === 'production';
}
```

2. Set the payload profile directly from state:

```jsx
aiProfile: aiAssisted ? aiProfile : undefined,
```

3. Render the selector whenever AI-assisted mode is active:

```jsx
{recommendationMode === 'ai' && (
  <RetroSelect
    label="AI profile"
    name="ai-profile"
    options={AI_PROFILE_OPTIONS}
    value={aiProfile}
    onChange={(event) => setAiProfile(event.target.value)}
  />
)}
```

- [ ] **Step 4: Run builder tests and verify success**

Run:

```powershell
npm --prefix frontend test -- --run tests/unit/builder.test.jsx
```

Expected: all builder tests pass, including production submission of `local_qwen`.

- [ ] **Step 5: Commit the profile behavior**

```powershell
git add frontend/components/builder/BuildWizard.jsx frontend/tests/unit/builder.test.jsx
git commit -m "feat(builder): expose AI profiles in all deployments"
```

---

### Task 3: Forward Browser Provider Overrides in Production

**Files:**
- Modify: `frontend/lib/api.js:1-4,55-78`
- Modify: `frontend/tests/unit/api.test.jsx:94-122`

**Interfaces:**
- Consumes local-storage keys: `kompare_user_gemini_key`, `kompare_user_lmstudio_url`, `kompare_user_qdrant_url`, `kompare_user_qdrant_key`.
- Produces request headers: `X-Gemini-Api-Key`, `X-LMStudio-Base-Url`, `X-Qdrant-Url`, `X-Qdrant-Api-Key`.
- Preserves: production API fallback at `https://kompare-backend-api.muttaqien0111.workers.dev/api`.

- [ ] **Step 1: Replace the production suppression test with a failing forwarding test**

In `frontend/tests/unit/api.test.jsx`, replace `ignores browser provider overrides in production` with:

```jsx
test('forwards browser provider overrides in production', async () => {
  const values = new Map([
    ['kompare_user_gemini_key', 'browser-gemini-key'],
    ['kompare_user_lmstudio_url', 'https://local-model.example'],
    ['kompare_user_qdrant_url', 'https://vector.example'],
    ['kompare_user_qdrant_key', 'browser-vector-key'],
  ]);
  vi.stubGlobal('localStorage', {
    getItem: (key) => values.get(key) || null,
  });
  vi.stubEnv('NODE_ENV', 'production');

  try {
    await api.health();

    expect(fetch).toHaveBeenCalledWith('/api/health', expect.objectContaining({
      headers: expect.objectContaining({
        'X-Gemini-Api-Key': 'browser-gemini-key',
        'X-LMStudio-Base-Url': 'https://local-model.example',
        'X-Qdrant-Url': 'https://vector.example',
        'X-Qdrant-Api-Key': 'browser-vector-key',
      }),
    }));
  } finally {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  }
});
```

- [ ] **Step 2: Run API tests and verify failure**

Run:

```powershell
npm --prefix frontend test -- --run tests/unit/api.test.jsx
```

Expected: FAIL because `allowBrowserProviderOverrides` is false in production.

- [ ] **Step 3: Remove only the override gate**

In `frontend/lib/api.js`, keep lines 1-4 unchanged, including:

```js
const apiBase = configuredBase || (process.env.NODE_ENV === 'production' ? productionFallback : '');
```

Replace the gated local-storage reads in `request()` with:

```js
const canReadLocalStorage = typeof window !== 'undefined'
  && typeof localStorage !== 'undefined'
  && typeof localStorage.getItem === 'function';

const userKey = canReadLocalStorage
  ? localStorage.getItem('kompare_user_gemini_key')
  : null;
const userLMStudioUrl = canReadLocalStorage
  ? localStorage.getItem('kompare_user_lmstudio_url')
  : null;
const userQdrantUrl = canReadLocalStorage
  ? localStorage.getItem('kompare_user_qdrant_url')
  : null;
const userQdrantKey = canReadLocalStorage
  ? localStorage.getItem('kompare_user_qdrant_key')
  : null;
```

Keep the existing `extraHeaders` mapping unchanged.

- [ ] **Step 4: Run API tests and verify both override and fallback contracts**

Run:

```powershell
npm --prefix frontend test -- --run tests/unit/api.test.jsx
```

Expected: all API tests pass, including:

- `forwards browser provider overrides in production`
- `uses the production Worker when exporting the frontend without an API env var`

- [ ] **Step 5: Commit the API client behavior**

```powershell
git add frontend/lib/api.js frontend/tests/unit/api.test.jsx
git commit -m "feat(api): enable browser provider overrides in production"
```

---

### Task 4: Synchronize Product and Security Documentation

**Files:**
- Modify: `docs/PROJECT_STATUS.md:55-65,68-106,121-126`
- Modify: `docs/AI_PIPELINE.md:19,187-192,227,298,357,412-413`
- Modify: `docs/ARCHITECTURE.md:32,71,337`
- Modify: `docs/UI_SPEC.md:214-216`
- Modify: `docs/AGENTS.md:68`
- Reference: `docs/specs/2026-07-26-unified-ai-provider-settings.md`

**Interfaces:**
- Consumes: the implemented unified provider contract from Tasks 1-3.
- Produces: one consistent documented contract and an explicit, unresolved security-hardening backlog.

- [ ] **Step 1: Update the active AI provider contract in PROJECT_STATUS**

Make these semantic replacements in `docs/PROJECT_STATUS.md`:

```markdown
| Positioning | AI-assisted adalah default user path; `gemini_free` adalah profile default, sementara `local_qwen` dapat dipilih pengguna. Deterministic validation tetap authority dan safety fallback. |
| Production UI | Settings dan provider selector tersedia di local, preview, dan production. Browser dapat mengirim Gemini BYOK, LM Studio, dan custom Qdrant overrides. |
```

Replace the obsolete release evidence row with:

```markdown
| Production provider contract | Settings, `gemini_free`, `local_qwen`, dan browser provider override headers tersedia di semua deployment; security hardening masih backlog. |
```

Add this row to the Post-MVP Backlog table:

```markdown
| Provider override security hardening | Security review | **Belum dikerjakan:** validasi/allowlist URL LM Studio dan Qdrant, mitigasi SSRF, larangan memasangkan custom Qdrant URL dengan secret server, secret-safe logging, rate limiting, dan abuse controls. |
```

Add provider override security hardening to the priority list before Local Qwen latency polish. Do not mark any security item complete.

- [ ] **Step 2: Remove development-only claims from supporting docs**

Apply these exact contract changes:

- `docs/AI_PIPELINE.md`: state that the AI Profile selector, Gemini BYOK, LM Studio, and custom Qdrant overrides are available in all deployments; keep `gemini_free` as the default.
- `docs/ARCHITECTURE.md`: change “Development-only provider override headers” to “Browser provider override headers” and describe forwarding in all environments.
- `docs/UI_SPEC.md`: specify that AI-assisted mode always exposes the profile selector and defaults to `gemini_free`.
- `docs/AGENTS.md`: replace “Local Qwen through LM Studio (optional dev mode)” with “Local Qwen through user-configured LM Studio”.

Do not alter the deterministic compatibility authority or production Worker fallback statements.

- [ ] **Step 3: Search for stale production-only statements**

Run:

```powershell
git grep -n -E "development-only provider|hides provider|hide provider|Provider selector disembunyikan|optional dev mode|do not inject provider override" -- docs
```

Expected: no stale statement describing Settings, AI Profile, or override headers as development-only. Historical text may remain only if explicitly labelled historical.

- [ ] **Step 4: Verify documentation whitespace**

Run:

```powershell
git diff --check -- docs
```

Expected: exit code 0 with no whitespace errors in documentation changed by this task.

- [ ] **Step 5: Commit documentation separately**

```powershell
git add docs/PROJECT_STATUS.md docs/AI_PIPELINE.md docs/ARCHITECTURE.md docs/UI_SPEC.md docs/AGENTS.md docs/specs/2026-07-26-unified-ai-provider-settings.md docs/plans/2026-07-26-unified-ai-provider-settings.md
git commit -m "docs: record unified AI provider contract and risks"
```

Do not include unrelated `docs/DEPLOY_PROD_RUNBOOK.md` changes in this commit unless they have been reviewed and intentionally approved as part of a separate commit.

---

### Task 5: Full Verification and Preview Release

**Files:**
- Verify all files changed in Tasks 1-4.
- Do not modify or stage `frontend/components/shell/RetroWindow.jsx`, `frontend/styles/kompare95.css`, or `frontend/tests/unit/ui.test.jsx` as part of this feature.

**Interfaces:**
- Consumes: unified Settings/profile/header behavior.
- Produces: a verified `development-branch` commit suitable for Cloudflare Preview and later fast-forward promotion to `main`.

- [ ] **Step 1: Verify the intended diff and preserve unrelated work**

Run:

```powershell
git status --short --untracked-files=all
git diff -- frontend/components/shell/DesktopShell.jsx frontend/components/builder/BuildWizard.jsx frontend/lib/api.js
git diff -- frontend/tests/unit/desktop-shell.test.jsx frontend/tests/unit/builder.test.jsx frontend/tests/unit/api.test.jsx
git diff -- docs/PROJECT_STATUS.md docs/AI_PIPELINE.md docs/ARCHITECTURE.md docs/UI_SPEC.md docs/AGENTS.md
```

Expected: feature changes match this plan; existing RetroWindow/CSS/UI-test work remains present but unstaged unless handled separately.

- [ ] **Step 2: Run the complete frontend unit suite**

Run:

```powershell
npm --prefix frontend test -- --run
```

Expected: all test files pass with zero failed tests.

- [ ] **Step 3: Run the production static build**

Run:

```powershell
npm --prefix frontend run build
```

Expected: Next.js compiles successfully and exports `/`, `/builder`, `/upgrade`, and `/audit` to `frontend/out/`. The known static-export rewrites warning is acceptable; compile or export errors are not.

- [ ] **Step 4: Check whitespace and final branch state**

Run:

```powershell
git diff --check
git status --short --branch
git log --oneline -10
```

Expected: no whitespace errors in feature-owned files and all intended commits are on `development-branch`.

- [ ] **Step 5: Push preview after explicit approval**

```powershell
git push origin development-branch
npx wrangler pages deployment list --project-name kompare
```

Expected: a new Preview deployment for the feature commit. Verify Settings is visible, both AI profiles are selectable, and the selected profile is used before promoting to `main` through the runbook.
