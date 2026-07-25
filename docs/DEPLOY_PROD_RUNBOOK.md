# Kompare Production Deployment Runbook

> Repeatable release procedure for the Cloudflare Pages frontend and standalone
> Cloudflare Worker backend. Architecture details live in
> [ARCHITECTURE.md](ARCHITECTURE.md); current release status lives in
> [PROJECT_STATUS.md](PROJECT_STATUS.md).

## 1. Production Targets

| Service | Target |
|---|---|
| Frontend | `https://kompare.pages.dev` |
| Pages project | `kompare` |
| Production branch | `main` |
| Backend Worker | `https://kompare-backend-api.muttaqien0111.workers.dev` |

The frontend is a Next.js static export from `frontend/out/`. The backend is
deployed independently from `backend_worker/`.

## 2. Secret Safety

- Keep local Worker secrets in the gitignored `.dev.vars` file or local environment variables.
- Set production secrets interactively with `wrangler secret put` from `backend_worker/`.
- Never commit `.env`, `.dev.vars`, API keys, tokens, credential files, or secret values in documentation.
- Confirm `git status --short --untracked-files=all` contains only intended release files before staging.

## 3. Pre-Release Checks

Run from the repository root unless a different directory is shown:

```powershell
git status --short --branch
git diff --check
git log --oneline -10
npm --prefix frontend test -- --run
npm --prefix frontend run build
```

For frontend workflow changes, also run:

```powershell
npm --prefix frontend run test:ui
```

Confirm the production Worker is healthy:

```powershell
Invoke-RestMethod -Uri "https://kompare-backend-api.muttaqien0111.workers.dev/api/health"
```

Expected health evidence includes `status: ok` and a non-zero `components_loaded` count.

## 4. Promote Development to Main

Release work starts on `development-branch`. Keep promotion linear so both
remote branches identify the same release commit.

```powershell
git switch development-branch
git push origin development-branch
git fetch origin
git merge-base --is-ancestor origin/main development-branch
git switch main
git merge --ff-only origin/main
git merge --ff-only development-branch
git push origin main
git fetch origin
git rev-parse origin/development-branch
git rev-parse origin/main
```

Stop if the ancestry check or either merge fails. Inspect branch divergence
instead of creating an unplanned merge commit or force-pushing. The final two
`rev-parse` commands must print the same SHA.

## 5. Deploy the Frontend

Git-based Cloudflare Pages builds currently fail during dependency resolution
with npm `ERESOLVE`. Until that operational debt is fixed, a failed automatic
build does not block release when the direct production deployment and all
acceptance checks pass.

Build from the promoted `main` commit, then deploy the static export directly:

```powershell
npm --prefix frontend run build
npx wrangler pages deploy frontend/out --project-name kompare --branch main
npx wrangler pages deployment list --project-name kompare
```

Record the deployment ID, immutable deployment URL, branch, and source commit
in [PROJECT_STATUS.md](PROJECT_STATUS.md). Verify that the newest successful
production deployment corresponds to the release commit.

## 6. Deploy the Worker

Deploy the Worker only when `backend_worker/`, Worker configuration, bindings,
or runtime catalog behavior changed. A frontend-only release does not require a
Worker deployment.

```powershell
npx wrangler deploy --cwd backend_worker
```

After deployment, run the health check and affected endpoint smoke tests. Do
not print secret values while diagnosing failures.

## 7. Production Acceptance

Verify both the immutable deployment URL and `https://kompare.pages.dev`.

- `/`, `/builder`, `/upgrade`, and `/audit` return HTTP 200.
- Builder defaults to AI-assisted recommendations using `gemini_free`.
- A successful AI result displays `AI-assisted`, contains all nine required slots, and reports no hard compatibility issues.
- The Playwright acceptance route interception simulates an AI failure without changing production secrets; it must return a deterministic nine-slot build and display the fallback marker.
- Manual Fast compatibility mode remains functional.
- Upgrade, audit, advisor, and component swap flows return valid results.
- EnterKomputer links and selected optional add-ons render correctly.
- The Worker health endpoint remains healthy with a non-zero catalog count.

Functional contract failures block release. Record known non-functional debt,
such as the failed Git-based Pages build, separately.

## 8. Rollback

### Frontend

Use the Cloudflare Pages dashboard to roll back to the most recent verified
production deployment, or redeploy a known-good static export from its commit:

```powershell
git switch --detach <known-good-commit>
npm --prefix frontend run build
npx wrangler pages deploy frontend/out --project-name kompare --branch main
```

Return to a branch after the emergency deployment. Do not rewrite branch
history or force-push as part of rollback.

### Worker

List Worker versions and roll back to a known-good version:

```powershell
npx wrangler versions list --cwd backend_worker
npx wrangler rollback <version-id> --cwd backend_worker
```

Run health and affected endpoint checks immediately after rollback.

## 9. Troubleshooting

### Git-Based Pages Build Fails with `ERESOLVE`

1. Confirm the local lockfile and install state have not changed unexpectedly.
2. Preserve the failed deployment as evidence; do not add broad permanent dependency-bypass flags without reviewing the conflict.
3. Build `frontend/out/` from the promoted `main` commit.
4. Direct-deploy the static export and run the full acceptance checklist.
5. Track dependency resolution and restoration of Git-based deployment as post-release operational work.

### Direct Pages Deployment Fails

1. Run `npx wrangler --version` and require Wrangler v4 or newer.
2. Run `npx wrangler whoami` without exposing credentials.
3. Confirm `frontend/out/` exists from a fresh successful build.
4. Confirm the Pages project is `kompare` and the target branch is `main`.
5. Do not delete successful deployments while investigating.

### Production Calls the Wrong API

1. Inspect generated JavaScript for the production Worker hostname.
2. Confirm `NEXT_PUBLIC_API_BASE_URL` if the Pages build uses an environment override.
3. Verify the fallback in `frontend/lib/api.js` still targets the production Worker.
4. Rebuild and redeploy; environment changes do not modify an existing static export.
