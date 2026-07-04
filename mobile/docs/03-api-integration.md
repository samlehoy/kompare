# 03 - API Integration

The mobile app talks to the **existing FastAPI backend** with no backend changes. This doc
specifies the Retrofit interface, the configurable base URL, the multipart audit upload,
and error handling. All shapes are derived from [`backend/app.py`](../../backend/app.py)
and the web client [`frontend/lib/api.js`](../../frontend/lib/api.js).

DTOs referenced here are fully defined in [04-data-models](04-data-models.md).

## Base URL

- Default: `http://10.0.2.2:8000` (Android emulator alias for the host machine's
  `localhost`). On a physical device, set the host's LAN IP (e.g. `http://192.168.1.20:8000`).
- The value is stored in **DataStore** and editable from the in-app Settings sheet.
- The web client uses a `/api` rewrite or `NEXT_PUBLIC_API_BASE_URL`. The mobile app calls
  the FastAPI routes **directly** (no `/api` prefix), so paths are e.g. `/build/recommend`.

### Dynamic base URL without recreating Retrofit

Use a host-swapping OkHttp interceptor so changing the base URL takes effect immediately
without rebuilding the Retrofit instance. Retrofit is created once with a placeholder base
URL; the interceptor rewrites the host/port/scheme on every request from the current
DataStore value.

```kotlin
class BaseUrlInterceptor(
    private val settings: SettingsStore,
) : Interceptor {
    override fun intercept(chain: Interceptor.Chain): Response {
        val configured = settings.baseUrlBlocking()          // e.g. http://10.0.2.2:8000
        val newBase = configured.toHttpUrlOrNull()
        val request = chain.request()
        val url = if (newBase != null) {
            request.url.newBuilder()
                .scheme(newBase.scheme)
                .host(newBase.host)
                .port(newBase.port)
                .build()
        } else request.url
        return chain.proceed(request.newBuilder().url(url).build())
    }
}
```

## Endpoints consumed (v1)

| Method | Path | Purpose | Web reference |
|---|---|---|---|
| GET | `/health` | Connectivity check in Settings | `api.health()` |
| GET | `/build/use-cases` | Use-case keys (form metadata; optional) | `api.listUseCases()` |
| GET | `/build/allocation-presets` | Allocation profiles for advanced sliders | `api.listAllocationPresets()` |
| GET | `/build/budget-tiers` | Budget tier guidance (optional) | `api.listBudgetTiers()` |
| POST | `/build/recommend` | Fast deterministic build | `api.recommendBuild()` |
| POST | `/build/ai-recommend` | AI-assisted build | `api.recommendAiBuild()` |
| POST | `/build/swap-candidates` | Compatible candidates for a slot | `api.listSwapCandidates()` |
| POST | `/build/swap` | Replace one slot, re-validate | `api.swapComponent()` |
| POST | `/build/audit` | Multipart cart audit | `api.auditBuild()` |
| POST | `/build/advisor` | Grounded chat | `api.askBuildAdvisor()` |

> Endpoints marked optional can be skipped in v1 with the local fallbacks the web uses;
> `LOCAL_ALLOCATION_PRESET_METADATA` in
> [`BuildWizard.jsx`](../../frontend/components/builder/BuildWizard.jsx) shows the
> deterministic local defaults if `/build/allocation-presets` is unreachable.

## Retrofit interface sketch

```kotlin
interface KompareApi {

    @GET("health")
    suspend fun health(): HealthDto

    @GET("build/use-cases")
    suspend fun useCases(): UseCasesDto

    @GET("build/allocation-presets")
    suspend fun allocationPresets(): AllocationPresetsDto

    @GET("build/budget-tiers")
    suspend fun budgetTiers(): BudgetTiersDto

    @POST("build/recommend")
    suspend fun recommend(@Body body: BuildRequestDto): BuildResponseDto

    @POST("build/ai-recommend")
    suspend fun recommendAi(@Body body: BuildRequestDto): BuildResponseDto

    @POST("build/swap-candidates")
    suspend fun swapCandidates(@Body body: SwapCandidatesRequestDto): SwapCandidatesResponseDto

    @POST("build/swap")
    suspend fun swap(@Body body: SwapRequestDto): BuildResponseDto

    @Multipart
    @POST("build/audit")
    suspend fun audit(
        @Part image: MultipartBody.Part?,            // name MUST be "image"
        @Part("goal") goal: RequestBody?,            // form field "goal"
        @Part("parts_list") partsList: RequestBody?, // form field "parts_list"
    ): AuditEnvelopeDto

    @POST("build/advisor")
    suspend fun advisor(@Body body: AdvisorRequestDto): AdvisorResponseDto
}
```

## Request bodies (field names match backend Pydantic models)

The backend `BuildRequest` (see [`backend/app.py`](../../backend/app.py)) and the web
`buildRecommendationPayload` define the exact snake_case fields:

