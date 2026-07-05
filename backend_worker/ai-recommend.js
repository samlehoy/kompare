import {
  composeBuild,
  componentsByCategoryMap,
  loadComponents,
  validateBuild,
  compatibilityMessages,
  normalizeMarketplaceLinks,
  USE_CASE_PROFILES,
  REQUIRED_BUILD_SLOTS,
  budgetBandFor,
  pickMotherboard,
  pickRam
} from './pc-builder-core.js';

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-Gemini-Api-Key, X-Qdrant-Url, X-Qdrant-Api-Key",
  "Content-Type": "application/json"
};

const AI_REQUIRED_SLOTS = ["cpu", "motherboard", "ram", "gpu", "ssd", "psu", "case"];
const STOCK_OK = new Set(["in_stock", "instock", "ready", "available", "stock"]);

const GPU_VENDOR_PREFERENCE_ALIASES = {
  nvidia: new Set(["nvidia", "geforce"]),
  geforce: new Set(["nvidia", "geforce"]),
  amd: new Set(["amd", "radeon"]),
  radeon: new Set(["amd", "radeon"]),
  intel: new Set(["intel", "arc"]),
  "intel arc": new Set(["intel", "arc"]),
  arc: new Set(["intel", "arc"])
};

const COMPACT_SPEC_KEYS = new Set([
  "socket", "ram_type", "memory_type", "type", "cores", "vram_gb", "recommended_psu_w", "wattage_w", "capacity_gb", "interface", "form_factor", "max_form_factor"
]);

function _slotBudgetLimit(slot, budgetIdr, useCase) {
  const profile = USE_CASE_PROFILES[useCase] || USE_CASE_PROFILES.gaming;
  const pct = profile[slot] || 0;
  return Math.max(1, Math.floor(budgetIdr * (pct / 100) * 1.8));
}

function _preferredSubsetOrOriginal(components, matcher, preference) {
  if (!preference) return components;
  const preferred = components.filter(c => matcher(c, preference));
  return preferred.length > 0 ? preferred : components;
}

function _cpuMatchesBrand(component, brand) {
  const wanted = String(brand || "").trim().toLowerCase();
  if (!wanted) return true;
  const got = String((component.specs || {}).brand || component.brand || "").trim().toLowerCase();
  if (got === wanted) return true;
  return String(component.name || "").toLowerCase().includes(wanted);
}

function _gpuMatchesVendor(component, vendor) {
  const rawWanted = String(vendor || "").trim().toLowerCase();
  const aliases = GPU_VENDOR_PREFERENCE_ALIASES[rawWanted] || new Set();
  if (aliases.size === 0) return true;
  const got = String((component.specs || {}).vendor || component.brand || "").trim().toLowerCase();
  if (aliases.has(got)) return true;
  const name = String(component.name || "").toLowerCase();
  return Array.from(aliases).some(alias => name.includes(alias));
}

function _socketsMatch(cpu, mobo) {
  const cpu_sock = String((cpu || {}).specs?.socket || "").trim().toUpperCase().replace(/[\s-]/g, "");
  const mobo_sock = String((mobo || {}).specs?.socket || "").trim().toUpperCase().replace(/[\s-]/g, "");
  if (!cpu_sock || !mobo_sock) return false;
  return mobo_sock.includes(cpu_sock) || cpu_sock.includes(mobo_sock);
}

function _ramMatchesMotherboard(mobo, ram) {
  const mobo_ddr = (mobo || {}).specs?.ram_type;
  const ram_ddr = (ram || {}).specs?.type;
  if (!mobo_ddr || !ram_ddr) return false;
  return mobo_ddr === ram_ddr;
}

function _platformCompatibleCandidates(candidatesBySlot) {
  const result = { ...candidatesBySlot };
  const cpus = result.cpu || [];
  const motherboards = result.motherboard || [];
  const rams = result.ram || [];
  
  if (cpus.length === 0 || motherboards.length === 0 || rams.length === 0) {
    return result;
  }

  const viableMotherboards = motherboards.filter(m => {
    return cpus.some(c => _socketsMatch(c, m)) && rams.some(r => _ramMatchesMotherboard(m, r));
  });

  if (viableMotherboards.length === 0) {
    return result;
  }

  const viableCpus = cpus.filter(c => viableMotherboards.some(m => _socketsMatch(c, m)));
  const viableRams = rams.filter(r => viableMotherboards.some(m => _ramMatchesMotherboard(m, r)));

  if (viableCpus.length > 0 && viableRams.length > 0) {
    result.cpu = viableCpus;
    result.motherboard = viableMotherboards;
    result.ram = viableRams;
  }
  return result;
}

function _candidateView(comp) {
  const specs = {};
  const rawSpecs = comp.specs || {};
  for (const key of COMPACT_SPEC_KEYS) {
    if (rawSpecs[key] !== undefined && rawSpecs[key] !== null && rawSpecs[key] !== "") {
      specs[key] = rawSpecs[key];
    }
  }
  return {
    sku: comp.sku || comp.id,
    category: comp.category,
    name: comp.name,
    brand: comp.brand || null,
    price_idr: comp.price_idr || 0,
    specs,
    retrieval_score: comp.retrieval_score || null
  };
}

