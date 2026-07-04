# Local Model Readiness Handoff

Date: 2026-05-21

This document captures the local LM Studio setup prepared for Kompare so another context window can plug it into the backend plan.

## Status

The local model stack is ready for the current experimental backend integration.

- LM Studio local server is running on `http://localhost:1234`.
- Qwen3.6 27B is loaded for chat/completions.
- Qwen3-Embedding-4B is loaded for embeddings.
- Qwen3-Embedding-4B is now responding after restarting LM Studio.
- The `kompare_components_qwen` Qdrant collection has been synced with 6476 component vectors at 2560 dimensions.
- Qwen3.6 27B chat/completions is reachable and can pass the compact strict JSON readiness probe.
- Kompare now uses a constrained SKU-choice JSON ranker for `local_qwen`: Qdrant retrieves candidates, the local model chooses exact SKU enum values per required slot, and deterministic validation/repair still checks budget, socket, RAM generation, PSU, and casing safety.
- `text-embedding-nomic-embed-text-v1.5` was verified as a working diagnostic embedding fallback with 768 dimensions.
- Qdrant is running in Docker as `kompare-qdrant`, and a diagnostic collection named `kompare_components_nomic` was successfully synced with 6476 component vectors.
- LM Studio MCP bridge was added to Codex config separately for local preparation workflows.

## Runtime Targets

Use these values for the Kompare `local_qwen` provider profile:

```env
LMSTUDIO_BASE_URL=http://localhost:1234/v1
LMSTUDIO_LLM_MODEL=qwen/qwen3.6-27b
LMSTUDIO_EMBEDDING_MODEL=text-embedding-qwen3-embedding-4b
LMSTUDIO_TIMEOUT_SECONDS=90
QDRANT_VECTOR_SIZE=2560
QDRANT_DISTANCE=cosine
```

Temporary diagnostic values that were proven to work for retrieval only:

```env
LMSTUDIO_EMBEDDING_MODEL=text-embedding-nomic-embed-text-v1.5
QDRANT_COLLECTION_QWEN=kompare_components_nomic
QDRANT_VECTOR_SIZE=768
```

These diagnostic values should not be mixed with the Qwen embedding collection.

## Loaded Models

LLM:

```text
id: qwen/qwen3.6-27b
file: F:\lmstudio_models\lmstudio-community\Qwen3.6-27B-GGUF\Qwen3.6-27B-Q4_K_M.gguf
context: 4096
parallel: 4
size: 17.48 GB
```

Embedding:

```text
id: text-embedding-qwen3-embedding-4b
file: F:\lmstudio_models\Qwen\Qwen3-Embedding-4B-GGUF\Qwen3-Embedding-4B-Q4_K_M.gguf
context: 4096
vector dimension: 2560
size: 2.50 GB
```

LM Studio also has `text-embedding-nomic-embed-text-v1.5` available. Kompare should use `text-embedding-qwen3-embedding-4b` once that endpoint responds reliably, but Nomic is currently the verified local retrieval fallback.

## Smoke Tests

Check the server:

```powershell
C:\Users\eleonorez\.lmstudio\bin\lms.exe server status
curl.exe http://localhost:1234/v1/models
```

Expected model IDs from `/v1/models`:

```text
qwen/qwen3.6-27b
text-embedding-qwen3-embedding-4b
text-embedding-nomic-embed-text-v1.5
```

Test embeddings:

```powershell
$body = @{
  model = "text-embedding-qwen3-embedding-4b"
  input = @("Kompare local embedding smoke test")
} | ConvertTo-Json -Depth 5

$response = Invoke-RestMethod `
  -Uri http://localhost:1234/v1/embeddings `
  -Method Post `
  -ContentType "application/json" `
  -Body $body

$response.data[0].embedding.Count
```

Expected result:

```text
2560
```

Current observed result after restarting LM Studio:

```text
Kompare backend requests to text-embedding-qwen3-embedding-4b returned 2560-dimension vectors.
Qdrant collection kompare_components_qwen contains 6476 synced component vectors.
```

Test chat:

```powershell
$body = @{
  model = "qwen/qwen3.6-27b"
  messages = @(
    @{ role = "system"; content = "Answer directly. Do not explain." },
    @{ role = "user"; content = "Reply with exactly: LOCAL_MODEL_OK" }
  )
  temperature = 0.1
  max_tokens = 500
} | ConvertTo-Json -Depth 8

Invoke-RestMethod `
  -Uri http://localhost:1234/v1/chat/completions `
  -Method Post `
  -ContentType "application/json" `
  -Body $body
```

Expected final content contains:

```text
LOCAL_MODEL_OK
```

For strict JSON ranker use, also verify that the model can return compact JSON without visible reasoning text and without exceeding the backend timeout. The current backend path uses a small SKU-only schema instead of asking the model to produce long-form reasoning. With `LMSTUDIO_TIMEOUT_SECONDS=90`, live `POST /build/ai-recommend` calls using `ai_profile=local_qwen` can complete as `ranker_mode: json_ranker` before deterministic validation.

## Backend Integration Notes

Provider order for Kompare:

```text
1. LM Studio / local_qwen
2. Gemini API
3. Deterministic Kompare fallback
```

Use Qdrant as the first vector database. Keep Gemini and Qwen embeddings in separate Qdrant collections. Do not mix vectors from different embedding models.

Recommended Qdrant collection for this local model:

```text
collection: kompare_components_qwen
vector name: dense
vector size: 2560
distance: cosine
embedding model: text-embedding-qwen3-embedding-4b
```

Recommended query instruction prefix:

```text
Instruct: Retrieve relevant PC component catalog entries for an Indonesian custom PC build, matching category, budget, specs, compatibility, and value.
Query: ...
```

Important Qwen/LM Studio caveat:

```text
Qwen3.6 may return useful output in choices[0].message.reasoning_content while choices[0].message.content is empty, especially for structured JSON tests.
```

The local LM Studio adapter should therefore read:

```python
text = message.content or getattr(message, "reasoning_content", None) or ""
```

Then trim leading/trailing whitespace before parsing or displaying.

Current local AI build behavior:

```text
ranker_mode: json_ranker
ranker_error: null
validation_source: deterministic
```

This means local embeddings, Qdrant retrieval, and the constrained Qwen JSON ranker are working together. The ranker chooses exact SKUs from retrieved candidates, then Kompare applies deterministic compatibility and budget repair before accepting the build. A retrieval-score fallback remains available for provider errors, stale indexes, or timeouts, but it should not be the normal path for the current local setup.

## Local Server Commands

Start server:

```powershell
C:\Users\eleonorez\.lmstudio\bin\lms.exe server start
```

List loaded models:

```powershell
C:\Users\eleonorez\.lmstudio\bin\lms.exe ps
```

List downloaded models:

```powershell
C:\Users\eleonorez\.lmstudio\bin\lms.exe ls
```

Stop server:

```powershell
C:\Users\eleonorez\.lmstudio\bin\lms.exe server stop
```
