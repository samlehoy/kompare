# Phase 2 - AI Retrieval-Augmented PC Build Recommendation

This document defines the Phase 2 enhancement for Kompare: a retrieval-augmented recommendation layer over the existing PC Builder catalog.

The goal is to make recommendations feel more AI-powered while preserving the current deterministic compatibility engine as the final safety gate.

## Summary

Phase 2 adds a retrieval-augmented generation flow:

1. Chunk component records from `data/components.json`.
2. Generate embeddings for each chunk.
3. Store vectors in Qdrant Cloud (or the local file index for offline development).
4. Retrieve relevant component candidates for a user's budget, use case, owned parts, and preferences.
5. Ask the selected AI profile to compare and rank only those retrieved candidates.
6. Validate the AI-proposed build with deterministic compatibility rules.
7. Return structured build output, rationale, warnings, and marketplace links.

Current progress covers the full build-from-zero foundation: component chunk generation, local vector index generation and manifest/status checks, retrieval, Gemini candidate ranking, the primary `POST /build/ai-recommend` route, provider profiles, LM Studio local-model adapters, Qdrant sync/smoke utilities, backend-owned allocation presets, and development-only provider selection for Local Qwen versus Gemini.

This should be presented as:

> AI-assisted retrieval and reasoning over a deterministic PC compatibility engine.

It should not be presented as unconstrained AI freely choosing parts.

## Recommended Architecture

```text
data/components.json
        |
        v
chunk_components.py
        |
        v
data/vector_chunks.jsonl
        |
        v
embed_components.py
        |
        v
data/vector_index/
        |
        v
retrieval service
        |
        v
Gemini ranking prompt
        |
        v
deterministic compatibility validator
        |
        v
existing BuildResult UI
```

## Chunking Strategy

Each chunk should describe one component or a small component comparison group.

Recommended component chunk fields:

- `sku`
- `category`
- `name`
- `brand`
- `price_idr`
- `stock_status`
- `marketplace_links`
- `specs`
- `selection_rationale`
- compact compatibility text
- compact use-case tags

Keep chunks short and buyer-relevant. Avoid embedding raw scrape noise, unrelated category text, or long unchanged marketplace descriptions.

## Embedding Strategy

Production query embeddings use Cloudflare Workers AI
`@cf/baai/bge-m3`, matching the vectors stored in the production Qdrant
collection `kompare_components_gemini`. Local index utilities may use their
documented profile-specific model, but those artifacts are not the production
query path.

Embedding output should be stored locally with the chunk ID and enough metadata to recover the source component.

Suggested local files:

- `data/vector_chunks.jsonl`
- `data/vector_index/embeddings.npy`
- `data/vector_index/metadata.jsonl`
- `data/vector_index/manifest.json`

`data/vector_index/` is gitignored (previously Git LFS); these are local
generated artifacts and must not be committed — CI/Pages clones do not
download them.

The manifest should record:

- source catalog hash
- embedding model
- output dimensionality
- generated timestamp
- chunk count

## Recommendation Flow

AI-assisted is the default production user path. The deterministic builder
remains the compatibility authority, automatic fallback, and manually
selectable Fast compatibility mode.

Recommended flow:

1. User submits budget, use case, preferences, and optional owned parts.
2. Backend applies deterministic filters first:
   - category
   - price ceiling
   - stock status
   - required specs
   - owned-part constraints
3. Retrieval ranks candidates from the local vector index.
4. Gemini receives only the top candidates per slot.
5. Gemini proposes a structured build with rationale.
6. Backend validates:
   - CPU and motherboard socket
   - motherboard and RAM generation
   - PSU headroom
   - case form factor
   - cooler context
   - budget
   - nine required build slots, with HDD handled as an optional bulk-storage add-on
7. Invalid Gemini choices are rejected, repaired, or converted into warnings.
8. UI labels the result as AI-assisted and shows deterministic validation status.

## Guardrails

These are non-negotiable:

