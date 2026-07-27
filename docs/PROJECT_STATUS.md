# Kompare — Project Status

> **Single source of truth** untuk *status & progress*.
> Untuk *scope, goals, requirements* → [PRODUCT.md](PRODUCT.md). Untuk *system design & API* → [ARCHITECTURE.md](ARCHITECTURE.md). Indeks lengkap → [README.md](README.md).

Last updated: 2026-07-26

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
| Production release | ✅ **AI-primary release aktif dan production verified** — lihat bagian 5 |
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

> **Tidak ada SHA, ID deployment, atau jumlah test di tabel ini.** Semua angka
> itu basi pada commit yang menuliskannya — kita sudah membuktikannya. Yang
> tercatat adalah *apa yang harus benar* plus perintah untuk memeriksanya.

| Item | Cara memastikan |
|---|---|
| Frontend & Worker sinkron dengan `main` | `git rev-parse origin/main origin/development-branch` — harus sama |
| Pages deployment aktif | `npx wrangler pages deployment list --project-name kompare` |
| Primary frontend | `https://kompare.pages.dev` |
| Versi Worker aktif | `npx wrangler versions list --cwd backend_worker` |
| Build yang sedang live | Terlihat di taskbar kanan bawah aplikasi (`v<versi> <commit>`) |
| Worker health | `Invoke-RestMethod .../api/health` → `status: ok`, catalog count bukan nol |
| Frontend unit tests | ✅ seluruh suite lulus (`npm --prefix frontend test -- --run`) |
| Browser tests | ✅ seluruh suite lulus (`npm --prefix frontend run test:ui`) |
| Production build | ✅ Next.js static export berhasil |
| Production routes | ✅ `/`, `/app`, `/builder`, `/upgrade`, `/audit` HTTP 200 |
| Real Gemini smoke | ✅ `ai_assisted: true`, `fallback: false`, `json_ranker`, `@cf/baai/bge-m3`, 9 slot, 0 compatibility issues |
| Safe fallback acceptance | ✅ `Gemini quota fallback` tampil dan 9 slot tetap tersedia |
| Upgrade acceptance | ✅ Form budget/CPU/GPU aktif; endpoint production menghasilkan upgrade priorities |
| Production provider contract | Settings, `gemini_free`, `local_qwen`, dan browser provider override headers tersedia di semua deployment; security hardening masih backlog. |
| Native Git Pages build | ✅ Preview dan production sukses via Git build (Node 22 dari `frontend/.node-version`) |

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
| Provider override security hardening | Security review 2026-07-26 | **Sebagian dikerjakan.** ✅ Selesai: secret Qdrant server tidak lagi dikirim ke endpoint yang ditentukan pemanggil — URL Qdrant custom wajib membawa kunci sendiri. **Masih accepted risk:** provider credentials di `localStorage` terekspos bila frontend mengalami XSS; URL LM Studio dan Qdrant yang dikontrol user dapat memicu SSRF; belum ada validasi URL, pembatasan protocol/host, request limits, secret-safe logging, atau rate/abuse controls. Sisa risiko diterima sementara demi Gemini BYOK dan Local Qwen/LM Studio. |
| Admin endpoint auth (`seed-qdrant`, `embed`) | Security review 2026-07-26 | **Belum dikerjakan.** `ai-recommend.js:1218` dan `:1314` memakai `env.GEMINI_API_KEY` sebagai token admin dan menerimanya lewat query string `?token=`, sehingga secret masuk ke URL dan log. Bila `GEMINI_API_KEY` tidak diset, token jatuh ke literal `"kompare-admin-token"` yang tertulis di kode — siapa pun bisa menulis ulang index vektor production. Butuh secret admin terpisah, dikirim lewat header, tanpa fallback literal. |
| `clean-data.mjs` hilang | Audit docs 2026-07-26 | **Belum dikerjakan.** Langkah pertama pipeline kualitas data (IQR outlier detection) didokumentasikan di [ARCHITECTURE.md](ARCHITECTURE.md) tapi script-nya tidak pernah ada di repo. Efeknya sudah menempel: 57 komponen bertanda `price_outlier` di `data/components.json`. Reseed dari CSV akan menghapus tanda itu tanpa cara membuatnya kembali. Perlu ditulis ulang atau tandanya dipindah ke sumber yang bisa direproduksi. |
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
3. Amankan **admin endpoint** `seed-qdrant` dan `embed`: secret admin terpisah dari `GEMINI_API_KEY`, dikirim lewat header bukan query string, dan hapus fallback token literal.
4. Lanjutkan **provider override security hardening**: validasi/allowlist URL LM Studio dan Qdrant, mitigasi SSRF, secret-safe logging, rate limiting, dan abuse controls. Pemisahan custom Qdrant URL dari secret server sudah selesai.
5. Bereskan sisa **React Doctor backlog** (medium/low).
6. Optimasi latency **Local Qwen** bila local profile tetap dipertahankan.
