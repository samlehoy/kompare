# Kompare — Project Status

> **Single source of truth** untuk *status & progress*.
> Untuk *scope, goals, requirements* → [PRODUCT.md](PRODUCT.md). Untuk *system design & API* → [ARCHITECTURE.md](ARCHITECTURE.md). Indeks lengkap → [README.md](README.md).

Last updated: 2026-07-25

---

## 1. Goal Singkat

Kompare adalah **PC Builder** untuk pasar PC Indonesia — bantu user **build dari nol**, **upgrade PC lama**, dan **audit build** dengan cek kompatibilitas deterministik, panduan budget-to-performance, dan link marketplace (EnterKomputer).

**Prinsip inti:** cek kompatibilitas deterministik = sumber kebenaran final. AI hanya me-ranking/menjelaskan, tidak pernah mengarang SKU/harga.

---

## 2. Status Ringkas

| Area | Status |
|---|---|
| MVP Core (build / upgrade / audit / advisor / swap) | ✅ **Selesai dan production verified** |
| AI `POST /build/ai-recommend` | ✅ **Primary Builder path, production verified** |
| Production release | ✅ **AI-primary release `main@2374d86` aktif dan production verified** |
| Frontend health (React Doctor) | 🟡 76/100 — lihat [`frontend/REACT_DOCTOR_BACKLOG.md`](../frontend/REACT_DOCTOR_BACKLOG.md) |
| Backlog & out-of-scope | Lihat bagian 6 & 7 |

---

## 3. MVP Core — Selesai

Semua flow inti terimplementasi di codebase (bukan hanya docs).

| Fitur | Endpoint | Frontend | Status |
|---|---|---|---|
| Build from zero (9 slot) | `POST /api/build/recommend` | `BuildWizard.jsx` | ✅ |
| Upgrade existing PC | `POST /api/build/upgrade` | `UpgradePlanner.jsx` | ✅ |
| Audit build (screenshot + text) | `POST /api/build/audit` | `BuildAudit.jsx` | ✅ |
| PC Build Advisor | `POST /api/build/advisor` | `AdvisorConsole.jsx` | ✅ |
| Swap komponen | `POST /api/build/swap`, `/swap-candidates` | `SwapModal.jsx` | ✅ |
| Budget tiers / use-cases | `GET /api/build/budget-tiers`, `/use-cases` | landing | ✅ |
| EnterKomputer links + optional HDD/Monitor/UPS | `composeBuild` (`pc-builder-core.js`) | `BuildResults.jsx` | ✅ |

**9 required slots:** CPU, Motherboard, RAM, GPU, SSD, PSU, CPU Cooler, Fan Cooler, Casing.
**Optional add-ons:** HDD, Monitor, UPS.

---

## 4. AI `POST /build/ai-recommend` — Primary Builder Path

Terimplementasi penuh: route `index.js:132` → `handleAiRecommend` (`ai-recommend.js`), FE `recommendAiBuild` + mode selector di `BuildWizard.jsx`.

**Pipeline:** baseline deterministic → embed (Workers AI `bge-m3`) → Qdrant retrieval → inject baseline → soft brand/vendor filter → platform-compat filter → Gemini/LM Studio rank → repair socket/RAM/budget → `validateBuild` → fallback deterministic bila gagal.

**Catatan status:**

| Hal | Status |
|---|---|
| Live smoke Worker production | ✅ Gemini `ai_assisted: true`, `fallback: false`, `json_ranker`, 9 slot, 0 compatibility issues |
| Browser AI success | ✅ Marker `AI-assisted` tampil pada hasil production nyata |
| Browser safe fallback | ✅ Marker `Gemini quota fallback` tampil; hasil deterministik tetap 9 slot |
| Docs vs code | ✅ Production embedding/provider facts synchronized with Worker runtime |
| Positioning | AI-assisted adalah default user path; `gemini_free` adalah profile default, sementara `local_qwen` dapat dipilih pengguna. Deterministic validation tetap authority dan safety fallback. |
| Production UI | Settings dan provider selector tersedia di local, preview, dan production. Browser dapat mengirim Gemini BYOK, LM Studio, dan custom Qdrant overrides. |

---

## 5. Release Aktif — AI-Primary

