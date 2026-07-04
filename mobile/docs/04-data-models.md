# 04 - Data Models

Kotlin models for the Kompare API, the JSON field mapping, and the slot/spec helpers ported
from the web. Field names come from [`backend/app.py`](../../backend/app.py) and the
normalizers in [`BuildResults.jsx`](../../frontend/components/results/BuildResults.jsx),
[`BuildAudit.jsx`](../../frontend/components/audit/BuildAudit.jsx),
[`AdvisorConsole.jsx`](../../frontend/components/advisor/AdvisorConsole.jsx), and
[`slots.js`](../../frontend/lib/slots.js).

## Parsing strategy

The backend emits **free-form and occasionally polymorphic JSON**:
- `specs` is an open map whose keys vary per category.
- `marketplace_links` may be absent; components also use `product_url`/`url`.
- The build payload can be flat (`{components, total_idr, ...}`) **or** wrapped under
  `recommendation` (the web `normalizeBuild` handles both).
- Audit `detected_parts` / `compatibility_issues` can be a **list or an object**, and items
  may be strings or objects (the web `normalizeDetectedParts`/`normalizeIssues` coerce
  both).

Therefore configure kotlinx.serialization tolerantly:

```kotlin
val kompareJson = Json {
    ignoreUnknownKeys = true
    isLenient = true
    coerceInputValues = true
    explicitNulls = false
}
```

Use `JsonElement`/`JsonObject` for genuinely free-form regions (`specs`, advisor
`context`, swap `current_build`) and write small normalizer functions for the
list-or-object cases instead of fighting the serializer.

## Raw + typed dual model (important)

The advisor and swap endpoints require resending the **exact** build object the server
returned. Keep both:

```kotlin
data class ActiveBuild(
    val raw: JsonObject,        // verbatim response, resent as advisor `context` / swap `current_build` source
    val typed: BuildResult,     // mapped for display
)
```

This avoids lossy re-serialization of rich component objects. `current_build` for swap is
`raw["components"]` (or `raw["recommendation"]["components"]`).

## Core component model

```kotlin
@Serializable
data class ComponentDto(
    val sku: String? = null,
    val id: String? = null,
    val name: String? = null,
    val brand: String? = null,
    val category: String? = null,
    val price_idr: Long = 0,
    val product_url: String? = null,
    val url: String? = null,
    val marketplace_links: List<MarketplaceLinkDto>? = null,
    val specs: JsonObject? = null,                 // free-form, formatted via slot helpers
    // swap-candidate enrichments (present only on /build/swap-candidates items):
    val compatibility_summary: String? = null,
    val compatibility_warnings: List<IssueDto>? = null,
    val price_delta_idr: Long? = null,
    val projected_total_idr: Long? = null,
    val projected_remaining_idr: Long? = null,
)

@Serializable
data class MarketplaceLinkDto(val url: String? = null, val label: String? = null)

val ComponentDto.key: String get() = sku ?: id ?: (name ?: "component")
fun ComponentDto.marketplaceUrl(): String? =
    product_url ?: url ?: marketplace_links?.firstOrNull { !it.url.isNullOrBlank() }?.url
```

## Build response

Mirrors `normalizeBuild` in [`BuildResults.jsx`](../../frontend/components/results/BuildResults.jsx),
which reads either flat or under `recommendation`.

