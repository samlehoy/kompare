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

### Current Verified Release

Values below are mirrored from [PROJECT_STATUS.md](PROJECT_STATUS.md), which is
the source of truth for release status. Update both together or this table goes
stale.

Do not record the Pages deployment UUID here. Every push to `main` — including a
push that only edits this file — mints a new one, so any UUID written down is
stale before it is read. Query the live value instead:

```powershell
npx wrangler pages deployment list --project-name kompare
```

| Item | Value |
|---|---|
| Frontend source last changed at | `a21223f` |
| Worker source commit | `5af9c2b` |
| Worker version | `663864f9-ce55-4620-853a-a31ad5ed7878` |

The release passed 51 frontend unit tests, static export, Worker health, and a
real Gemini AI recommendation returning `ai_assisted: true` with nine slots and
zero compatibility issues. See [PROJECT_STATUS.md](PROJECT_STATUS.md) for the
complete evidence table.

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

## 4. Branch Workflow

Gunakan aturan sederhana berikut:

| Situasi | Branch | Efek push |
|---|---|---|
| Development dan testing normal | `development-branch` | Cloudflare Pages preview |
| Release yang sudah lolos preview | `main` | Cloudflare Pages production |
| Hotfix production yang mendesak | `main` | Cloudflare Pages production |

`main` selalu merepresentasikan production. `development-branch` adalah tempat
testing sebelum release. Pull Request tidak wajib untuk workflow solo; gunakan
PR untuk perubahan besar, berisiko, atau ketika perlu review tambahan.

### Release Normal

1. Kerjakan perubahan di `development-branch`.
2. Jalankan test dan build lokal.
3. Push ke `development-branch`.
4. Tunggu preview selesai dan cek URL preview.
5. Jika preview valid, fast-forward `main` ke commit yang sama.
6. Push `main` untuk memulai production deployment.
7. Cek URL production dan health Worker.
8. Pastikan `development-branch` kembali sinkron dengan `main`.

```powershell
# 1. Push perubahan ke preview
git switch development-branch
git pull --ff-only origin development-branch
git add <file-yang-diubah>
git commit -m "feat: deskripsi perubahan"
git push origin development-branch

# 2. Setelah preview berhasil, promote commit yang sama ke production
git fetch origin
git switch main
git pull --ff-only origin main
git merge --ff-only development-branch
git push origin main

# 3. Pastikan kedua branch identik setelah release
git fetch origin
git switch development-branch
git merge --ff-only origin/main
git push origin development-branch
git rev-parse origin/development-branch
git rev-parse origin/main
```

Dua perintah `git rev-parse` terakhir harus menghasilkan SHA yang sama. Jika
`git merge --ff-only` gagal, branch telah menyimpang. Berhenti, periksa
perbedaannya, dan jangan membuat merge commit atau force-push tanpa keputusan
eksplisit.

### Hotfix Production

Untuk hotfix yang benar-benar mendesak, perubahan boleh dibuat langsung di
`main`:

```powershell
git switch main
git pull --ff-only origin main
git add <file-yang-diubah>
git commit -m "fix: deskripsi hotfix"
git push origin main
```

Setelah production terverifikasi, sinkronkan hotfix ke development:

```powershell
git fetch origin
git switch development-branch
git merge --ff-only origin/main
git push origin development-branch
```

Jangan memulai pekerjaan development baru sebelum sinkronisasi ini selesai.

## 5. Deploy the Frontend

### Native Git Build Configuration

Cloudflare Pages dashboard is the source of truth for the Git-integrated build:

| Setting | Value |
|---|---|
| Git repository | `samlehoy/kompare` |
| Production branch | `main` |
| Root directory | `frontend` |
| Build command | `npm run build` |
| Build output directory | `out` |
| Node version | `22` via `NODE_VERSION=22` and `frontend/.node-version` |

The install step must resolve `frontend/package-lock.json` with `npm ci` or the
Pages build system's equivalent clean lockfile install. Do not use
`--legacy-peer-deps`; the repository dependency graph passes `npm ci` without
it. Branches other than `main`, especially `development-branch`, are preview
deployments.

Normal release flow is documented in [Branch Workflow](#4-branch-workflow):
preview first on `development-branch`, then fast-forward the verified commit to
`main` for production. A push to `main` is the production release action.

If a native build fails, capture the complete build log, effective root/build
settings, Node/npm versions, and source commit before changing dependencies.
Do not add a root package wrapper or dependency bypass while the frontend
lockfile installs cleanly.

### Emergency Direct Upload

Build from the promoted `main` commit, then deploy the static export directly:

```powershell
npm --prefix frontend run build
npx wrangler pages deploy frontend/out --project-name kompare --branch main
npx wrangler pages deployment list --project-name kompare
```

Record emergency deployment details in [PROJECT_STATUS.md](PROJECT_STATUS.md)
and explain why native Git deployment could not be used. Verify the deployment
corresponds to the intended source commit.

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

Functional contract failures block release. Record known non-functional debt
separately; a successful native Git Pages build is required for a normal release.

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

### Git-Based Pages Build Fails

1. Confirm Pages uses root directory `frontend`, Node 22, build command `npm run build`, and output `out`.
2. Run `npm --prefix frontend ci` locally and preserve the complete remote failure log.
3. Check whether the failure occurs during clone, install, build, or deploy.
4. For a clone failure, check Git LFS usage. Do not commit generated `data/vector_index/` artifacts.
5. Do not add `--legacy-peer-deps`, a root `package.json`, or a wrapper script unless the same lockfile fails locally with the same error.
6. If production recovery is urgent, direct-deploy `frontend/out`, run the full acceptance checklist, and record the emergency deployment.

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