| Item | Nilai terverifikasi |
|---|---|
| Release commit | `2374d8671666ce0bf21fefce2301a4f91ba9f8b1` (`2374d86`) |
| Remote branches | `origin/main` dan `origin/development-branch` menunjuk ke SHA yang sama |
| Pages deployment | `9986d4cf-7f12-4c3e-b9cc-59c785fcfc86` — `https://9986d4cf.kompare.pages.dev` |
| Primary frontend | `https://kompare.pages.dev` |
| Worker version | `6c548266-285d-4ca9-b09f-8724eaa5884c` |
| Worker health | ✅ `status: ok`, 6.476 komponen dimuat |
| Frontend unit tests | ✅ 48/48 |
| Browser tests | ✅ 26/26 (serial Playwright run) |
| Production build | ✅ Next.js static export berhasil |
| Production routes | ✅ `/`, `/builder`, `/upgrade`, `/audit` HTTP 200 |
| Real Gemini smoke | ✅ `ai_assisted: true`, `fallback: false`, `json_ranker`, `@cf/baai/bge-m3`, 9 slot, 0 compatibility issues |
| Safe fallback acceptance | ✅ `Gemini quota fallback` tampil dan 9 slot tetap tersedia |
| Upgrade acceptance | ✅ Form budget/CPU/GPU aktif; endpoint production menghasilkan upgrade priorities |
| Production provider contract | Settings, `gemini_free`, `local_qwen`, dan browser provider override headers tersedia di semua deployment; security hardening masih backlog. |
| Native Git Pages build | ✅ Preview `a6ea7b88` + production `433bdd7b` sukses via Git build (Node 22.22.0 dari `frontend/.node-version`) |

Native Git-based Pages deployment pulih per rilis `b393694`. Root cause
kegagalan historis bukan konflik dependency, melainkan (1) build config usang
(`npx @cloudflare/next-on-pages@1`, output `.vercel/output/static`) dan
(2) budget Git LFS GitHub habis karena `data/vector_index/` (~400 MB) ikut
ter-clone setiap build. Perbaikan: build config dashboard dikoreksi
(`npm run build`, output `out`, root `frontend`), artefak vector index lokal
di-untrack dari git, dan Node dipin via `frontend/.node-version`. Direct
static upload `frontend/out` kini hanya emergency fallback.

---

## 6. Post-MVP Backlog / Belum Digarap

| Item | Sumber | Catatan |
|---|---|---|
| `POST /build/ai-upgrade` | PRODUCT, AI_PIPELINE | **Belum di `backend_worker`**; fitur tambahan setelah build-from-zero stabil. |
| Provider override security hardening | Security review | **Belum dikerjakan:** validasi/allowlist URL LM Studio dan Qdrant, mitigasi SSRF, larangan memasangkan custom Qdrant URL dengan secret server, secret-safe logging, rate limiting, dan abuse controls. |
| Local Qwen latency polish | AI_PIPELINE appendix | ~55s; timeout/progress copy masih open. |
| Frontend health backlog (15 issue) | React Doctor | `missing deps`, `plain <img>`, `state-in-handlers`, giant component. |
| n8n operations automation | Product decision | Plan only: scheduled catalog jobs, validation, KV/Qdrant sync, alerts, smoke tests, reports, and approval gates. Never place n8n in the user request path. |

---

## 7. Out-of-Scope (Bukan Goal Sekarang)

| Item | Sumber | Catatan |
|---|---|---|
| Shopee / Tokopedia links | AGENTS, PRD, UI_SPEC | **Future** marketplace target, bukan flow sekarang. Muncul sebagai link per-komponen tambahan nanti, bukan primary flow. |
| Checkout / accounts / inventory / order | PRD Non-Goals | **Bukan** product goal. |
| Generic laptop/desktop/gadget/electronics recommendation | PRD Non-Goals | PC Builder-only. |
| Generic catalog browse / compare / image identify / broad chat | PRD, UI_SPEC | Route lama yang tidak boleh dihidupkan kembali. |

---

## 8. Prioritas Berikutnya (Usulan)

1. Susun implementation plan **n8n operations automation** untuk scheduled catalog update, validation, KV/Qdrant sync, health/smoke alerts, reports, dan approval gate.
2. Design `POST /build/ai-upgrade` sebagai ekspansi produk berikutnya; jangan mengubah deterministic compatibility authority.
3. Kerjakan **provider override security hardening**: validasi/allowlist URL LM Studio dan Qdrant, mitigasi SSRF, pemisahan custom Qdrant URL dari secret server, secret-safe logging, rate limiting, dan abuse controls.
4. Bereskan sisa **React Doctor backlog** (medium/low).
5. Optimasi latency **Local Qwen** bila local profile tetap dipertahankan.