```kotlin
@Serializable
data class BuildResponseDto(
    val recommendation: BuildBodyDto? = null,      // some responses wrap fields here
    // flat fields (also accepted at top level):
    val components: Map<String, ComponentDto>? = null,
    val optional_addons: Map<String, ComponentDto>? = null,
    val budget_idr: Long? = null,
    val total_idr: Long? = null,
    val remaining_idr: Long? = null,
    val use_case: String? = null,
    val compatibility_warnings: List<IssueDto>? = null,
    val compatibility_issues: List<IssueDto>? = null,
    val budget_usage: BudgetUsageDto? = null,
    val budget_warnings: List<BudgetWarningDto>? = null,
    val upgrade_suggestions: List<UpgradeSuggestionDto>? = null,
    val performance_balance: PerformanceBalanceDto? = null,
    val ai_assisted: Boolean? = null,
    val local_fallback: Boolean? = null,
    val fallback: Boolean? = null,
    val fallback_reason: String? = null,
)

@Serializable
data class BuildBodyDto(
    val components: Map<String, ComponentDto>? = null,
    val optional_addons: Map<String, ComponentDto>? = null,
    val budget_idr: Long? = null,
    val total_idr: Long? = null,
    val remaining_idr: Long? = null,
    val use_case: String? = null,
    val compatibility_warnings: List<IssueDto>? = null,
    val compatibility_issues: List<IssueDto>? = null,
    val budget_usage: BudgetUsageDto? = null,
    val budget_warnings: List<BudgetWarningDto>? = null,
    val upgrade_suggestions: List<UpgradeSuggestionDto>? = null,
    val performance_balance: PerformanceBalanceDto? = null,
    val ai_assisted: Boolean? = null,
    val local_fallback: Boolean? = null,
    val fallback: Boolean? = null,
    val fallback_reason: String? = null,
)
```

Flatten into a UI model:

```kotlin
data class BuildResult(
    val budgetIdr: Long,
    val totalIdr: Long,
    val remainingIdr: Long,
    val useCase: String,
    val components: Map<String, ComponentDto>,
    val optionalAddons: Map<String, ComponentDto>,
    val warnings: List<Issue>,
    val legacyIssues: List<Issue>,
    val budgetUsage: BudgetUsage?,
    val budgetWarnings: List<BudgetWarning>,
    val upgradeSuggestions: List<UpgradeSuggestion>,
    val performanceBalance: PerformanceBalance?,
    val aiAssisted: Boolean,
    val localFallback: Boolean,
    val fallbackReason: String,
) {
    val overBudget get() = remainingIdr < 0
}

fun BuildResponseDto.toResult(): BuildResult {
    val r = recommendation
    val budget = budget_idr ?: r?.budget_idr ?: 0
    val total = total_idr ?: r?.total_idr ?: 0
    return BuildResult(
        budgetIdr = budget,
        totalIdr = total,
        remainingIdr = remaining_idr ?: r?.remaining_idr ?: (budget - total),
        useCase = use_case ?: r?.use_case ?: "gaming",
        components = components ?: r?.components ?: emptyMap(),
        optionalAddons = optional_addons ?: r?.optional_addons ?: emptyMap(),
        warnings = (compatibility_warnings ?: r?.compatibility_warnings).toIssues(),
        legacyIssues = (compatibility_issues ?: r?.compatibility_issues).toIssues(),
        budgetUsage = budget_usage ?: r?.budget_usage,
        budgetWarnings = budget_warnings ?: r?.budget_warnings ?: emptyList(),
        upgradeSuggestions = upgrade_suggestions ?: r?.upgrade_suggestions ?: emptyList(),
        performanceBalance = performance_balance ?: r?.performance_balance,
        aiAssisted = ai_assisted ?: r?.ai_assisted ?: false,
        localFallback = (local_fallback ?: r?.local_fallback) == true ||
            (fallback ?: r?.fallback) == true ||
            !(fallback_reason ?: r?.fallback_reason).isNullOrBlank(),
        fallbackReason = fallback_reason ?: r?.fallback_reason ?: "",
    )
}
```

### Fallback labels

Port `fallbackLabel` from `BuildResults.jsx`:

```kotlin
fun fallbackLabel(reason: String?): String = when (reason) {
    null, "" -> "Deterministic fallback"
    "ai_ranker_rejected" -> "AI ranker rejected"
    "deterministic_validation_failed" -> "Deterministic fallback"
    "gemini_quota_exceeded" -> "Gemini quota fallback"
    "retrieval_incomplete" -> "Retrieval fallback"
    "vector_index_missing", "vector_index_stale" -> "Vector index fallback"
    else -> "Deterministic fallback"
}
```

## Issues, budget & guidance models