function buildAiRankerPrompt(budget_idr, use_case, candidates_by_slot) {
  const candidate_view = {};
  for (const [slot, list] of Object.entries(candidates_by_slot)) {
    candidate_view[slot] = list.map(_candidateView);
  }
  
  const schemaStr = JSON.stringify({
    selected_skus: {
      slot_key: "exact SKU copied from that slot's provided candidates"
    },
    slot_rationales: {
      slot_key: "short reason for choosing this SKU from the provided candidates"
    },
    summary: "short buyer-readable build summary",
    tradeoffs: ["short tradeoff notes"]
  }, null, 2);

  return `You are Kompare's PC build ranking assistant.

Choose the best SKU for each slot from the provided candidate lists only.
Backend validation rejects any SKU outside the candidate list for that slot.

Hard rules:
- Choose only from provided SKUs.
- Do not invent SKUs, prices, links, specs, stock, stores, or unavailable options.
- Copy selected SKU values exactly as provided.
- Return JSON only. Do not wrap the response in markdown.
- Do not add fields outside the required response schema.

Budget IDR: ${budget_idr}
Use case: ${use_case}

Candidates grouped by slot:
${JSON.stringify(candidate_view, null, 2)}

Required response schema:
${schemaStr}`;
}

function _fallbackCandidatePool(candidates_by_slot, catalog_by_slot, budget, useCase) {
  const pool = {};
  for (const slot of AI_REQUIRED_SLOTS) {
    const category = slot;
    const budget_limit = _slotBudgetLimit(slot, budget, useCase);
    const catalog_candidates = (catalog_by_slot[category] || []).filter(c => {
      const stock = String(c.stock_status || c.stock || "").trim().toLowerCase();
      return STOCK_OK.has(stock) && (c.price_idr || 0) <= budget_limit;
    });

    const list = [...(candidates_by_slot[slot] || []), ...catalog_candidates];
    const deduped = [];
    const seen = new Set();
    for (const comp of list) {
      const sku = comp.sku || comp.id;
      if (sku && !seen.has(sku)) {
        deduped.push(comp);
        seen.add(sku);
      }
    }
    pool[slot] = deduped;
  }
  return pool;
}

function _retrievalRankerPayload(candidates_by_slot) {
  const selected_components = {};
  const slot_rationales = {};

  const cpu_candidates = candidates_by_slot.cpu || [];
  if (cpu_candidates.length > 0) {
    selected_components.cpu = cpu_candidates[0];
    slot_rationales.cpu = "Top Qdrant retrieval candidate accepted by deterministic validation.";
  }

  const motherboard_candidates = candidates_by_slot.motherboard || [];
  if (motherboard_candidates.length > 0) {
    const selected_motherboard = motherboard_candidates.find(m => _socketsMatch(selected_components.cpu, m)) || motherboard_candidates[0];
    selected_components.motherboard = selected_motherboard;
    if (selected_motherboard === motherboard_candidates[0]) {
      slot_rationales.motherboard = "Top Qdrant retrieval candidate accepted by deterministic validation.";
    } else {
      slot_rationales.motherboard = "Skipped higher retrieval hits to match the selected CPU socket.";
    }
  }

  const ram_candidates = candidates_by_slot.ram || [];
  if (ram_candidates.length > 0) {
    const selected_ram = ram_candidates.find(r => _ramMatchesMotherboard(selected_components.motherboard, r)) || ram_candidates[0];
    selected_components.ram = selected_ram;
    if (selected_ram === ram_candidates[0]) {
      slot_rationales.ram = "Top Qdrant retrieval candidate accepted by deterministic validation.";
    } else {
      slot_rationales.ram = "Skipped higher retrieval hits to match motherboard RAM generation.";
    }
  }

  for (const slot of AI_REQUIRED_SLOTS) {
    if (slot in selected_components) continue;
    const candidates = candidates_by_slot[slot] || [];
    if (candidates.length === 0) continue;
    selected_components[slot] = candidates[0];
    slot_rationales[slot] = "Top Qdrant retrieval candidate accepted by deterministic validation.";
  }

  const selected_skus = {};
  for (const [slot, comp] of Object.entries(selected_components)) {
    selected_skus[slot] = comp.sku || comp.id;
  }

  return {
    selected_skus,
    slot_rationales,
    summary: "Local retrieval selected the strongest compatible candidates before deterministic validation.",
    tradeoffs: [
      "The local JSON ranker was unavailable, so Kompare used vector retrieval order plus deterministic compatibility checks."
    ]
  };
}

function parseAiRankerResponse(payload, candidates_by_slot) {
  if (!payload || typeof payload !== "object") {
    throw new Error("AI ranker response must be a JSON object.");
  }
  const selected_skus = payload.selected_skus;
  if (!selected_skus || typeof selected_skus !== "object") {
    throw new Error("AI ranker response must include selected_skus object.");
  }
  
  const clean_selected_skus = {};
  const allowed_skus = {};
  for (const [slot, list] of Object.entries(candidates_by_slot)) {
    allowed_skus[slot] = new Set(list.map(c => String(c.sku || c.id).trim()));
  }

  for (const [slot, rawSku] of Object.entries(selected_skus)) {
    const sku = String(rawSku).trim();
    if (!sku) throw new Error("AI ranker response contains an empty selected SKU.");
    const allowed = allowed_skus[slot] || new Set();
    if (!allowed.has(sku)) {
      throw new Error(`unknown SKU for slot ${slot}: ${sku}`);
    }
    clean_selected_skus[slot] = sku;
  }

  const slot_rationales = {};
  if (payload.slot_rationales && typeof payload.slot_rationales === "object") {
    for (const [k, v] of Object.entries(payload.slot_rationales)) {
      if (v) slot_rationales[k] = String(v).trim();
    }
  }

  const summary = String(payload.summary || "").trim();
  const tradeoffs = Array.isArray(payload.tradeoffs) ? payload.tradeoffs.map(t => String(t || "").trim()).filter(Boolean) : [];

  return {
    selected_skus: clean_selected_skus,
    slot_rationales,
    summary,
    tradeoffs
  };
}

function _dedupeComponents(g1, g2) {
  const deduped = [];
  const seen = new Set();
  for (const c of [...g1, ...g2]) {
    const sku = c.sku || c.id;
    if (sku && !seen.has(sku)) {
      deduped.push(c);
      seen.add(sku);
    }
  }
  return deduped;
}

