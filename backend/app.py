"""Kompare REST API.

FastAPI app exposing the PC Builder API. Run with:

    uvicorn backend.app:app --reload --port 8000

The frontend talks to http://localhost:8000 during local development.
"""

from __future__ import annotations

import re

from typing import Optional
from typing import Literal

from fastapi import FastAPI, File, Form, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from backend import services
from backend.gemini_client import GeminiError, generate_chat_reply, generate_multimodal_json
from backend.prompts.build_advisor import (
    SLOT_LABELS as BUILD_ADVISOR_SLOT_LABELS,
    build_advisor_system_instruction,
    detect_referenced_slots,
    evidence_cards as build_advisor_evidence_cards,
    extract_components as build_advisor_extract_components,
    fallback_answer as build_advisor_fallback_answer,
    suggested_questions as build_advisor_suggested_questions,
)
from backend.prompts.build_audit import SLOT_LABELS as BUILD_AUDIT_SLOT_LABELS
from backend.prompts.build_audit import build_build_audit_prompt, normalize_build_audit
from backend.utils.image_preprocessing import prepare_image
from backend.utils.build_pc import (
    ALLOCATION_PRESET_SLOTS,
    BUDGET_STRATEGY_ALLOCATION_SHIFTS,
    BUDGET_TIERS,
    PERFORMANCE_PRIORITY_ALLOCATION_SHIFTS,
    REQUIRED_BUILD_SLOTS,
    USE_CASE_PROFILES,
    analyze_existing_components,
    compatibility_messages,
    compose_build,
    normalize_marketplace_links,
    parse_existing_component,
    recommend_upgrade as compose_upgrade_recommendation,
    validate_build,
)
from backend.utils.ai_build_recommendation import compose_ai_build

# ---------- App ----------

app = FastAPI(
    title="Kompare API",
    version="0.1.0",
    description="AI-Powered PC Builder and budget-to-performance API for the Indonesian PC market.",
)

# Allow common frontend dev server localhost ports during development.
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------- Schemas ----------


class HealthResponse(BaseModel):
    status: str
    version: str
    components_loaded: int


class BuildRequest(BaseModel):
    budget_idr: int = Field(..., gt=0, description="Total budget in IDR")
    use_case: str = Field("gaming", description=f"One of: {list(USE_CASE_PROFILES)}")
    cpu_brand: Optional[str] = Field(None, description="'Intel' or 'AMD' (case-insensitive); soft preference")
    gpu_vendor: Optional[str] = Field(None, description="'Nvidia', 'AMD', or 'Intel'; soft preference")
    budget_strategy: Optional[Literal["value", "balanced", "maximize"]] = Field("balanced", description="Budget usage strategy")
    performance_priority: Optional[Literal["gaming", "productivity", "best_value", "balanced", "upgrade_friendly"]] = Field(None, description="Performance priority for budget allocation and upgrade pass")
    allocation_overrides: Optional[dict[str, int]] = Field(None, description="Optional advanced component allocation percentages. Values must sum to 100 to be applied.")
    include_optional_addons: bool = Field(False, description="When true, recommend optional HDD bulk storage, monitor, and UPS add-ons when catalog data exists")
    selected_optional_addons: Optional[list[str]] = Field(None, description="Optional add-on slots to recommend individually: hdd, monitor, ups")
    ai_profile: Optional[str] = Field(None, description="Optional AI/RAG profile for /build/ai-recommend, e.g. gemini_free or local_qwen")


class UpgradeRequest(BaseModel):
    budget_idr: int = Field(..., gt=0, description="Upgrade budget in IDR")
    use_case: str = Field("gaming", description=f"One of: {list(USE_CASE_PROFILES)}")
    existing_components: dict[str, str] = Field(
        default_factory=dict,
        description="Manual user-entered existing components keyed by slot name",
    )


class ChatMessage(BaseModel):
    role: str = Field(..., description="'user' or 'assistant'")
    content: str = Field(..., min_length=1, max_length=4000)


