import {
  loadComponents,
  validateBuild,
  normalizeMarketplaceLinks,
  parseExistingComponent
} from './pc-builder-core.js';

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-Gemini-Api-Key",
  "Content-Type": "application/json"
};

const SLOT_LABELS = {
  cpu: "CPU", motherboard: "Motherboard", ram: "RAM", gpu: "GPU", ssd: "SSD", hdd: "HDD", psu: "PSU",
  cpu_cooler: "CPU cooler", fan_cooler: "Fan cooler", case: "Casing", monitor: "Monitor", ups: "UPS"
};

const SLOT_KEYWORDS = {
  cpu: ["cpu", "processor", "core", "ryzen", "intel"],
  motherboard: ["motherboard", "mobo", "socket", "chipset", "board"],
  ram: ["ram", "memory", "ddr", "gb"],
  gpu: ["gpu", "vga", "graphics", "graphic", "vram", "geforce", "radeon", "rtx", "rx"],
  ssd: ["ssd", "nvme", "storage"],
  hdd: ["hdd", "hard drive", "hard disk"],
  psu: ["psu", "power supply", "watt", "wattage", "headroom"],
  cpu_cooler: ["cpu cooler", "cooler", "thermal", "tdp"],
  fan_cooler: ["fan", "airflow"],
  case: ["case", "casing", "form factor"],
  monitor: ["monitor", "display", "screen"],
  ups: ["ups", "va", "backup power"]
};

const SUMMARY_KEYS = {
  cpu: ["socket", "cores", "threads", "base_clock_ghz", "tdp_w"],
  motherboard: ["socket", "form_factor", "ram_type", "chipset"],
  ram: ["type", "capacity_gb", "speed_mhz", "module_count", "modules"],
  gpu: ["vram_gb", "vendor", "recommended_psu_w", "tdp_w"],
  ssd: ["capacity_gb", "interface", "form_factor"],
  hdd: ["capacity_gb", "interface", "form_factor_in"],
  psu: ["wattage_w", "rating", "modular"],
  cpu_cooler: ["type", "tdp_w", "fan_size_mm"],
  fan_cooler: ["type", "fan_size_mm"],
  case: ["form_factor", "max_form_factor", "color"],
  monitor: ["size_in", "refresh_rate_hz", "resolution"],
  ups: ["capacity_va", "wattage_w"]
};

const SPEC_LABELS = {
  socket: "Socket", cores: "Cores", threads: "Threads", base_clock_ghz: "Base clock", tdp_w: "TDP",
  form_factor: "Form factor", max_form_factor: "Fits board", ram_type: "Memory type", chipset: "Chipset",
  type: { ram: "Memory type", cpu_cooler: "Cooler type", fan_cooler: "Fan type" },
  capacity_gb: { ram: "Capacity", ssd: "Capacity", hdd: "Capacity" },
  speed_mhz: "Speed", module_count: "Modules", modules: "Modules", vram_gb: "VRAM", vendor: "GPU vendor",
  recommended_psu_w: "PSU target", wattage_w: "Wattage", rating: "Efficiency", modular: "Modular",
  fan_size_mm: "Fan size", interface: "Interface", form_factor_in: "Drive size", color: "Color",
  size_in: "Size", refresh_rate_hz: "Refresh rate", resolution: "Resolution", capacity_va: "Capacity"
};

const OUT_OF_SCOPE_TERMS = [
  "laptop", "notebook", "phone", "smartphone", "tablet", "camera", "speaker", "headset", "printer", "gadget"
];

function specLabel(slot, key) {
  const label = SPEC_LABELS[key];
  if (label && typeof label === "object") {
    return label[slot] || key.replace(/_/g, " ");
  }
  return label || key.replace(/_/g, " ");
}

function formatSpecValue(key, value) {
  if (["wattage_w", "tdp_w", "recommended_psu_w"].includes(key)) return `${value}W`;
  if (["capacity_gb", "vram_gb"].includes(key)) return `${value} GB`;
  if (key === "speed_mhz") return `${value} MHz`;
  if (key === "fan_size_mm") return `${value} mm`;
  if (key === "base_clock_ghz") return `${value} GHz`;
  if (["form_factor_in", "size_in"].includes(key)) return `${value}"`;
  if (key === "refresh_rate_hz") return `${value} Hz`;
  if (key === "capacity_va") return `${value} VA`;
  if (typeof value === "boolean") return value ? "yes" : "no";
  return String(value);
}