function _totalPrice(components) {
  return Object.values(components).reduce((sum, c) => sum + (c ? (c.price_idr || 0) : 0), 0);
}

function _firstAffordableCompatibleMotherboard(candidates, cpu, maxPrice) {
  return candidates.find(m => _socketsMatch(cpu, m) && (m.price_idr || 0) <= maxPrice) || null;
}

function _firstAffordableCompatibleCpu(candidates, motherboard, maxPrice) {
  return candidates.find(c => _socketsMatch(c, motherboard) && (c.price_idr || 0) <= maxPrice) || null;
}

function _firstAffordableCompatibleRam(candidates, targetMemoryType, maxPrice) {
  return candidates.find(r => r.specs?.type === targetMemoryType && (r.price_idr || 0) <= maxPrice) || null;
}

function _repairSelectedComponents(components, candidates_by_slot, catalog_by_slot, budget) {
  const repaired = { ...components };
  let warnings = validateBuild(repaired);

  const hasSocketMismatch = warnings.some(w => w.id === "cpu_motherboard_socket_mismatch" && w.severity === "error");
  if (hasSocketMismatch) {
    const currentTotal = _totalPrice(repaired);
    const currentMoboPrice = repaired.motherboard ? (repaired.motherboard.price_idr || 0) : 0;
    const maxMoboPrice = budget - (currentTotal - currentMoboPrice);

    const motherboardPool = _dedupeComponents(
      candidates_by_slot.motherboard || [],
      (catalog_by_slot.motherboard || [])
    );
    const cpu = repaired.cpu;
    const cpuSocket = cpu && cpu.specs ? cpu.specs.socket : null;
    
    let replacement = _firstAffordableCompatibleMotherboard(
      candidates_by_slot.motherboard || [],
      cpu,
      maxMoboPrice
    );
    if (!replacement) {
      replacement = pickMotherboard(motherboardPool, maxMoboPrice, cpuSocket || "");
    }
    if (replacement && (replacement.price_idr || 0) > maxMoboPrice) {
      replacement = _firstAffordableCompatibleMotherboard(
        motherboardPool,
        cpu,
        maxMoboPrice
      );
    }
    if (replacement && !_socketsMatch(cpu, replacement)) {
      replacement = _firstAffordableCompatibleMotherboard(
        motherboardPool,
        cpu,
        maxMoboPrice
      );
    }

    if (replacement && (replacement.price_idr || 0) <= maxMoboPrice) {
      repaired.motherboard = normalizeMarketplaceLinks({ ...replacement });
      warnings = validateBuild(repaired);
    } else if (repaired.motherboard) {
      const currentTotal2 = _totalPrice(repaired);
      const currentCpuPrice = repaired.cpu ? (repaired.cpu.price_idr || 0) : 0;
      const maxCpuPrice = budget - (currentTotal2 - currentCpuPrice);
      const cpuPool = _dedupeComponents(
        candidates_by_slot.cpu || [],
        (catalog_by_slot.cpu || [])
      );
      const cpuReplacement = _firstAffordableCompatibleCpu(
        cpuPool,
        repaired.motherboard,
        maxCpuPrice
      );
      if (cpuReplacement) {
        repaired.cpu = normalizeMarketplaceLinks({ ...cpuReplacement });
        warnings = validateBuild(repaired);
      }
    }
  }

  const hasMemoryMismatch = warnings.some(w => w.id === "motherboard_ram_type_mismatch" && w.severity === "error");
  if (hasMemoryMismatch && repaired.motherboard) {
    const targetMemoryType = repaired.motherboard.specs?.ram_type;
    if (targetMemoryType) {
      const currentTotal = _totalPrice(repaired);
      const currentRamPrice = repaired.ram ? (repaired.ram.price_idr || 0) : 0;
      const maxRamPrice = budget - (currentTotal - currentRamPrice);
      const ramPool = _dedupeComponents(
        candidates_by_slot.ram || [],
        (catalog_by_slot.ram || [])
      );
      let replacement = _firstAffordableCompatibleRam(
        candidates_by_slot.ram || [],
        targetMemoryType,
        maxRamPrice
      );
      if (!replacement) {
        replacement = pickRam(ramPool, maxRamPrice, targetMemoryType);
      }
      if (replacement && (replacement.price_idr || 0) > maxRamPrice) {
        replacement = _firstAffordableCompatibleRam(
          ramPool,
          targetMemoryType,
          maxRamPrice
        );
      }
      if (replacement && replacement.specs?.type !== targetMemoryType) {
        replacement = _firstAffordableCompatibleRam(
          ramPool,
          targetMemoryType,
          maxRamPrice
        );
      }
      if (replacement && (replacement.price_idr || 0) > maxRamPrice) {
        replacement = null;
      }
      if (replacement) {
        repaired.ram = normalizeMarketplaceLinks({ ...replacement });
      }
    }
  }

  return repaired;
}

