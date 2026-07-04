# 02 - Tech Stack

A modern, mainstream Android stack. Versions below are a **known-good baseline**; pin exact
versions in a Gradle **version catalog** (`gradle/libs.versions.toml`) and bump to the
latest stable at implementation time. Prefer the Compose **BOM** so Compose artifacts stay
mutually compatible.

## Platform targets

| Setting | Value | Rationale |
|---|---|---|
| Language | Kotlin 2.0+ | K2 compiler; required for the Compose Compiler Gradle plugin |
| `minSdk` | 26 (Android 8.0) | DataStore, modern APIs, covers ~95%+ devices; raise to 24 only if needed |
| `targetSdk` / `compileSdk` | 35 (Android 15) | Current Play target requirement baseline |
| JVM target | 17 | Required by recent AGP |
| Build system | Gradle (Kotlin DSL) + AGP 8.5+ | `build.gradle.kts`, version catalog |

## Core libraries (baseline versions)

| Area | Library | Baseline version | Notes |
|---|---|---|---|
| Compose | `androidx.compose:compose-bom` | `2024.09.x`+ | Single source of truth for Compose versions |
| Compose UI | `androidx.compose.ui:ui`, `ui-tooling`, `ui-tooling-preview` | via BOM | Previews + tooling |
| Material 3 | `androidx.compose.material3:material3` | via BOM | Base layer under the retro theme |
| Activity | `androidx.activity:activity-compose` | `1.9.x`+ | `setContent`, photo picker contracts |
| Lifecycle | `androidx.lifecycle:lifecycle-viewmodel-compose`, `lifecycle-runtime-compose` | `2.8.x`+ | `viewModel()`, `collectAsStateWithLifecycle()` |
| Navigation | `androidx.navigation:navigation-compose` | `2.8.x`+ | Three destinations + sheets |
| DI | `com.google.dagger:hilt-android` + `hilt-compiler` | `2.52`+ | App-wide DI; `androidx.hilt:hilt-navigation-compose` for `hiltViewModel()` |
| Networking | `com.squareup.retrofit2:retrofit` | `2.11.x`+ | REST client |
| HTTP | `com.squareup.okhttp3:okhttp` + `logging-interceptor` | `4.12.x`+ | Dynamic base URL, logging in debug |
| JSON | `org.jetbrains.kotlinx:kotlinx-serialization-json` | `1.7.x`+ | With `retrofit2-kotlinx-serialization-converter` |
| Persistence | `androidx.datastore:datastore-preferences` | `1.1.x`+ | Stores configurable base URL |
| Images | `io.coil-kt:coil-compose` | `2.7.x`+ | Render the picked audit screenshot preview |
| Coroutines | `org.jetbrains.kotlinx:kotlinx-coroutines-android` | `1.8.x`+ | Async + flows |

### JSON converter choice

Use **kotlinx.serialization** (`@Serializable` DTOs) with the Retrofit kotlinx converter.
It matches the JSON-first nature of the backend and avoids reflection. Moshi is an
acceptable alternative; pick one and stay consistent. Backend responses contain
free-form `specs` maps and occasionally polymorphic shapes (e.g. audit `detected_parts`
can be a list or object) - see [04-data-models](04-data-models.md) for the tolerant
parsing strategy (`ignoreUnknownKeys = true`, `isLenient = true`, `JsonElement` for
free-form specs).

## Image handling for Audit

- Pick an image with the **Photo Picker** (`ActivityResultContracts.PickVisualMedia`),
  which needs no storage permission on Android 13+.
- Read bytes via `ContentResolver.openInputStream(uri)`, send as a multipart part
  (`okhttp3.MultipartBody.Part`). The backend accepts JPEG/PNG/WebP up to 8 MB
  (see `/build/audit` in [`backend/app.py`](../../backend/app.py)).
- Optionally downscale large images client-side before upload (the backend also
  re-encodes via `prepare_image`). Keep it simple in v1: enforce the 8 MB cap and show a
  friendly error if exceeded.

## Fonts & assets

The web uses pixel/retro fonts. Bundle fonts as resources to guarantee the look offline.

| Role | Font | Source |
|---|---|---|
| Display / headings | **Silkscreen** (per [`design/DESIGN.md`](../../design/DESIGN.md)) | Google Fonts (OFL) - bundle `.ttf` in `res/font/` |
| Mono / labels | **JetBrains Mono** | Google Fonts (OFL) - bundle `.ttf` |
| Body fallback | System sans (Roboto) | Built-in |

> Note: the live CSS in [`frontend/styles/kompare95.css`](../../frontend/styles/kompare95.css)
> falls back to "MS Sans Serif"/"Courier New". On Android those are unavailable, so we
> bundle Silkscreen + JetBrains Mono to achieve the intended retro feel consistently.
> See [05-design-system](05-design-system.md) for the `FontFamily` setup.

Other assets:
- Window-95 desktop icons (port relevant PNGs from `frontend/public/icons/` if reused).
- A subtle grid/dither background for the teal desktop (can be drawn with a Compose
  background brush instead of a bitmap).

## Build configuration notes

- Enable Compose: `buildFeatures { compose = true }` and apply the
  `org.jetbrains.kotlin.plugin.compose` plugin (Kotlin 2.0+).
- Apply `kotlin("plugin.serialization")`, `com.google.dagger.hilt.android`, and
  `com.google.devtools.ksp` (for Hilt/serialization processors).
- `buildConfigField` for a default base URL (`http://10.0.2.2:8000`); the runtime value is
  overridden by DataStore.
- Network security: targeting cleartext `http://10.0.2.2` requires a debug
  `network_security_config.xml` allowing cleartext to `10.0.2.2` (and any LAN dev host),
  or `usesCleartextTraffic` in the debug manifest only. Production HTTPS hosts need no
  exception.

## Testing libraries

| Area | Library |
|---|---|
| Unit | `junit4`, `kotlinx-coroutines-test`, `turbine` (Flow assertions) |
| API mocking | `okhttp3:mockwebserver` |
| Compose UI tests | `androidx.compose.ui:ui-test-junit4`, `ui-test-manifest` (debug) |
| DI test | `hilt-android-testing` |

See [07-implementation-roadmap](07-implementation-roadmap.md) for what to test at each
milestone.