class BuildAdvisorRequest(BaseModel):
    mode: Literal["build", "upgrade"] = "build"
    question: str = Field(..., min_length=1, max_length=2000)
    context: dict = Field(..., description="Current build or upgrade response object")
    history: list[ChatMessage] = Field(default_factory=list, max_length=12)


class SwapRequest(BaseModel):
    budget_idr: int = Field(..., gt=0)
    use_case: str = "gaming"
    slot: str = Field(..., description="PC builder slot to swap, including cpu_cooler and fan_cooler")
    new_component_id: str = Field(..., description="SKU of replacement component")
    current_build: dict = Field(..., description="Existing build['components'] dict")


class SwapCandidatesRequest(BaseModel):
    budget_idr: int = Field(..., gt=0)
    use_case: str = "gaming"
    slot: str = Field(..., description="PC builder slot to search, including cpu_cooler and fan_cooler")
    current_build: dict = Field(..., description="Existing build['components'] dict")
    q: Optional[str] = Field(None, description="Optional component name search")
    max_price: Optional[int] = Field(None, ge=0)
    limit: int = Field(50, ge=1, le=200)
    offset: int = Field(0, ge=0)


VALID_BUILD_SWAP_SLOTS = {
    "cpu",
    "gpu",
    "ram",
    "motherboard",
    "ssd",
    "hdd",
    "psu",
    "case",
    "cpu_cooler",
    "fan_cooler",
}

BUILD_AUDIT_INPUT_SLOTS = {
    "cpu",
    "motherboard",
    "ram",
    "gpu",
    "ssd",
    "hdd",
    "psu",
    "cpu_cooler",
    "fan_cooler",
    "case",
}

BUILD_AUDIT_SLOT_ALIASES = {
    "processor": "cpu",
    "cpu": "cpu",
    "motherboard": "motherboard",
    "mainboard": "motherboard",
    "mobo": "motherboard",
    "ram": "ram",
    "memory": "ram",
    "gpu": "gpu",
    "vga": "gpu",
    "graphics card": "gpu",
    "ssd": "ssd",
    "nvme": "ssd",
    "hard drive": "hdd",
    "hard disk": "hdd",
    "hdd": "hdd",
    "psu": "psu",
    "power supply": "psu",
    "cpu cooler": "cpu_cooler",
    "cooler": "cpu_cooler",
    "fan cooler": "fan_cooler",
    "case fan": "fan_cooler",
    "casing": "case",
    "case": "case",
}


def _clean_parts_line(line: str) -> str:
    return re.sub(r"^\s*[-*•\d.)]+\s*", "", line or "").strip()


def _slot_from_parts_line(line: str) -> tuple[str | None, str]:
    clean = _clean_parts_line(line)
    if not clean:
        return None, ""

    if ":" in clean:
        prefix, value = clean.split(":", 1)
        key = prefix.strip().lower().replace("_", " ")
        slot = BUILD_AUDIT_SLOT_ALIASES.get(key)
        if slot:
            return slot, value.strip()

    text = clean.lower()
    if any(word in text for word in ["cpu cooler", "ak400", "ag400", "hyper 212", "aio", "liquid cooler"]):
        return "cpu_cooler", clean
    if any(word in text for word in ["case fan", "fan casing", "120mm fan", "140mm fan"]):
        return "fan_cooler", clean
    if any(word in text for word in ["ryzen", "core i", "core ultra", "pentium", "athlon"]):
        return "cpu", clean
    if any(word in text for word in ["motherboard", "mainboard", "b450", "b550", "b650", "h610", "b660", "b760", "x670", "z790", "lga", "am4", "am5"]):
        return "motherboard", clean
    if "ddr" in text or re.search(r"\b\d{1,3}\s*gb\b.*\b(?:3200|3600|5200|5600|6000)\b", text):
        return "ram", clean
    if any(word in text for word in ["rtx", "gtx", "geforce", "radeon", " rx ", "arc a"]):
        return "gpu", clean
    if any(word in text for word in ["nvme", "m.2", "ssd"]):
        return "ssd", clean
    if any(word in text for word in ["hdd", "hard drive", "hard disk", "barracuda"]):
        return "hdd", clean
    if any(word in text for word in ["psu", "power supply", "bronze", "gold"]) or re.search(r"\b\d{3,4}\s*(?:w|watt)\b", text):
        return "psu", clean
    if any(word in text for word in ["case", "casing", "tower"]):
        return "case", clean
    return None, clean