function stockLabel(status) {
  const normalized = String(status || "").trim().toLowerCase();
  if (!normalized) return "Stock unknown";
  if (["in_stock", "instock", "ready", "available", "stock"].includes(normalized)) return "In stock";
  if (["out_of_stock", "outofstock", "sold_out", "empty", "habis"].includes(normalized)) return "Out of stock";
  if (normalized.includes("pre")) return "Preorder";
  return normalized.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

function specSummary(slot, specs) {
  const out = [];
  const keys = SUMMARY_KEYS[slot] || Object.keys(specs);
  for (const key of keys) {
    const value = specs[key];
    if (value === null || value === undefined || value === "" || (Array.isArray(value) && value.length === 0)) continue;
    out.push({ label: specLabel(slot, key), value: formatSpecValue(key, value) });
    if (out.length >= 4) break;
  }
  return out;
}

function rationaleLines(component) {
  const rationale = component.selection_rationale || {};
  const lines = [];
  if (rationale.summary) lines.push(String(rationale.summary));
  for (const factor of (rationale.factors || [])) {
    if (factor && !lines.includes(factor)) lines.push(String(factor));
  }
  return lines.slice(0, 4);
}

function compactComponent(slot, component) {
  if (!component) return null;
  const specs = component.specs || {};
  const specBits = specSummary(slot, specs).map(item => `${item.label}=${item.value}`);
  const suffix = specBits.length > 0 ? ` (${specBits.join(", ")})` : "";
  const rationale = rationaleLines(component);
  const rationaleSuffix = rationale.length > 0 ? `; Selection rationale: ${rationale.slice(0, 2).join("; ")}` : "";
  const price = (component.price_idr || 0).toLocaleString("id-ID");
  return `${SLOT_LABELS[slot] || slot}: ${component.name} - Rp ${price}; ${stockLabel(component.stock_status)}${suffix}${rationaleSuffix}`;
}

function extractComponents(context) {
  if (context.components && typeof context.components === "object") return context.components;
  const rec = context.recommendation || {};
  if (rec.components && typeof rec.components === "object") return rec.components;
  return {};
}

function detectReferencedSlots(question, context = null) {
  const text = String(question || "").toLowerCase();
  const found = [];
  for (const [slot, keywords] of Object.entries(SLOT_KEYWORDS)) {
    if (keywords.some(kw => text.includes(kw))) found.push(slot);
  }
  if (context) {
    for (const warning of (context.compatibility_warnings || [])) {
      const slots = warning.slots || [warning.slot];
      for (const slot of slots) {
        if (slot && !found.includes(slot)) found.push(slot);
      }
    }
  }
  return found;
}

function isOutOfScope(question) {
  const text = String(question || "").toLowerCase();
  return OUT_OF_SCOPE_TERMS.some(term => {
    const rx = new RegExp(`\\b${term}s?\\b`, "i");
    return rx.test(text);
  });
}

function evidenceCards(context, referencedSlots) {
  const components = extractComponents(context);
  const cards = [];
  for (const slot of referencedSlots) {
    const component = components[slot];
    if (!component) continue;
    cards.push({
      slot,
      label: SLOT_LABELS[slot] || slot,
      sku: component.sku || component.id,
      name: component.name,
      brand: component.brand,
      price_idr: component.price_idr || 0,
      stock_label: stockLabel(component.stock_status),
      specs: specSummary(slot, component.specs || {}),
      rationale: rationaleLines(component)
    });
  }
  return cards;
}

function buildContextSummary(mode, context) {
  const components = extractComponents(context);
  const total = context.total_idr || (context.recommendation || {}).total_idr || 0;
  const lines = [
    `Mode: ${mode}`,
    `Budget IDR: ${context.budget_idr || 0}`,
    `Total IDR: ${total}`,
    `Remaining IDR: ${context.remaining_idr || 0}`,
    "Components:"
  ];
  for (const slot of Object.keys(SLOT_LABELS)) {
    const line = compactComponent(slot, components[slot]);
    if (line) lines.push(`- ${line}`);
  }

  const priorities = context.upgrade_priorities || [];
  if (priorities.length > 0) {
    lines.push("Upgrade priorities:");
    for (const item of priorities.slice(0, 5)) {
      lines.push(`- ${item.slot}: ${item.title} | ${item.reason}`);
    }
  }

  const warnings = context.compatibility_warnings || [];
  if (warnings.length > 0) {
    lines.push("Compatibility warnings:");
    for (const warning of warnings.slice(0, 5)) {
      lines.push(`- ${warning.severity}: ${warning.title} - ${warning.message}`);
    }
  } else {
    lines.push("Compatibility warnings: none");
  }

  return lines.join("\n");
}

function buildContextAdvisorSystemInstruction(mode, context) {
  return (
    "You are Kompare's PC Build Advisor. Answer only about the active PC build or upgrade context.\n" +
    "Use the provided context as source of truth. Do not invent parts, prices, stock, or marketplace links.\n" +
    "Do not recommend laptops, notebooks, gadgets, phones, broad electronics, or unrelated shopping categories.\n" +
    "If the user asks outside PC building, briefly steer them back to the active PC build.\n" +
    "Be concise, practical, and buyer-readable. Mention compatibility warnings when relevant.\n\n" +
    `ACTIVE CONTEXT:\n${buildContextSummary(mode, context)}`
  );
}

function suggestedQuestions(mode, referencedSlots) {
  const slots = new Set(referencedSlots);
  if (slots.has("gpu")) {
    return ["Can I get better GPU value?", "Is the PSU enough for this GPU?", "What would you downgrade to save budget?"];
  }
  if (slots.has("psu")) {
    return ["How much PSU headroom do I have?", "Is the UPS sized correctly?", "Can I use a cheaper PSU?"];
  }
  if (mode === "upgrade") {
    return ["What should I upgrade first?", "What can wait until later?", "Any compatibility risks?"];
  }
  return ["Why this component mix?", "Can I reduce the total price?", "What is the first future upgrade?"];
}

function fallbackAnswer(mode, question, context) {
  if (isOutOfScope(question)) {
    return (
      "I can only help with the active PC build or PC upgrade in Kompare. " +
      "I cannot recommend laptops, gadgets, or unrelated electronics here. " +
      "For this PC build, ask about compatibility, budget tradeoffs, upgrade priority, or a selected component."
    );
  }

  const components = extractComponents(context);
  const referenced = detectReferencedSlots(question, context);
  const lines = [];

  if (referenced.length === 0) {
    const total = context.total_idr || (context.recommendation || {}).total_idr || 0;
    const budget = context.budget_idr || 0;
    lines.push(`This ${mode} recommendation is grounded in the current component list and budget.`);
    if (total && budget) {
      lines.push(`It uses Rp ${total.toLocaleString("id-ID")} from a Rp ${budget.toLocaleString("id-ID")} budget.`);
    }
    const priorities = context.upgrade_priorities || [];
    if (priorities.length > 0) {
      lines.push(`The top upgrade priority is ${priorities[0].title}: ${priorities[0].reason}`);
    }
  } else {
    for (const slot of referenced) {
      const component = components[slot];
      if (!component) continue;
      const label = SLOT_LABELS[slot] || slot;
      const specs = specSummary(slot, component.specs || {});
      const specText = specs.slice(0, 3).map(item => `${item.label} ${item.value}`).join(", ");
      let detail = `${label}: ${component.name} at Rp ${(component.price_idr || 0).toLocaleString("id-ID")} (${stockLabel(component.stock_status)}).`;
      if (specText) {
        detail += ` Key specs: ${specText}.`;
      }
      lines.push(detail);
      const rationale = rationaleLines(component);
      if (rationale.length > 0) {
        lines.push(`Why it fits: ${rationale.slice(0, 2).join(" ")}`);
      }
    }
  }

  const warnings = context.compatibility_warnings || [];
  if (warnings.length > 0) {
    lines.push(`Compatibility note: ${warnings[0].title} - ${warnings[0].message}`);
  } else if (referenced.length > 0) {
    lines.push("No compatibility warnings are attached to these referenced parts in the current result.");
  }

  return lines.join(" ").trim() || "Ask me about the active PC build, upgrade priorities, compatibility, or budget tradeoffs.";
}

const COST_SAVING_TERMS = [
  "reduce", "cheaper", "cheap", "save", "saving", "lower price", "cut cost", "downgrade", "less expensive", "budget"
];

function _isCostSavingQuestion(question) {
  const text = String(question || "").toLowerCase();
  return COST_SAVING_TERMS.some(term => text.includes(term));
}

function _componentRef(component) {
  const c = component || {};
  return {
    sku: c.sku || c.id || null,
    name: c.name || null,
    price_idr: c.price_idr || 0
  };
}

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

function _advisorCostSavingSlots(referenced_slots, components) {
  const selected = referenced_slots.filter(slot => {
    return ["cpu", "gpu", "ram", "motherboard", "ssd", "hdd", "psu", "case", "cpu_cooler", "fan_cooler"].includes(slot) && components[slot];
  });
  if (selected.length > 0) return selected;

  const priced_slots = Object.entries(components)
    .filter(([slot, component]) => {
      return ["cpu", "gpu", "ram", "motherboard", "ssd", "hdd", "psu", "case", "cpu_cooler", "fan_cooler"].includes(slot) && component;
    })
    .map(([slot, component]) => [slot, component.price_idr || 0]);

  priced_slots.sort((a, b) => b[1] - a[1]);
  return priced_slots.slice(0, 3).map(item => item[0]);
}

function _advisorCostSavingSuggestions(context, referenced_slots, question) {
  if (!_isCostSavingQuestion(question)) return [];
  const components = extractComponents(context);
  if (!components || Object.keys(components).length === 0) return [];

  const current_total = context.total_idr || (context.recommendation || {}).total_idr || Object.values(components).reduce((sum, c) => sum + ((c || {}).price_idr || 0), 0);
  const budget = context.budget_idr || current_total;
  const suggestions = [];
  const source_items = loadComponents();

  for (const slot of _advisorCostSavingSlots(referenced_slots, components)) {
    const current = components[slot] || {};
    const current_price = parseInt(current.price_idr || 0, 10);
    const current_sku = current.sku || current.id;
    if (current_price <= 0) continue;

    const slot_suggestions = [];
    for (const component of source_items) {
      const candidate_price = parseInt(component.price_idr || 0, 10);
      if (candidate_price <= 0 || candidate_price >= current_price) continue;
      const sku = component.sku || component.id;
      if (current_sku && sku === current_sku) continue;
      if (!_slotAcceptsCandidate(slot, component)) continue;

      const projected_build = { ...components };
      const normalized = normalizeMarketplaceLinks(component);
      projected_build[slot] = normalized;

      const warnings = validateBuild(projected_build);
      if (warnings.some(warning => warning.severity === "error")) continue;

      const projected_total = parseInt(current_total, 10) - current_price + candidate_price;
      slot_suggestions.push({
        slot,
        label: SLOT_LABELS[slot] || slot,
        current: _componentRef(current),
        candidate: _componentRef(normalized),
        savings_idr: current_price - candidate_price,
        projected_total_idr: projected_total,
        projected_remaining_idr: parseInt(budget, 10) - projected_total,
        compatibility_summary: _compatibilitySummary(slot, normalized, components, warnings),
        compatibility_warnings: warnings.slice(0, 2)
      });
    }

    slot_suggestions.sort((a, b) => {
      if (b.savings_idr !== a.savings_idr) {
        return b.savings_idr - a.savings_idr;
      }
      return a.candidate.price_idr - b.candidate.price_idr;
    });

    if (slot_suggestions.length > 0) {
      suggestions.push(slot_suggestions[0]);
    }
    if (suggestions.length >= 3) break;
  }

  return suggestions;
}

async function callGemini(env, headers, payload, modelOverride = null) {
  const model = modelOverride || headers.get("X-Gemini-Model") || env.GEMINI_MODEL || "gemini-2.5-flash";
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

export async function handleAdvisor(request, env) {
  const reqData = await request.json().catch(() => ({}));
  const question = String(reqData.question || "").trim();

  if (!question) {
    return new Response(
      JSON.stringify({ error: "question is required" }),
      { status: 400, headers: CORS_HEADERS }
    );
  }

  const mode = reqData.mode || "build";
  const contextData = reqData.context || {};
  const history = reqData.history || [];

  const referenced_slots = detectReferencedSlots(question, contextData);
  const system = buildContextAdvisorSystemInstruction(mode, contextData);

  let answer = "";
  let fallback = false;

  try {
    const contents = [];
    const historySlice = history.slice(-11);
    for (const m of historySlice) {
      if (m.role === "user" || m.role === "assistant") {
        contents.push({
          role: m.role === "assistant" ? "model" : "user",
          parts: [{ text: String(m.content) }]
        });
      }
    }
    contents.push({
      role: "user",
      parts: [{ text: question }]
    });

    const payload = {
      contents,
      systemInstruction: {
        parts: [{ text: system }]
      },
      generationConfig: {
        temperature: 0.3
      }
    };

    const geminiRes = await callGemini(env, request.headers, payload);
    answer = geminiRes.candidates?.[0]?.content?.parts?.[0]?.text || "";
    if (!answer) {
      throw new Error("Gemini returned empty response");
    }
    answer = answer.trim();
  } catch (e) {
    answer = fallbackAnswer(mode, question, contextData);
    fallback = true;
  }

  return new Response(
    JSON.stringify({
      answer,
      referenced_slots,
      evidence_cards: evidenceCards(contextData, referenced_slots),
      cost_saving_suggestions: _advisorCostSavingSuggestions(contextData, referenced_slots, question),
      suggested_questions: suggestedQuestions(mode, referenced_slots),
      fallback
    }),
    { status: 200, headers: CORS_HEADERS }
  );
}
