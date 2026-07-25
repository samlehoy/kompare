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
| AI `POST /build/ai-recommend` | ✅ **Selesai (experimental), production verified** |
| Production release | ✅ Pages `main@c3cacd5` + Worker sehat; browser smoke dan AI acceptance lulus |
| Frontend health (React Doctor) | 🟡 76/100 — lihat [`frontend/REACT_DOCTOR_BACKLOG.md`](../frontend/REACT_DOCTOR_BACKLOG.md) |
| Backlog & out-of-scope | Lihat bagian 4 & 5 |

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

## 4. AI `POST /build/ai-recommend` — Selesai (experimental)

Terimplementasi penuh: route `index.js:132` → `handleAiRecommend` (`ai-recommend.js`), FE `recommendAiBuild` + mode selector di `BuildWizard.jsx`.

**Pipeline:** baseline deterministic → embed (Workers AI `bge-m3`) → Qdrant retrieval → inject baseline → soft brand/vendor filter → platform-compat filter → Gemini/LM Studio rank → repair socket/RAM/budget → `validateBuild` → fallback deterministic bila gagal.

**Catatan status:**

| Hal | Status |
|---|---|
| Live smoke Worker production | ✅ Gemini `ai_assisted: true`, `fallback: false`, `json_ranker`, 9 slot, 0 compatibility issues |
| Browser AI success | ✅ Marker `AI-assisted` tampil pada hasil production nyata |
| Browser safe fallback | ✅ Marker `Gemini quota fallback` tampil; hasil deterministik tetap 9 slot |
| Docs vs code | Perlu sinkronisasi model embedding/provider profile pada deep-dive AI |
| Positioning | Masih experimental; belum diputuskan jadi primary flow |

---

## 5. Post-MVP Backlog / Belum Digarap

| Item | Sumber | Catatan |
|---|---|---|
| `POST /build/ai-upgrade` | PRODUCT, AI_PIPELINE | **Belum di `backend_worker`**; fitur tambahan setelah build-from-zero stabil. |
| Phase 2 → primary path | AI_PIPELINE Next Steps | Masih experimental; **perlu keputusan produk**. |
| Local Qwen latency polish | AI_PIPELINE appendix | ~55s; timeout/progress copy masih open. |
| Git-based Pages auto-build | Deployment runbook | Masih gagal karena dependency conflict; production saat ini memakai direct static deploy `frontend/out`. |
| Frontend health backlog (15 issue) | React Doctor | `missing deps`, `plain <img>`, `state-in-handlers`, giant component. |

---

## 6. Out-of-Scope (Bukan Goal Sekarang)

| Item | Sumber | Catatan |
|---|---|---|
| Shopee / Tokopedia links | AGENTS, PRD, UI_SPEC | **Future** marketplace target, bukan flow sekarang. Muncul sebagai link per-komponen tambahan nanti, bukan primary flow. |
| Checkout / accounts / inventory / order | PRD Non-Goals | **Bukan** product goal. |
| Generic laptop/desktop/gadget/electronics recommendation | PRD Non-Goals | PC Builder-only. |
| Generic catalog browse / compare / image identify / broad chat | PRD, UI_SPEC | Route lama yang tidak boleh dihidupkan kembali. |

---

## 7. Prioritas Berikutnya (Usulan)

1. **Keputusan produk**: promote Phase 2 (AI-assisted) ke primary flow atau tetap experimental.
2. Bila AI build dianggap stabil → **design `POST /build/ai-upgrade`**.
3. Rapikan **Git-based Pages auto-build**, agar tidak bergantung pada direct static deploy manual.
4. Bereskan sisa **React Doctor backlog** (medium/low).
5. Optimasi latency **Local Qwen** bila local profile tetap dipertahankan untuk demo.