def _parse_parts_list(parts_list: str) -> dict[str, str]:
    parts: dict[str, str] = {}
    for line in (parts_list or "").splitlines():
        slot, value = _slot_from_parts_line(line)
        if slot in BUILD_AUDIT_INPUT_SLOTS and value and slot not in parts:
            parts[slot] = value
    return parts


def _fallback_build_audit(goal: str, parts_list: str) -> dict:
    parts = _parse_parts_list(parts_list)
    analysis = analyze_existing_components(parts)
    detected = analysis["detected_existing"]
    compatibility = validate_build(detected)
    missing_slots = [slot for slot in REQUIRED_BUILD_SLOTS if slot not in detected]
    issues = compatibility + analysis["warning_objects"]
    has_hard_issue = any(issue.get("severity") in {"warning", "error"} for issue in compatibility)
    status = "needs_attention" if has_hard_issue else "incomplete" if missing_slots else "compatible"

    detected_parts = []
    for slot, name in analysis["recognized"].items():
        item = detected.get(slot) or parse_existing_component(slot, name)
        detected_parts.append({
            "slot": slot,
            "slot_label": BUILD_AUDIT_SLOT_LABELS.get(slot, slot),
            "name": name,
            "confidence": 0.7 if item.get("detection_confidence") == "medium" else 0.45,
            "source": "text",
            "extracted_specs": item.get("specs") or {},
        })

    suggested_next_steps = []
    if missing_slots:
        labels = [BUILD_AUDIT_SLOT_LABELS.get(slot, slot) for slot in missing_slots[:4]]
        suggested_next_steps.append(f"Confirm missing parts before buying: {', '.join(labels)}.")
    if compatibility:
        suggested_next_steps.append("Resolve compatibility warnings before checking marketplace prices.")
    if not detected_parts:
        suggested_next_steps.append("Paste one part per line, such as CPU: Ryzen 5 5600 or GPU: RTX 3060 12GB.")

    return normalize_build_audit({
        "status": status,
        "summary": (
            "This build needs attention before buying."
            if status == "needs_attention"
            else "This parts list is incomplete."
            if status == "incomplete"
            else "No major compatibility issue was detected from the typed parts."
        ),
        "detected_parts": detected_parts,
        "compatibility_issues": issues,
        "missing_slots": missing_slots,
        "budget_notes": [f"Goal: {goal.strip()}"] if goal and goal.strip() else [],
        "suggested_next_steps": suggested_next_steps,
    })


def _image_unavailable_build_audit(goal: str) -> dict:
    audit = _fallback_build_audit(goal, "")
    audit["summary"] = "Screenshot uploaded, but image analysis is unavailable. Paste the cart parts as text to continue the audit."
    audit["budget_notes"].append("The screenshot was received, but no parts could be extracted without the multimodal model.")
    audit["suggested_next_steps"] = [
        "Paste the cart parts as text, one component per line, then run Audit build again.",
        "Use labels like CPU:, Motherboard:, RAM:, GPU:, SSD:, HDD:, PSU:, CPU Cooler:, Fan Cooler:, and Casing:.",
    ]
    return audit


def _swap_category(slot: str) -> str:
    return "cooler" if slot in {"cpu_cooler", "fan_cooler"} else slot


def _slot_accepts_candidate(slot: str, component: dict) -> bool:
    if component.get("category") != _swap_category(slot):
        return False
    cooler_type = (component.get("specs") or {}).get("type")
    if slot == "cpu_cooler":
        return cooler_type != "fan"
    if slot == "fan_cooler":
        return cooler_type == "fan"
    return True