- Do not send the whole catalog to Gemini.
- Do not let Gemini invent SKUs or prices.
- Do not bypass deterministic compatibility checks.
- Do not use vector similarity as proof of compatibility.
- Do not reintroduce laptops, desktops, gadgets, or broad electronics recommendations.
- Do not hide fallback behavior when Gemini is unavailable.
- Always inject deterministic baseline candidates into the AI candidate list so AI ranking cannot lose the known-safe build path.
- Treat budget as a performance target in the Gemini prompt, not only as a ceiling, so higher budgets are not underused by default.
- Fall back safely when AI underuses high-end or custom budgets.
- Report Gemini quota fallback explicitly as `gemini_quota_exceeded`.

## Possible API Shape

Keep the current API stable and use explicit AI-assisted routes:

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/build/ai-recommend` | AI-assisted build recommendation using the selected retrieval profile and deterministic validation. |
| POST | `/build/ai-upgrade` | AI-assisted upgrade planning using local retrieval and deterministic validation. |

These routes should return the same core response shape as `/build/recommend` and `/build/upgrade` so the UI can reuse existing cards.

Additional fields may include:

```json
{
  "ai_assisted": true,
  "retrieval": {
    "profile": "gemini_free",
    "vector_backend": "local_json",
    "embedding_model": "@cf/baai/bge-m3",
    "chunk_count_considered": 120,
    "top_k_per_slot": 12
  },
  "ai_rationale": {
    "summary": "This build favors GPU value while keeping the platform upgradeable.",
    "tradeoffs": []
  },
  "validation_source": "deterministic"
}
```

## UI Implications

The AI-primary UI remains subtle:

- Add an "AI-assisted" badge to generated results.
- Add a "Recommendation mode" control to the Build from zero form so the user chooses between Fast compatibility and AI-assisted before pressing the single "Generate build" action.
- In production, hide provider selection and always send `gemini_free`. In development, show the "AI profile" selector only when AI-assisted mode is selected so Local Qwen + Qdrant can still be tested.
- Show "Retrieved candidates reviewed" in the rationale panel.
- Keep compatibility warnings in the existing summary panel.
- Keep manual deterministic build mode available.
- Explain when AI mode falls back to deterministic recommendations.
- Use clear progress copy for slow local model runs, because the current Local Qwen ranker can take about a minute on this machine.

Fallback copy should describe the safety reason in user-facing language instead of showing raw fallback codes. For example, quota and budget-underuse fallbacks should read as safe deterministic recommendations rather than unexplained internal states.

Avoid adding a generic chatbot or product search page.

## Developer Runbook

1. Generate local chunks:
   `python -m backend.utils.ai_rag_chunks --components data/components.json --output data/vector_chunks.jsonl`
2. Generate local vectors:
   `python -m backend.utils.ai_rag_index --components data/components.json --chunks data/vector_chunks.jsonl --index-dir data/vector_index --model gemini-embedding-001`
3. For free-tier-safe incremental generation, run one batch at a time:
   `python -m backend.utils.ai_rag_index --components data/components.json --chunks data/vector_chunks.jsonl --index-dir data/vector_index --model gemini-embedding-001 --max-batches 1`
4. For paced generation, add a delay between batches:
   `python -m backend.utils.ai_rag_index --components data/components.json --chunks data/vector_chunks.jsonl --index-dir data/vector_index --model gemini-embedding-001 --delay-seconds 65`
5. Inspect cache/index progress without calling Gemini:
   `python -m backend.utils.ai_rag_index --status --chunks data/vector_chunks.jsonl --index-dir data/vector_index --model gemini-embedding-001`
6. Start the backend and frontend with `.\dev.ps1`.
7. Call `POST /build/ai-recommend` for the primary AI-assisted Build from zero path.
8. Regenerate the four-budget comparison report:
   `python -m backend.utils.ai_build_comparison --output data/ai_comparison_report.json`

The AI build route accepts optional request-time profile selection:

```json
{
  "budget_idr": 20000000,
  "use_case": "gaming",
  "ai_profile": "gemini_free"
}
```

Use `"ai_profile": "local_qwen"` only after LM Studio and Qdrant are running and the Qdrant collection has been synced.

The Build from zero UI exposes a "Recommendation mode" control. Fast compatibility calls the deterministic route. AI-assisted production requests always send `ai_profile: gemini_free` without exposing a provider selector; development reveals the selector and sends the selected profile to `POST /build/ai-recommend`.

The generated vector files are local artifacts and are ignored by git:

- `data/vector_chunks.jsonl`
- `data/vector_index/`

Gemini embedding requests are batched at 100 texts per request. Free-tier embedding quota can still block a full `data/components.json` index run; when that happens, the AI endpoint should return deterministic fallback metadata instead of failing the normal builder flow.

Vector generation now writes an append-only resume cache at `data/vector_index/embedding_cache.jsonl`. If quota stops a run after some batches, rerun the same command later and it will skip cached chunk vectors whose chunk ID, text hash, and embedding model still match.

Use the `--status` command between quota windows to check `chunk_count`, `cached_count`, `missing_count`, `complete`, and whether the final loadable index files exist. Status inspection exits successfully even when the cache is incomplete because it is an operator check, not a generation failure.

Current local index status:

- `cached_count`: 6476
- `chunk_count`: 6476
- `complete`: true
- `index_exists`: true
- `missing_count`: 0

The current local vector index contains 6476 component vectors and is complete/loadable.

A local `POST /build/ai-recommend` smoke test has returned an AI-assisted result for a normal gaming build payload after deterministic validation and repair checks. When Gemini quota is exhausted, the same path should return deterministic fallback metadata instead of breaking the builder flow.

An AI-assisted versus deterministic comparison can be run across entry-level, mid-range, high-end, and custom budget scenarios. The generated report is stored at `data/ai_comparison_report.json` and includes generation metadata, catalog hash, deterministic summaries, AI summaries, and fallback reasons.

## Testing Requirements

Before shipping Phase 2:

- Unit tests for chunk generation.
- Unit tests for vector index manifest and stale-index detection.
- Retrieval tests showing relevant candidates are returned for CPU, GPU, RAM, PSU, monitor, and UPS queries.
- Contract tests proving Gemini cannot introduce unknown SKUs.
- Compatibility tests proving invalid AI choices are rejected.
- Fallback tests when embedding files are missing.
- Fallback tests when Gemini quota is exhausted.
- Playwright tests for the AI-assisted badge and fallback messaging.

## Recommended Implementation Order

1. Build local chunk generation from `data/components.json`.
2. Build local embedding generation and manifest writing.
3. Build a deterministic retrieval service with cosine similarity.
4. Add tests for retrieval quality and stale index handling.
5. Add Gemini ranking prompt with strict JSON schema.
6. Add deterministic validation gate for AI-selected builds.
7. Add an `/build/ai-recommend` endpoint.
8. Add UI badge, rationale display, and fallback messaging.
9. Promote AI-assisted mode into the primary builder flow while retaining deterministic authority.

## Current Status

Phase 2 is implemented as the primary Builder path with a complete local RAG foundation:

- Local component chunk generation exists.
- Local vector index storage, resume cache, manifest/status checks, and stale-manifest checks exist.
- Slot-based candidate retrieval exists.
- Gemini ranker prompt and strict response parsing exist.
- `POST /build/ai-recommend` exists beside the deterministic `/build/recommend` endpoint.
- The local index currently contains 6476 component vectors and is complete/loadable.
- A live backend smoke test for `POST /build/ai-recommend` has returned `ai_assisted: true` and `fallback: false` when Gemini quota is available.
- Backend validation repairs the observed AI-selected DDR4/DDR5 RAM mismatch by selecting a compatible RAM alternative before accepting the AI-assisted build.
- Hybrid guardrails are implemented:
  - deterministic baseline candidates are injected into AI candidate lists
  - the Gemini prompt treats budget as a performance target
  - AI underuse of high/custom budgets falls back safely
  - Gemini quota fallback is explicit as `gemini_quota_exceeded`
- AI-assisted and deterministic outputs can be compared across entry-level, mid-range, high-end, and custom budgets with the reusable report command. The latest local Qwen report at `data/ai_comparison_report.json` shows `ai_assisted: true`, `fallback: false`, `ranker_mode: json_ranker`, and no hard compatibility errors for all four scenarios.
- Build from zero now uses one `Generate build` action controlled by the `Recommendation mode` choice.
- Production Build from zero defaults to AI-assisted with `gemini_free` and hides provider selection. Development exposes an `AI profile` selector for `local_qwen` and `gemini_free` while AI-assisted mode is selected.
- The AI-assisted loading state now tells users the local AI is ranking real catalog candidates, checking compatibility, and may take about a minute.
- Build results show AI-assisted metadata and deterministic fallback messaging when the response includes it.
- UI fallback copy now explains safety fallback reasons instead of exposing raw fallback codes.
- Responsive UI test coverage now includes the AI-assisted badge and Gemini quota fallback copy; a browser run is still needed before calling that coverage fully verified.
- Local model preparation is documented in the [Local Model Setup appendix](#appendix--local-model-setup-lm-studio--qwen) below.
- AI provider profile configuration now exists for `gemini_free` and `local_qwen`.
- The LM Studio local Qwen adapter foundation can call OpenAI-compatible `/chat/completions` and `/embeddings`, including Qwen's `reasoning_content` fallback behavior.
- A Qdrant REST adapter, `backend.utils.qdrant_sync`, and `backend.utils.qdrant_smoke` now exist for the `local_qwen` collection.
- `POST /build/ai-recommend` now accepts optional `ai_profile` selection and can route `local_qwen` through LM Studio embeddings, Qdrant retrieval, local Qwen JSON ranking, and the same deterministic validation gate used by the Gemini path.
- Qdrant is running locally through Docker as `kompare-qdrant`.
- The intended Qwen Qdrant collection named `kompare_components_qwen` has been synced with 6476 vectors using `text-embedding-qwen3-embedding-4b` at 2560 dimensions after restarting LM Studio.
- A diagnostic Qdrant collection named `kompare_components_nomic` has also been synced with 6476 vectors using `text-embedding-nomic-embed-text-v1.5` at 768 dimensions.
- Qdrant point IDs now use deterministic UUIDs because the current Qdrant server rejects raw SHA-256 hex strings as invalid point IDs.
- Qdrant sync now embeds and upserts in batches instead of sending the whole catalog to LM Studio in a single request.
- `backend.utils.local_ai_readiness` now reports embedding, Qdrant retrieval, and strict JSON chat readiness separately before long sync or demo runs.
- The intended Qwen embedding collection is no longer blocked after restarting LM Studio; embedding and Qdrant retrieval readiness pass.
- The currently loaded Qwen chat model is reachable for strict JSON readiness checks and now completes the request-time build ranking path through a constrained SKU-choice JSON schema.
- If the local Qwen JSON ranker times out, rejects the compact ranker prompt, or the vector index is stale, `POST /build/ai-recommend` still uses a compatibility-aware Qdrant retrieval fallback instead of immediately dropping to deterministic recommendations.
- The local Qdrant path selects CPU first, then skips incompatible motherboard hits to match the CPU socket, then skips incompatible RAM hits to match the motherboard RAM generation before running the same deterministic validation gate.
- The local Qdrant path injects deterministic baseline candidates into sparse retrieval results and can step down to cheaper compatible candidates when the full build would exceed budget.
- Budget allocation is now driven solely by `use_case`. The `budget_strategy` and `performance_priority` parameters have been removed from `composeBuild`. When no manual allocation override is supplied, Fast compatibility and the AI-assisted deterministic baseline use the use-case allocation profile; valid 100% manual overrides remain authoritative.
- The deterministic preset quality pass can now be rerun with `python -m backend.utils.preset_quality_audit --output data/preset_quality_report.json`. The latest report checks Rp 5m through Rp 60m core-tower budgets across all use cases, with no hard compatibility errors or missing required slots.
- A live local Qwen smoke test returned `ai_assisted: true`, `fallback: false`, `ranker_mode: json_ranker`, and no compatibility warnings for a Rp 20.000.000 gaming build.
- A direct local Qwen timing check for a Rp 20.000.000 gaming build took about 55.54 seconds, so the UI copy now sets the expectation that local AI can take about a minute.
- The frontend API client now supports `NEXT_PUBLIC_API_BASE_URL`; `dev.ps1` sets it to the active FastAPI origin so long local-model requests bypass the Next dev proxy timeout.
- A final live UI demo pass on `/builder` completed against the real FastAPI backend:
  - `Fast compatibility` + `Generate build`: HTTP 200, `fallback: false`, 0 compatibility warnings, 0 compatibility issues.
  - `AI-assisted` + `local_qwen` + `Generate build`: HTTP 200, `ai_assisted: true`, `fallback: false`, `retrieval.profile: local_qwen`, `ranker_mode: json_ranker`, 0 compatibility warnings, 0 compatibility issues.
  - `AI-assisted` + `gemini_free` + `Generate build`: HTTP 200, `fallback: true`, `fallback_reason: ai_ranker_rejected`, 0 compatibility warnings, 0 compatibility issues.

AI-assisted is the primary user path. The deterministic PC Builder remains the compatibility authority, automatic safety fallback, and manually selectable Fast compatibility mode because Gemini quota, API errors, stale indexes, or invalid AI selections must never break the builder flow.

## Next Steps

1. Measure local Qwen ranker latency across the remaining common budgets and decide whether to keep the current 90-second timeout, add richer progress details, or test a faster local chat model for demos. A Rp 20.000.000 gaming run currently takes about 55.54 seconds.
2. Run the local readiness command before long sync, demo, or comparison runs:
   `python -m backend.utils.local_ai_readiness --profile local_qwen --timeout 90 --fail-on-error`
3. Smoke-test local Qwen retrieval against Qdrant after any resync:
   `python -m backend.utils.qdrant_smoke --profile local_qwen --category gpu --query "RTX 4060 under 6 juta" --top-k 5`
4. Call `POST /build/ai-recommend` with `"ai_profile": "local_qwen"` and confirm the response returns `ai_assisted: true`, `fallback: false`, and `ranker_mode: json_ranker` after deterministic validation. If fallback is used, verify that the fallback reason is explicit and compatibility warnings remain empty for accepted builds.
5. Rerun the four-budget AI-assisted versus deterministic comparison with `local_qwen` after dataset, embedding, prompt, timeout, or repair-rule changes:
   - budget safety
   - required slot completeness, excluding optional HDD
   - CPU and motherboard socket compatibility
   - motherboard and RAM generation compatibility
   - PSU headroom
   - casing fit
   - marketplace link availability
6. Rerun the deterministic preset quality audit after allocation, ranking, parser, or catalog changes:
   `python -m backend.utils.preset_quality_audit --output data/preset_quality_report.json`
7. Design `POST /build/ai-upgrade` after the AI-primary Builder release is stable.
8. Preserve explicit Gemini fallback copy as a safety guardrail in demos and production acceptance.
9. Design `/build/ai-upgrade` only after the Build from zero AI-assisted flow is stable.

---

# Appendix — Local Model Setup (LM Studio + Qwen)

> Environment setup for the `local_qwen` profile. Optional; only needed for offline/local AI development. The cloud path uses Gemini + Cloudflare Workers AI and needs none of this.

## Runtime Targets

Values for the `local_qwen` provider profile:

```env
LMSTUDIO_BASE_URL=http://localhost:1234/v1
LMSTUDIO_LLM_MODEL=qwen/qwen3.6-27b
LMSTUDIO_EMBEDDING_MODEL=text-embedding-qwen3-embedding-4b
LMSTUDIO_TIMEOUT_SECONDS=90
QDRANT_VECTOR_SIZE=2560
QDRANT_DISTANCE=cosine
```

Diagnostic values proven to work for retrieval only (do not mix with the Qwen embedding collection):

```env
LMSTUDIO_EMBEDDING_MODEL=text-embedding-nomic-embed-text-v1.5
QDRANT_COLLECTION_QWEN=kompare_components_nomic
QDRANT_VECTOR_SIZE=768
```

## Loaded Models

- **LLM:** `qwen/qwen3.6-27b` (context 4096, ~17.5 GB, Q4_K_M).
- **Embedding:** `text-embedding-qwen3-embedding-4b` (2560 dims, ~2.5 GB, Q4_K_M).
- **Diagnostic embedding fallback:** `text-embedding-nomic-embed-text-v1.5` (768 dims).

Use `text-embedding-qwen3-embedding-4b` as the primary; Nomic is the verified retrieval-only fallback.

## Qdrant Collections

Keep Gemini and Qwen embeddings in separate collections — never mix vectors from different embedding models.

```text
collection: kompare_components_qwen
vector name: dense
vector size: 2560
distance: cosine
embedding model: text-embedding-qwen3-embedding-4b
```

Both `kompare_components_qwen` (2560 dims) and the diagnostic `kompare_components_nomic` (768 dims) have been synced with 6476 component vectors. Qdrant runs locally in Docker as `kompare-qdrant`. Point IDs use deterministic UUIDs (the server rejects raw SHA-256 hex).

Recommended query instruction prefix:

```text
Instruct: Retrieve relevant PC component catalog entries for an Indonesian custom PC build, matching category, budget, specs, compatibility, and value.
Query: ...
```

## Local Development Provider Order

```text
1. Explicit development selection: LM Studio / `local_qwen`
2. Default development and production selection: Gemini API / `gemini_free`
3. Deterministic Kompare fallback
```

## LM Studio Server Commands

```powershell
# path: C:\Users\<user>\.lmstudio\bin\lms.exe
lms server start            # start
lms server status           # check
lms ps                      # loaded models
lms ls                      # downloaded models
lms server stop             # stop
curl.exe http://localhost:1234/v1/models
```

## Smoke Tests

Embeddings — expect `2560` for the Qwen model:

```powershell
$body = @{ model = "text-embedding-qwen3-embedding-4b"; input = @("smoke test") } | ConvertTo-Json -Depth 5
(Invoke-RestMethod -Uri http://localhost:1234/v1/embeddings -Method Post -ContentType "application/json" -Body $body).data[0].embedding.Count
```

Chat — expect final content containing `LOCAL_MODEL_OK`:

```powershell
$body = @{
  model = "qwen/qwen3.6-27b"
  messages = @(
    @{ role = "system"; content = "Answer directly. Do not explain." },
    @{ role = "user"; content = "Reply with exactly: LOCAL_MODEL_OK" }
  )
  temperature = 0.1; max_tokens = 500
} | ConvertTo-Json -Depth 8
Invoke-RestMethod -Uri http://localhost:1234/v1/chat/completions -Method Post -ContentType "application/json" -Body $body
```

## Qwen/LM Studio Caveat

Qwen3.6 may return useful output in `choices[0].message.reasoning_content` while `choices[0].message.content` is empty, especially for structured JSON. The adapter should read:

```python
text = message.content or getattr(message, "reasoning_content", None) or ""
```

Then trim whitespace before parsing. The current backend uses a small SKU-only JSON schema (not long-form reasoning); with `LMSTUDIO_TIMEOUT_SECONDS=90`, live `ai-recommend` calls using `ai_profile=local_qwen` complete as `ranker_mode: json_ranker` before deterministic validation.
