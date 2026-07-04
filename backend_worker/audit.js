import {
  REQUIRED_BUILD_SLOTS,
  analyzeExistingComponents,
  validateBuild,
  parseExistingComponent
} from './pc-builder-core.js';

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-Gemini-Api-Key",
  "Content-Type": "application/json"
};

const BUILD_AUDIT_SLOT_LABELS = {
  cpu: "Processor / CPU", motherboard: "Motherboard", ram: "RAM", gpu: "VGA / GPU", ssd: "SSD",
  hdd: "Hard Drive / HDD", psu: "PSU", cpu_cooler: "CPU Cooler", fan_cooler: "Fan Cooler",
  case: "Casing", monitor: "Monitor", ups: "UPS", unknown: "Unknown"
};

const BUILD_AUDIT_INPUT_SLOTS = new Set([
  "cpu", "motherboard", "ram", "gpu", "ssd", "hdd", "psu", "cpu_cooler", "fan_cooler", "case"
]);

const BUILD_AUDIT_SLOT_ALIASES = {
  processor: "cpu", cpu: "cpu", motherboard: "motherboard", mainboard: "motherboard", mobo: "motherboard",
  ram: "ram", memory: "ram", gpu: "gpu", vga: "gpu", "graphics card": "gpu", ssd: "ssd", nvme: "ssd",
  "hard drive": "hdd", "hard disk": "hdd", hdd: "hdd", psu: "psu", "power supply": "psu",
  "cpu cooler": "cpu_cooler", cooler: "cpu_cooler", "fan cooler": "fan_cooler", "case fan": "fan_cooler",
  casing: "case", case: "case"
};

const SUPPORTED_SLOTS = new Set(Object.keys(BUILD_AUDIT_SLOT_LABELS).filter(s => s !== "unknown"));

function _cleanPartsLine(line) {
  return (line || "").replace(/^\s*[-*•\d.)]+\s*/, "").trim();
}

function _slotFromPartsLine(line) {
  const clean = _cleanPartsLine(line);
  if (!clean) return [null, ""];

  if (clean.includes(":")) {
    const parts = clean.split(":");
    const prefix = parts[0];
    const value = parts.slice(1).join(":");
    const key = prefix.trim().toLowerCase().replace(/_/g, " ");
    const slot = BUILD_AUDIT_SLOT_ALIASES[key];
    if (slot) {
      return [slot, value.trim()];
    }
  }

  const text = clean.toLowerCase();
  if (["cpu cooler", "ak400", "ag400", "hyper 212", "aio", "liquid cooler"].some(w => text.includes(w))) {
    return ["cpu_cooler", clean];
  }
  if (["case fan", "fan casing", "120mm fan", "140mm fan"].some(w => text.includes(w))) {
    return ["fan_cooler", clean];
  }
  if (["ryzen", "core i", "core ultra", "pentium", "athlon"].some(w => text.includes(w))) {
    return ["cpu", clean];
  }
  if (["motherboard", "mainboard", "b450", "b550", "b650", "h610", "b660", "b760", "x670", "z790", "lga", "am4", "am5"].some(w => text.includes(w))) {
    return ["motherboard", clean];
  }
  if (text.includes("ddr") || /\b\d{1,3}\s*gb\b.*\b(?:3200|3600|5200|5600|6000)\b/.test(text)) {
    return ["ram", clean];
  }
  if (["rtx", "gtx", "geforce", "radeon", " rx ", "arc a"].some(w => text.includes(w))) {
    return ["gpu", clean];
  }
  if (["nvme", "m.2", "ssd"].some(w => text.includes(w))) {
    return ["ssd", clean];
  }
  if (["hdd", "hard drive", "hard disk", "barracuda"].some(w => text.includes(w))) {
    return ["hdd", clean];
  }
  if (["psu", "power supply", "bronze", "gold"].some(w => text.includes(w)) || /\b\d{3,4}\s*(?:w|watt)\b/.test(text)) {
    return ["psu", clean];
  }
  if (["case", "casing", "tower"].some(w => text.includes(w))) {
    return ["case", clean];
  }
  return [null, clean];
}

