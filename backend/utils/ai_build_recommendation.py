from __future__ import annotations

from pathlib import Path
from typing import Any

from backend.ai_providers import (
    AIProviderError,
    AIProviderProfile,
    get_ai_profile,
    lmstudio_client_from_profile,
)
from backend.gemini_client import GeminiError, embed_texts, generate_json
from backend.prompts.ai_build_ranker import (
    AIRankerParseError,
    build_compact_ai_ranker_prompt,
    build_ai_ranker_prompt,
    build_local_sku_choice_prompt,
    build_sku_choice_schema,
    parse_ai_ranker_response,
    sku_choice_payload_to_ranker_response,
)
from backend.utils.ai_rag_chunks import catalog_hash
from backend.utils.ai_rag_index import (
    VectorIndexUnavailable,
    load_vector_index,
    manifest_is_stale,
)
from backend.utils.ai_rag_retrieval import (
    AI_REQUIRED_SLOTS,
    SLOT_CATEGORY,
    STOCK_OK,
    _normalized,
    _slot_budget_limit,
    build_slot_query_texts,
    retrieve_build_candidates,
)
from backend.utils.build_pc import (
    _apply_budget_strategy,
    compatibility_messages,
    compose_build,
    budget_band_for,
    normalize_marketplace_links,
    normalize_budget_strategy,
    normalize_performance_priority,
    pick_motherboard,
    pick_ram,
    validate_build,
)
from backend.utils.qdrant_store import QdrantVectorStore


PROJECT_DIR = Path(__file__).resolve().parents[2]
DATA_DIR = Path(__file__).resolve().parents[2] / "data"
VECTOR_INDEX_DIR = DATA_DIR / "vector_index"
LOCAL_QUERY_PREFIX = (
    "Instruct: Retrieve relevant PC component catalog entries for an Indonesian "
    "custom PC build, matching category, budget, specs, compatibility, and value.\n"
    "Query: "
)
LOCAL_RANKER_TOP_K = 3
GPU_VENDOR_PREFERENCE_ALIASES = {
    "nvidia": {"nvidia", "geforce"},
    "geforce": {"nvidia", "geforce"},
    "amd": {"amd", "radeon"},
    "radeon": {"amd", "radeon"},
    "intel": {"intel", "arc"},
    "intel arc": {"intel", "arc"},
    "arc": {"intel", "arc"},
}
AI_RANKER_JSON_SCHEMA = {
    "type": "object",
    "properties": {
        "selected_skus": {
            "type": "object",
            "additionalProperties": {"type": "string"},
        },
        "slot_rationales": {
            "type": "object",
            "additionalProperties": {"type": "string"},
        },
        "summary": {"type": "string"},
        "tradeoffs": {
            "type": "array",
            "items": {"type": "string"},
        },
    },
    "required": ["selected_skus", "slot_rationales", "summary", "tradeoffs"],
    "additionalProperties": False,
}


def _flat_components(by_category: dict[str, list[dict]]) -> list[dict]:
    return [
        component
        for components in by_category.values()
        for component in components
    ]


def _fallback(
    by_category: dict[str, list[dict]],
    budget: int,
    use_case: str,
    reason: str,
    **kwargs: Any,
) -> dict:
    result = compose_build(by_category, budget, use_case, **kwargs)
    return {
        **result,
        "ai_assisted": False,
        "fallback": True,
        "fallback_reason": reason,
        "validation_source": "deterministic",
    }


def _component_sku(component: dict | None) -> str:
    if not component:
        return ""
    return str(component.get("sku") or component.get("id") or "").strip()


def _selected_components(
    candidates_by_slot: dict[str, list[dict]],
    selected_skus: dict[str, str],
) -> dict[str, dict | None]:
    selected: dict[str, dict | None] = {}
    for slot in AI_REQUIRED_SLOTS:
        wanted_sku = str(selected_skus.get(slot) or "").strip()
        selected[slot] = next(
            (
                component
                for component in candidates_by_slot.get(slot, [])
                if _component_sku(component) == wanted_sku
            ),
            None,
        )
    return selected


def _normal_component_price(component: dict | None) -> int:
    if not component:
        return 0
    try:
        return int(component.get("price_idr") or 0)
    except (TypeError, ValueError):
        return 0