def _compatibility_summary(slot: str, candidate: dict, current_build: dict, warnings: list[dict]) -> str:
    if warnings:
        return "Compatible, with notes to review before buying."

    specs = candidate.get("specs") or {}
    cpu_specs = (current_build.get("cpu") or {}).get("specs") or {}
    ram_specs = (current_build.get("ram") or {}).get("specs") or {}
    case_specs = (current_build.get("case") or {}).get("specs") or {}
    gpu_specs = (current_build.get("gpu") or {}).get("specs") or {}

    if slot == "motherboard":
        parts = []
        if specs.get("socket") and cpu_specs.get("socket"):
            parts.append(f"current CPU socket {specs['socket']}")
        if specs.get("ram_type") and ram_specs.get("type"):
            parts.append(f"{specs['ram_type']} memory")
        if specs.get("form_factor") and case_specs.get("max_form_factor"):
            parts.append(f"{specs['form_factor']} casing fit")
        return "Matches " + ", ".join(parts) + "." if parts else "Compatible with current build checks."
    if slot == "ram" and specs.get("type"):
        return f"Matches current motherboard memory generation {specs['type']}."
    if slot == "gpu" and specs.get("recommended_psu_w"):
        return f"Fits the current PSU target at {specs['recommended_psu_w']}W recommendation."
    if slot == "psu" and gpu_specs.get("recommended_psu_w"):
        return f"Covers the current GPU recommendation of {gpu_specs['recommended_psu_w']}W."
    if slot == "cpu_cooler" and specs.get("tdp_w"):
        return f"Covers the selected CPU cooling target up to {specs['tdp_w']}W."
    if slot == "fan_cooler":
        return "Compatible case airflow upgrade."
    return "Compatible with current build checks."


_COST_SAVING_TERMS = (
    "reduce",
    "cheaper",
    "cheap",
    "save",
    "saving",
    "lower price",
    "cut cost",
    "downgrade",
    "less expensive",
    "budget",
)


def _is_cost_saving_question(question: str) -> bool:
    text = (question or "").lower()
    return any(term in text for term in _COST_SAVING_TERMS)


def _component_ref(component: dict | None) -> dict:
    component = component or {}
    return {
        "sku": component.get("sku") or component.get("id"),
        "name": component.get("name"),
        "price_idr": component.get("price_idr") or 0,
    }


def _advisor_cost_saving_slots(referenced_slots: list[str], components: dict) -> list[str]:
    selected = [
        slot for slot in referenced_slots
        if slot in VALID_BUILD_SWAP_SLOTS and components.get(slot)
    ]
    if selected:
        return selected

    priced_slots = [
        (slot, component.get("price_idr") or 0)
        for slot, component in components.items()
        if slot in VALID_BUILD_SWAP_SLOTS and component
    ]
    return [slot for slot, _price in sorted(priced_slots, key=lambda item: item[1], reverse=True)[:3]]


def _advisor_cost_saving_suggestions(context: dict, referenced_slots: list[str], question: str) -> list[dict]:
    if not _is_cost_saving_question(question):
        return []

    components = build_advisor_extract_components(context)
    if not components:
        return []

    current_total = (
        context.get("total_idr")
        or (context.get("recommendation") or {}).get("total_idr")
        or sum((component or {}).get("price_idr", 0) for component in components.values())
    )
    budget = context.get("budget_idr") or current_total
    suggestions: list[dict] = []
    source_items = services.load_components()

    for slot in _advisor_cost_saving_slots(referenced_slots, components):
        current = components.get(slot) or {}
        current_price = int(current.get("price_idr") or 0)
        current_sku = current.get("sku") or current.get("id")
        if current_price <= 0:
            continue

        slot_suggestions = []
        for component in source_items:
            candidate_price = int(component.get("price_idr") or 0)
            if candidate_price <= 0 or candidate_price >= current_price:
                continue
            if current_sku and (component.get("sku") == current_sku or component.get("id") == current_sku):
                continue
            if not _slot_accepts_candidate(slot, component):
                continue

            projected_build = dict(components)
            normalized = normalize_marketplace_links(component)
            projected_build[slot] = normalized
            warnings = validate_build(projected_build)
            if any(warning.get("severity") == "error" for warning in warnings):
                continue

            projected_total = int(current_total) - current_price + candidate_price
            slot_suggestions.append({
                "slot": slot,
                "label": BUILD_ADVISOR_SLOT_LABELS.get(slot, slot),
                "current": _component_ref(current),
                "candidate": _component_ref(normalized),
                "savings_idr": current_price - candidate_price,
                "projected_total_idr": projected_total,
                "projected_remaining_idr": int(budget) - projected_total,
                "compatibility_summary": _compatibility_summary(slot, normalized, components, warnings),
                "compatibility_warnings": warnings[:2],
            })

        slot_suggestions.sort(key=lambda item: (-item["savings_idr"], item["candidate"]["price_idr"]))
        suggestions.extend(slot_suggestions[:1])
        if len(suggestions) >= 3:
            break

    return suggestions