function _budgetRepairSelectedComponents(components, candidates_by_slot, catalog_by_slot, budget, cpu_brand = null, gpu_vendor = null) {
  const repaired = { ...components };
  const changed_slots = new Set();

  while (_totalPrice(repaired) > budget) {
    const current_total = _totalPrice(repaired);
    if (validateBuild(repaired).some(w => w.severity === "error")) {
      return [repaired, changed_slots];
    }

    let best_trial = null;
    let best_trial_total = null;
    let best_changed_slots = new Set();
    let best_key = null;

    for (const slot of AI_REQUIRED_SLOTS) {
      const current = repaired[slot];
      const currentSku = current ? (current.sku || current.id) : null;
      const currentPrice = current ? (current.price_idr || 0) : 0;
      
      let pool = _dedupeComponents(
        candidates_by_slot[slot] || [],
        catalog_by_slot[slot] || []
      );
      if (slot === "cpu") {
        pool = _preferredSubsetOrOriginal(pool, _cpuMatchesBrand, cpu_brand);
      } else if (slot === "gpu") {
        pool = _preferredSubsetOrOriginal(pool, _gpuMatchesVendor, gpu_vendor);
      }

      for (const candidate of pool) {
        const cSku = candidate.sku || candidate.id;
        if (cSku === currentSku) continue;
        const cPrice = candidate.price_idr || 0;
        if (cPrice >= currentPrice) continue;

        let trial = { ...repaired };
        trial[slot] = normalizeMarketplaceLinks({ ...candidate });
        trial = _repairSelectedComponents(
          trial,
          candidates_by_slot,
          catalog_by_slot,
          budget
        );
        if (validateBuild(trial).some(w => w.severity === "error")) continue;

        const trial_total = _totalPrice(trial);
        if (trial_total >= current_total) continue;

        const isFits = trial_total <= budget ? 0 : 1;
        const distance = trial_total <= budget ? Math.abs(budget - trial_total) : trial_total;
        const key = isFits * 1e12 + distance;

        if (best_key === null || key < best_key) {
          best_key = key;
          best_trial = trial;
          best_trial_total = trial_total;
          
          best_changed_slots = new Set();
          for (const changed_slot of AI_REQUIRED_SLOTS) {
            const oldSku = repaired[changed_slot] ? (repaired[changed_slot].sku || repaired[changed_slot].id) : null;
            const trialSku = trial[changed_slot] ? (trial[changed_slot].sku || trial[changed_slot].id) : null;
            if (trialSku !== oldSku) {
              best_changed_slots.add(changed_slot);
            }
          }
        }
      }
    }

    if (best_trial === null || best_trial_total === null) {
      return [repaired, changed_slots];
    }

    for (const [k, v] of Object.entries(best_trial)) {
      repaired[k] = v;
    }
    for (const s of best_changed_slots) {
      changed_slots.add(s);
    }
  }

  return [repaired, changed_slots];
}

async function catalogHash(components) {
  const sorted = [...components].sort((a, b) => {
    const skuA = String(a.sku || a.id || "");
    const skuB = String(b.sku || b.id || "");
    return skuA.localeCompare(skuB);
  });
  const cleaned = sorted.map(c => {
    const keys = Object.keys(c).sort();
    const obj = {};
    for (const k of keys) obj[k] = c[k];
    return obj;
  });
  const str = JSON.stringify(cleaned);
  const msgBuffer = new TextEncoder().encode(str);
  const hashBuffer = await crypto.subtle.digest("SHA-256", msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

function _buildMetadata(profileName, current_hash, candidates_by_slot, selected_skus, ranker_mode, ranker_error, collection) {
  const candidate_counts = {};
  for (const slot of AI_REQUIRED_SLOTS) {
    candidate_counts[slot] = (candidates_by_slot[slot] || []).length;
  }
  const meta = {
    profile: profileName,
    llm_model: "gemini-2.5-flash",
    embedding_model: "@cf/baai/bge-small-en-v1.5",
    vector_backend: "qdrant",
    vector_collection: collection,
    ranker_mode: ranker_mode,
    top_k_per_slot: 12,
    catalog_hash: current_hash,
    required_slots: AI_REQUIRED_SLOTS,
    candidate_counts,
    selected_skus
  };
  if (ranker_error) {
    meta.ranker_error = ranker_error;
  }
  return meta;
}

function _fallbackResponse(byCategory, budget, useCase, reason, deterministicKwargs, error = null) {
  const result = composeBuild(byCategory, budget, useCase, { ...deterministicKwargs, _apply_budget_optimizer: true });
  const res = {
    ...result,
    ai_assisted: false,
    fallback: true,
    fallback_reason: reason,
    validation_source: "deterministic"
  };
  if (error !== null) {
    res.error_detail = String(error.message || error);
  }
  return res;
}

async function queryQdrant(env, headers, vector, category, top_k) {
  const qdrantUrl = headers.get("X-Qdrant-Url") || headers.get("x-qdrant-url") || env.QDRANT_URL;
  const qdrantApiKey = headers.get("X-Qdrant-Api-Key") || headers.get("x-qdrant-api-key") || env.QDRANT_API_KEY;
  const collection = headers.get("X-Qdrant-Collection") || headers.get("x-qdrant-collection") || env.QDRANT_COLLECTION || "kompare_components_gemini";

  if (!qdrantUrl) {
    throw new Error("Qdrant URL is not configured.");
  }

  const url = `${qdrantUrl.replace(/\/$/, "")}/collections/${collection}/points/search`;
  const body = {
    vector: {
      name: "dense",
      vector: vector
    },
    limit: top_k,
    with_payload: true,
    with_vector: false,
    filter: {
      must: [
        {
          key: "category",
          match: { value: category }
        }
      ]
    }
  };

  const fetchHeaders = { "Content-Type": "application/json" };
  if (qdrantApiKey) {
    fetchHeaders["api-key"] = qdrantApiKey;
  }

  const res = await fetch(url, {
    method: "POST",
    headers: fetchHeaders,
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Qdrant search failed with HTTP ${res.status}: ${errText}`);
  }

  const data = await res.json();
  return (data.result || []).map(item => {
    const payload = item.payload || {};
    return {
      chunk_id: payload.chunk_id,
      sku: payload.sku,
      category: payload.category,
      text: payload.text,
      metadata: payload.metadata || {},
      score: item.score
    };
  });
}

async function embedTexts(env, texts) {
  if (!env.AI) {
    throw new Error("Cloudflare Workers AI (env.AI) is not bound or configured.");
  }
  const response = await env.AI.run("@cf/baai/bge-m3", {
    text: texts
  });
  if (!response || !response.data) {
    throw new Error("Failed to generate embeddings from Workers AI.");
  }
  return response.data;
}

async function callGemini(env, headers, payload, modelOverride = null) {
  const model = modelOverride || headers.get("X-Gemini-Model") || env.GEMINI_MODEL || "gemini-2.5-flash";
  
  // Check if LM Studio routing is requested
  const lmStudioUrl = headers.get("X-LMStudio-Base-Url") || headers.get("x-lmstudio-base-url");
  if (lmStudioUrl) {
    const lmUrl = `${lmStudioUrl.replace(/\/$/, "")}/v1/chat/completions`;
    const messages = payload.contents.map(c => ({
      role: c.role === "model" ? "assistant" : "user",
      content: c.parts.map(p => p.text).join("\n")
    }));
    
    const lmBody = {
      model: model,
      messages: messages,
      temperature: payload.generationConfig?.temperature ?? 0.2
    };
    
    if (payload.generationConfig?.responseMimeType === "application/json") {
      lmBody.response_format = { type: "json_object" };
    }

    const res = await fetch(lmUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(lmBody)
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`LM Studio request failed status ${res.status}: ${errText}`);
    }

    const lmData = await res.json();
    const textResult = lmData.choices?.[0]?.message?.content || "";

    return {
      candidates: [
        {
          content: {
            parts: [
              { text: textResult }
            ]
          }
        }
      ]
    };
  }

  let keys = [];
  const headerKey = headers.get("X-Gemini-Api-Key") || headers.get("x-gemini-api-key");
  if (headerKey) {
    keys.push(headerKey);
  } else {
    const names = ["GEMINI_API_KEY", "GEMINI_API_KEY_1", "GEMINI_API_KEY_2", "GEMINI_API_KEY_3", "GEMINI_API_KEY_4"];
    for (const name of names) {
      const val = env[name];
      if (val) {
        const split = val.split(",").map(k => k.trim()).filter(Boolean);
        for (const k of split) {
          if (!keys.includes(k)) keys.push(k);
        }
      }
    }
  }

  if (keys.length === 0) {
    throw new Error("No Gemini API keys set.");
  }

  let lastError = null;
  for (const apiKey of keys) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (res.status === 429 || res.status === 503) {
        const errText = await res.text();
        lastError = new Error(`Gemini status ${res.status}: ${errText}`);
        continue;
      }
      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Gemini status ${res.status}: ${errText}`);
      }
      return await res.json();
    } catch (e) {
      lastError = e;
      if (e.message.includes("429") || e.message.includes("503") || e.message.includes("quota") || e.message.includes("ResourceExhausted")) {
        continue;
      }
      throw e;
    }
  }
  throw lastError || new Error("All Gemini API keys exhausted.");
}