def _spec_value(component: dict | None, *keys: str) -> str:
    if not component:
        return ""
    specs = component.get("specs") or {}
    if not isinstance(specs, dict):
        return ""
    for key in keys:
        value = specs.get(key)
        if value not in (None, ""):
            return str(value).strip().upper().replace(" ", "")
    return ""


def _total_price(components: dict[str, dict | None]) -> int:
    return sum(_normal_component_price(component) for component in components.values())


def _has_error_warnings(warnings: list[dict]) -> bool:
    return any(warning.get("severity") == "error" for warning in warnings)


def _sockets_match(cpu: dict | None, motherboard: dict | None) -> bool:
    cpu_socket = _spec_value(cpu, "socket")
    motherboard_socket = _spec_value(motherboard, "socket")
    if not cpu_socket or not motherboard_socket:
        return False
    return cpu_socket in motherboard_socket or motherboard_socket in cpu_socket


def _ram_matches_motherboard(motherboard: dict | None, ram: dict | None) -> bool:
    target_memory_type = _spec_value(motherboard, "ram_type", "memory_type")
    ram_type = _spec_value(ram, "type", "ram_type", "memory_type")
    if not target_memory_type or not ram_type:
        return False
    return target_memory_type == ram_type


def _cpu_matches_brand(component: dict, brand: str | None) -> bool:
    wanted = _normalized(brand)
    if not wanted:
        return True
    specs = component.get("specs") or {}
    candidate_brand = _normalized(specs.get("brand") or component.get("brand"))
    if candidate_brand == wanted:
        return True
    return wanted in _normalized(component.get("name"))


def _gpu_matches_vendor(component: dict, vendor: str | None) -> bool:
    wanted_values = GPU_VENDOR_PREFERENCE_ALIASES.get(_normalized(vendor), set())
    if not wanted_values:
        return True
    specs = component.get("specs") or {}
    candidate_vendor = _normalized(specs.get("vendor") or component.get("brand"))
    if candidate_vendor in wanted_values:
        return True
    name = _normalized(component.get("name"))
    return any(value in name for value in wanted_values)


def _preferred_subset_or_original(
    components: list[dict],
    matcher,
    preference: str | None,
) -> list[dict]:
    if not preference:
        return components
    preferred = [component for component in components if matcher(component, preference)]
    return preferred or components


def _apply_component_preferences(
    candidates_by_slot: dict[str, list[dict]],
    *,
    cpu_brand: str | None,
    gpu_vendor: str | None,
) -> dict[str, list[dict]]:
    filtered = {
        slot: list(candidates)
        for slot, candidates in candidates_by_slot.items()
    }
    if "cpu" in filtered:
        filtered["cpu"] = _preferred_subset_or_original(
            filtered["cpu"],
            _cpu_matches_brand,
            cpu_brand,
        )
    if "gpu" in filtered:
        filtered["gpu"] = _preferred_subset_or_original(
            filtered["gpu"],
            _gpu_matches_vendor,
            gpu_vendor,
        )
    return filtered


def _profile_vector_index_dir(profile: AIProviderProfile) -> Path:
    raw_path = profile.vector_index_path or str(VECTOR_INDEX_DIR)
    path = Path(raw_path)
    if path.is_absolute():
        return path
    return PROJECT_DIR / path


def _build_qdrant_candidates(
    *,
    components: list[dict],
    store: QdrantVectorStore,
    query_vectors: dict[str, list[float]],
    budget_idr: int,
    use_case: str,
    top_k: int = 12,
) -> dict[str, list[dict]]:
    components_by_sku = {
        _component_sku(component): component
        for component in components
        if _component_sku(component)
    }
    candidates_by_slot: dict[str, list[dict]] = {}

    for slot in AI_REQUIRED_SLOTS:
        category = SLOT_CATEGORY[slot]
        vector = query_vectors.get(slot) or []
        matches = store.query(vector, top_k=top_k * 3, category=category)
        budget_limit = _slot_budget_limit(slot, budget_idr, use_case)
        slot_candidates: list[dict] = []

        for match in matches:
            component = components_by_sku.get(str(match.get("sku") or "").strip())
            if not component:
                continue
            if _normalized(component.get("category")) != category:
                continue
            if _normalized(component.get("stock_status") or component.get("stock")) not in STOCK_OK:
                continue
            if _normal_component_price(component) > budget_limit:
                continue

            candidate = dict(component)
            candidate["retrieval_score"] = match.get("score")
            slot_candidates.append(candidate)
            if len(slot_candidates) >= top_k:
                break

        candidates_by_slot[slot] = slot_candidates

    return candidates_by_slot