```kotlin
@Serializable
data class IssueDto(
    val title: String? = null,
    val message: String? = null,
    val description: String? = null,
    val recommendation: String? = null,
    val next_step: String? = null,
    val severity: String? = null,   // info|warning|error
    val slot: String? = null,
    val code: String? = null,
)

data class Issue(val title: String, val message: String, val recommendation: String, val severity: String)

// Accepts string OR object items (web textFromIssue/normalizeIssues)
fun List<IssueDto>?.toIssues(): List<Issue> = this.orEmpty().map {
    Issue(
        title = it.title ?: it.slot ?: it.severity ?: "Issue",
        message = it.message ?: it.description ?: "",
        recommendation = it.recommendation ?: it.next_step ?: "",
        severity = it.severity ?: "",
    )
}

@Serializable
data class BudgetUsageDto(
    val used_percent: Double? = null,
    val strategy: String? = null,
    val target_min_percent: Double? = null,
)
typealias BudgetUsage = BudgetUsageDto

@Serializable
data class BudgetWarningDto(
    val code: String? = null,
    val title: String? = null,
    val message: String? = null,
    val recommendation: String? = null,
)
typealias BudgetWarning = BudgetWarningDto

@Serializable
data class UpgradeSuggestionDto(
    val slot: String? = null,
    val candidate: ComponentDto? = null,
    val added_cost_idr: Long? = null,
)
typealias UpgradeSuggestion = UpgradeSuggestionDto

@Serializable
data class PerformanceBalanceDto(val summary: String? = null)
typealias PerformanceBalance = PerformanceBalanceDto
```

## Swap models

```kotlin
@Serializable
data class SwapCandidatesResponseDto(
    val total: Int = 0,
    val offset: Int = 0,
    val limit: Int = 0,
    val slot: String? = null,
    val items: List<ComponentDto> = emptyList(),
)
// /build/swap returns a full BuildResponseDto plus a `swap` summary object:
@Serializable
data class SwapResultDto(
    val total_idr: Long = 0,
    val remaining_idr: Long = 0,
    val components: Map<String, ComponentDto> = emptyMap(),
    val compatibility_warnings: List<IssueDto> = emptyList(),
    val compatibility_issues: List<IssueDto> = emptyList(),
    val swap: SwapSummaryDto? = null,
    val use_case: String? = null,
    val budget_idr: Long? = null,
)
@Serializable
data class SwapSummaryDto(
    val slot: String? = null,
    val old_sku: String? = null,
    val new_sku: String? = null,
    val price_delta_idr: Long? = null,
)
```

## Audit models

Envelope `{ filename, image_meta, audit }`; `audit` shape from `normalize_build_audit` in
[`backend/prompts/build_audit.py`](../../backend/prompts/build_audit.py) plus the tolerant
coercion in [`BuildAudit.jsx`](../../frontend/components/audit/BuildAudit.jsx).

```kotlin
@Serializable
data class AuditEnvelopeDto(
    val filename: String? = null,
    val image_meta: JsonObject? = null,
    val audit: AuditDto? = null,
)

@Serializable
data class AuditDto(
    val status: String? = null,                    // compatible|incomplete|needs_attention
    val summary: String? = null,
    val detected_parts: JsonElement? = null,       // list OR object -> normalize
    val compatibility_issues: JsonElement? = null, // list OR object -> normalize
    val issues: JsonElement? = null,               // alt key
    val missing_slots: JsonElement? = null,        // list OR object of strings
    val budget_notes: JsonElement? = null,
    val suggested_next_steps: JsonElement? = null,
    val next_steps: JsonElement? = null,           // alt key
)

data class DetectedPart(
    val slot: String,
    val slotLabel: String,
    val name: String,
    val confidence: Double?,
    val source: String?,
    val specs: JsonObject,
)
```

Implement `normalizeDetectedParts`, `normalizeIssues`, and `normalizeTextList` to handle
both list and object inputs and string-or-object items, matching `BuildAudit.jsx`. Confidence
display: if `<= 1` multiply by 100, then `"${pct}% confidence"`.

## Advisor models

From the `/build/advisor` return in [`backend/app.py`](../../backend/app.py) and
[`AdvisorConsole.jsx`](../../frontend/components/advisor/AdvisorConsole.jsx).

