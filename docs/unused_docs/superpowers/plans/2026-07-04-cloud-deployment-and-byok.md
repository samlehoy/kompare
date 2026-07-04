# Cloud Deployment and Gemini BYOK Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement Gemini BYOK key overrides, Qdrant Cloud connectivity, FastAPI deployment configurations for Render/Cloudflare, and resolve the failing GPU upgrade test.

**Architecture:** Use client-side `localStorage` to persist personal Gemini keys and attach them to outgoing API requests via headers, while updating the backend to extract those headers, update the AI profile for Qdrant Cloud connection, and fix in-stock preference sorting.

**Tech Stack:** Next.js, FastAPI, Qdrant, Google Gemini SDK

---

### Task 1: Fix GPU Upgrade Stock Preference (Resolve Failing Test)

Ensure that `_best_gpu_upgrade` prioritizes in-stock GPU candidates before evaluating out-of-stock options.

**Files:**
*   Modify: [build_pc.py](file:///f:/Project/kompare/backend/utils/build_pc.py#L1532-L1544)
*   Test: [test_pc_builder_refactor.py](file:///f:/Project/kompare/backend/tests/test_pc_builder_refactor.py#L1192)

- [ ] **Step 1: Write/Inspect the failing test**
    *   Verify the test by running the test suite.
    *   Run: `rtk python -m pytest backend/tests/test_pc_builder_refactor.py::test_upgrade_gpu_recommendation_prefers_available_value_upgrade_over_unavailable_flagship -v`
    *   Expected: FAIL (asserts `'gpu-flagship-out' == 'gpu-value-fresh'`)

- [ ] **Step 2: Update `_best_gpu_upgrade` in `build_pc.py`**
    *   Modify `_best_gpu_upgrade` to filter for in-stock options first.
    ```python
    def _best_gpu_upgrade(gpus: list[dict], budget: int, detected_gpu: Optional[dict], use_case: str = "gaming") -> Optional[dict]:
        current_vram = _component_specs(detected_gpu).get("vram_gb") or 0
        candidates = [g for g in gpus if g.get("price_idr", 0) <= budget]
        better = [g for g in candidates if (_component_specs(g).get("vram_gb") or 0) > current_vram]
        pool = better or candidates
        if not pool:
            return None
        
        # Prioritize in-stock candidates
        in_stock = [g for g in pool if str(g.get("stock_status") or "").strip().lower() in {"in_stock", "instock", "ready", "available", "stock"}]
        final_pool = in_stock if in_stock else pool
        
        return _best_ranked_component(
            final_pool,
            "gpu",
            budget,
            {"current_vram_gb": current_vram, "use_case": use_case},
        )
    ```

- [ ] **Step 3: Verify the test passes**
    *   Run: `rtk python -m pytest backend/tests/test_pc_builder_refactor.py::test_upgrade_gpu_recommendation_prefers_available_value_upgrade_over_unavailable_flagship -v`
    *   Expected: PASS

- [ ] **Step 4: Commit changes**
    *   Run:
        ```bash
        git add backend/utils/build_pc.py
        git commit -m "fix: prioritize in-stock GPUs in upgrade recommendation"
        ```

---

### Task 2: Backend `gemini_client.py` API Key Override

Add parameter support for bypassing key rotation and utilizing a user-provided API key override.

**Files:**
*   Modify: [gemini_client.py](file:///f:/Project/kompare/backend/gemini_client.py)
*   Test: [test_gemini_client.py](file:///f:/Project/kompare/backend/tests/test_gemini_client.py)

- [ ] **Step 1: Update `_run_with_key_rotation` to support `api_key_override`**
    *   Modify `_run_with_key_rotation` signature and add fast-path bypass for override:
    ```python
    def _run_with_key_rotation(
        operation: Callable[[Any, str], Any],
        *,
        quota_message: str,
        failure_prefix: str,
        api_key_override: Optional[str] = None,
    ) -> Any:
        if api_key_override:
            model = _get_model()
            client = _get_client(api_key_override, model)
            try:
                return operation(client, model)
            except Exception as exc:
                msg = str(exc)
                raise GeminiError(f"{failure_prefix}: {msg}") from exc
        # ... existing key rotation logic ...
    ```

- [ ] **Step 2: Add `api_key_override` support to public client functions**
    *   Update `generate_chat_reply`, `generate_multimodal_json`, `generate_structured_json` (if exists), `generate_json`, and `embed_texts` to accept `api_key_override: Optional[str] = None` and pass it to `_run_with_key_rotation`.
    *   Example for `generate_chat_reply`:
    ```python
    def generate_chat_reply(
        messages: list[dict],
        *,
        system_instruction: Optional[str] = None,
        temperature: float = 0.6,
        api_key_override: Optional[str] = None,
    ) -> str:
        # ... logic ...
        response = _run_with_key_rotation(
            operation,
            quota_message="...",
            failure_prefix="...",
            api_key_override=api_key_override,
        )
        # ...
    ```

- [ ] **Step 3: Write tests for key override**
    *   Add a test in `backend/tests/test_gemini_client.py` asserting that when `api_key_override` is passed, genai Client is created with it and rotation is bypassed.

- [ ] **Step 4: Verify tests pass**
    *   Run: `rtk python -m pytest backend/tests/test_gemini_client.py -v`
    *   Expected: PASS

- [ ] **Step 5: Commit changes**
    *   Run:
        ```bash
        git add backend/gemini_client.py backend/tests/test_gemini_client.py
        git commit -m "feat: add api_key_override support to gemini_client"
        ```

---

### Task 3: Backend `ai_providers` Profile Update for Qdrant Cloud

Add vector credential fields to the `AIProviderProfile` struct and dynamically fetch `QDRANT_API_KEY`.

**Files:**
*   Modify: [ai_providers.py](file:///f:/Project/kompare/backend/ai_providers.py)
*   Test: [test_ai_provider_profiles.py](file:///f:/Project/kompare/backend/tests/test_ai_provider_profiles.py)

- [ ] **Step 1: Add `vector_api_key` to `AIProviderProfile`**
    *   Update the dataclass:
    ```python
    @dataclass(frozen=True)
    class AIProviderProfile:
        # ... existing ...
        vector_api_key: str | None = None
        # ...
    ```

- [ ] **Step 2: Update `_gemini_free_profile` and `_local_qwen_profile`**
    *   Let `_gemini_free_profile` dynamically switch to `qdrant` as vector backend if `QDRANT_URL` environment variable is defined.
    ```python
    def _gemini_free_profile() -> AIProviderProfile:
        qdrant_url = _env("QDRANT_URL")
        vector_backend = "qdrant" if qdrant_url else "local_json"
        return AIProviderProfile(
            name="gemini_free",
            llm_provider="gemini",
            embedding_provider="gemini",
            vector_backend=vector_backend,
            llm_model=_env("GEMINI_MODEL", DEFAULT_GEMINI_LLM_MODEL),
            embedding_model=_env("GEMINI_EMBEDDING_MODEL", DEFAULT_GEMINI_EMBEDDING_MODEL),
            vector_index_path=_env("GEMINI_VECTOR_INDEX_PATH", "data/vector_index"),
            vector_url=qdrant_url or None,
            vector_collection=_env("QDRANT_COLLECTION_GEMINI", "kompare_components_gemini"),
            vector_api_key=_env("QDRANT_API_KEY") or None,
            embedding_dimension=_env_int("GEMINI_EMBEDDING_DIMENSION", 768),
        )
    ```
    *   Update `_local_qwen_profile` to load `QDRANT_API_KEY` into `vector_api_key`.

- [ ] **Step 3: Update `test_ai_provider_profiles.py`**
    *   Ensure all tests adapt to the new fields and pass.

- [ ] **Step 4: Commit changes**
    *   Run:
        ```bash
        git add backend/ai_providers.py backend/tests/test_ai_provider_profiles.py
        git commit -m "feat: add vector_api_key to AIProviderProfile and upgrade gemini_free to Qdrant if URL set"
        ```

---

### Task 4: Qdrant Client Credentials support

Add header authentication support to `QdrantVectorStore`.

**Files:**
*   Modify: [qdrant_store.py](file:///f:/Project/kompare/backend/utils/qdrant_store.py)
*   Modify: [qdrant_sync.py](file:///f:/Project/kompare/backend/utils/qdrant_sync.py)
*   Test: [test_qdrant_vector_store.py](file:///f:/Project/kompare/backend/tests/test_qdrant_vector_store.py)

- [ ] **Step 1: Update `_default_transport` to accept `api_key`**
    *   Modify `_default_transport(base_url)` in `qdrant_store.py`:
    ```python
    def _default_transport(base_url: str, api_key: str | None = None) -> Transport:
        clean_base = base_url.rstrip("/")

        def transport(method: str, path: str, payload: dict | None, timeout: int) -> dict:
            data = None if payload is None else json.dumps(payload).encode("utf-8")
            headers = {"Content-Type": "application/json"}
            if api_key:
                headers["api-key"] = api_key
            request = urllib.request.Request(
                f"{clean_base}{path}",
                data=data,
                headers=headers,
                method=method,
            )
            # ... rest of code ...
    ```

- [ ] **Step 2: Update `QdrantVectorStore.__init__` and `from_profile`**
    *   Pass `api_key` parameter down from initialization and from profile properties.

- [ ] **Step 3: Update `qdrant_sync.py` profile validation**
    *   Allow validation for any profile where `vector_backend == "qdrant"`, instead of strictly matching `local_qwen`.

- [ ] **Step 4: Verify tests pass**
    *   Run: `rtk python -m pytest backend/tests/test_qdrant_vector_store.py -v`
    *   Expected: PASS

- [ ] **Step 5: Commit changes**
    *   Run:
        ```bash
        git add backend/utils/qdrant_store.py backend/utils/qdrant_sync.py backend/tests/test_qdrant_vector_store.py
        git commit -m "feat: add api-key authentication to Qdrant REST transport and update sync tool"
        ```

---

### Task 5: FastAPI CORS and Header Interception

Add `X-Gemini-Api-Key` extraction from incoming headers and inject it into backend request pipelines.

**Files:**
*   Modify: [app.py](file:///f:/Project/kompare/backend/app.py)
*   Modify: [ai_build_recommendation.py](file:///f:/Project/kompare/backend/utils/ai_build_recommendation.py)
*   Test: [test_pc_builder_surface.py](file:///f:/Project/kompare/backend/tests/test_pc_builder_surface.py)

- [ ] **Step 1: Update CORS configuration**
    *   Allow CORS requests originating from `https://*.pages.dev` in `app.py`.

- [ ] **Step 2: Add header parameter to FastAPI endpoints**
    *   Add `x_gemini_api_key: Optional[str] = Header(None)` to `/build/ai-recommend`, `/build/advisor`, and `/build/audit`.
    *   Extract the key and forward it to downstream business functions (`compose_ai_build`, `generate_chat_reply`, etc.).
    *   Example:
    ```python
    @app.post("/build/advisor")
    def build_advisor(req: BuildAdvisorRequest, x_gemini_api_key: Optional[str] = Header(None)):
        # ...
        answer = generate_chat_reply(
            messages,
            system_instruction=system,
            temperature=0.3,
            api_key_override=x_gemini_api_key,
        )
        # ...
    ```

- [ ] **Step 3: Update `compose_ai_build` signature**
    *   Update `compose_ai_build` in `ai_build_recommendation.py` to accept `api_key_override: Optional[str] = None` and forward it to `embed_texts` and `generate_json` (under `ranker`).

- [ ] **Step 4: Verify FastAPI endpoints with a unit test**
    *   Add tests in `test_pc_builder_surface.py` using `TestClient` to verify that custom headers are correctly passed.

- [ ] **Step 5: Commit changes**
    *   Run:
        ```bash
        git add backend/app.py backend/utils/ai_build_recommendation.py backend/tests/test_pc_builder_surface.py
        git commit -m "feat: extract X-Gemini-Api-Key headers in FastAPI endpoints and add CORS wildcard patterns"
        ```

---

### Task 6: Frontend API Key Settings UI and Request Headers

Add a Settings panel to the retro desktop shell, persist personal API keys in `localStorage`, and inject them into API requests.

**Files:**
*   Modify: [api.js](file:///f:/Project/kompare/frontend/lib/api.js)
*   Modify: [DesktopShell.jsx](file:///f:/Project/kompare/frontend/components/shell/DesktopShell.jsx) (or parent navigation wrapper)
*   Create: `frontend/components/shell/ApiKeySettings.jsx`

- [ ] **Step 1: Inject header in `api.js` request wrapper**
    *   Retrieve the key from `localStorage` under key name `kompare_user_gemini_key`.
    *   If present, attach it to headers:
    ```javascript
    const key = typeof window !== 'undefined' ? localStorage.getItem('kompare_user_gemini_key') : null;
    const requestHeaders = {
      ...headers,
      ...(key ? { 'X-Gemini-Api-Key': key } : {})
    };
    ```

- [ ] **Step 2: Create `ApiKeySettings.jsx` modal/panel**
    *   Implement input form, persistent save to `localStorage`, visual indicator status ("Using Server Key" vs "Using Personal Key"), and clear button. Keep styling aligned with `kompare95.css`.

- [ ] **Step 3: Integrate settings modal into `DesktopShell.jsx`**
    *   Add option to open the settings modal from the desktop start menu or toolbar.

- [ ] **Step 4: Validate Next.js production build**
    *   Run: `rtk npm --prefix frontend run build`
    *   Expected: Success

- [ ] **Step 5: Commit changes**
    *   Run:
        ```bash
        git add frontend/
        git commit -m "feat: add api key settings panel and intercept outbound api request headers"
        ```