def _first_affordable_compatible_ram(
    candidates: list[dict],
    *,
    target_memory_type: str,
    max_price: int,
) -> dict | None:
    for candidate in candidates:
        if _spec_value(candidate, "type", "ram_type", "memory_type") != target_memory_type:
            continue
        if _normal_component_price(candidate) <= max_price:
            return candidate
    return None


def _first_affordable_compatible_motherboard(
    candidates: list[dict],
    *,
    cpu: dict | None,
    max_price: int,
) -> dict | None:
    for candidate in candidates:
        if not _sockets_match(cpu, candidate):
            continue
        if _normal_component_price(candidate) <= max_price:
            return candidate
    return None


def _first_affordable_compatible_cpu(
    candidates: list[dict],
    *,
    motherboard: dict | None,
    max_price: int,
) -> dict | None:
    for candidate in candidates:
        if not _sockets_match(candidate, motherboard):
            continue
        if _normal_component_price(candidate) <= max_price:
            return candidate
    return None


def _dedupe_components(*component_groups: list[dict]) -> list[dict]:
    deduped = []
    seen = set()
    for group in component_groups:
        for component in group:
            sku = _component_sku(component)
            if not sku or sku in seen:
                continue
            deduped.append(component)
            seen.add(sku)
    return deduped


def _fallback_candidate_pool(
    *,
    candidates_by_slot: dict[str, list[dict]],
    catalog_by_slot: dict[str, list[dict]],
    budget: int,
    use_case: str,
) -> dict[str, list[dict]]:
    pool: dict[str, list[dict]] = {}
    for slot in AI_REQUIRED_SLOTS:
        category = SLOT_CATEGORY[slot]
        budget_limit = _slot_budget_limit(slot, budget, use_case)
        catalog_candidates = [
            component
            for component in catalog_by_slot.get(slot, [])
            if _normalized(component.get("category")) == category
            and _normalized(component.get("stock_status") or component.get("stock")) in STOCK_OK
            and _normal_component_price(component) <= budget_limit
        ]
        pool[slot] = _dedupe_components(
            candidates_by_slot.get(slot, []),
            catalog_candidates,
        )
    return pool


def _inject_baseline_candidates(
    candidates_by_slot: dict[str, list[dict]],
    baseline_components: dict[str, dict | None],
) -> dict[str, list[dict]]:
    injected: dict[str, list[dict]] = {}
    for slot in AI_REQUIRED_SLOTS:
        baseline_component = baseline_components.get(slot)
        baseline_group = [baseline_component] if baseline_component else []
        injected[slot] = _dedupe_components(
            candidates_by_slot.get(slot, []),
            baseline_group,
        )
    return injected


def _ranker_candidates(
    candidates_by_slot: dict[str, list[dict]],
    baseline_components: dict[str, dict | None],
    *,
    limit: int,
) -> dict[str, list[dict]]:
    candidates: dict[str, list[dict]] = {}
    for slot in AI_REQUIRED_SLOTS:
        baseline_component = baseline_components.get(slot)
        baseline_group = [baseline_component] if baseline_component else []
        candidates[slot] = _dedupe_components(
            candidates_by_slot.get(slot, [])[:limit],
            baseline_group,
        )
    return candidates


def _platform_compatible_candidates(
    candidates_by_slot: dict[str, list[dict]],
) -> dict[str, list[dict]]:
    candidates = {
        slot: list(components)
        for slot, components in candidates_by_slot.items()
    }
    cpus = candidates.get("cpu") or []
    motherboards = candidates.get("motherboard") or []
    rams = candidates.get("ram") or []
    if not cpus or not motherboards or not rams:
        return candidates

    viable_motherboards = [
        motherboard
        for motherboard in motherboards
        if any(_sockets_match(cpu, motherboard) for cpu in cpus)
        and any(_ram_matches_motherboard(motherboard, ram) for ram in rams)
    ]
    if not viable_motherboards:
        return candidates

    viable_cpus = [
        cpu
        for cpu in cpus
        if any(_sockets_match(cpu, motherboard) for motherboard in viable_motherboards)
    ]
    viable_rams = [
        ram
        for ram in rams
        if any(_ram_matches_motherboard(motherboard, ram) for motherboard in viable_motherboards)
    ]
    if viable_cpus and viable_rams:
        candidates["cpu"] = viable_cpus
        candidates["motherboard"] = viable_motherboards
        candidates["ram"] = viable_rams
    return candidates