export async function handleAiRecommend(request, env) {
  const reqData = await request.json().catch(() => ({}));

  const budgetIdr = parseInt(reqData.budget_idr, 10);
  if (isNaN(budgetIdr) || budgetIdr <= 0) {
    return new Response(
      JSON.stringify({ error: "budget_idr is required and must be greater than 0" }),
      { status: 400, headers: CORS_HEADERS }
    );
  }

  const useCase = reqData.use_case || "gaming";
  if (!(useCase in USE_CASE_PROFILES)) {
    return new Response(
      JSON.stringify({ error: `Unknown use_case: ${useCase}. Valid: ${Object.keys(USE_CASE_PROFILES).join(", ")}` }),
      { status: 400, headers: CORS_HEADERS }
    );
  }

  const byCat = componentsByCategoryMap();
  if (!byCat || Object.keys(byCat).length === 0) {
    return new Response(
      JSON.stringify({ error: "Component catalog is empty or missing" }),
      { status: 503, headers: CORS_HEADERS }
    );
  }

  const cpu_brand = reqData.cpu_brand || null;
  const gpu_vendor = reqData.gpu_vendor || null;
  const budget_strategy = reqData.budget_strategy || "balanced";
  const performance_priority = reqData.performance_priority || null;
  
  const deterministicKwargs = {
    cpu_brand,
    gpu_vendor,
    include_optional_addons: !!reqData.include_optional_addons,
    optional_addon_slots: reqData.selected_optional_addons || null,
    budget_strategy,
    performance_priority,
    allocation_overrides: reqData.allocation_overrides || null
  };

  const flat = loadComponents();
  const current_hash = await catalogHash(flat);
  const profileName = reqData.ai_profile || env.KOMPARE_AI_PROFILE || "gemini_free";
  const qdrantCollection = request.headers.get("X-Qdrant-Collection") || request.headers.get("x-qdrant-collection") || env.QDRANT_COLLECTION || "kompare_components_gemini";

  let baseline;
  try {
    baseline = composeBuild(byCat, budgetIdr, useCase, { ...deterministicKwargs, _apply_budget_optimizer: false });
  } catch (e) {
    return new Response(
      JSON.stringify(_fallbackResponse(byCat, budgetIdr, useCase, "baseline_failed", deterministicKwargs, e)),
      { status: 200, headers: CORS_HEADERS }
    );
  }

  const normalizedBudgetStrategy = budget_strategy;
  const normalizedPerformancePriority = performance_priority || (useCase === "gaming" ? "gaming" : "balanced");

  const queryTexts = AI_REQUIRED_SLOTS.map(slot => {
    const text = `${useCase} PC build with budget ${budgetIdr} IDR. Find a balanced ${slot} candidate with compatibility, upgrade flexibility, and good value for the overall build.`;
    return `${text} Budget strategy: ${normalizedBudgetStrategy}. Performance priority: ${normalizedPerformancePriority}.`;
  });

  let vectors;
  try {
    vectors = await embedTexts(env, queryTexts);
  } catch (e) {
    return new Response(
      JSON.stringify(_fallbackResponse(byCat, budgetIdr, useCase, "embedding_failed", deterministicKwargs, e)),
      { status: 200, headers: CORS_HEADERS }
    );
  }

  const candidatesBySlot = {};
  const componentsBySku = new Map();
  for (const comp of flat) {
    const sku = comp.sku || comp.id;
    if (sku) componentsBySku.set(String(sku).trim(), comp);
  }

  try {
    for (let i = 0; i < AI_REQUIRED_SLOTS.length; i++) {
      const slot = AI_REQUIRED_SLOTS[i];
      const category = slot;
      const vector = vectors[i];
      
      const matches = await queryQdrant(env, request.headers, vector, category, 36);
      const budgetLimit = _slotBudgetLimit(slot, budgetIdr, useCase);
      const slotCandidates = [];

      for (const match of matches) {
        const sku = String(match.sku || "").trim();
        const component = componentsBySku.get(sku);
        if (!component) continue;
        if (component.category !== category) continue;
        const stock = String(component.stock_status || component.stock || "").trim().toLowerCase();
        if (!STOCK_OK.has(stock)) continue;
        if ((component.price_idr || 0) > budgetLimit) continue;

        const candidate = { ...component, retrieval_score: match.score };
        slotCandidates.push(candidate);
        if (slotCandidates.length >= 12) break;
      }
      candidatesBySlot[slot] = slotCandidates;
    }
  } catch (e) {
    return new Response(
      JSON.stringify(_fallbackResponse(byCat, budgetIdr, useCase, "retrieval_failed", deterministicKwargs, e)),
      { status: 200, headers: CORS_HEADERS }
    );
  }

  const baselineComponents = baseline.components || {};
  const injectedCandidatesBySlot = {};
  for (const slot of AI_REQUIRED_SLOTS) {
    const baselineComp = baselineComponents[slot];
    const list = candidatesBySlot[slot] || [];
    const deduped = [];
    const seenSkus = new Set();
    
    for (const comp of list) {
      const sku = comp.sku || comp.id;
      if (sku && !seenSkus.has(sku)) {
        deduped.push(comp);
        seenSkus.add(sku);
      }
    }
    if (baselineComp) {
      const bSku = baselineComp.sku || baselineComp.id;
      if (bSku && !seenSkus.has(bSku)) {
        deduped.push(baselineComp);
        seenSkus.add(bSku);
      }
    }
    injectedCandidatesBySlot[slot] = deduped;
  }

  const finalCandidatesBySlot = {};
  for (const slot of AI_REQUIRED_SLOTS) {
    let list = injectedCandidatesBySlot[slot] || [];
    if (slot === "cpu") {
      list = _preferredSubsetOrOriginal(list, _cpuMatchesBrand, cpu_brand);
    } else if (slot === "gpu") {
      list = _preferredSubsetOrOriginal(list, _gpuMatchesVendor, gpu_vendor);
    }
    finalCandidatesBySlot[slot] = list;
  }

  const rankerCandidatesBySlot = {};
  for (const slot of AI_REQUIRED_SLOTS) {
    const list = finalCandidatesBySlot[slot] || [];
    const baselineComp = baselineComponents[slot];
    const sliceList = list.slice(0, 3);
    
    const deduped = [];
    const seenSkus = new Set();
    for (const comp of sliceList) {
      const sku = comp.sku || comp.id;
      if (sku && !seenSkus.has(sku)) {
        deduped.push(comp);
        seenSkus.add(sku);
      }
    }
    if (baselineComp) {
      const bSku = baselineComp.sku || baselineComp.id;
      if (bSku && !seenSkus.has(bSku)) {
        deduped.push(baselineComp);
        seenSkus.add(bSku);
      }
    }
    rankerCandidatesBySlot[slot] = deduped;
  }

  const finalRankerCandidatesBySlot = _platformCompatibleCandidates(rankerCandidatesBySlot);

  if (AI_REQUIRED_SLOTS.some(slot => !finalRankerCandidatesBySlot[slot] || finalRankerCandidatesBySlot[slot].length === 0)) {
    return new Response(
      JSON.stringify(_fallbackResponse(byCat, budgetIdr, useCase, "retrieval_incomplete", deterministicKwargs)),
      { status: 200, headers: CORS_HEADERS }
    );
  }

  const prompt = buildAiRankerPrompt(budgetIdr, useCase, finalRankerCandidatesBySlot);
  const rankerPayload = {
    contents: [
      {
        parts: [{ text: prompt }]
      }
    ],
    generationConfig: {
      temperature: 0.2,
      responseMimeType: "application/json"
    }
  };

  let parsed = null;
  let rankerMode = "json_ranker";
  let rankerError = null;
  let selectionCandidatesBySlot = finalRankerCandidatesBySlot;

  try {
    const geminiRes = await callGemini(env, request.headers, rankerPayload);
    let text = geminiRes.candidates?.[0]?.content?.parts?.[0]?.text || "";
    if (!text) throw new Error("Gemini returned empty ranking response");
    text = text.trim();
    if (text.startsWith("```")) {
      text = text.replace(/^```json\s*/i, "").replace(/```$/, "").trim();
    }
    const jsonResult = JSON.parse(text);
    parsed = parseAiRankerResponse(jsonResult, finalRankerCandidatesBySlot);
  } catch (e) {
    rankerMode = "retrieval_score_fallback";
    rankerError = e.message;
    
    selectionCandidatesBySlot = _fallbackCandidatePool(finalCandidatesBySlot, byCat, budgetIdr, useCase);
    for (const slot of AI_REQUIRED_SLOTS) {
      let list = selectionCandidatesBySlot[slot] || [];
      if (slot === "cpu") {
        list = _preferredSubsetOrOriginal(list, _cpuMatchesBrand, cpu_brand);
      } else if (slot === "gpu") {
        list = _preferredSubsetOrOriginal(list, _gpuMatchesVendor, gpu_vendor);
      }
      selectionCandidatesBySlot[slot] = list;
    }
    
    const fallbackPayload = _retrievalRankerPayload(selectionCandidatesBySlot);
    parsed = parseAiRankerResponse(fallbackPayload, selectionCandidatesBySlot);
  }

  const selected = {};
  for (const slot of AI_REQUIRED_SLOTS) {
    const wantedSku = parsed.selected_skus[slot];
    selected[slot] = (selectionCandidatesBySlot[slot] || []).find(c => (c.sku || c.id) === wantedSku) || null;
  }

  if (AI_REQUIRED_SLOTS.some(slot => !selected[slot])) {
    return new Response(
      JSON.stringify(_fallbackResponse(byCat, budgetIdr, useCase, "ai_ranker_missing_slot", deterministicKwargs)),
      { status: 200, headers: CORS_HEADERS }
    );
  }

  const components = { ...baselineComponents };
  for (const slot of AI_REQUIRED_SLOTS) {
    components[slot] = normalizeMarketplaceLinks({ ...selected[slot] });
  }

  let repaired = _repairSelectedComponents(components, candidatesBySlot, byCat, budgetIdr);
  
  let budgetRepairedSlots = new Set();
  const [budgetRepaired, repairedSlots] = _budgetRepairSelectedComponents(repaired, selectionCandidatesBySlot, byCat, budgetIdr, cpu_brand, gpu_vendor);
  repaired = budgetRepaired;
  budgetRepairedSlots = repairedSlots;

  if (budgetRepairedSlots.size > 0) {
    for (const slot of budgetRepairedSlots) {
      parsed.slot_rationales[slot] = "Adjusted to keep the full build within budget while preserving compatibility.";
    }
    parsed.selected_skus = {};
    for (const slot of AI_REQUIRED_SLOTS) {
      parsed.selected_skus[slot] = repaired[slot] ? (repaired[slot].sku || repaired[slot].id) : null;
    }
  }

  let finalBuildResult;
  try {
    const total = _totalPrice(repaired);
    const compatibilityWarnings = validateBuild(repaired);
    
    if (total > budgetIdr || compatibilityWarnings.some(w => w.severity === "error")) {
      return new Response(
        JSON.stringify(_fallbackResponse(byCat, budgetIdr, useCase, "deterministic_validation_failed", { ...deterministicKwargs, error: "AI build failed final checks" })),
        { status: 200, headers: CORS_HEADERS }
      );
    }

    const finalBuild = composeBuild(byCat, budgetIdr, useCase, {
      ...deterministicKwargs,
      _apply_budget_optimizer: false
    });

    for (const slot of REQUIRED_BUILD_SLOTS) {
      if (repaired[slot]) {
        finalBuild.components[slot] = repaired[slot];
      }
    }
    finalBuild.total_idr = _totalPrice(finalBuild.components);
    finalBuild.remaining_idr = budgetIdr - finalBuild.total_idr;
    finalBuild.budget_usage.used_percent = budgetIdr ? parseFloat(((finalBuild.total_idr / budgetIdr) * 100).toFixed(1)) : 0.0;
    
    finalBuildResult = {
      ...finalBuild,
      ai_assisted: true,
      fallback: false,
      retrieval: _buildMetadata(
        profileName,
        current_hash,
        selectionCandidatesBySlot,
        parsed.selected_skus,
        rankerMode,
        rankerError,
        qdrantCollection
      ),
      ai_rationale: {
        summary: parsed.summary,
        tradeoffs: parsed.tradeoffs,
        slot_rationales: parsed.slot_rationales
      },
      validation_source: "deterministic"
    };

  } catch (e) {
    return new Response(
      JSON.stringify(_fallbackResponse(byCat, budgetIdr, useCase, "final_composition_failed", deterministicKwargs, e)),
      { status: 200, headers: CORS_HEADERS }
    );
  }

  return new Response(
    JSON.stringify(finalBuildResult),
    { status: 200, headers: CORS_HEADERS }
  );
}