# ---------- Routes ----------


@app.get("/health", response_model=HealthResponse)
def health():
    return HealthResponse(
        status="ok",
        version=app.version,
        components_loaded=len(services.load_components()),
    )


@app.get("/components")
def list_components(
    category: Optional[str] = Query(None, description="cpu|gpu|ram|motherboard|ssd|psu|case|cooler"),
    q: Optional[str] = Query(None),
    max_price: Optional[int] = Query(None, ge=0),
    limit: int = Query(100, ge=1, le=2000),
    offset: int = Query(0, ge=0),
):
    items = services.load_components()
    if category:
        items = [c for c in items if c.get("category") == category]
    if q:
        ql = q.lower()
        items = [c for c in items if ql in (c.get("name") or "").lower()]
    if max_price is not None:
        items = [c for c in items if (c.get("price_idr") or 0) <= max_price]
    items = sorted(items, key=lambda c: c.get("price_idr") or 0)
    total = len(items)
    page = items[offset : offset + limit]
    return {"total": total, "offset": offset, "limit": limit, "items": page}


@app.post("/build/swap-candidates")
def list_swap_candidates(req: SwapCandidatesRequest):
    if req.slot not in VALID_BUILD_SWAP_SLOTS:
        raise HTTPException(status_code=400, detail=f"Invalid slot {req.slot!r}")

    ql = (req.q or "").strip().lower()
    current = req.current_build.get(req.slot) or {}
    current_sku = current.get("sku") or current.get("id")
    source_items = services.load_components()
    items = []

    for component in source_items:
        if not _slot_accepts_candidate(req.slot, component):
            continue
        if current_sku and (component.get("sku") == current_sku or component.get("id") == current_sku):
            continue
        if ql and ql not in (component.get("name") or "").lower():
            continue
        if req.max_price is not None and (component.get("price_idr") or 0) > req.max_price:
            continue

        projected_build = dict(req.current_build)
        projected_build[req.slot] = normalize_marketplace_links(component)
        projected_total = sum(c.get("price_idr", 0) for c in projected_build.values() if c)
        if projected_total > req.budget_idr:
            continue

        warnings = validate_build(projected_build)
        if any(warning.get("severity") == "error" for warning in warnings):
            continue

        normalized = normalize_marketplace_links(component)
        normalized["compatibility_warnings"] = warnings
        normalized["compatibility_summary"] = _compatibility_summary(req.slot, normalized, req.current_build, warnings)
        normalized["price_delta_idr"] = int(component.get("price_idr", 0)) - int(current.get("price_idr", 0) or 0)
        normalized["projected_total_idr"] = projected_total
        normalized["projected_remaining_idr"] = req.budget_idr - projected_total
        items.append(normalized)

    items = sorted(items, key=lambda item: (abs(item.get("price_delta_idr", 0)), item.get("price_idr", 0)))
    total = len(items)
    page = items[req.offset : req.offset + req.limit]
    return {"total": total, "offset": req.offset, "limit": req.limit, "slot": req.slot, "items": page}


@app.get("/build/use-cases")
def list_use_cases():
    return {
        "use_cases": [
            {"key": k, "allocation_pct": v} for k, v in USE_CASE_PROFILES.items()
        ]
    }