def _repair_selected_components(
    *,
    components: dict[str, dict | None],
    candidates_by_slot: dict[str, list[dict]],
    catalog_by_slot: dict[str, list[dict]] | None = None,
    budget: int,
) -> dict[str, dict | None]:
    repaired = dict(components)
    warnings = validate_build(repaired)

    has_socket_mismatch = any(
        warning.get("id") == "cpu_motherboard_socket_mismatch"
        and warning.get("severity") == "error"
        for warning in warnings
    )
    if has_socket_mismatch:
        current_total = _total_price(repaired)
        current_motherboard_price = _normal_component_price(repaired.get("motherboard"))
        max_motherboard_price = budget - (current_total - current_motherboard_price)
        motherboard_pool = _dedupe_components(
            candidates_by_slot.get("motherboard", []),
            (catalog_by_slot or {}).get("motherboard", []),
        )
        cpu = repaired.get("cpu")
        cpu_socket = _spec_value(cpu, "socket")
        replacement = (
            _first_affordable_compatible_motherboard(
                candidates_by_slot.get("motherboard", []),
                cpu=cpu,
                max_price=max_motherboard_price,
            )
            or pick_motherboard(motherboard_pool, max_motherboard_price, cpu_socket)
        )
        if replacement and _normal_component_price(replacement) > max_motherboard_price:
            replacement = _first_affordable_compatible_motherboard(
                motherboard_pool,
                cpu=cpu,
                max_price=max_motherboard_price,
            )
        if replacement and not _sockets_match(cpu, replacement):
            replacement = _first_affordable_compatible_motherboard(
                motherboard_pool,
                cpu=cpu,
                max_price=max_motherboard_price,
            )
        if replacement and _normal_component_price(replacement) <= max_motherboard_price:
            repaired["motherboard"] = normalize_marketplace_links(dict(replacement))
            warnings = validate_build(repaired)
        elif repaired.get("motherboard"):
            current_total = _total_price(repaired)
            current_cpu_price = _normal_component_price(repaired.get("cpu"))
            max_cpu_price = budget - (current_total - current_cpu_price)
            cpu_pool = _dedupe_components(
                candidates_by_slot.get("cpu", []),
                (catalog_by_slot or {}).get("cpu", []),
            )
            cpu_replacement = _first_affordable_compatible_cpu(
                cpu_pool,
                motherboard=repaired.get("motherboard"),
                max_price=max_cpu_price,
            )
            if cpu_replacement:
                repaired["cpu"] = normalize_marketplace_links(dict(cpu_replacement))
                warnings = validate_build(repaired)

    has_memory_mismatch = any(
        warning.get("id") == "motherboard_ram_type_mismatch"
        and warning.get("severity") == "error"
        for warning in warnings
    )
    if not has_memory_mismatch:
        return repaired

    target_memory_type = _spec_value(repaired.get("motherboard"), "ram_type", "memory_type")
    if not target_memory_type:
        return repaired

    current_total = _total_price(repaired)
    current_ram_price = _normal_component_price(repaired.get("ram"))
    max_ram_price = budget - (current_total - current_ram_price)
    ram_pool = _dedupe_components(
        candidates_by_slot.get("ram", []),
        (catalog_by_slot or {}).get("ram", []),
    )
    replacement = (
        _first_affordable_compatible_ram(
            candidates_by_slot.get("ram", []),
            target_memory_type=target_memory_type,
            max_price=max_ram_price,
        )
        or pick_ram(ram_pool, max_ram_price, target_memory_type)
    )
    if replacement and _normal_component_price(replacement) > max_ram_price:
        replacement = _first_affordable_compatible_ram(
            ram_pool,
            target_memory_type=target_memory_type,
            max_price=max_ram_price,
        )
    if replacement and _spec_value(replacement, "type", "ram_type", "memory_type") != target_memory_type:
        replacement = _first_affordable_compatible_ram(
            ram_pool,
            target_memory_type=target_memory_type,
            max_price=max_ram_price,
        )
    if replacement and _normal_component_price(replacement) > max_ram_price:
        replacement = None
    if replacement:
        repaired["ram"] = normalize_marketplace_links(dict(replacement))
    return repaired