// =========================================================================
// Qdrant Cloud Reseeding Utility for BGE-M3 (1024 dimensions)
// =========================================================================

function formatPriceIdr(price) {
  return "IDR " + String(price).replace(/\B(?=(\d{3})+(?!\n))/g, ".");
}

function specsText(specs) {
  if (!specs || typeof specs !== 'object') return "";
  const parts = [];
  const keys = Object.keys(specs).sort();
  for (const key of keys) {
    const value = specs[key];
    if (value === null || value === undefined || value === "" || (Array.isArray(value) && value.length === 0)) continue;
    const label = String(key).replace(/_/g, " ");
    parts.push(`${label} ${value}`);
    if (parts.length >= 8) break;
  }
  return parts.join(", ");
}

function marketplaceNames(component) {
  const names = [];
  for (const link of (component.marketplace_links || [])) {
    if (typeof link === 'object' && link !== null) {
      const name = link.marketplace || link.name;
      if (name) names.push(String(name).trim());
    } else if (link) {
      names.push(String(link).trim());
    }
  }
  const directFields = {
    product_url: "enterkomputer",
    tokopedia_url: "tokopedia",
    shopee_url: "shopee"
  };
  for (const [field, name] of Object.entries(directFields)) {
    if (component[field]) names.push(name);
  }
  const seen = new Set();
  const deduped = [];
  for (const name of names) {
    const key = name.toLowerCase();
    if (key && !seen.has(key)) {
      deduped.push(name);
      seen.add(key);
    }
  }
  return deduped;
}

