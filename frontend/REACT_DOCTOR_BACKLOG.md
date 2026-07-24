# React Doctor Backlog - Kompare Frontend

Source: `npx react-doctor@latest -y --verbose`
Date: 2026-07-24
| Metrik | Sebelum | Setelah P0-P2 | Setelah Batch 1-3 |
|--------|---------|--------------|-------------------|
| Skor | 59/100 | **72/100** | **76/100** |
| Total issues | 47 | **34** | **15** |
| Bugs | 17 | 11 | 11 |
| Performance | 14 | 13 | 2 |
| Accessibility | 7 | 1 | **0** |
| Maintainability | 9 | 9 | 2 |

---

## Batch 1: Backdrop A11y di SwapModal (Sisa)

**Rule**: `no-static-element-interactions`
**File**: `components/swap/SwapModal.jsx:240`
**Issue**: Backdrop `<div onClick={handleBackdropClick}>` tidak punya role/keyboard handler.
**Constraint**: Jangan jadikan backdrop focusable (memicu `html-no-nested-interactive`).
**Proposed fix**: Pakai `role="presentation"` + keyboard via dialog Escape, atau pisahkan backdrop close button.

---

## Batch 2: Cleanup Unused Files & Dependencies

**Rules**: `deslop/unused-file`, `deslop/unused-dependency`
**Files**:
- `app/providers.jsx`
- `lib/allocation.js`
- `store/index.js`
- `store/slices/auditSlice.js`
- `store/slices/builderSlice.js`
- `store/slices/windowsSlice.js`

**Dependencies**:
- `@react95/icons`
- `react-draggable`

**Action**: Verifikasi import aktual, lalu hapus jika benar-benar tidak dipakai.

---

## Batch 3: Fix `.map().filter()` Chains

**Rules**: `js-flatmap-filter`, `js-combine-iterations`
**Files**:
- `components/audit/BuildAudit.jsx` (×5)
- `components/results/BuildResults.jsx` (×2)
- `components/advisor/AdvisorConsole.jsx` (×2)

**Proposed fix**: Ganti `.map().filter(Boolean)` dengan `.flatMap()`, dan gabung chained iterations dengan `.reduce()` / `for...of`.

---

## Progress Log

| Batch | Status | Notes |
|-------|--------|-------|
| Batch 1 | **Done** | Restruktur `.modal-layer` + `.modal-backdrop aria-hidden` + sibling dialog |
| Batch 2 | Done | Hapus 6 unused files + 2 unused deps (`@react95/icons`, `react-draggable`) |
| Batch 3 | Done | Fix `.map().filter()` di `BuildAudit.jsx`, `BuildResults.jsx`, `AdvisorConsole.jsx` |

## Remaining Issues (15)

| Rule | Count | File(s) | Priority |
|------|-------|---------|----------|
| Missing effect dependencies | 1 | `BuildWizard.jsx:269` | Medium |
| Plain `<img>` | 8 | `Marketplace.jsx`, `DesktopShell.jsx`, `UpgradePlanner.jsx` | Low |
| State only used in handlers | 2 | `BuildAudit.jsx:187`, `BuildWizard.jsx:225` | Medium |
| Giant component | 2 | `BuildWizard.jsx:216`, `SwapModal.jsx:89` | Low |
| Many related useState | 2 | `BuildWizard.jsx:216`, `ApiKeySettings.jsx:13` | Low |