```kotlin
@Serializable
data class AdvisorResponseDto(
    val answer: String? = null,
    val referenced_slots: List<String> = emptyList(),
    val evidence_cards: List<EvidenceCardDto> = emptyList(),
    val cost_saving_suggestions: List<CostSavingSuggestionDto> = emptyList(),
    val suggested_questions: List<String> = emptyList(),
    val fallback: Boolean = false,
)

@Serializable
data class EvidenceCardDto(
    val slot: String? = null,
    val label: String? = null,
    val name: String? = null,
    val brand: String? = null,
    val price_idr: Long? = null,
    val specs: JsonElement? = null,        // list of {label,value} OR map
    val rationale: JsonElement? = null,    // string OR list<string>
)

@Serializable
data class CostSavingSuggestionDto(
    val slot: String? = null,
    val label: String? = null,
    val current: ComponentRefDto? = null,
    val candidate: ComponentRefDto? = null,
    val savings_idr: Long? = null,
    val projected_total_idr: Long? = null,
    val projected_remaining_idr: Long? = null,
    val compatibility_summary: String? = null,
    val compatibility_warnings: List<IssueDto> = emptyList(),
)

@Serializable
data class ComponentRefDto(val sku: String? = null, val name: String? = null, val price_idr: Long? = null)

// UI-side chat message (client-owned memory, last ~8 turns; send last ~6 to API)
data class ChatMessage(
    val id: String,
    val role: String,           // "user" | "assistant"
    val content: String,
    val fallback: Boolean = false,
    val referencedSlots: List<String> = emptyList(),
    val evidenceCards: List<EvidenceCardDto> = emptyList(),
    val costSavingSuggestions: List<CostSavingSuggestionDto> = emptyList(),
    val suggestedQuestions: List<String> = emptyList(),
)
```

## Form metadata models

```kotlin
@Serializable data class HealthDto(val status: String, val version: String, val components_loaded: Int)
@Serializable data class UseCasesDto(val use_cases: List<JsonObject> = emptyList())
@Serializable data class BudgetTiersDto(val tiers: JsonElement? = null)

@Serializable
data class AllocationPresetsDto(
    val slots: List<String> = emptyList(),
    val profiles: Map<String, Map<String, Int>> = emptyMap(),
    val priority_shifts: Map<String, Map<String, Int>> = emptyMap(),
    val strategy_shifts: Map<String, Map<String, Int>> = emptyMap(),
)
```

## Slots, labels & spec formatting (port of `slots.js`)

Single source of truth for slot ordering, labels, and spec pill formatting.

```kotlin
object Slots {
    val ORDER = listOf("cpu","motherboard","ram","gpu","ssd","psu","cpu_cooler","fan_cooler","case")
    val OPTIONAL_ADDON_ORDER = listOf("hdd","monitor","ups")

    val LABELS = mapOf(
        "cpu" to "Processor / CPU", "motherboard" to "Motherboard", "ram" to "RAM",
        "gpu" to "VGA / GPU", "ssd" to "SSD", "hdd" to "Hard Drive / HDD", "psu" to "PSU",
        "cpu_cooler" to "CPU Cooler", "fan_cooler" to "Fan Cooler", "case" to "Casing",
        "monitor" to "Monitor", "ups" to "UPS",
    )
    fun label(slot: String) = LABELS[slot] ?: slot.replace('_', ' ')

    // Short tokens for advisor chips (SLOT_ICONS in slots.js)
    val ICONS = mapOf(
        "cpu" to "CPU","motherboard" to "MB","ram" to "RAM","gpu" to "GPU","ssd" to "SSD",
        "hdd" to "HDD","psu" to "PSU","cpu_cooler" to "COOL","fan_cooler" to "FAN",
        "case" to "CASE","monitor" to "MON","ups" to "UPS",
    )

    // Which specs to show as pills per slot (SUMMARY_KEYS)
    val SUMMARY_KEYS = mapOf(
        "cpu" to listOf("socket","cores","threads","base_clock_ghz","tdp_w"),
        "motherboard" to listOf("socket","form_factor","ram_type","chipset"),
        "ram" to listOf("type","capacity_gb","speed_mhz","module_count"),
        "gpu" to listOf("vram_gb","vendor","recommended_psu_w","tdp_w"),
        "ssd" to listOf("capacity_gb","interface","form_factor"),
        "hdd" to listOf("capacity_gb","interface","form_factor_in"),
        "psu" to listOf("wattage_w","rating","modular"),
        "cpu_cooler" to listOf("type","tdp_w","fan_size_mm"),
        "fan_cooler" to listOf("type","fan_size_mm"),
        "case" to listOf("form_factor","color"),
        "monitor" to listOf("size_inch","resolution","refresh_hz"),
        "ups" to listOf("capacity_va","wattage_w"),
    )
}
```