function _parsePartsList(parts_list) {
  const parts = {};
  const lines = (parts_list || "").split(/\r?\n/);
  for (const line of lines) {
    const [slot, value] = _slotFromPartsLine(line);
    if (slot && BUILD_AUDIT_INPUT_SLOTS.has(slot) && value && !parts[slot]) {
      parts[slot] = value;
    }
  }
  return parts;
}

function _normalizeSlot(value) {
  const raw = String(value || "").trim().toLowerCase().replace(/-/g, "_").replace(/\s+/g, "_");
  const aliases = {
    processor: "cpu", vga: "gpu", graphics: "gpu", graphics_card: "gpu", hard_drive: "hdd", hard_disk: "hdd",
    casing: "case", cooler: "cpu_cooler", cpu_fan: "cpu_cooler", case_fan: "fan_cooler", fan: "fan_cooler", memory: "ram"
  };
  const resolved = aliases[raw] || raw;
  return SUPPORTED_SLOTS.has(resolved) ? resolved : "unknown";
}

function _normalizeConfidence(value) {
  let confidence = parseFloat(value);
  if (isNaN(confidence)) return 0.0;
  if (confidence > 1 && confidence <= 10) confidence /= 10.0;
  return Math.max(0.0, Math.min(1.0, confidence));
}

function _normalizeList(value) {
  if (Array.isArray(value)) {
    return value.map(item => String(item || "").trim()).filter(Boolean);
  }
  if (typeof value === "string" && value.trim()) {
    return [value.trim()];
  }
  return [];
}

function _normalizeSpecs(value) {
  return (value && typeof value === "object" && !Array.isArray(value)) ? value : {};
}