function componentToChunk(component) {
  const sku = String(component.sku || component.id || "").trim();
  const category = String(component.category || "").trim().toLowerCase();
  const brand = String(component.brand || "").trim();
  const name = String(component.name || sku).trim();
  const priceIdr = parseInt(component.price_idr, 10) || 0;
  const stockStatus = String(component.stock_status || "").trim();

  const textParts = [
    `${category} component: ${name}`,
    brand ? `brand ${brand}` : "",
    `price ${formatPriceIdr(priceIdr)}`,
    stockStatus ? `stock ${stockStatus}` : ""
  ];

  const specs = specsText(component.specs);
  if (specs) textParts.push(`specs: ${specs}`);

  const rationale = component.selection_rationale || component.rationale;
  if (rationale) textParts.push(`rationale: ${String(rationale).trim()}`);

  const marketplaces = marketplaceNames(component);
  if (marketplaces.length > 0) textParts.push(`marketplaces: ${marketplaces.join(", ")}`);

  return {
    chunk_id: `component:${sku}`,
    sku: sku,
    category: category,
    text: textParts.filter(Boolean).join(". "),
    metadata: {
      price_idr: priceIdr,
      stock_status: stockStatus,
      brand: brand
    }
  };
}

async function qdrantRequest(env, method, path, body = null) {
  const url = `${env.QDRANT_URL.replace(/\/$/, "")}${path}`;
  const headers = {
    "Content-Type": "application/json"
  };
  const apiKey = env.QDRANT_API_KEY;
  if (apiKey) {
    headers["api-key"] = apiKey;
  }
  const init = {
    method,
    headers
  };
  if (body) {
    init.body = JSON.stringify(body);
  }
  const res = await fetch(url, init);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Qdrant request failed: ${res.status} ${text}`);
  }
  return await res.json();
}

export async function handleSeedQdrant(request, env) {
  try {
    // 1. Authenticate check (support simple admin check or token check via query)
    const urlObj = new URL(request.url);
    const secretToken = urlObj.searchParams.get("token");
    const expectedToken = env.GEMINI_API_KEY || "kompare-admin-token";
    if (secretToken !== expectedToken) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: CORS_HEADERS });
    }

    // 2. Load catalog from KV
    const raw = await env.KOMPARE_DATA.get("components");
    if (!raw) {
      return new Response(JSON.stringify({ error: "Catalog not found in KV. Please seed KV first." }), { status: 404, headers: CORS_HEADERS });
    }
    const components = JSON.parse(raw);
    if (!Array.isArray(components) || components.length === 0) {
      return new Response(JSON.stringify({ error: "Catalog is empty in KV" }), { status: 400, headers: CORS_HEADERS });
    }

    const collectionName = env.QDRANT_COLLECTION || "kompare_components_gemini";

    // 3. Recreate collection on Qdrant Cloud for 1024-dimensional BGE-M3 vectors
    await qdrantRequest(env, "DELETE", `/collections/${collectionName}`).catch(() => {});
    await qdrantRequest(env, "PUT", `/collections/${collectionName}`, {
      vectors: {
        dense: {
          size: 1024,
          distance: "Cosine"
        }
      }
    });
    await qdrantRequest(env, "PUT", `/collections/${collectionName}/index`, {
      field_name: "category",
      field_schema: "keyword"
    });

    // 4. Batch & seed
    const batchSize = 32;
    const batches = [];
    for (let i = 0; i < components.length; i += batchSize) {
      batches.push(components.slice(i, i + batchSize));
    }

    let processedCount = 0;
    const concurrency = 4;

    for (let i = 0; i < batches.length; i += concurrency) {
      const slice = batches.slice(i, i + concurrency);
      await Promise.all(slice.map(async (batch) => {
        const chunks = batch.map(c => componentToChunk(c));
        const texts = chunks.map(chunk => chunk.text);
        
        // Generate embeddings using Workers AI
        const embeddings = await embedTexts(env, texts);

        const points = [];
        for (let idx = 0; idx < chunks.length; idx++) {
          const chunk = chunks[idx];
          const vector = embeddings[idx];

          // Idempotent point ID via SHA-256 hash of chunk_id
          const encoder = new TextEncoder();
          const data = encoder.encode(chunk.chunk_id);
          const hashBuffer = await crypto.subtle.digest("SHA-256", data);
          const hashArray = Array.from(new Uint8Array(hashBuffer));
          const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
          const pointId = `${hashHex.slice(0,8)}-${hashHex.slice(8,12)}-${hashHex.slice(12,16)}-${hashHex.slice(16,20)}-${hashHex.slice(20,32)}`;

          points.push({
            id: pointId,
            vector: {
              dense: vector
            },
            payload: {
              chunk_id: chunk.chunk_id,
              sku: chunk.sku,
              category: chunk.category,
              text: chunk.text,
              metadata: chunk.metadata
            }
          });
        }

        // Upload to Qdrant Cloud
        await qdrantRequest(env, "PUT", `/collections/${collectionName}/points?wait=true`, { points });
        processedCount += points.length;
      }));
    }

    return new Response(JSON.stringify({ status: "success", message: `Successfully seeded ${processedCount} components to Qdrant Cloud collection ${collectionName}` }), { status: 200, headers: CORS_HEADERS });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: CORS_HEADERS });
  }
}

export async function handleEmbed(request, env) {
  try {
    const urlObj = new URL(request.url);
    const secretToken = urlObj.searchParams.get("token");
    const expectedToken = env.GEMINI_API_KEY || "kompare-admin-token";
    if (secretToken !== expectedToken) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: CORS_HEADERS });
    }

    const reqData = await request.json().catch(() => ({}));
    const { texts } = reqData;
    if (!Array.isArray(texts) || texts.length === 0) {
      return new Response(JSON.stringify({ error: "texts array is required" }), { status: 400, headers: CORS_HEADERS });
    }

    const embeddings = await embedTexts(env, texts);
    return new Response(JSON.stringify({ embeddings }), { status: 200, headers: CORS_HEADERS });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: CORS_HEADERS });
  }
}