Spec label/value formatting (port of `specLabel`/`formatSpecValue`/`specPills`). Note that
`type` and `capacity_gb` labels are **slot-dependent**:

```kotlin
fun specLabel(slot: String, key: String): String = when (key) {
    "type" -> when (slot) { "ram" -> "Memory type"; "cpu_cooler" -> "Cooler type"; "fan_cooler" -> "Fan type"; else -> "type" }
    "capacity_gb" -> "Capacity"
    "socket" -> "Socket"; "cores" -> "Cores"; "threads" -> "Threads"; "base_clock_ghz" -> "Base clock"
    "tdp_w" -> "TDP"; "form_factor" -> "Form factor"; "max_form_factor" -> "Fits board"
    "ram_type" -> "Memory type"; "chipset" -> "Chipset"; "speed_mhz" -> "Speed"; "module_count" -> "Modules"
    "vram_gb" -> "VRAM"; "vendor" -> "GPU vendor"; "recommended_psu_w" -> "PSU target"
    "wattage_w" -> "Wattage"; "rating" -> "Efficiency"; "modular" -> "Modular"; "fan_size_mm" -> "Fan size"
    "size_inch" -> "Size"; "resolution" -> "Resolution"; "refresh_hz" -> "Refresh rate"
    "capacity_va" -> "Capacity"; "interface" -> "Interface"; "form_factor_in" -> "Drive size"; "color" -> "Color"
    else -> key.replace('_', ' ')
}

fun formatSpecValue(key: String, value: String): String = when (key) {
    "wattage_w", "tdp_w", "recommended_psu_w" -> "${value}W"
    "capacity_gb", "vram_gb" -> "$value GB"
    "speed_mhz" -> "$value MHz"
    "fan_size_mm" -> "$value mm"
    "size_inch", "form_factor_in" -> "$value\""
    "refresh_hz" -> "$value Hz"
    "capacity_va" -> "$value VA"
    "base_clock_ghz" -> "$value GHz"
    else -> value
}
```

`specPills(slot, specs, limit = 4)` iterates `SUMMARY_KEYS[slot]` (or all keys), skips
null/blank, and returns up to 4 `{label, value}` pairs.

## Money formatting (port of `format.js`)

IDR currency formatting with `id-ID` locale and budget parsing (supports `jt`/`juta`
shorthand).

```kotlin
fun formatIdr(value: Long): String {
    val nf = NumberFormat.getCurrencyInstance(Locale("in", "ID")).apply {
        maximumFractionDigits = 0
        currency = Currency.getInstance("IDR")
    }
    return nf.format(value).replace('\u00A0', ' ')
}

// parseIDR: "20.000.000", "20jt", "20 juta", "Rp 20.000.000" -> Long
fun parseIdr(raw: String): Long {
    val s = raw.trim().lowercase()
    if (s.isEmpty()) return 0
    val multiplier = if (s.contains("jt") || s.contains("juta")) 1_000_000.0 else 1.0
    val normalized = s.replace(Regex("juta|jt|rp|\\s"), "")
        .replace(".", "")
        .replace(",", ".")
    val parsed = normalized.toDoubleOrNull() ?: return 0
    return Math.round(parsed * multiplier)
}
```

> Minimum budget is **Rp 3,000,000** (`MIN_BUDGET_IDR` in BuildWizard); enforce client-side
> with the message "Budget is too low. Minimum Rp 3 juta for a reasonable PC build."