def _budget_repair_selected_components(
    *,
    components: dict[str, dict | None],
    candidates_by_slot: dict[str, list[dict]],
    catalog_by_slot: dict[str, list[dict]],
    budget: int,
    cpu_brand: str | None = None,
    gpu_vendor: str | None = None,
) -> tuple[dict[str, dict | None], set[str]]:
    repaired = dict(components)
    changed_slots: set[str] = set()

    while _total_price(repaired) > budget:
        current_total = _total_price(repaired)
        if _has_error_warnings(validate_build(repaired)):
            return repaired, changed_slots

        best_trial: dict[str, dict | None] | None = None
        best_trial_total: int | None = None
        best_changed_slots: set[str] = set()
        best_key: tuple[int, int] | None = None

        for slot in AI_REQUIRED_SLOTS:
            current = repaired.get(slot)
            current_sku = _component_sku(current)
            current_price = _normal_component_price(current)
            pool = _dedupe_components(
                candidates_by_slot.get(slot, []),
                catalog_by_slot.get(slot, []),
            )
            if slot == "cpu":
                pool = _preferred_subset_or_original(pool, _cpu_matches_brand, cpu_brand)
            elif slot == "gpu":
                pool = _preferred_subset_or_original(pool, _gpu_matches_vendor, gpu_vendor)

            for candidate in pool:
                if _component_sku(candidate) == current_sku:
                    continue
                if _normal_component_price(candidate) >= current_price:
                    continue

                trial = dict(repaired)
                trial[slot] = normalize_marketplace_links(dict(candidate))
                trial = _repair_selected_components(
                    components=trial,
                    candidates_by_slot=candidates_by_slot,
                    catalog_by_slot=catalog_by_slot,
                    budget=budget,
                )
                if _has_error_warnings(validate_build(trial)):
                    continue

                trial_total = _total_price(trial)
                if trial_total >= current_total:
                    continue

                # Prefer the smallest downgrade that gets under budget; otherwise
                # take the largest safe reduction and continue the loop.
                key = (
                    0 if trial_total <= budget else 1,
                    abs(budget - trial_total) if trial_total <= budget else trial_total,
                )
                if best_key is None or key < best_key:
                    best_key = key
                    best_trial = trial
                    best_trial_total = trial_total
                    best_changed_slots = {
                        changed_slot
                        for changed_slot in AI_REQUIRED_SLOTS
                        if _component_sku(trial.get(changed_slot)) != _component_sku(repaired.get(changed_slot))
                    }

        if best_trial is None or best_trial_total is None:
            return repaired, changed_slots

        repaired = best_trial
        changed_slots.update(best_changed_slots)

    return repaired, changed_slots


def _build_metadata(
    *,
    profile: AIProviderProfile,
    current_hash: str,
    manifest: dict | None,
    candidates_by_slot: dict[str, list[dict]],
    selected_skus: dict[str, str],
    ranker_mode: str = "json_ranker",
    ranker_error: str | None = None,
) -> dict:
    manifest = manifest or {}
    metadata = {
        "profile": profile.name,
        "llm_model": profile.llm_model,
        "embedding_model": manifest.get("embedding_model") or profile.embedding_model,
        "vector_backend": profile.vector_backend,
        "vector_collection": profile.vector_collection,
        "ranker_mode": ranker_mode,
        "top_k_per_slot": 12,
        "chunk_count_considered": manifest.get("chunk_count"),
        "catalog_hash": current_hash,
        "required_slots": list(AI_REQUIRED_SLOTS),
        "candidate_counts": {
            slot: len(candidates_by_slot.get(slot, []))
            for slot in AI_REQUIRED_SLOTS
        },
        "selected_skus": {
            slot: selected_skus.get(slot)
            for slot in AI_REQUIRED_SLOTS
        },
    }
    if ranker_error:
        metadata["ranker_error"] = ranker_error
    return metadata