@app.get("/build/allocation-presets")
def list_allocation_presets():
    return {
        "slots": ALLOCATION_PRESET_SLOTS,
        "profiles": USE_CASE_PROFILES,
        "priority_shifts": PERFORMANCE_PRIORITY_ALLOCATION_SHIFTS,
        "strategy_shifts": BUDGET_STRATEGY_ALLOCATION_SHIFTS,
    }


@app.post("/build/recommend")
def recommend_build(req: BuildRequest):
    if req.use_case not in USE_CASE_PROFILES:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown use_case {req.use_case!r}. Valid: {list(USE_CASE_PROFILES)}",
        )
    by_cat = services.components_by_category()
    if not by_cat:
        raise HTTPException(
            status_code=503,
            detail="components.json missing or empty. Run: python -m backend.utils.seed_components --input data/products_cleaned.csv --output data/components.json --report data/component_catalog_report.json --fail-on-validation",
        )
    return compose_build(
        by_cat, req.budget_idr, req.use_case,
        cpu_brand=req.cpu_brand,
        gpu_vendor=req.gpu_vendor,
        include_optional_addons=req.include_optional_addons,
        optional_addon_slots=req.selected_optional_addons,
        budget_strategy=req.budget_strategy,
        performance_priority=req.performance_priority,
        allocation_overrides=req.allocation_overrides,
    )


@app.post("/build/ai-recommend")
def recommend_ai_build(req: BuildRequest):
    if req.use_case not in USE_CASE_PROFILES:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown use_case {req.use_case!r}. Valid: {list(USE_CASE_PROFILES)}",
        )
    by_cat = services.components_by_category()
    if not by_cat:
        raise HTTPException(
            status_code=503,
            detail="Component catalog is empty. Run the component seeding pipeline first.",
        )
    return compose_ai_build(
        by_cat,
        req.budget_idr,
        req.use_case,
        cpu_brand=req.cpu_brand,
        gpu_vendor=req.gpu_vendor,
        include_optional_addons=req.include_optional_addons,
        optional_addon_slots=req.selected_optional_addons,
        profile_name=req.ai_profile,
        budget_strategy=req.budget_strategy,
        performance_priority=req.performance_priority,
        allocation_overrides=req.allocation_overrides,
    )


@app.get("/build/budget-tiers")
def list_budget_tiers():
    return {"tiers": BUDGET_TIERS}


@app.post("/build/upgrade")
def recommend_upgrade(req: UpgradeRequest):
    if req.use_case not in USE_CASE_PROFILES:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown use_case {req.use_case!r}. Valid: {list(USE_CASE_PROFILES)}",
        )
    by_cat = services.components_by_category()
    if not by_cat:
        raise HTTPException(
            status_code=503,
            detail="components.json missing or empty. Run: python -m backend.utils.seed_components --input data/products_cleaned.csv --output data/components.json --report data/component_catalog_report.json --fail-on-validation",
        )
    return compose_upgrade_recommendation(
        by_cat,
        req.budget_idr,
        req.use_case,
        req.existing_components,
    )