function normalizeBuildAudit(result) {
  const rawResult = result || {};
  const detected_parts = [];
  const seen = new Set();

  for (const item of (rawResult.detected_parts || [])) {
    if (!item || typeof item !== "object") continue;
    const slot = _normalizeSlot(item.slot);
    const name = String(item.name || item.name_guess || "").trim();
    if (!name) continue;
    const key = `${slot}:${name.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);

    detected_parts.push({
      slot,
      slot_label: BUILD_AUDIT_SLOT_LABELS[slot] || BUILD_AUDIT_SLOT_LABELS.unknown,
      name,
      confidence: _normalizeConfidence(item.confidence),
      source: String(item.source || "text").trim() || "text",
      extracted_specs: _normalizeSpecs(item.extracted_specs)
    });
  }

  const issues = [];
  for (const item of (rawResult.compatibility_issues || [])) {
    if (!item || typeof item !== "object") continue;
    const rawSlots = _normalizeList(item.slots || item.slot).map(_normalizeSlot);
    const slots = rawSlots.filter(s => s !== "unknown");
    let severity = String(item.severity || "info").toLowerCase();
    if (!["info", "warning", "error"].includes(severity)) severity = "info";

    issues.push({
      severity,
      slot: slots.length > 0 ? slots[0] : null,
      slots,
      title: String(item.title || "Build audit note").trim(),
      message: String(item.message || "").trim(),
      recommendation: String(item.recommendation || "").trim()
    });
  }

  const missing_slots = _normalizeList(rawResult.missing_slots).map(_normalizeSlot).filter(s => s !== "unknown");
  const unique_missing = Array.from(new Set(missing_slots)).sort();

  let status = String(rawResult.status || "").trim().toLowerCase();
  if (!["compatible", "needs_attention", "incomplete"].includes(status)) {
    status = issues.length > 0 ? "needs_attention" : (unique_missing.length > 0 ? "incomplete" : "compatible");
  }

  return {
    status,
    summary: String(rawResult.summary || "Build audit completed.").trim(),
    detected_parts,
    compatibility_issues: issues,
    missing_slots: unique_missing,
    budget_notes: _normalizeList(rawResult.budget_notes),
    suggested_next_steps: _normalizeList(rawResult.suggested_next_steps)
  };
}

function _fallbackBuildAudit(goal, parts_list) {
  const parts = _parsePartsList(parts_list);
  const analysis = analyzeExistingComponents(parts);
  const detected = analysis.detected_existing;
  const compatibility = validateBuild(detected);
  const missing_slots = REQUIRED_BUILD_SLOTS.filter(slot => !(slot in detected));
  
  const issues = [...compatibility, ...analysis.warning_objects];
  const hasHardIssue = compatibility.some(issue => issue.severity === "warning" || issue.severity === "error");
  const status = hasHardIssue ? "needs_attention" : (missing_slots.length > 0 ? "incomplete" : "compatible");

  const detected_parts = [];
  for (const [slot, name] of Object.entries(analysis.recognized)) {
    const item = detected[slot] || parseExistingComponent(slot, name);
    detected_parts.push({
      slot,
      slot_label: BUILD_AUDIT_SLOT_LABELS[slot] || slot,
      name,
      confidence: item.detection_confidence === "medium" ? 0.7 : 0.45,
      source: "text",
      extracted_specs: item.specs || {}
    });
  }

  const suggested_next_steps = [];
  if (missing_slots.length > 0) {
    const labels = missing_slots.slice(0, 4).map(slot => BUILD_AUDIT_SLOT_LABELS[slot] || slot);
    suggested_next_steps.push(`Confirm missing parts before buying: ${labels.join(", ")}.`);
  }
  if (compatibility.length > 0) {
    suggested_next_steps.push("Resolve compatibility warnings before checking marketplace prices.");
  }
  if (detected_parts.length === 0) {
    suggested_next_steps.push("Paste one part per line, such as CPU: Ryzen 5 5600 or GPU: RTX 3060 12GB.");
  }

  return normalizeBuildAudit({
    status,
    summary: status === "needs_attention" ? "This build needs attention before buying." : (status === "incomplete" ? "This parts list is incomplete." : "No major compatibility issue was detected from the typed parts."),
    detected_parts,
    compatibility_issues: issues,
    missing_slots,
    budget_notes: goal && goal.trim() ? [`Goal: ${goal.trim()}`] : [],
    suggested_next_steps
  });
}

function _imageUnavailableBuildAudit(goal) {
  const audit = _fallbackBuildAudit(goal, "");
  audit.summary = "Screenshot uploaded, but image analysis is unavailable. Paste the cart parts as text to continue the audit.";
  audit.budget_notes.push("The screenshot was received, but no parts could be extracted without the multimodal model.");
  audit.suggested_next_steps = [
    "Paste the cart parts as text, one component per line, then run Audit build again.",
    "Use labels like CPU:, Motherboard:, RAM:, GPU:, SSD:, HDD:, PSU:, CPU Cooler:, Fan Cooler:, and Casing:."
  ];
  return audit;
}

function buildBuildAuditPrompt(goal, parts_list) {
  const goal_block = goal && goal.trim() ? `\nUSER GOAL: ${goal.trim()}` : "";
  const parts_block = parts_list && parts_list.trim() ? `\nTYPED PARTS LIST:\n${parts_list.trim()}` : "";
  
  const schemaStr = JSON.stringify({
    status: "compatible | needs_attention | incomplete",
    summary: "short buyer-readable audit summary",
    detected_parts: [
      {
        slot: "cpu | motherboard | ram | gpu | ssd | hdd | psu | cpu_cooler | fan_cooler | case | monitor | ups | unknown",
        name: "detected component name",
        confidence: "number from 0.0 to 1.0",
        source: "image | text | image_and_text",
        extracted_specs: "object of compatibility-relevant specs only"
      }
    ],
    compatibility_issues: [
      {
        severity: "info | warning | error",
        title: "issue title",
        message: "plain-language issue",
        slots: ["affected slot keys"],
        recommendation: "what the buyer should do next"
      }
    ],
    missing_slots: ["required PC Builder slots not found"],
    budget_notes: ["budget or value notes"],
    suggested_next_steps: ["specific next actions"]
  }, null, 2);

  return `Audit a PC build from a cart screenshot and optional typed parts list.

Return one JSON object matching the schema. This is a PC Builder audit, not a generic product identifier.

Rules:
- Detect PC component slots: CPU, motherboard, RAM, VGA/GPU, SSD, HDD, PSU, CPU cooler, fan cooler, casing, monitor, UPS.
- Check compatibility risks: CPU socket, motherboard socket, RAM generation, PSU headroom, motherboard/case fit, cooler context, storage interface, monitor target, and UPS wattage/VA.
- Report missing required tower slots: CPU, motherboard, RAM, GPU, SSD, HDD, PSU, CPU cooler, fan cooler, casing.
- Use image evidence and typed text together, but do not invent exact specs when neither source supports them.
- Keep the output grounded in the provided cart/list. Do not recommend laptops, prebuilt desktops, phones, printers, speakers, software, or unrelated electronics.
- Do not wrap output in markdown. Do not add fields outside the schema.${goal_block}${parts_block}

SCHEMA:
${schemaStr}`;
}

function arrayBufferToBase64(buffer) {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
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

export async function handleAudit(request, env) {
  const formData = await request.formData().catch(() => null);
  if (!formData) {
    return new Response(
      JSON.stringify({ error: "Paste a parts list or upload a cart screenshot first." }),
      { status: 400, headers: CORS_HEADERS }
    );
  }

  const goal = String(formData.get("goal") || "").trim();
  const parts_list = String(formData.get("parts_list") || "").trim();
  const imageFile = formData.get("image");

  const hasImage = imageFile && typeof imageFile === "object" && imageFile.size > 0;
  if (!hasImage && !parts_list) {
    return new Response(
      JSON.stringify({ error: "Paste a parts list or upload a cart screenshot first." }),
      { status: 400, headers: CORS_HEADERS }
    );
  }

  let filename = null;
  let meta = {};
  let audit = null;

  if (hasImage) {
    filename = imageFile.name || "image.jpg";
    const rawBytes = await imageFile.arrayBuffer();
    if (rawBytes.byteLength > 8 * 1024 * 1024) {
      return new Response(
        JSON.stringify({ error: "Image too large (max 8 MB)." }),
        { status: 413, headers: CORS_HEADERS }
      );
    }
    if (rawBytes.byteLength === 0) {
      return new Response(
        JSON.stringify({ error: "Empty file." }),
        { status: 400, headers: CORS_HEADERS }
      );
    }

    meta = {
      name: filename,
      size: rawBytes.byteLength,
      type: imageFile.type || "image/jpeg"
    };

    const base64Data = arrayBufferToBase64(rawBytes);
    const prompt = buildBuildAuditPrompt(goal, parts_list);

    try {
      const payload = {
        contents: [
          {
            parts: [
              {
                inlineData: {
                  mimeType: imageFile.type || "image/jpeg",
                  data: base64Data
                }
              },
              {
                text: prompt
              }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.2,
          responseMimeType: "application/json"
        }
      };

      const geminiRes = await callGemini(env, request.headers, payload);
      let text = geminiRes.candidates?.[0]?.content?.parts?.[0]?.text || "";
      if (!text) {
        throw new Error("Gemini returned empty response");
      }
      
      text = text.trim();
      if (text.startsWith("```")) {
        text = text.replace(/^```json\s*/i, "").replace(/```$/, "").trim();
      }

      const jsonResult = JSON.parse(text);
      audit = normalizeBuildAudit(jsonResult);
    } catch (e) {
      if (!parts_list) {
        audit = _imageUnavailableBuildAudit(goal);
      } else {
        audit = _fallbackBuildAudit(goal, parts_list);
        audit.budget_notes.push("Image analysis was unavailable, so this audit used the typed parts list.");
      }
    }
  } else {
    audit = _fallbackBuildAudit(goal, parts_list);
  }

  return new Response(
    JSON.stringify({
      filename,
      image_meta: meta,
      audit
    }),
    { status: 200, headers: CORS_HEADERS }
  );
}