def _retrieval_ranker_payload(candidates_by_slot: dict[str, list[dict]]) -> dict:
    selected_components: dict[str, dict] = {}
    slot_rationales: dict[str, str] = {}

    cpu_candidates = candidates_by_slot.get("cpu", [])
    if cpu_candidates:
        selected_components["cpu"] = cpu_candidates[0]
        slot_rationales["cpu"] = "Top Qdrant retrieval candidate accepted by deterministic validation."

    motherboard_candidates = candidates_by_slot.get("motherboard", [])
    if motherboard_candidates:
        selected_motherboard = next(
            (
                candidate
                for candidate in motherboard_candidates
                if _sockets_match(selected_components.get("cpu"), candidate)
            ),
            motherboard_candidates[0],
        )
        selected_components["motherboard"] = selected_motherboard
        if selected_motherboard is motherboard_candidates[0]:
            slot_rationales["motherboard"] = "Top Qdrant retrieval candidate accepted by deterministic validation."
        else:
            slot_rationales["motherboard"] = "Skipped higher retrieval hits to match the selected CPU socket."

    ram_candidates = candidates_by_slot.get("ram", [])
    if ram_candidates:
        selected_ram = next(
            (
                candidate
                for candidate in ram_candidates
                if _ram_matches_motherboard(selected_components.get("motherboard"), candidate)
            ),
            ram_candidates[0],
        )
        selected_components["ram"] = selected_ram
        if selected_ram is ram_candidates[0]:
            slot_rationales["ram"] = "Top Qdrant retrieval candidate accepted by deterministic validation."
        else:
            slot_rationales["ram"] = "Skipped higher retrieval hits to match motherboard RAM generation."

    for slot in AI_REQUIRED_SLOTS:
        if slot in selected_components:
            continue
        candidates = candidates_by_slot.get(slot, [])
        if not candidates:
            continue
        selected_components[slot] = candidates[0]
        slot_rationales[slot] = "Top Qdrant retrieval candidate accepted by deterministic validation."

    selected_skus = {
        slot: _component_sku(component)
        for slot, component in selected_components.items()
        if _component_sku(component)
    }
    return {
        "selected_skus": selected_skus,
        "slot_rationales": slot_rationales,
        "summary": "Local retrieval selected the strongest compatible candidates before deterministic validation.",
        "tradeoffs": [
            "The local JSON ranker was unavailable, so Kompare used vector retrieval order plus deterministic compatibility checks."
        ],
    }