@app.post("/build/audit")
async def audit_pc_build(
    image: Optional[UploadFile] = File(None, description="Optional cart or quote screenshot (JPEG/PNG/WebP)"),
    goal: Optional[str] = Form(None, description="Budget and performance goal, such as Gaming 1080p under 12 juta"),
    parts_list: Optional[str] = Form(None, description="Typed cart or PC parts list"),
):
    """Audit a full PC parts list or cart screenshot before the user buys.

    This replaces the old single-component checker with a more useful
    multimodal feature: cart/list extraction plus compatibility, missing-slot,
    and next-step guidance.
    """
    clean_goal = (goal or "").strip()
    clean_parts = (parts_list or "").strip()
    has_image = image is not None and bool(image.filename)
    if not has_image and not clean_parts:
        raise HTTPException(status_code=400, detail="Paste a parts list or upload a cart screenshot first.")

    filename = image.filename if has_image else None
    meta: dict = {}
    if has_image:
        raw = await image.read()
        if len(raw) > 8 * 1024 * 1024:
            raise HTTPException(status_code=413, detail="Image too large (max 8 MB).")
        if len(raw) == 0:
            raise HTTPException(status_code=400, detail="Empty file.")
        try:
            jpeg_bytes, meta = prepare_image(raw)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc))

        prompt = build_build_audit_prompt(goal=clean_goal, parts_list=clean_parts)
        try:
            result = generate_multimodal_json(prompt, jpeg_bytes, mime_type="image/jpeg", temperature=0.2)
            audit = normalize_build_audit(result)
        except GeminiError:
            if not clean_parts:
                audit = _image_unavailable_build_audit(clean_goal)
            else:
                audit = _fallback_build_audit(clean_goal, clean_parts)
                audit["budget_notes"].append("Image analysis was unavailable, so this audit used the typed parts list.")
    else:
        audit = _fallback_build_audit(clean_goal, clean_parts)

    return {
        "filename": filename,
        "image_meta": meta,
        "audit": audit,
    }


@app.post("/build/advisor")
def build_advisor(req: BuildAdvisorRequest):
    """Constrained multi-turn advisor for the active PC build or upgrade.

    The frontend owns conversation memory and sends recent turns each request.
    Gemini is optional: if quota or configuration fails, this endpoint returns
    a deterministic grounded fallback instead of breaking the PC Builder flow.
    """
    question = req.question.strip()
    history = [m.model_dump() for m in req.history][-12:]
    messages = [m for m in history if m.get("role") in {"user", "assistant"}]
    messages.append({"role": "user", "content": question})
    system = build_advisor_system_instruction(req.mode, req.context)
    referenced_slots = detect_referenced_slots(question, req.context)

    try:
        answer = generate_chat_reply(
            messages,
            system_instruction=system,
            temperature=0.3,
        )
        fallback = False
    except GeminiError:
        answer = build_advisor_fallback_answer(req.mode, question, req.context)
        fallback = True

    return {
        "answer": answer,
        "referenced_slots": referenced_slots,
        "evidence_cards": build_advisor_evidence_cards(req.context, referenced_slots),
        "cost_saving_suggestions": _advisor_cost_saving_suggestions(req.context, referenced_slots, question),
        "suggested_questions": build_advisor_suggested_questions(req.mode, referenced_slots),
        "fallback": fallback,
    }


@app.post("/build/swap")
def swap_component(req: SwapRequest):
    """Replace a single slot in an existing build, then re-validate compatibility.

    The frontend sends the current build + the new component SKU; we look up
    the replacement, swap it in, re-run the validator, and return the updated
    build with cost delta and any new compatibility issues.
    """
    if req.slot not in VALID_BUILD_SWAP_SLOTS:
        raise HTTPException(status_code=400, detail=f"Invalid slot {req.slot!r}")

    category = _swap_category(req.slot)
    new_comp = services.find_component(req.new_component_id)
    if not new_comp:
        raise HTTPException(
            status_code=404,
            detail=f"Component {req.new_component_id!r} not found",
        )
    if new_comp.get("category") != category:
        raise HTTPException(
            status_code=400,
            detail=f"Component is category {new_comp.get('category')!r}, not {category!r}",
        )

    new_build = dict(req.current_build)
    old = new_build.get(req.slot)
    new_build[req.slot] = normalize_marketplace_links(new_comp)

    total = sum(c["price_idr"] for c in new_build.values() if c)
    compatibility_warnings = validate_build(new_build)
    issues = compatibility_messages(compatibility_warnings)

    return {
        "use_case": req.use_case,
        "budget_idr": req.budget_idr,
        "total_idr": total,
        "remaining_idr": req.budget_idr - total,
        "components": new_build,
        "compatibility_warnings": compatibility_warnings,
        "compatibility_issues": issues,
        "swap": {
            "slot": req.slot,
            "old_sku": (old or {}).get("sku"),
            "new_sku": new_comp.get("sku"),
            "price_delta_idr": new_comp["price_idr"] - ((old or {}).get("price_idr") or 0),
        },
    }