```kotlin
@Serializable
data class BuildRequestDto(
    val budget_idr: Int,
    val use_case: String = "gaming",            // gaming|productivity|content_creation|office|student
    val cpu_brand: String? = null,              // "Intel"|"AMD"|null
    val gpu_vendor: String? = null,             // "Nvidia"|"AMD"|"Intel"|null
    val budget_strategy: String? = "balanced",  // value|balanced|maximize
    val performance_priority: String? = null,   // gaming|productivity|best_value|balanced|upgrade_friendly
    val allocation_overrides: Map<String, Int>? = null, // must sum to 100 to apply
    val include_optional_addons: Boolean = false,
    val selected_optional_addons: List<String>? = null, // ["hdd","monitor","ups"]
    val ai_profile: String? = null,             // only for ai-recommend: "local_qwen"|"gemini_free"
)
```

Swap requests send the **current build's `components` map** as `current_build` (a map of
slot -> component object), mirroring the web `currentBuild: buildComponents`:

```kotlin
@Serializable
data class SwapCandidatesRequestDto(
    val budget_idr: Int,
    val use_case: String = "gaming",
    val slot: String,                  // cpu|gpu|ram|motherboard|ssd|hdd|psu|case|cpu_cooler|fan_cooler
    val current_build: Map<String, JsonElement>,
    val q: String? = null,
    val max_price: Int? = null,
    val limit: Int = 50,
    val offset: Int = 0,
)

@Serializable
data class SwapRequestDto(
    val budget_idr: Int,
    val use_case: String = "gaming",
    val slot: String,
    val new_component_id: String,      // SKU/id of the replacement
    val current_build: Map<String, JsonElement>,
)

@Serializable
data class AdvisorRequestDto(
    val mode: String = "build",        // "build" | "upgrade"
    val question: String,              // 1..2000 chars
    val context: JsonElement,          // the full active BuildResponse object
    val history: List<ChatMessageDto> = emptyList(), // max 12, roles user|assistant
)

@Serializable data class ChatMessageDto(val role: String, val content: String)
```

> Important: `context` and `current_build` are passed back to the backend **verbatim** as
> the build object the server returned. To avoid lossy round-tripping of the rich
> component objects (which include `specs`, `marketplace_links`, etc.), keep the raw
> `JsonElement`/`JsonObject` of the last build response and resend it. Map to typed models
> only for display. See [04-data-models](04-data-models.md) ("Raw + typed dual model").

## Multipart audit

The backend route signature is `image: UploadFile`, `goal: Form`, `parts_list: Form`. At
least one of `image`/`parts_list` is required (HTTP 400 otherwise). Construction:

```kotlin
suspend fun audit(bytes: ByteArray?, fileName: String?, mime: String?, goal: String?, partsList: String?): AuditEnvelopeDto {
    val imagePart = bytes?.let {
        val body = it.toRequestBody((mime ?: "image/jpeg").toMediaType())
        MultipartBody.Part.createFormData("image", fileName ?: "cart.jpg", body)
    }
    val goalPart = goal?.takeIf { it.isNotBlank() }?.toRequestBody("text/plain".toMediaType())
    val partsPart = partsList?.takeIf { it.isNotBlank() }?.toRequestBody("text/plain".toMediaType())
    return api.audit(imagePart, goalPart, partsPart)
}
```

- Enforce the 8 MB cap before upload (backend returns 413 if exceeded).
- The response is an envelope `{ filename, image_meta, audit }`; unwrap `audit` for the UI
  (the web does `response?.audit || response`).

## Error handling

Mirror the web `ApiError` (status + message). The repository converts exceptions into a
single `ApiException`:

```kotlin
class ApiException(message: String, val status: Int? = null) : Exception(message)

suspend fun <T> safeCall(block: suspend () -> T): T = try {
    block()
} catch (e: HttpException) {
    val detail = e.response()?.errorBody()?.string()?.let(::extractDetail)
    throw ApiException(detail ?: "${e.code()} ${e.message()}", e.code())
} catch (e: SocketTimeoutException) {
    throw ApiException("Request timed out. Is the backend running and reachable?")
} catch (e: IOException) {
    throw ApiException("Cannot reach the backend at the configured URL.")
}
```

`extractDetail` parses FastAPI's `{"detail": "..."}` (or `{"detail": {"message": ...}}`)
just like `parseErrorResponse` in [`api.js`](../../frontend/lib/api.js). Known backend
error messages to surface clearly:
- 400 `Unknown use_case ...`
- 400 `Paste a parts list or upload a cart screenshot first.`
- 413 `Image too large (max 8 MB).`
- 503 `components.json missing or empty...` (catalog not seeded)

## Timeouts & logging

- OkHttp timeouts: connect 15s, read **120s** (AI builds "can take about a minute" per the
  web `LOADING_STATUS.ai` copy), write 30s.
- Add `HttpLoggingInterceptor` at `BODY` level **only in debug** builds.

## AI build latency note

`/build/ai-recommend` may take ~60s and can return a deterministic fallback (flagged via
`fallback`/`fallback_reason`/`local_fallback` fields). The UI must show a long-running
"AI build in progress" state and then render fallback markers when present
(see [06-screens-and-flows](06-screens-and-flows.md)).