def compose_ai_build(
    by_category: dict[str, list[dict]],
    budget: int,
    use_case: str,
    *,
    cpu_brand: str | None = None,
    gpu_vendor: str | None = None,
    include_optional_addons: bool = False,
    optional_addon_slots: list[str] | None = None,
    profile_name: str | None = None,
    budget_strategy: str | None = None,
    performance_priority: str | None = None,
    allocation_overrides: dict[str, int] | None = None,
) -> dict:
    deterministic_kwargs = {
        "cpu_brand": cpu_brand,
        "gpu_vendor": gpu_vendor,
        "include_optional_addons": include_optional_addons,
        "optional_addon_slots": optional_addon_slots,
        "budget_strategy": budget_strategy,
        "performance_priority": performance_priority,
        "allocation_overrides": allocation_overrides,
    }
    normalized_budget_strategy = normalize_budget_strategy(budget_strategy)
    normalized_performance_priority = normalize_performance_priority(performance_priority, use_case)
    strategy_requested = (
        budget_strategy is not None
        or performance_priority is not None
        or allocation_overrides is not None
    )
    flat = _flat_components(by_category)
    current_hash = catalog_hash(flat)

    try:
        profile = get_ai_profile(profile_name)
    except AIProviderError:
        return _fallback(
            by_category,
            budget,
            use_case,
            "ai_provider_unavailable",
            **deterministic_kwargs,
        )

    manifest: dict | None = None
    if profile.vector_backend == "local_json":
        try:
            index = load_vector_index(_profile_vector_index_dir(profile))
        except VectorIndexUnavailable:
            return _fallback(
                by_category,
                budget,
                use_case,
                "vector_index_missing",
                **deterministic_kwargs,
            )

        if manifest_is_stale(index.manifest, current_hash):
            return _fallback(
                by_category,
                budget,
                use_case,
                "vector_index_stale",
                **deterministic_kwargs,
            )

        slot_queries = build_slot_query_texts(budget, use_case)
        slot_queries = {
            slot: (
                f"{text} Budget strategy: {normalized_budget_strategy}. "
                f"Performance priority: {normalized_performance_priority}."
            )
            for slot, text in slot_queries.items()
        }
        query_texts = [slot_queries[slot] for slot in AI_REQUIRED_SLOTS]
        try:
            vectors = embed_texts(query_texts)
        except GeminiError:
            return _fallback(
                by_category,
                budget,
                use_case,
                "ai_ranker_rejected",
                **deterministic_kwargs,
            )
        query_vectors = dict(zip(AI_REQUIRED_SLOTS, vectors))

        candidates_by_slot = retrieve_build_candidates(
            flat,
            index,
            query_vectors,
            budget_idr=budget,
            use_case=use_case,
            top_k=12,
        )
        ranker = generate_json
        ranker_prompt_builder = build_ai_ranker_prompt
        manifest = index.manifest
    elif profile.vector_backend == "qdrant":
        try:
            local_client = lmstudio_client_from_profile(profile)
            store = QdrantVectorStore.from_profile(profile)
            slot_queries = build_slot_query_texts(budget, use_case)
            slot_queries = {
                slot: (
                    f"{text} Budget strategy: {normalized_budget_strategy}. "
                    f"Performance priority: {normalized_performance_priority}."
                )
                for slot, text in slot_queries.items()
            }
            query_texts = [
                f"{LOCAL_QUERY_PREFIX}{slot_queries[slot]}"
                for slot in AI_REQUIRED_SLOTS
            ]
            vectors = local_client.embed_texts(query_texts)
            query_vectors = dict(zip(AI_REQUIRED_SLOTS, vectors))
            candidates_by_slot = _build_qdrant_candidates(
                components=flat,
                store=store,
                query_vectors=query_vectors,
                budget_idr=budget,
                use_case=use_case,
                top_k=12,
            )
            ranker = lambda prompt, temperature=0.2: local_client.generate_json(
                prompt,
                temperature=temperature,
                schema=AI_RANKER_JSON_SCHEMA,
            )
            ranker_prompt_builder = build_local_sku_choice_prompt
        except AIProviderError:
            return _fallback(
                by_category,
                budget,
                use_case,
                "ai_provider_unavailable",
                **deterministic_kwargs,
            )
    else:
        return _fallback(
            by_category,
            budget,
            use_case,
            "ai_provider_unavailable",
            **deterministic_kwargs,
        )

    baseline = compose_build(
        by_category,
        budget,
        use_case,
        **deterministic_kwargs,
        _apply_budget_optimizer=False,
    )
    candidates_by_slot = _inject_baseline_candidates(
        candidates_by_slot,
        baseline.get("components") or {},
    )
    candidates_by_slot = _apply_component_preferences(
        candidates_by_slot,
        cpu_brand=cpu_brand,
        gpu_vendor=gpu_vendor,
    )
    ranker_candidates_by_slot = (
        _platform_compatible_candidates(
            _ranker_candidates(
                candidates_by_slot,
                baseline.get("components") or {},
                limit=LOCAL_RANKER_TOP_K,
            )
        )
        if profile.vector_backend == "qdrant"
        else candidates_by_slot
    )

    if any(not ranker_candidates_by_slot.get(slot) for slot in AI_REQUIRED_SLOTS):
        return _fallback(
            by_category,
            budget,
            use_case,
            "retrieval_incomplete",
            **deterministic_kwargs,
        )

    prompt = ranker_prompt_builder(budget, use_case, ranker_candidates_by_slot)
    ranker_mode = "json_ranker"
    ranker_error = None
    selection_candidates_by_slot = ranker_candidates_by_slot
    try:
        if profile.vector_backend == "qdrant":
            sku_choice_payload = local_client.generate_json(
                prompt,
                temperature=0.0,
                schema=build_sku_choice_schema(ranker_candidates_by_slot),
            )
            ranker_payload = sku_choice_payload_to_ranker_response(
                sku_choice_payload,
                ranker_candidates_by_slot,
            )
        else:
            ranker_payload = ranker(prompt, temperature=0.2)
        parsed = parse_ai_ranker_response(ranker_payload, ranker_candidates_by_slot)
    except (GeminiError, AIProviderError, AIRankerParseError) as exc:
        if profile.vector_backend == "qdrant":
            ranker_mode = "retrieval_score_fallback"
            ranker_error = str(exc)
            selection_candidates_by_slot = _fallback_candidate_pool(
                candidates_by_slot=candidates_by_slot,
                catalog_by_slot=by_category,
                budget=budget,
                use_case=use_case,
            )
            selection_candidates_by_slot = _apply_component_preferences(
                selection_candidates_by_slot,
                cpu_brand=cpu_brand,
                gpu_vendor=gpu_vendor,
            )
            parsed = parse_ai_ranker_response(
                _retrieval_ranker_payload(selection_candidates_by_slot),
                selection_candidates_by_slot,
            )
        else:
            return _fallback(
                by_category,
                budget,
                use_case,
                "ai_ranker_rejected",
                **deterministic_kwargs,
            )
    except Exception:
        return _fallback(
            by_category,
            budget,
            use_case,
            "ai_ranker_rejected",
            **deterministic_kwargs,
        )

    selected = _selected_components(selection_candidates_by_slot, parsed["selected_skus"])
    if any(selected.get(slot) is None for slot in AI_REQUIRED_SLOTS):
        return _fallback(
            by_category,
            budget,
            use_case,
            "ai_ranker_missing_slot",
            **deterministic_kwargs,
        )

    components = dict(baseline["components"])
    for slot in AI_REQUIRED_SLOTS:
        components[slot] = normalize_marketplace_links(dict(selected[slot] or {}))
    components = _repair_selected_components(
        components=components,
        candidates_by_slot=candidates_by_slot,
        catalog_by_slot=by_category,
        budget=budget,
    )
    budget_repaired_slots: set[str] = set()
    if profile.vector_backend == "qdrant":
        components, budget_repaired_slots = _budget_repair_selected_components(
            components=components,
            candidates_by_slot=selection_candidates_by_slot,
            catalog_by_slot=by_category,
            budget=budget,
            cpu_brand=cpu_brand,
            gpu_vendor=gpu_vendor,
        )
        if budget_repaired_slots:
            for slot in budget_repaired_slots:
                parsed["slot_rationales"][slot] = (
                    "Adjusted to keep the full build within budget while preserving compatibility."
                )
            parsed["selected_skus"] = {
                slot: _component_sku(components.get(slot))
                for slot in AI_REQUIRED_SLOTS
            }

    if strategy_requested:
        (
            components,
            budget_usage,
            budget_warnings,
            upgrade_suggestions,
            alternative_options,
            performance_balance,
        ) = _apply_budget_strategy(
            by_category,
            components,
            budget,
            use_case,
            budget_strategy=normalized_budget_strategy,
            performance_priority=normalized_performance_priority,
            cpu_brand=cpu_brand,
            gpu_vendor=gpu_vendor,
        )
    else:
        budget_usage = baseline.get("budget_usage")
        budget_warnings = baseline.get("budget_warnings") or []
        upgrade_suggestions = baseline.get("upgrade_suggestions") or []
        alternative_options = baseline.get("alternative_options") or {}
        performance_balance = baseline.get("performance_balance") or {}

    total = _total_price(components)
    compatibility_warnings = validate_build(components)
    if total > budget or _has_error_warnings(compatibility_warnings):
        return _fallback(
            by_category,
            budget,
            use_case,
            "deterministic_validation_failed",
            **deterministic_kwargs,
        )

    return {
        **baseline,
        "components": components,
        "total_idr": total,
        "remaining_idr": budget - total,
        "budget_band": budget_band_for(budget),
        "budget_strategy": normalized_budget_strategy,
        "performance_priority": normalized_performance_priority,
        "budget_usage": budget_usage,
        "budget_warnings": budget_warnings,
        "upgrade_suggestions": upgrade_suggestions,
        "alternative_options": alternative_options,
        "performance_balance": performance_balance,
        "missing_slots": [
            slot for slot, component in components.items()
            if component is None
        ],
        "compatibility_warnings": compatibility_warnings,
        "compatibility_issues": compatibility_messages(compatibility_warnings),
        "ai_assisted": True,
        "fallback": False,
        "retrieval": _build_metadata(
            profile=profile,
            current_hash=current_hash,
            manifest=manifest,
            candidates_by_slot=selection_candidates_by_slot,
            selected_skus=parsed["selected_skus"],
            ranker_mode=ranker_mode,
            ranker_error=ranker_error,
        ),
        "ai_rationale": {
            "summary": parsed["summary"],
            "tradeoffs": parsed["tradeoffs"],
            "slot_rationales": parsed["slot_rationales"],
        },
        "validation_source": "deterministic",
    }
