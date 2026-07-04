import * as core from './pc-builder-core.js';
import { handleAdvisor } from './advisor.js';
import { handleAudit } from './audit.js';
import { handleAiRecommend } from './ai-recommend.js';

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-Gemini-Api-Key, X-LMStudio-Base-Url, X-Qdrant-Url, X-Qdrant-Api-Key, X-Qdrant-Collection, X-Gemini-Model",
  "Access-Control-Max-Age": "86400"
};

let catalogInitialized = false;

async function ensureCatalog(env) {
  if (catalogInitialized) return;
  const raw = await env.KOMPARE_DATA.get("components");
  if (!raw) throw new Error("Catalog not found in KV");
  const list = JSON.parse(raw);
  core.initCatalog(list);
  catalogInitialized = true;
}

function makeResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...CORS_HEADERS,
      "Content-Type": "application/json"
    }
  });
}

export default {
  async fetch(request, env, ctx) {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    const url = new URL(request.url);
    const path = url.pathname;

    try {
      if (path === "/api/health") {
        if (request.method !== "GET") return makeResponse({ error: "Method not allowed" }, 405);
        await ensureCatalog(env);
        const count = core.loadComponents().length;
        return makeResponse({
          status: "ok",
          version: "0.1.0",
          components_loaded: count
        });
      }

      if (path === "/api/components") {
        if (request.method !== "GET") return makeResponse({ error: "Method not allowed" }, 405);
        await ensureCatalog(env);
        
        const category = url.searchParams.get("category");
        const q = url.searchParams.get("q");
        const maxPriceStr = url.searchParams.get("max_price");

        let limit = parseInt(url.searchParams.get("limit") || "100", 10);
        if (isNaN(limit) || limit < 1) limit = 100;
        if (limit > 2000) limit = 2000;

        let offset = parseInt(url.searchParams.get("offset") || "0", 10);
        if (isNaN(offset) || offset < 0) offset = 0;

        let items = core.loadComponents();

        if (category) {
          items = items.filter(c => c.category === category);
        }

        if (q) {
          const ql = q.toLowerCase().trim();
          items = items.filter(c => (c.name || "").toLowerCase().includes(ql));
        }

        if (maxPriceStr !== null && maxPriceStr !== "") {
          const maxPrice = parseInt(maxPriceStr, 10);
          if (!isNaN(maxPrice) && maxPrice >= 0) {
            items = items.filter(c => (c.price_idr || 0) <= maxPrice);
          }
        }

        items.sort((a, b) => (a.price_idr || 0) - (b.price_idr || 0));

        const total = items.length;
        const page = items.slice(offset, offset + limit);

        return makeResponse({
          total,
          offset,
          limit,
          items: page
        });
      }

      if (path === "/api/build/recommend") {
        if (request.method !== "POST") return makeResponse({ error: "Method not allowed" }, 405);
        await ensureCatalog(env);
        
        const reqData = await request.json().catch(() => ({}));
        const budgetIdr = parseInt(reqData.budget_idr, 10);
        if (isNaN(budgetIdr) || budgetIdr <= 0) {
          return makeResponse({ error: "budget_idr is required and must be greater than 0" }, 400);
        }

        const useCase = reqData.use_case || "gaming";
        if (!(useCase in core.USE_CASE_PROFILES)) {
          return makeResponse({ error: `Unknown use_case: ${useCase}. Valid: ${Object.keys(core.USE_CASE_PROFILES).join(", ")}` }, 400);
        }

        const byCat = core.componentsByCategoryMap();
        if (!byCat || Object.keys(byCat).length === 0) {
          return makeResponse({ error: "Component catalog is empty or missing" }, 503);
        }

        const result = core.composeBuild(byCat, budgetIdr, useCase, {
          cpu_brand: reqData.cpu_brand || null,
          gpu_vendor: reqData.gpu_vendor || null,
          include_optional_addons: !!reqData.include_optional_addons,
          optional_addon_slots: reqData.selected_optional_addons || null,
          budget_strategy: reqData.budget_strategy || "balanced",
          performance_priority: reqData.performance_priority || null,
          allocation_overrides: reqData.allocation_overrides || null
        });

        return makeResponse(result);
      }

      if (path === "/api/build/ai-recommend") {
        if (request.method !== "POST") return makeResponse({ error: "Method not allowed" }, 405);
        await ensureCatalog(env);
        return await handleAiRecommend(request, env);
      }

      if (path === "/api/build/advisor") {
        if (request.method !== "POST") return makeResponse({ error: "Method not allowed" }, 405);
        await ensureCatalog(env);
        return await handleAdvisor(request, env);
      }

      if (path === "/api/build/audit") {
        if (request.method !== "POST") return makeResponse({ error: "Method not allowed" }, 405);
        await ensureCatalog(env);
        return await handleAudit(request, env);
      }

      if (path === "/api/build/use-cases") {
        if (request.method !== "GET") return makeResponse({ error: "Method not allowed" }, 405);
        const list = Object.entries(core.USE_CASE_PROFILES).map(([k, v]) => ({
          key: k,
          allocation_pct: v
        }));
        return makeResponse({ use_cases: list });
      }

      if (path === "/api/build/budget-tiers") {
        if (request.method !== "GET") return makeResponse({ error: "Method not allowed" }, 405);
        return makeResponse({ tiers: core.BUDGET_TIERS });
      }

      if (path === "/api/build/allocation-presets") {
        if (request.method !== "GET") return makeResponse({ error: "Method not allowed" }, 405);
        return makeResponse({
          slots: core.ALLOCATION_PRESET_SLOTS,
          profiles: core.USE_CASE_PROFILES,
          priority_shifts: core.PERFORMANCE_PRIORITY_ALLOCATION_SHIFTS,
          strategy_shifts: core.BUDGET_STRATEGY_ALLOCATION_SHIFTS
        });
      }

      if (path === "/api/build/swap-candidates") {
        if (request.method !== "POST") return makeResponse({ error: "Method not allowed" }, 405);
        await ensureCatalog(env);

        const reqData = await request.json().catch(() => ({}));
        const budgetIdr = parseInt(reqData.budget_idr, 10);
        if (isNaN(budgetIdr) || budgetIdr <= 0) {
          return makeResponse({ error: "budget_idr is required and must be greater than 0" }, 400);
        }

        const slot = reqData.slot;
        const VALID_BUILD_SWAP_SLOTS = new Set([
          "cpu", "gpu", "ram", "motherboard", "ssd", "hdd", "psu", "case", "cpu_cooler", "fan_cooler"
        ]);
        if (!slot || !VALID_BUILD_SWAP_SLOTS.has(slot)) {
          return makeResponse({ error: `Invalid or missing slot: ${slot}` }, 400);
        }

        const currentBuild = reqData.current_build || {};
        const ql = (reqData.q || "").trim().toLowerCase();
        const current = currentBuild[slot] || {};
        const currentSku = current.sku || current.id;
        const maxPrice = reqData.max_price !== undefined && reqData.max_price !== null ? parseInt(reqData.max_price, 10) : null;

        let limit = parseInt(reqData.limit || "50", 10);
        if (isNaN(limit) || limit < 1) limit = 50;
        if (limit > 200) limit = 200;

        let offset = parseInt(reqData.offset || "0", 10);
        if (isNaN(offset) || offset < 0) offset = 0;

        function _swapCategory(slot) {
          return (slot === "cpu_cooler" || slot === "fan_cooler") ? "cooler" : slot;
        }

        function _slotAcceptsCandidate(slot, component) {
          if (component.category !== _swapCategory(slot)) return false;
          const cooler_type = (component.specs || {}).type;
          if (slot === "cpu_cooler") return cooler_type !== "fan";
          if (slot === "fan_cooler") return cooler_type === "fan";
          return true;
        }

        function _compatibilitySummary(slot, candidate, current_build, warnings) {
          if (warnings && warnings.length > 0) return "Compatible, with notes to review before buying.";
          const specs = candidate.specs || {};
          const cpu_specs = (current_build.cpu || {}).specs || {};
          const ram_specs = (current_build.ram || {}).specs || {};
          const case_specs = (current_build.case || {}).specs || {};
          const gpu_specs = (current_build.gpu || {}).specs || {};

          if (slot === "motherboard") {
            const parts = [];
            if (specs.socket && cpu_specs.socket) parts.push(`current CPU socket ${specs.socket}`);
            if (specs.ram_type && ram_specs.type) parts.push(`${specs.ram_type} memory`);
            if (specs.form_factor && case_specs.max_form_factor) parts.push(`${specs.form_factor} casing fit`);
            return parts.length > 0 ? "Matches " + parts.join(", ") + "." : "Compatible with current build checks.";
          }
          if (slot === "ram" && specs.type) {
            return `Matches current motherboard memory generation ${specs.type}.`;
          }
          if (slot === "gpu" && specs.recommended_psu_w) {
            return `Fits the current PSU target at ${specs.recommended_psu_w}W recommendation.`;
          }
          if (slot === "psu" && gpu_specs.recommended_psu_w) {
            return `Covers the current GPU recommendation of ${gpu_specs.recommended_psu_w}W.`;
          }
          if (slot === "cpu_cooler" && specs.tdp_w) {
            return `Covers the selected CPU cooling target up to ${specs.tdp_w}W.`;
          }
          if (slot === "fan_cooler") {
            return "Compatible case airflow upgrade.";
          }
          return "Compatible with current build checks.";
        }

        const sourceItems = core.loadComponents();
        const items = [];

        for (const component of sourceItems) {
          if (!_slotAcceptsCandidate(slot, component)) continue;
          const sku = component.sku || component.id;
          if (currentSku && sku === currentSku) continue;
          if (ql && !(component.name || "").toLowerCase().includes(ql)) continue;
          
          const price = component.price_idr || 0;
          if (maxPrice !== null && price > maxPrice) continue;

          const projectedBuild = { ...currentBuild };
          projectedBuild[slot] = core.normalizeMarketplaceLinks(component);

          const projectedTotal = Object.values(projectedBuild).reduce((sum, c) => sum + (c ? (c.price_idr || 0) : 0), 0);
          if (projectedTotal > budgetIdr) continue;

          const warnings = core.validateBuild(projectedBuild);
          if (warnings.some(w => w.severity === "error")) continue;

          const normalized = core.normalizeMarketplaceLinks(component);
          normalized.compatibility_warnings = warnings;
          normalized.compatibility_summary = _compatibilitySummary(slot, normalized, currentBuild, warnings);
          normalized.price_delta_idr = price - (current.price_idr || 0);
          normalized.projected_total_idr = projectedTotal;
          normalized.projected_remaining_idr = budgetIdr - projectedTotal;

          items.push(normalized);
        }

        items.sort((a, b) => {
          const diffA = Math.abs(a.price_delta_idr);
          const diffB = Math.abs(b.price_delta_idr);
          if (diffA !== diffB) {
            return diffA - diffB;
          }
          return (a.price_idr || 0) - (b.price_idr || 0);
        });

        const total = items.length;
        const page = items.slice(offset, offset + limit);

        return makeResponse({
          total,
          offset,
          limit,
          slot,
          items: page
        });
      }

      if (path === "/api/build/swap") {
        if (request.method !== "POST") return makeResponse({ error: "Method not allowed" }, 405);
        await ensureCatalog(env);

        const reqData = await request.json().catch(() => ({}));
        const budgetIdr = parseInt(reqData.budget_idr, 10);
        if (isNaN(budgetIdr) || budgetIdr <= 0) {
          return makeResponse({ error: "budget_idr is required and must be greater than 0" }, 400);
        }

        const slot = reqData.slot;
        const VALID_BUILD_SWAP_SLOTS = new Set([
          "cpu", "gpu", "ram", "motherboard", "ssd", "hdd", "psu", "case", "cpu_cooler", "fan_cooler"
        ]);
        if (!slot || !VALID_BUILD_SWAP_SLOTS.has(slot)) {
          return makeResponse({ error: `Invalid or missing slot: ${slot}` }, 400);
        }

        const newComponentId = reqData.new_component_id;
        if (!newComponentId) {
          return makeResponse({ error: "new_component_id is required" }, 400);
        }

        const newComp = core.findComponent(newComponentId);
        if (!newComp) {
          return makeResponse({ error: `Component ${newComponentId} not found` }, 404);
        }

        function _swapCategory(slot) {
          return (slot === "cpu_cooler" || slot === "fan_cooler") ? "cooler" : slot;
        }

        const category = _swapCategory(slot);
        if (newComp.category !== category) {
          return makeResponse({ error: `Component is category ${newComp.category}, not ${category}` }, 400);
        }

        const currentBuild = reqData.current_build || {};
        const old = currentBuild[slot];

        const newBuild = { ...currentBuild };
        newBuild[slot] = core.normalizeMarketplaceLinks(newComp);

        const total = Object.values(newBuild).reduce((sum, c) => sum + (c ? (c.price_idr || 0) : 0), 0);
        const compatibilityWarnings = core.validateBuild(newBuild);
        const issues = core.compatibilityMessages(compatibilityWarnings);

        return makeResponse({
          use_case: reqData.use_case || "gaming",
          budget_idr: budgetIdr,
          total_idr: total,
          remaining_idr: budgetIdr - total,
          components: newBuild,
          compatibility_warnings: compatibilityWarnings,
          compatibility_issues: issues,
          swap: {
            slot,
            old_sku: (old || {}).sku || null,
            new_sku: newComp.sku || newComp.id,
            price_delta_idr: (newComp.price_idr || 0) - ((old || {}).price_idr || 0)
          }
        });
      }

      if (path === "/api/build/upgrade") {
        if (request.method !== "POST") return makeResponse({ error: "Method not allowed" }, 405);
        await ensureCatalog(env);

        const reqData = await request.json().catch(() => ({}));
        const budgetIdr = parseInt(reqData.budget_idr, 10);
        if (isNaN(budgetIdr) || budgetIdr <= 0) {
          return makeResponse({ error: "budget_idr is required and must be greater than 0" }, 400);
        }

        const useCase = reqData.use_case || "gaming";
        if (!(useCase in core.USE_CASE_PROFILES)) {
          return makeResponse({ error: `Unknown use_case: ${useCase}. Valid: ${Object.keys(core.USE_CASE_PROFILES).join(", ")}` }, 400);
        }

        const byCat = core.componentsByCategoryMap();
        if (!byCat || Object.keys(byCat).length === 0) {
          return makeResponse({ error: "Component catalog is empty or missing" }, 503);
        }

        const existingComponents = reqData.existing_components || {};
        const result = core.recommendUpgrade(byCat, budgetIdr, useCase, existingComponents);
        return makeResponse(result);
      }

      return makeResponse({ error: `Route not found: ${path}` }, 404);
    } catch (e) {
      return makeResponse({ error: e.message }, 500);
    }
  }
};
