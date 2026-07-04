// Constants
export const USE_CASE_PROFILES = {
  gaming:           { cpu: 18, gpu: 33, ram: 7,  motherboard: 10, ssd: 10, psu: 8, case: 7, cpu_cooler: 5, fan_cooler: 2 },
  productivity:     { cpu: 27, gpu: 17, ram: 12, motherboard: 12, ssd: 14, psu: 7, case: 6, cpu_cooler: 4, fan_cooler: 1 },
  content_creation: { cpu: 24, gpu: 26, ram: 12, motherboard: 10, ssd: 13, psu: 7, case: 4, cpu_cooler: 3, fan_cooler: 1 },
  office:           { cpu: 28, gpu: 0,  ram: 12, motherboard: 18, ssd: 20, psu: 8, case: 8, cpu_cooler: 5, fan_cooler: 1 },
  student:          { cpu: 22, gpu: 16, ram: 12, motherboard: 14, ssd: 14, psu: 8, case: 8, cpu_cooler: 5, fan_cooler: 1 }
};

export const ALLOCATION_PRESET_SLOTS = [
  "cpu", "gpu", "ram", "motherboard", "ssd", "psu", "case", "cpu_cooler", "fan_cooler"
];

export const PERFORMANCE_PRIORITY_ALLOCATION_SHIFTS = {
  gaming: { cpu: 2, gpu: 4, motherboard: -1, ssd: -2, case: -2, fan_cooler: -1 },
  productivity: { cpu: 5, gpu: -7, ram: 4, ssd: 4, case: -3, cpu_cooler: -1, fan_cooler: -2 },
  best_value: { cpu: -1, gpu: -2, ram: 2, ssd: 2, psu: 1, cpu_cooler: -1, fan_cooler: -1 },
  balanced: {},
  upgrade_friendly: { cpu: -2, gpu: -6, ram: -1, motherboard: 5, ssd: -2, psu: 4, case: 3, fan_cooler: -1 }
};

export const BUDGET_STRATEGY_ALLOCATION_SHIFTS = {
  value: { cpu: -1, gpu: -2, ram: 1, ssd: 2, psu: 1, cpu_cooler: -1 },
  balanced: {},
  maximize: { cpu: 2, gpu: 3, ram: -1, motherboard: -1, ssd: -2, case: -2, cpu_cooler: 1 }
};

export const BUDGET_STRATEGIES = new Set(["value", "balanced", "maximize"]);
export const PERFORMANCE_PRIORITIES = new Set(["gaming", "productivity", "best_value", "balanced", "upgrade_friendly"]);

export const BUDGET_USAGE_TARGETS = {
  value: { min: 0.0, max: 0.90 },
  balanced: { min: 0.85, max: 0.97 },
  maximize: { min: 0.95, max: 1.0 }
};

export const BUDGET_BANDS = [
  { key: "below_entry", label: "Below entry-level", min_idr: 0, max_idr: 6999999, summary: "Best-effort build; catalog constraints may leave required parts missing." },
  { key: "entry_level", label: "Entry-level", min_idr: 7000000, max_idr: 11999999, summary: "Starter PC budget for basic work and light esports." },
  { key: "mid_range", label: "Mid-range", min_idr: 12000000, max_idr: 21999999, summary: "Mainstream 1080p and balanced multitasking budget." },
  { key: "high_end", label: "High-end", min_idr: 22000000, max_idr: 40000000, summary: "High-refresh 1440p and creator workload budget." },
  { key: "custom_high", label: "Custom high-budget", min_idr: 40000001, max_idr: null, summary: "Performance-tier budget where catalog availability controls the ceiling." }
];

export const PRIORITY_UPGRADE_ORDER = {
  gaming: ["gpu", "cpu", "ram", "psu", "cpu_cooler", "motherboard", "ssd", "case", "fan_cooler"],
  productivity: ["cpu", "ram", "ssd", "gpu", "motherboard", "psu", "cpu_cooler", "case", "fan_cooler"],
  best_value: ["gpu", "cpu", "ram", "ssd", "psu", "motherboard", "case", "cpu_cooler", "fan_cooler"],
  upgrade_friendly: ["psu", "motherboard", "case", "cpu", "gpu", "ram", "cpu_cooler", "ssd", "fan_cooler"],
  balanced: ["gpu", "cpu", "ram", "ssd", "psu", "motherboard", "cpu_cooler", "case", "fan_cooler"]
};

export const CASE_FF_RANK = { ITX: 1, mATX: 2, ATX: 3, EATX: 4 };
export const MONITOR_RESOLUTION_RANK = { FHD: 1, QHD: 2, "4K": 3 };

export const REQUIRED_BUILD_SLOTS = [
  "cpu", "motherboard", "ram", "gpu", "ssd", "psu", "cpu_cooler", "fan_cooler", "case"
];

export const OPTIONAL_ADDON_SLOTS = ["hdd", "monitor", "ups"];
export const KNOWN_UPGRADE_SLOTS = [...REQUIRED_BUILD_SLOTS, "hdd"];

export const BUDGET_TIERS = [
  {
    key: "entry_level",
    label: "Entry-level",
    min_idr: 7000000,
    max_idr: 12000000,
    target: "Office, school, light esports, and compact upgrade-friendly basics.",
    summary: "Tight starter build for office, school, and light esports.",
    performance_goal: "Everyday + light esports",
    upgrade_note: "Keeps the platform simple and upgrade-ready."
  },
  {
    key: "mid_range",
    label: "Mid-range",
    min_idr: 12000000,
    max_idr: 22000000,
    target: "Strong 1080p ultra or 1440p entry gaming with balanced platform choices.",
    summary: "Balanced 1080p ultra build with 1440p entry headroom.",
    performance_goal: "1080p ultra / 1440p entry",
    upgrade_note: "Balances GPU value, RAM, and PSU headroom."
  },
  {
    key: "high_end",
    label: "High-end",
    min_idr: 22000000,
    max_idr: 40000000,
    target: "1440p high-refresh, content creation, and longer upgrade runway.",
    summary: "Focused high-refresh gaming and creator workload tier.",
    performance_goal: "1440p high-refresh",
    upgrade_note: "Adds stronger cooling and platform runway."
  },
  {
    key: "custom",
    label: "Custom budget",
    min_idr: 3000000,
    max_idr: null,
    display_range: "♾️",
    target: "User-defined budget with the same compatibility and balance checks.",
    summary: "Enter your own number and keep the same balance checks.",
    performance_goal: "Manual budget fit",
    upgrade_note: "Uses compatibility checks at your number."
  }
];

const DDR5_ONLY_SOCKETS = new Set(["AM5", "LGA 1851", "LGA1851", "sTR5", "SP5", "LGA 4677"]);
const DDR4_ONLY_SOCKETS = new Set(["AM4", "LGA 1200", "LGA1200", "LGA 1151", "LGA1151", "LGA 1151V2", "LGA1151V2"]);
const DDR3_ONLY_SOCKETS = new Set(["LGA 1150", "LGA1150", "LGA 1155", "LGA1155"]);

function norm(s) {
  return String(s || "").trim();
}

export function parseCpu(name, subcategory) {
  const sub = norm(subcategory);
  const name_l = name.toLowerCase();
  let socket = null;
  const m = sub.match(/Socket\s+([A-Za-z0-9 ]+?)(?:\s*$)/);
  if (m) {
    socket = m[1].trim();
  } else if (sub.includes("AM4")) {
    socket = "AM4";
  } else if (sub.includes("AM5")) {
    socket = "AM5";
  }

  const brand = (sub.includes("AMD") || /ryzen|epyc|athlon|bristol ridge/.test(name_l)) ? "AMD" : (sub.includes("Intel") ? "Intel" : null);
  let family = null;
  const families = [
    "Ryzen Threadripper PRO", "Ryzen Threadripper", "EPYC", "Athlon", "Bristol Ridge",
    "Core Ultra 9", "Core Ultra 7", "Core Ultra 5",
    "Core i9", "Core i7", "Core i5", "Core i3", "Core 2 Duo", "Pentium",
    "Ryzen 9", "Ryzen 7", "Ryzen 5", "Ryzen 3"
  ];
  for (const fam of families) {
    if (name_l.includes(fam.toLowerCase())) {
      family = fam;
      break;
    }
  }

  const cores_by_family = {
    "Ryzen 9": 12, "Ryzen 7": 8, "Ryzen 5": 6, "Ryzen 3": 4,
    "Core Ultra 9": 24, "Core Ultra 7": 20, "Core Ultra 5": 14,
    "Core i9": 16, "Core i7": 12, "Core i5": 10, "Core i3": 4,
    "Core 2 Duo": 2, "Pentium": 2, "Athlon": 2
  };
  let cores = cores_by_family[family] || null;
  const explicit_cores = name.match(/\b(\d{1,3})\s*Core\b/i);
  if (explicit_cores) {
    cores = parseInt(explicit_cores[1], 10);
  }

  let has_igpu = true;
  if (brand === "Intel" && /\d{3,5}[A-Z]*F\b/.test(name)) {
    has_igpu = false;
  }
  if (name_l.includes("ryzen") && /\b\d{4,5}X?\b/.test(name)) {
    const parts = name.split(/\s+/);
    const lastPart = parts[parts.length - 1].toUpperCase();
    if (!lastPart.includes("G") && socket === "AM4") {
      has_igpu = false;
    }
  }

  let ddr = null;
  if (socket) {
    if (DDR5_ONLY_SOCKETS.has(socket) || Array.from(DDR5_ONLY_SOCKETS).some(s => socket.includes(s))) {
      ddr = "DDR5";
    } else if (DDR4_ONLY_SOCKETS.has(socket) || Array.from(DDR4_ONLY_SOCKETS).some(s => socket.includes(s))) {
      ddr = "DDR4";
    } else if (DDR3_ONLY_SOCKETS.has(socket) || Array.from(DDR3_ONLY_SOCKETS).some(s => socket.includes(s))) {
      ddr = "DDR3";
    } else if (socket === "LGA 1700") {
      ddr = "DDR5";
    }
  }

  return { socket, brand, family, cores, has_igpu, ram_type: ddr, tdp_w: null };
}

export function parseGpu(name, subcategory) {
  const name_l = name.toLowerCase();
  const sub = norm(subcategory).toLowerCase();
  let vendor = sub || null;
  if (!vendor) {
    if (name_l.includes("geforce") || name_l.includes("rtx") || name_l.includes("gtx")) {
      vendor = "nvidia";
    } else if (name_l.includes("radeon") || name_l.includes(" rx ")) {
      vendor = "radeon";
    } else if (name_l.includes("arc")) {
      vendor = "intel";
    }
  }

  let vram_gb = null;
  const m = name.match(/(\d+)\s*GB/i);
  if (m) {
    vram_gb = parseInt(m[1], 10);
  }

  let rec_psu = 500;
  const tier_match = name.match(/\b(RTX|GTX|RX|Arc)\s*([A-Z]?\d{3,4})/i);
  if (tier_match) {
    const prefix = tier_match[1].toLowerCase();
    const n = tier_match[2].replace(/\D/g, "");
    if (n) {
      const num = parseInt(n, 10);
      if (prefix === "rtx" || prefix === "gtx") {
        const generation = Math.floor(num / 1000);
        const model_class = num % 100;
        if (model_class >= 80) {
          rec_psu = 850;
        } else if (model_class >= 70) {
          rec_psu = 750;
        } else if (model_class >= 60) {
          rec_psu = (generation >= 4) ? 650 : 550;
        } else {
          rec_psu = 550;
        }
      } else if (prefix === "rx") {
        const model_class = Math.floor((num % 1000) / 100);
        if (model_class >= 9) {
          rec_psu = 850;
        } else if (model_class >= 8) {
          rec_psu = 750;
        } else if (model_class >= 6) {
          rec_psu = 650;
        } else {
          rec_psu = 550;
        }
      } else {
        rec_psu = 550;
      }
    }
  }

  return { vendor, vram_gb, recommended_psu_w: rec_psu };
}

export function parseMotherboard(name, subcategory) {
  const sub = norm(subcategory);
  const name_l = name.toLowerCase();
  let socket = null;
  const m = sub.match(/Motherboard\s+(?:AMD|Intel)\s+(.+)/i);
  if (m) {
    socket = m[1].trim();
  }

  let form_factor = "ATX";
  if (name_l.includes("mini-itx") || name_l.includes("mini itx") || name_l.includes(" itx") || name_l.endsWith("itx")) {
    form_factor = "ITX";
  } else if (name_l.includes("micro") || name_l.includes("matx") || name_l.includes("m-atx") || name.includes(" mATX")) {
    form_factor = "mATX";
  } else if (name_l.includes("e-atx") || name_l.includes("eatx")) {
    form_factor = "EATX";
  }

  let ram_type = null;
  if (name_l.includes("ddr5")) {
    ram_type = "DDR5";
  } else if (name_l.includes("ddr4")) {
    ram_type = "DDR4";
  } else if (name_l.includes("ddr3")) {
    ram_type = "DDR3";
  } else if (socket) {
    if (DDR5_ONLY_SOCKETS.has(socket) || Array.from(DDR5_ONLY_SOCKETS).some(s => socket.includes(s))) {
      ram_type = "DDR5";
    } else if (DDR4_ONLY_SOCKETS.has(socket) || Array.from(DDR4_ONLY_SOCKETS).some(s => socket.includes(s))) {
      ram_type = "DDR4";
    } else if (DDR3_ONLY_SOCKETS.has(socket) || Array.from(DDR3_ONLY_SOCKETS).some(s => socket.includes(s))) {
      ram_type = "DDR3";
    } else if (socket.includes("1700")) {
      ram_type = "DDR5";
    }
  }

  return { socket, form_factor, ram_type };
}

export function parsePsu(name, subcategory) {
  let wattage = null;
  const m = name.match(/(\d{3,4})\s*(?:W\b|Watt)/i);
  if (m) {
    const w = parseInt(m[1], 10);
    if (w >= 100 && w <= 3000) {
      wattage = w;
    }
  }
  if (wattage === null) {
    const candidates = name.match(/\d{3,4}/g) || [];
    for (const cand of candidates) {
      const n = parseInt(cand, 10);
      if (n >= 250 && n <= 3000) {
        wattage = n;
        break;
      }
    }
  }

  let rating = null;
  for (const r of ["Titanium", "Platinum", "Gold", "Silver", "Bronze", "White"]) {
    if (name.toLowerCase().includes(r.toLowerCase())) {
      rating = r;
      break;
    }
  }

  let modular = null;
  const nl = name.toLowerCase();
  if (nl.includes("full modular") || nl.includes("fully modular")) {
    modular = "full";
  } else if (nl.includes("semi modular") || nl.includes("semi-modular")) {
    modular = "semi";
  } else if (nl.includes("non modular") || nl.includes("non-modular")) {
    modular = "none";
  }

  return { wattage_w: wattage, rating, modular };
}

export function parseCase(name, subcategory) {
  const nl = name.toLowerCase();
  let max_ff = "ATX";
  if (nl.includes("e-atx") || nl.includes("eatx") || nl.includes("full tower")) {
    max_ff = "EATX";
  } else if (nl.includes("mini-itx") || nl.includes("mini itx") || nl.includes("itx tower")) {
    max_ff = "ITX";
  } else if (nl.includes("micro") || nl.includes("matx") || nl.includes("m-atx") || nl.includes("mini tower")) {
    max_ff = "mATX";
  }
  return { max_form_factor: max_ff, form_factor: max_ff };
}

export function parseCooler(name, subcategory) {
  const sub = norm(subcategory).toLowerCase();
  const nl = name.toLowerCase();
  let ctype = "other";
  if (sub.includes("liquid") || sub.includes("water") || nl.includes("aio") || nl.includes("liquid")) {
    ctype = "liquid";
  } else if (sub.includes("air") || sub.includes("heatsink")) {
    ctype = "air";
  } else if (sub.includes("fan casing") || sub.includes("fan case")) {
    ctype = "fan";
  }

  let rad = null;
  const m = name.match(/(120|140|240|280|360|420)\s*mm/i);
  if (m) {
    rad = parseInt(m[1], 10);
  }
  let fan_size = rad;
  const cm = `${subcategory} ${name}`.match(/(\d{1,2})\s*CM/i);
  if (cm) {
    fan_size = parseInt(cm[1], 10) * 10;
  }
  if (fan_size === null) {
    const mm = name.match(/(80|92|120|140)\s*mm/i);
    if (mm) {
      fan_size = parseInt(mm[1], 10);
    }
  }

  let tdp_w = null;
  if (ctype === "liquid") {
    tdp_w = (rad >= 360) ? 300 : ((rad >= 240) ? 240 : 180);
  } else if (ctype === "air") {
    tdp_w = 180;
  }

  return { type: ctype, radiator_mm: rad, fan_size_mm: fan_size, tdp_w, sockets_supported: null };
}

export function parseRam(name, subcategory) {
  let ram_type = null;
  const m = name.match(/\bDDR\s?([345])\b/i);
  if (m) {
    ram_type = `DDR${m[1]}`;
  }

  let speed = null;
  const mhz = name.match(/\b(\d{4,5})\s*MHz\b/i);
  if (mhz) {
    speed = parseInt(mhz[1], 10);
  } else {
    const pc = name.match(/\bPC\s?(\d{4,5})\b/i);
    if (pc) {
      speed = Math.round(parseInt(pc[1], 10) / 8);
    }
  }

  let capacity = null;
  const kit = name.match(/(\d+)\s*[xX]\s*(\d+)\s*GB/i);
  if (kit) {
    capacity = parseInt(kit[1], 10) * parseInt(kit[2], 10);
  } else {
    const gb = name.match(/(\d+)\s*GB/i);
    if (gb) {
      capacity = parseInt(gb[1], 10);
    }
  }

  let module_count = null;
  const module = name.match(/\((\d+)\s*[xX]\s*\d+\s*GB\)/i);
  if (module) {
    module_count = parseInt(module[1], 10);
  }

  return {
    type: ram_type,
    capacity_gb: capacity,
    speed_mhz: speed,
    module_count,
    desktop: !norm(subcategory).toLowerCase().includes("notebook")
  };
}

export function parseSsd(name, subcategory) {
  const nl = name.toLowerCase();
  let cap_gb = null;
  const m = name.match(/(\d+(?:\.\d+)?)\s*TB/i);
  if (m) {
    cap_gb = Math.round(parseFloat(m[1]) * 1024);
  } else {
    const gb = name.match(/(\d{3,4})\s*GB/i);
    if (gb) {
      cap_gb = parseInt(gb[1], 10);
    }
  }
  const interfaceType = (nl.includes("nvme") || nl.includes("m.2") || nl.includes("pcie") || nl.includes("pci-e")) ? "NVMe" : "SATA";
  const external = norm(subcategory).includes("External");
  return { capacity_gb: cap_gb, interface: interfaceType, external };
}

export function parseHdd(name, subcategory) {
  const nl = name.toLowerCase();
  let cap_gb = null;
  const m = name.match(/(\d+(?:\.\d+)?)\s*TB/i);
  if (m) {
    cap_gb = Math.round(parseFloat(m[1]) * 1024);
  } else {
    const gb = name.match(/(\d{3,5})\s*GB/i);
    if (gb) {
      cap_gb = parseInt(gb[1], 10);
    }
  }
  const form_factor = (name.includes("2.5") || norm(subcategory).includes("2.5")) ? "2.5" : ((name.includes("3.5") || norm(subcategory).includes("3.5")) ? "3.5" : null);
  return {
    capacity_gb: cap_gb,
    interface: "SATA",
    form_factor_in: form_factor,
    external: norm(subcategory).toLowerCase().includes("external") || nl.includes("external")
  };
}

export function parseMonitor(name, subcategory) {
  let size = null;
  const size_match = name.match(/\b(\d{2}(?:\.\d)?)\s*(?:inch|in|"|\b)/i);
  if (size_match) {
    size = parseFloat(size_match[1]);
  }
  let refresh = null;
  let refresh_inferred = false;
  const hz = name.match(/(\d{2,3})\s*Hz/i);
  if (hz) {
    refresh = parseInt(hz[1], 10);
  }
  const nl = name.toLowerCase();
  if (refresh === null) {
    refresh_inferred = true;
    if (nl.includes("freesync") || nl.includes("free sync")) {
      refresh = 75;
    } else if (nl.includes("gaming")) {
      refresh = 144;
    } else {
      refresh = 60;
    }
  }
  const resolution = (nl.includes("4k") || nl.includes("uhd")) ? "4K" : ((nl.includes("qhd") || nl.includes("1440")) ? "QHD" : ((nl.includes("fhd") || nl.includes("1080")) ? "FHD" : null));
  return { size_inch: size, refresh_hz: refresh, refresh_hz_inferred: refresh_inferred, resolution };
}

export function parseUps(name, subcategory) {
  let va = null;
  const va_match = name.match(/(\d{3,5})\s*VA\b/i);
  if (va_match) {
    va = parseInt(va_match[1], 10);
  } else {
    const kva_match = name.match(/(\d+(?:[.,]\d+)?)\s*kVA\b/i);
    if (kva_match) {
      va = Math.round(parseFloat(kva_match[1].replace(",", ".")) * 1000);
    }
  }
  let wattage = null;
  const watts = name.match(/(\d{3,5})\s*(?:W|WATT|WATTS)\b/i);
  if (watts) {
    wattage = parseInt(watts[1], 10);
  }
  let wattage_inferred = false;
  if (wattage === null && va) {
    wattage = Math.round(va * 0.6);
    wattage_inferred = true;
  }
  return { capacity_va: va, wattage_w: wattage, wattage_inferred };
}

export function parseComponent(category, name, subcategory) {
  const mapping = {
    Processor: parseCpu,
    VGA: parseGpu,
    Motherboard: parseMotherboard,
    RAM: parseRam,
    PSU: parsePsu,
    Casing: parseCase,
    Cooler: parseCooler,
    SSD: parseSsd,
    "Hard Drive": parseHdd,
    LCD: parseMonitor,
    UPS: parseUps
  };
  const fn = mapping[category];
  if (!fn) return {};
  try {
    return fn(name || "", subcategory || "");
  } catch (e) {
    return {};
  }
}

export function budgetBandFor(budget) {
  for (const band of BUDGET_BANDS) {
    const max = band.max_idr;
    if (budget >= band.min_idr && (max === null || budget <= max)) {
      return { ...band };
    }
  }
  return { ...BUDGET_BANDS[BUDGET_BANDS.length - 1] };
}

export function normalizeBudgetStrategy(strategy) {
  const value = String(strategy || "balanced").trim().toLowerCase();
  return BUDGET_STRATEGIES.has(value) ? value : "balanced";
}

export function normalizePerformancePriority(priority, useCase) {
  const value = String(priority || "").trim().toLowerCase();
  if (PERFORMANCE_PRIORITIES.has(value)) {
    return value;
  }
  if (useCase === "gaming") return "gaming";
  if (useCase === "productivity" || useCase === "content_creation") return "productivity";
  if (useCase === "office" || useCase === "student") return "best_value";
  return "balanced";
}

function _cleanAllocationPercent(value) {
  if (typeof value !== "number" || isNaN(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function _applyAllocationShift(profile, shift) {
  const shifted = {};
  for (const slot of ALLOCATION_PRESET_SLOTS) {
    shifted[slot] = _cleanAllocationPercent(profile[slot] || 0);
  }
  for (const [slot, delta] of Object.entries(shift)) {
    if (slot in shifted) {
      shifted[slot] = _cleanAllocationPercent(shifted[slot] + delta);
    }
  }
  return shifted;
}

function _allocationFillOrder(performancePriority) {
  const preferred = {
    gaming: ["gpu", "cpu"],
    productivity: ["cpu", "ram", "ssd"],
    best_value: ["gpu", "ssd", "ram"],
    balanced: ["gpu", "cpu"],
    upgrade_friendly: ["motherboard", "psu", "case"]
  }[performancePriority] || ["gpu", "cpu"];
  return [...preferred, ...ALLOCATION_PRESET_SLOTS.filter(slot => !preferred.includes(slot))];
}

function _normalizeAllocationProfile(profile, performancePriority) {
  const normalized = {};
  for (const slot of ALLOCATION_PRESET_SLOTS) {
    normalized[slot] = _cleanAllocationPercent(profile[slot] || 0);
  }
  let total = Object.values(normalized).reduce((a, b) => a + b, 0);
  const fillOrder = _allocationFillOrder(performancePriority);

  while (total < 100) {
    const slot = fillOrder.find(candidate => normalized[candidate] < 60) || fillOrder[0];
    normalized[slot] += 1;
    total += 1;
  }

  while (total > 100) {
    const slot = ALLOCATION_PRESET_SLOTS.reduce((maxSlot, currentSlot) => {
      return normalized[currentSlot] > normalized[maxSlot] ? currentSlot : maxSlot;
    }, ALLOCATION_PRESET_SLOTS[0]);
    if (normalized[slot] === 0) break;
    normalized[slot] -= 1;
    total -= 1;
  }

  return normalized;
}

export function strategyAllocationProfile(useCase, performancePriority, budgetStrategy = "balanced", allocationOverrides = null) {
  let profile = { ...USE_CASE_PROFILES[useCase] };
  if (allocationOverrides) {
    const allowed = new Set(ALLOCATION_PRESET_SLOTS);
    const cleaned = {};
    for (const [slot, value] of Object.entries(allocationOverrides)) {
      if (allowed.has(slot) && typeof value === "number" && value >= 0) {
        cleaned[slot] = Math.round(value);
      }
    }
    const sum = Object.values(cleaned).reduce((a, b) => a + b, 0);
    if (Object.keys(cleaned).length > 0 && sum === 100) {
      return cleaned;
    }
  }

  const normalizedPriority = normalizePerformancePriority(performancePriority, useCase);
  const normalizedStrategy = normalizeBudgetStrategy(budgetStrategy);
  profile = _applyAllocationShift(profile, PERFORMANCE_PRIORITY_ALLOCATION_SHIFTS[normalizedPriority] || {});
  profile = _applyAllocationShift(profile, BUDGET_STRATEGY_ALLOCATION_SHIFTS[normalizedStrategy] || {});
  return _normalizeAllocationProfile(profile, normalizedPriority);
}

export function normalizeMarketplaceLinks(component) {
  if (component === null || component === undefined) return null;
  const collected = [];
  const seenUrls = new Set();

  function addLink(marketplace, url) {
    const cleanUrl = String(url || "").trim();
    if (!cleanUrl || seenUrls.has(cleanUrl)) return;
    collected.push({ marketplace, url: cleanUrl });
    seenUrls.add(cleanUrl);
  }

  for (const link of (component.marketplace_links || [])) {
    if (link && typeof link === "object") {
      addLink(String(link.marketplace || "marketplace").trim().toLowerCase(), link.url);
    }
  }

  addLink("enterkomputer", component.product_url);
  addLink("tokopedia", component.tokopedia_url);
  addLink("shopee", component.shopee_url);

  const order = { enterkomputer: 0, tokopedia: 1, shopee: 2 };
  collected.sort((a, b) => {
    const oA = order[a.marketplace] !== undefined ? order[a.marketplace] : 99;
    const oB = order[b.marketplace] !== undefined ? order[b.marketplace] : 99;
    return oA - oB;
  });

  const primary = collected.length > 0 ? collected[0].url : null;
  return { ...component, marketplace_links: collected, primary_url: primary };
}

function _ownedComponent(slot, name, specs, confidence = "medium") {
  const cleanSpecs = {};
  for (const [k, v] of Object.entries(specs)) {
    if (v !== null && v !== "" && v !== 0) cleanSpecs[k] = v;
  }
  return {
    sku: `owned-${slot}`,
    id: `owned-${slot}`,
    category: (slot === "cpu_cooler" || slot === "fan_cooler") ? "cooler" : slot,
    slot,
    name,
    brand: specs.brand || null,
    price_idr: 0,
    source: "user_input",
    detection_confidence: confidence,
    specs: cleanSpecs
  };
}

function _parseCapacityGb(text) {
  const kit = text.match(/(\d+)\s*[xX]\s*(\d+)\s*GB/);
  if (kit) return parseInt(kit[1], 10) * parseInt(kit[2], 10);
  const tb = text.match(/(\d+(?:\.\d+)?)\s*TB/i);
  if (tb) return Math.round(parseFloat(tb[1]) * 1024);
  const gb = text.match(/(\d+)\s*GB/i);
  if (gb) return parseInt(gb[1], 10);
  return null;
}

function _inferCpuSocket(text) {
  const lower = text.toLowerCase();
  const explicit = text.match(/\b(AM[45]|LGA\s?1851|LGA\s?1700|LGA\s?1200|LGA\s?1151|LGA\s?1150)\b/i);
  if (explicit) {
    const val = explicit[1].replace(/\s+/g, "").toUpperCase();
    return val.startsWith("LGA") ? val.replace("LGA", "LGA ") : val;
  }
  const ryzen = lower.match(/ryzen\s+[3579]\s+(\d{4})/);
  if (ryzen) return parseInt(ryzen[1], 10) >= 7000 ? "AM5" : "AM4";
  const core = lower.match(/i[3579][- ]?(\d{4,5})/);
  if (core) {
    const modelText = core[1];
    const gen = parseInt(modelText.length >= 5 ? modelText.slice(0, 2) : modelText.slice(0, 1), 10);
    if (gen >= 12) return "LGA 1700";
    if (gen >= 10) return "LGA 1200";
    return "LGA 1151";
  }
  if (lower.includes("core ultra")) return "LGA 1851";
  return null;
}

function _inferMotherboardSocket(text) {
  const lower = text.toLowerCase();
  const explicit = _inferCpuSocket(text);
  if (explicit) return explicit;
  if (/\b(a320|b350|x370|b450|x470|a520|b550|x570)[a-z]?\b/.test(lower)) return "AM4";
  if (/\b(a620|b650|x670|x870)[a-z]?\b/.test(lower)) return "AM5";
  if (/\b(h610|b660|b760|z690|z790)[a-z]?\b/.test(lower)) return "LGA 1700";
  if (/\b(b860|z890)[a-z]?\b/.test(lower)) return "LGA 1851";
  return null;
}

function _inferFormFactor(text) {
  const lower = text.toLowerCase();
  if (/mini[- ]?itx|\bitx\b/.test(lower)) return "ITX";
  if (/micro[- ]?atx|m[- ]?atx|\bmatx\b|[abzxh]\d{3}m\b/.test(lower)) return "mATX";
  if (/e[- ]?atx|\beatx\b/.test(lower)) return "EATX";
  if (lower.includes("atx")) return "ATX";
  return null;
}

function _inferRamType(text, socket = null) {
  const match = text.match(/\bDDR\s?([345])\b/i);
  if (match) return `DDR${match[1]}`;
  if (socket === "AM4") return "DDR4";
  if (socket === "AM5" || socket === "LGA 1851") return "DDR5";
  return null;
}

function _inferGpuSpecs(text) {
  const lower = ` ${text.toLowerCase()} `;
  let vendor = null;
  if (lower.includes(" nvidia") || lower.includes(" geforce") || lower.includes(" rtx") || lower.includes(" gtx")) {
    vendor = "Nvidia";
  } else if (lower.includes(" radeon") || lower.includes(" rx ")) {
    vendor = "AMD";
  } else if (lower.includes(" arc ")) {
    vendor = "Intel";
  }
  const vram = _parseCapacityGb(text);
  let rec_psu = null;
  const match = text.match(/\b(RTX|GTX|RX)\s*([0-9]{3,4})/i);
  if (match) {
    const prefix = match[1].toLowerCase();
    const model = parseInt(match[2], 10);
    if (prefix === "rtx" || prefix === "gtx") {
      const generation = Math.floor(model / 1000);
      const model_class = model % 100;
      rec_psu = (model_class >= 80) ? 850 : ((model_class >= 70) ? 750 : (((model_class >= 60 && generation >= 4) ? 650 : 550)));
    } else {
      const model_class = Math.floor((model % 1000) / 100);
      rec_psu = (model_class >= 9) ? 850 : ((model_class >= 8) ? 750 : ((model_class >= 6) ? 650 : 550));
    }
  }
  return { vendor, vram_gb: vram, recommended_psu_w: rec_psu };
}

function _inferStorageSpecs(text, slot) {
  const lower = text.toLowerCase();
  const capacity = _parseCapacityGb(text);
  if (slot === "ssd") {
    const interfaceType = (lower.includes("nvme") || lower.includes("m.2") || lower.includes("pcie") || lower.includes("pci-e")) ? "NVMe" : (lower.includes("sata") ? "SATA" : null);
    const form_factor = (lower.includes("m.2") || lower.includes("nvme")) ? "M.2" : (lower.includes("2.5") ? "2.5" : null);
    return { capacity_gb: capacity, interface: interfaceType, form_factor };
  }
  if (slot === "hdd") {
    const form_factor = lower.includes("2.5") ? "2.5" : (lower.includes("3.5") ? "3.5" : null);
    const interfaceType = (lower.includes("sata") || lower.includes("hdd") || lower.includes("hard") || lower.includes("disk")) ? "SATA" : null;
    return { capacity_gb: capacity, interface: interfaceType, form_factor_in: form_factor };
  }
  return {};
}

export function parseExistingComponent(slot, value) {
  const cleanSlot = String(slot || "").trim().toLowerCase();
  const text = String(value || "").trim();
  let specs = {};

  if (cleanSlot === "cpu") {
    const socket = _inferCpuSocket(text);
    const lower = text.toLowerCase();
    specs = { socket, brand: (lower.includes("ryzen") || lower.includes("amd")) ? "AMD" : ((lower.includes("intel") || lower.includes("core")) ? "Intel" : null) };
  } else if (cleanSlot === "motherboard") {
    const socket = _inferMotherboardSocket(text);
    specs = { socket, form_factor: _inferFormFactor(text), ram_type: _inferRamType(text, socket) };
  } else if (cleanSlot === "ram") {
    const ram_type = _inferRamType(text);
    const speedMatch = text.match(/\b(\d{4,5})\s*(?:MHz)?\b/i);
    specs = { type: ram_type, capacity_gb: _parseCapacityGb(text), speed_mhz: speedMatch ? parseInt(speedMatch[1], 10) : null };
  } else if (cleanSlot === "gpu") {
    specs = _inferGpuSpecs(text);
  } else if (cleanSlot === "ssd" || cleanSlot === "hdd") {
    specs = _inferStorageSpecs(text, cleanSlot);
  } else if (cleanSlot === "psu") {
    const wattMatch = text.match(/(\d{3,4})\s*(?:W|Watt)/i);
    let rating = null;
    for (const r of ["Titanium", "Platinum", "Gold", "Silver", "Bronze", "White"]) {
      if (text.toLowerCase().includes(r.toLowerCase())) {
        rating = r;
        break;
      }
    }
    specs = { wattage_w: wattMatch ? parseInt(wattMatch[1], 10) : null, rating };
  } else if (cleanSlot === "case") {
    const max_form = _inferFormFactor(text);
    specs = { max_form_factor: max_form, form_factor: max_form };
  } else if (cleanSlot === "cpu_cooler" || cleanSlot === "fan_cooler") {
    const lower = text.toLowerCase();
    const fanMatch = text.match(/(\d{2,3})\s*mm/i);
    specs = {
      type: lower.includes("fan") ? "fan" : ((lower.includes("aio") || lower.includes("liquid") || lower.includes("water")) ? "liquid" : "air"),
      fan_size_mm: fanMatch ? parseInt(fanMatch[1], 10) : null
    };
  }

  const hasSpecs = Object.values(specs).some(v => v !== null && v !== "" && v !== 0);
  return _ownedComponent(cleanSlot, text, specs, hasSpecs ? "medium" : "low");
}

export function analyzeExistingComponents(existing_components) {
  const recognized = {};
  const detected_existing = {};
  const unknown = {};
  const warnings = [];
  const warning_objects = [];
  const knownUpgradeSlotsSet = new Set(KNOWN_UPGRADE_SLOTS);

  for (const [raw_slot, raw_value] of Object.entries(existing_components || {})) {
    const slot = String(raw_slot).trim().toLowerCase();
    const value = String(raw_value || "").trim();
    if (!value) continue;
    if (knownUpgradeSlotsSet.has(slot)) {
      recognized[slot] = value;
      detected_existing[slot] = parseExistingComponent(slot, value);
    } else {
      unknown[slot] = value;
    }
  }

  for (const slot of ["cpu", "motherboard", "ram", "gpu", "psu"]) {
    if (!(slot in recognized)) {
      const label = slot.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
      const message = `${label} was not provided, so compatibility can only be estimated.`;
      warnings.push(message);
      warning_objects.push({
        id: `owned_${slot}_missing`,
        severity: "info",
        slot,
        slots: [slot],
        title: `${label} not provided`,
        message,
        recommendation: `Type your current ${slot.replace(/_/g, " ")} if you want a more precise upgrade check.`
      });
    }
  }

  return { recognized, detected_existing, unknown, warnings, warning_objects };
}

export function caseFitsMobo(case_max_ff, mobo_ff) {
  return (CASE_FF_RANK[case_max_ff] || 3) >= (CASE_FF_RANK[mobo_ff] || 3);
}

function _availabilityScore(component) {
  const status = String(component.stock_status || "").trim().toLowerCase();
  if (["in_stock", "instock", "ready", "available", "stock"].includes(status)) return 30.0;
  if (status.includes("pre")) return 10.0;
  if (["out_of_stock", "outofstock", "sold_out", "empty", "habis"].includes(status)) return -80.0;
  return 0.0;
}

function _freshnessScore(component) {
  const raw = component.scraped_at;
  if (!raw) return 3.0;
  try {
    const parsed = new Date(raw);
    if (isNaN(parsed.getTime())) return 2.0;
    const ageDays = Math.max(0, (Date.now() - parsed.getTime()) / (1000 * 60 * 60 * 24));
    if (ageDays <= 30) return 10.0;
    if (ageDays <= 90) return 7.0;
    if (ageDays <= 365) return 4.0;
    return 1.0;
  } catch (e) {
    return 2.0;
  }
}

function _qualityFlagScore(component) {
  const flags = new Set(component.quality_flags || []);
  if (flags.has("price_outlier_low")) return -95.0;
  return 0.0;
}

function _priceFitScore(component, budget) {
  if (budget <= 0) return 0.0;
  const price = Math.max(parseInt(component.price_idr || 0, 10), 0);
  if (price <= 0) return -5.0;
  const utilization = price / budget;
  return Math.max(0.0, 1.0 - Math.abs(utilization - 0.72) / 0.72) * 12.0;
}

function _valueScore(performance_units, component) {
  const price_million = Math.max((component.price_idr || 0) / 1000000, 0.1);
  return Math.min((performance_units / price_million) * 3.0, 25.0);
}

function _socketRunwayScore(socket) {
  const key = String(socket || "").replace(/[\s-]/g, "").toUpperCase();
  if (key.includes("AM5")) return 30.0;
  if (key.includes("LGA1851")) return 28.0;
  if (key.includes("LGA1700")) return 22.0;
  if (key.includes("AM4")) return 16.0;
  if (key.includes("LGA1200")) return 8.0;
  if (key.includes("LGA1151")) return -8.0;
  return 0.0;
}

function _gamingGpuFitScore(component, target_specs) {
  if ((target_specs || {}).use_case !== "gaming") return 0.0;
  const name = String(component.name || "").toLowerCase();
  if (["geforce", "radeon", "gaming", "rtx ", "rx "].some(token => name.includes(token))) return 24.0;
  if (["arc pro", " rtx a", "quadro", "workstation", "creator"].some(token => name.includes(token))) return -120.0;
  return 0.0;
}

function _cpuGamingTierBonus(component, target_specs) {
  const priority = (target_specs || {}).performance_priority;
  if (priority !== "gaming") return 0.0;
  const name = String(component.name || "").toLowerCase();
  if (name.includes("9800x3d")) return 92.0;
  if (name.includes("7800x3d") || name.includes("7950x3d")) return 84.0;
  if (name.includes("x3d")) return 72.0;
  return 0.0;
}

function _gpuModelTierBonus(component, target_specs) {
  const priority = (target_specs || {}).performance_priority;
  if (priority !== "gaming" && priority !== "balanced" && priority !== "productivity") return 0.0;
  const name = String(component.name || "").toLowerCase();
  let score = 0.0;

  const nvidia = name.match(/\brtx\s*([245]0[56789]0)\s*(ti|super)?/);
  if (nvidia) {
    const model = parseInt(nvidia[1], 10);
    const suffix = nvidia[2] || "";
    const model_class = Math.floor((model % 1000) / 10);
    const generation = Math.floor(model / 1000);
    score = generation * 18 + model_class * 11;
    if (suffix.includes("ti")) score += 24;
    else if (suffix.includes("super")) score += 14;
  }

  const radeon = name.match(/\brx\s*([679]0[56789]0)\s*(xt)?/);
  if (radeon) {
    const model = parseInt(radeon[1], 10);
    const suffix = radeon[2] || "";
    const model_class = Math.floor((model % 1000) / 10);
    const generation = Math.floor(model / 1000);
    score = Math.max(score, generation * 17 + model_class * 10 + (suffix.includes("xt") ? 24 : 0));
  }

  const arc = name.match(/\barc\s*([ab])\s*([0-9]{3})/);
  if (arc) {
    const tier = parseInt(arc[2][0], 10);
    score = Math.max(score, 45 + tier * 12);
  }

  if (["quadro", "rtx a", "arc pro", "workstation"].some(term => name.includes(term))) score -= 120;
  return score;
}

function _performancePriorityBonus(component, slot, target_specs) {
  const priority = (target_specs || {}).performance_priority;
  if (slot === "cpu") return _cpuGamingTierBonus(component, target_specs);
  if (slot === "gpu") return _gpuModelTierBonus(component, target_specs);
  if (priority === "upgrade_friendly" && (slot === "motherboard" || slot === "psu" || slot === "case")) return 18.0;
  if (priority === "productivity" && (slot === "cpu" || slot === "ram" || slot === "ssd")) return 14.0;
  return 0.0;
}

const _PSU_RATING_SCORE = { Titanium: 10, Platinum: 8, Gold: 6, Silver: 4, Bronze: 3, White: 1 };
const _PSU_MODULAR_SCORE = { full: 3, semi: 2, none: 0 };

export const UPGRADE_PRIORITY_SCORES = {
  weak_gaming_gpu: 96,
  missing_gpu_gaming: 92,
  ram_capacity: 82,
  psu_headroom: 78,
  missing_ram: 76,
  missing_psu: 74,
  missing_gpu_general: 72,
  missing_motherboard: 70,
  missing_ssd: 58
};

function _componentPerformanceUnits(component, slot, target_specs = null) {
  const specs = component.specs || {};
  const category = (slot === "cpu_cooler" || slot === "fan_cooler") ? "cooler" : slot;

  if (category === "cpu") {
    return (specs.cores || 0) * 8 + (specs.threads || 0) * 2 + (specs.tdp_w || 0) / 20 + _socketRunwayScore(specs.socket) + _cpuGamingTierBonus(component, target_specs);
  }
  if (category === "gpu") {
    const current_vram = (target_specs || {}).current_vram_gb || 0;
    const vram = specs.vram_gb || 0;
    const upgrade_gain = (current_vram && vram > current_vram) ? (vram - current_vram) * 5 : 0;
    const psu_target = specs.recommended_psu_w || 0;
    const efficiency_bonus = psu_target ? Math.max(0, 900 - psu_target) / 120 : 0;
    return vram * 10 + upgrade_gain + efficiency_bonus + _gamingGpuFitScore(component, target_specs) + _gpuModelTierBonus(component, target_specs);
  }
  if (category === "motherboard") {
    const ff = CASE_FF_RANK[specs.form_factor || "ATX"] || 3;
    return 28 + (ff <= 2 ? 4 : 0) + (specs.chipset ? 6 : 0) + _socketRunwayScore(specs.socket);
  }
  if (category === "ram") {
    const capacity = specs.capacity_gb || 0;
    const target_capacity = (target_specs || {}).target_capacity_gb || 0;
    let capacity_fit = 0.0;
    if (target_capacity) {
      capacity_fit = (capacity >= target_capacity) ? 28.0 : -18.0 * ((target_capacity - capacity) / target_capacity);
    }
    return capacity * 2 + (specs.speed_mhz || 0) / 160 + capacity_fit;
  }
  if (category === "ssd") {
    return (specs.capacity_gb || 0) / 64 + (specs.interface === "NVMe" ? 18 : 6);
  }
  if (category === "hdd") {
    return (specs.capacity_gb || 0) / 128 + (specs.interface === "SATA" ? 8 : 0);
  }
  if (category === "psu") {
    return (specs.wattage_w || 0) / 40 + (_PSU_RATING_SCORE[specs.rating || ""] || 0) * 2 + (_PSU_MODULAR_SCORE[specs.modular || ""] !== undefined ? _PSU_MODULAR_SCORE[specs.modular || ""] : 1);
  }
  if (category === "cooler") {
    if (slot === "fan_cooler" || specs.type === "fan") return (specs.fan_size_mm || 0) / 8;
    return (specs.tdp_w || 0) / 8 + (specs.type === "liquid" ? 12 : 8);
  }
  if (category === "case") {
    return 22 + (CASE_FF_RANK[specs.max_form_factor || specs.form_factor || "ATX"] || 3) * 3;
  }
  if (category === "monitor") {
    return (specs.size_inch || 0) + (specs.refresh_hz || 60) / 12;
  }
  if (category === "ups") {
    return (specs.capacity_va || 0) / 60 + (specs.wattage_w || 0) / 80;
  }
  return 10.0;
}

function _componentScore(component, slot, budget, target_specs = null) {
  const performance_units = _componentPerformanceUnits(component, slot, target_specs);
  return (
    _availabilityScore(component) +
    _freshnessScore(component) +
    _qualityFlagScore(component) +
    performance_units +
    _performancePriorityBonus(component, slot, target_specs) +
    _valueScore(performance_units, component) +
    _priceFitScore(component, budget)
  );
}

function _isRecentCatalogRow(component) {
  const raw = component.scraped_at;
  if (!raw) return false;
  try {
    const parsed = new Date(raw);
    if (isNaN(parsed.getTime())) return false;
    return ((Date.now() - parsed.getTime()) / (1000 * 60 * 60 * 24)) <= 90;
  } catch (e) {
    return false;
  }
}

function _selectionRationale(slot, component, slot_budget, use_case, target_specs = null) {
  const specs = component.specs || {};
  const factors = [];
  const stock = String(component.stock_status || "").trim().toLowerCase();
  const price = parseInt(component.price_idr || 0, 10);

  if (["in_stock", "instock", "ready", "available", "stock"].includes(stock)) factors.push("In-stock listing");
  else if (stock) factors.push("Availability needs checking");

  if (_isRecentCatalogRow(component)) factors.push("Recent marketplace data");

  if (slot_budget > 0 && price > 0) {
    factors.push(price <= slot_budget ? "Fits the slot budget with value headroom" : "Uses leftover budget for a stronger compatible part");
  }

  if (slot === "cpu" && specs.socket) factors.push(`${specs.socket} platform runway`);
  else if (slot === "motherboard") {
    const platform = [specs.socket, specs.ram_type].filter(Boolean).join(" and ");
    if (platform) factors.push(`Matches the ${platform} platform plan`);
  } else if (slot === "ram") {
    const capacity = specs.capacity_gb;
    const ram_type = specs.type;
    const target_capacity = (target_specs || {}).target_capacity_gb;
    if (capacity) {
      let label = `${capacity} GB`;
      if (target_capacity && capacity >= target_capacity) label += ` meets the ${target_capacity} GB target`;
      factors.push(label);
    }
    if (ram_type) factors.push(`${ram_type} memory generation`);
  } else if (slot === "gpu") {
    if (specs.vram_gb) factors.push(`${specs.vram_gb} GB VRAM for ${use_case.replace(/_/g, " ")} workloads`);
    if (use_case === "gaming") factors.push("Gaming-focused GPU fit");
  } else if (slot === "ssd" && specs.capacity_gb) factors.push(`${specs.capacity_gb} GB fast storage`);
  else if (slot === "hdd" && specs.capacity_gb) factors.push(`${specs.capacity_gb} GB bulk storage`);
  else if (slot === "psu" && specs.wattage_w) factors.push(`${specs.wattage_w}W power headroom`);
  else if (slot === "cpu_cooler") {
    if (specs.tdp_w) factors.push(`${specs.tdp_w}W cooling capacity`);
    else if (specs.type) factors.push(`${specs.type.charAt(0).toUpperCase() + specs.type.slice(1)} CPU cooling`);
  } else if (slot === "fan_cooler") {
    factors.push(specs.fan_size_mm ? `${specs.fan_size_mm} mm case airflow support` : "Case airflow support");
  } else if (slot === "case") {
    const form_factor = specs.max_form_factor || specs.form_factor;
    if (form_factor) factors.push(`Fits up to ${form_factor} motherboards`);
  }

  if (factors.length === 0) factors.push("Best-ranked compatible catalog option");
  return { summary: "Ranked for stock, freshness, value, compatibility, and upgrade fit.", factors: factors.slice(0, 5) };
}

function _bestRankedComponent(components, slot, budget, target_specs = null) {
  if (!components || components.length === 0) return null;
  return components.reduce((best, current) => {
    const scoreBest = _componentScore(best, slot, budget, target_specs);
    const scoreCurrent = _componentScore(current, slot, budget, target_specs);
    if (scoreCurrent !== scoreBest) return scoreCurrent > scoreBest ? current : best;
    const perfBest = _componentPerformanceUnits(best, slot, target_specs);
    const perfCurrent = _componentPerformanceUnits(current, slot, target_specs);
    if (perfCurrent !== perfBest) return perfCurrent > perfBest ? current : best;
    return parseInt(current.price_idr || 0, 10) < parseInt(best.price_idr || 0, 10) ? current : best;
  }, components[0]);
}

export function pickCpu(cpus, budget, brand = null, useCase = null, performancePriority = null) {
  const base = cpus.filter(c => c.price_idr <= budget && c.specs && c.specs.socket);
  if (base.length === 0) return null;
  const target_specs = { use_case: useCase, performance_priority: performancePriority };
  if (brand) {
    const b = brand.trim().toLowerCase();
    const filtered = base.filter(c => (c.specs.brand || "").toLowerCase() === b);
    if (filtered.length > 0) return _bestRankedComponent(filtered, "cpu", budget, target_specs);
  }
  return _bestRankedComponent(base, "cpu", budget, target_specs);
}

export function pickMotherboard(mobos, budget, socket) {
  const candidates = mobos.filter(m => m.price_idr <= budget && m.specs && m.specs.socket && socket && m.specs.socket.includes(socket));
  if (candidates.length === 0) return null;
  return _bestRankedComponent(candidates, "motherboard", budget);
}

export function pickRam(rams, budget, ramType, targetCapacityGb = null) {
  function preferSanePrices(candidates) {
    const sane = candidates.filter(r => !(new Set(r.quality_flags || [])).has("price_outlier_low"));
    return sane.length > 0 ? sane : candidates;
  }

  if (ramType) {
    const anyMatching = rams.filter(r => r.specs && r.specs.type === ramType);
    const saneMatching = preferSanePrices(anyMatching);
    if (targetCapacityGb) {
      const targetMatching = saneMatching.filter(r => (r.specs.capacity_gb || 0) >= targetCapacityGb);
      const targetInSlot = targetMatching.filter(r => r.price_idr <= budget);
      if (targetInSlot.length > 0) return _bestRankedComponent(targetInSlot, "ram", budget, { target_capacity_gb: targetCapacityGb });
      if (targetMatching.length > 0) return targetMatching.reduce((min, cur) => cur.price_idr < min.price_idr ? cur : min, targetMatching[0]);
    }

    const inSlot = rams.filter(r => r.price_idr <= budget && r.specs && r.specs.type === ramType);
    if (inSlot.length > 0) return _bestRankedComponent(preferSanePrices(inSlot), "ram", budget, { target_capacity_gb: targetCapacityGb });
    if (anyMatching.length > 0) return saneMatching.reduce((min, cur) => cur.price_idr < min.price_idr ? cur : min, saneMatching[0]);
    return null;
  }

  const inBudget = rams.filter(r => r.price_idr <= budget);
  if (inBudget.length === 0) return null;
  return _bestRankedComponent(preferSanePrices(inBudget), "ram", budget, { target_capacity_gb: targetCapacityGb });
}

const _GPU_VENDOR_ALIASES = { nvidia: "nvidia", geforce: "nvidia", amd: "radeon", radeon: "radeon", intel: "intel", arc: "intel" };

function _targetRamCapacity(useCase, budget) {
  if (["gaming", "productivity", "content_creation"].includes(useCase) && budget >= 18000000) return 32;
  return 16;
}

export function pickGpu(gpus, budget, vendor = null, useCase = null, performancePriority = null) {
  if (budget <= 0) return null;
  const base = gpus.filter(g => g.price_idr <= budget);
  if (base.length === 0) return null;
  if (vendor) {
    const normalized = _GPU_VENDOR_ALIASES[vendor.trim().toLowerCase()];
    if (normalized) {
      const filtered = base.filter(g => (g.specs && g.specs.vendor || "").toLowerCase() === normalized);
      if (filtered.length > 0) return _bestRankedComponent(filtered, "gpu", budget, { use_case: useCase, performance_priority: performancePriority });
    }
  }
  return _bestRankedComponent(base, "gpu", budget, { use_case: useCase, performance_priority: performancePriority });
}

function _psuQualityScore(psu, min_watts) {
  const specs = psu.specs || {};
  const w = specs.wattage_w || 0;
  if (w === 0) return 0.0;
  const headroom_score = Math.min(w / Math.max(min_watts, 1), 1.5) * 5;
  const rating_score = _PSU_RATING_SCORE[specs.rating || ""] || 0;
  const modular_score = _PSU_MODULAR_SCORE[specs.modular || ""] !== undefined ? _PSU_MODULAR_SCORE[specs.modular || ""] : 1;
  return headroom_score + rating_score + modular_score + _availabilityScore(psu) / 6 + _freshnessScore(psu) / 3;
}

export function pickPsu(psus, budget, min_watts) {
  const inBudget = psus.filter(p => p.price_idr <= budget && (p.specs && p.specs.wattage_w || 0) > 0);
  const qualified = inBudget.filter(p => (p.specs.wattage_w || 0) >= min_watts);
  if (qualified.length > 0) return qualified.reduce((maxPsu, curPsu) => _psuQualityScore(curPsu, min_watts) > _psuQualityScore(maxPsu, min_watts) ? curPsu : maxPsu, qualified[0]);
  if (inBudget.length > 0) return inBudget.reduce((maxPsu, curPsu) => (curPsu.specs.wattage_w || 0) > (maxPsu.specs.wattage_w || 0) ? curPsu : maxPsu, inBudget[0]);
  return null;
}

function _isRealUpsCandidate(component) {
  const name = String(component.name || "").toLowerCase();
  const specs = component.specs || {};
  if (!specs.capacity_va) return false;
  if (["line-r", "voltage regulator", "automatic voltage regulator", "stabilizer", "battery"].some(term => name.includes(term))) return false;
  if (name.includes("inverter") && !name.includes("ups")) return false;
  return name.includes("ups") || name.includes("back-ups");
}

function _estimatedUpsWattage(component) {
  const specs = component.specs || {};
  if (specs.wattage_w) return parseInt(specs.wattage_w, 10);
  if (specs.capacity_va) return Math.round((specs.capacity_va || 0) * 0.6);
  return 0;
}

function _upsRequirements(build) {
  const cpu_specs = (build.cpu || {}).specs || {};
  const gpu_specs = (build.gpu || {}).specs || {};
  const psu_specs = (build.psu || {}).specs || {};
  const psu_watts = parseInt(psu_specs.wattage_w || 0, 10);
  const gpu_psu_target = parseInt(gpu_specs.recommended_psu_w || 0, 10);
  const cpu_tdp = parseInt(cpu_specs.tdp_w || 0, 10);
  const gpu_tdp = parseInt(gpu_specs.tdp_w || 0, 10);
  const measured_draw = (cpu_tdp || gpu_tdp) ? (cpu_tdp + gpu_tdp + 150) : 0;

  const estimated_draw = Math.max(measured_draw, gpu_psu_target ? Math.round(gpu_psu_target * 0.7) : 0, psu_watts ? Math.round(psu_watts * 0.6) : 0, 300);
  const required_watts = Math.ceil((estimated_draw * 1.2) / 50) * 50;
  let required_va = Math.ceil((required_watts / 0.6) / 100) * 100;
  if (psu_watts >= 600 || gpu_psu_target >= 600) required_va = Math.max(required_va, 1000);
  else if (psu_watts >= 500 || gpu_psu_target >= 500) required_va = Math.max(required_va, 850);
  return { wattage_w: required_watts, capacity_va: required_va };
}

export function pickUps(upss, budget, build) {
  const requirements = _upsRequirements(build);
  const candidates = upss.filter(u => (u.price_idr || 0) <= budget && _isRealUpsCandidate(u) && (u.specs && u.specs.capacity_va || 0) >= requirements.capacity_va && _estimatedUpsWattage(u) >= requirements.wattage_w);
  if (candidates.length === 0) return null;

  function upsScore(component) {
    const specs = component.specs || {};
    const excess_va = Math.max(0, (specs.capacity_va || 0) - requirements.capacity_va);
    const excess_watts = Math.max(0, _estimatedUpsWattage(component) - requirements.wattage_w);
    const oversize_penalty = Math.min(excess_va / 180, 12) + Math.min(excess_watts / 120, 8);
    return _componentScore(component, "ups", budget) - oversize_penalty;
  }

  const pick = candidates.reduce((maxUps, curUps) => upsScore(curUps) > upsScore(maxUps) ? curUps : maxUps, candidates[0]);
  const specs = pick.specs || {};
  pick.selection_rationale = {
    summary: `Sized for at least ${requirements.capacity_va}VA / ${requirements.wattage_w}W output.`,
    factors: ["Actual UPS listing, not a voltage regulator or stabilizer", `${specs.capacity_va}VA capacity`, `Estimated ${_estimatedUpsWattage(pick)}W usable output`]
  };
  return pick;
}

function _monitorTarget(build, useCase, budget) {
  const gpu_specs = (build.gpu || {}).specs || {};
  const vram = parseInt(gpu_specs.vram_gb || 0, 10);
  const gpu_psu_target = parseInt(gpu_specs.recommended_psu_w || 0, 10);

  if (useCase === "gaming") {
    if (budget >= 30000000 && (gpu_psu_target >= 750 || vram >= 16)) return { resolution: "4K", min_refresh_hz: 120, ideal_size_inch: 32 };
    if (budget >= 22000000 || gpu_psu_target >= 650 || vram >= 12) return { resolution: "QHD", min_refresh_hz: 144, ideal_size_inch: 27 };
    return { resolution: "FHD", min_refresh_hz: 144, ideal_size_inch: 24 };
  }
  if (useCase === "content_creation") {
    if (budget >= 30000000 && (gpu_psu_target >= 750 || vram >= 16)) return { resolution: "4K", min_refresh_hz: 60, ideal_size_inch: 32 };
    return { resolution: "QHD", min_refresh_hz: 75, ideal_size_inch: 27 };
  }
  if (useCase === "productivity") return { resolution: budget >= 16000000 ? "QHD" : "FHD", min_refresh_hz: 75, ideal_size_inch: 27 };
  return { resolution: "FHD", min_refresh_hz: 75, ideal_size_inch: 24 };
}

export function pickMonitor(monitors, budget, build, useCase, totalBudget) {
  const target = _monitorTarget(build, useCase, totalBudget);
  const candidates = monitors.filter(m => (m.price_idr || 0) <= budget);
  if (candidates.length === 0) return null;
  const target_rank = MONITOR_RESOLUTION_RANK[target.resolution] || 1;

  function monitorScore(component) {
    const specs = component.specs || {};
    const resolution = specs.resolution;
    const resolution_rank = MONITOR_RESOLUTION_RANK[resolution] || target_rank;
    const rank_delta = resolution_rank - target_rank;
    const refresh = parseInt(specs.refresh_hz || 60, 10);
    const size = parseFloat(specs.size_inch || target.ideal_size_inch);

    let resolution_score = rank_delta === 0 ? 45 : (rank_delta < 0 ? -18 * Math.abs(rank_delta) : -34 * rank_delta);
    let refresh_score = Math.min(refresh - target.min_refresh_hz, 90) / 6;
    if (refresh < target.min_refresh_hz) refresh_score -= (target.min_refresh_hz - refresh) / 3;
    const size_score = Math.max(0, 18 - Math.abs(size - target.ideal_size_inch) * 4);

    return _availabilityScore(component) + _freshnessScore(component) + _qualityFlagScore(component) + resolution_score + refresh_score + size_score + _priceFitScore(component, budget);
  }

  const pick = candidates.reduce((bestMonitor, curMonitor) => {
    const scoreBest = monitorScore(bestMonitor);
    const scoreCur = monitorScore(curMonitor);
    if (scoreCur !== scoreBest) return scoreCur > scoreBest ? curMonitor : bestMonitor;
    const perfBest = _componentPerformanceUnits(bestMonitor, "monitor", target);
    const perfCur = _componentPerformanceUnits(curMonitor, "monitor", target);
    if (perfCur !== perfBest) return perfCur > perfBest ? curMonitor : bestMonitor;
    return (curMonitor.price_idr || 0) < (bestMonitor.price_idr || 0) ? curMonitor : bestMonitor;
  }, candidates[0]);

  pick.selection_rationale = {
    summary: `Matched to the build's ${useCase.replace(/_/g, " ")} display target.`,
    factors: [`${target.resolution} target resolution`, `At least ${target.min_refresh_hz}Hz refresh target`, "Balanced for the selected GPU and setup budget"]
  };
  return pick;
}

export function pickCase(cases, budget, mobo_ff) {
  const candidates = cases.filter(c => c.price_idr <= budget && caseFitsMobo(c.specs && c.specs.max_form_factor || "ATX", mobo_ff));
  if (candidates.length === 0) return null;
  return _bestRankedComponent(candidates, "case", budget);
}

export function pickCooler(coolers, budget, prefer_liquid = false) {
  const candidates = coolers.filter(c => c.price_idr <= budget && c.specs && ["air", "liquid"].includes(c.specs.type));
  if (candidates.length === 0) return null;
  if (prefer_liquid) {
    const liq = candidates.filter(c => c.specs.type === "liquid");
    if (liq.length > 0) return _bestRankedComponent(liq, "cpu_cooler", budget);
  }
  return _bestRankedComponent(candidates, "cpu_cooler", budget);
}

function _isCaseFanCandidate(component) {
  const name = String(component.name || "").toLowerCase();
  const specs = component.specs || {};
  if (["cpu cooler", "liquid cooler", "radiator", "heatsink", "hsf", "tower cooler", "shadow rock", "pure rock", "hyper 212", "assassin"].some(term => name.includes(term))) return false;
  if (["case fan", "casing fan", "fan case", "fan casing", "triple pack", "value pack", "single pack", "performance fan"].some(term => name.includes(term))) return true;
  return specs.type === "fan" && name.includes("fan");
}

export function pickFanCooler(coolers, budget) {
  const candidates = coolers.filter(c => c.price_idr <= budget && _isCaseFanCandidate(c));
  if (candidates.length === 0) return null;
  return _bestRankedComponent(candidates, "fan_cooler", budget);
}

export function pickSsd(ssds, budget) {
  let candidates = ssds.filter(s => s.price_idr <= budget && s.specs && (s.specs.capacity_gb || 0) >= 250);
  if (candidates.length === 0) candidates = ssds.filter(s => s.price_idr <= budget);
  if (candidates.length === 0) return null;
  const nvme = candidates.filter(s => s.specs && s.specs.interface === "NVMe");
  const pool = nvme.length > 0 ? nvme : candidates;
  return _bestRankedComponent(pool, pool.some(s => s.category === "ssd") ? "ssd" : "hdd", budget);
}

export function compatibilityMessages(warnings) {
  return warnings.filter(w => w && w.message).map(w => w.message);
}

function _warning(warning_id, severity, slots, title, message, recommendation) {
  return { id: warning_id, severity, slot: slots.length > 0 ? slots[0] : null, slots, title, message, recommendation };
}

function _componentSpecs(component) {
  return (component || {}).specs || {};
}

function _normalizeSpecText(value) {
  return String(value || "").replace(/[\s-]/g, "").toUpperCase();
}

export function validateBuild(build) {
  const warnings = [];
  const cpu = build.cpu;
  const mobo = build.motherboard;
  const ram = build.ram;
  const psu = build.psu;
  const gpu = build.gpu;
  const caseComp = build.case;
  const cpu_cooler = build.cpu_cooler || build.cooler;

  if (cpu && mobo) {
    const cpu_sock = (_componentSpecs(cpu).socket || "").trim();
    const mobo_sock = (_componentSpecs(mobo).socket || "").trim();
    const cpu_sock_key = _normalizeSpecText(cpu_sock);
    const mobo_sock_key = _normalizeSpecText(mobo_sock);
    if (cpu_sock_key && mobo_sock_key && !mobo_sock_key.includes(cpu_sock_key) && !cpu_sock_key.includes(mobo_sock_key)) {
      warnings.push(_warning("cpu_motherboard_socket_mismatch", "error", ["cpu", "motherboard"], "CPU and motherboard socket mismatch", `CPU uses ${cpu_sock}, but the motherboard uses ${mobo_sock}.`, "Choose a motherboard with the same CPU socket, or choose a CPU that matches this motherboard."));
    }
  }

  if (mobo && ram) {
    const mobo_ddr = _componentSpecs(mobo).ram_type;
    const ram_ddr = _componentSpecs(ram).type;
    if (mobo_ddr && ram_ddr && mobo_ddr !== ram_ddr) {
      warnings.push(_warning("motherboard_ram_type_mismatch", "error", ["motherboard", "ram"], "Motherboard and RAM generation mismatch", `Motherboard requires ${mobo_ddr}, but the selected RAM is ${ram_ddr}.`, "Use RAM with the same DDR generation as the motherboard."));
    }
  }

  if (psu && gpu) {
    const watts = _componentSpecs(psu).wattage_w || 0;
    const rec = _componentSpecs(gpu).recommended_psu_w || 0;
    if (watts && rec && watts < rec) {
      warnings.push(_warning("psu_headroom_low", "warning", ["psu", "gpu"], "PSU wattage is below GPU recommendation", `PSU provides ${watts}W, while the GPU recommendation is ${rec}W.`, "Pick a higher wattage PSU to protect stability and future upgrades."));
    }
  }

  if (caseComp && mobo) {
    const max_ff = _componentSpecs(caseComp).max_form_factor || "ATX";
    const mobo_ff = _componentSpecs(mobo).form_factor || "ATX";
    if (!caseFitsMobo(max_ff, mobo_ff)) {
      warnings.push(_warning("case_motherboard_form_factor_mismatch", "error", ["case", "motherboard"], "Casing does not fit motherboard form factor", `Casing supports up to ${max_ff}, but the motherboard is ${mobo_ff}.`, "Choose a larger casing or a smaller motherboard form factor."));
    }
  }

  if (cpu && cpu_cooler) {
    const cpu_tdp = _componentSpecs(cpu).tdp_w || 0;
    const cooler_tdp = _componentSpecs(cpu_cooler).tdp_w || 0;
    if (cpu_tdp && cooler_tdp && cooler_tdp < cpu_tdp) {
      warnings.push(_warning("cpu_cooler_capacity_low", "warning", ["cpu_cooler", "cpu"], "CPU cooler may be too small", `CPU is rated around ${cpu_tdp}W, while the cooler is rated around ${cooler_tdp}W.`, "Choose a stronger air cooler or liquid cooler for better thermal headroom."));
    }
  }

  return warnings;
}

function _pickUpgradeMotherboard(motherboards, budget, detected_existing) {
  const cpu_socket = _componentSpecs(detected_existing.cpu).socket;
  const ram_type = _componentSpecs(detected_existing.ram).type;
  const case_max_ff = _componentSpecs(detected_existing.case).max_form_factor;

  let candidates = motherboards.filter(m => (m.price_idr || 0) <= budget);
  if (cpu_socket) {
    candidates = candidates.filter(m => _normalizeSpecText(cpu_socket).includes(_normalizeSpecText(_componentSpecs(m).socket)) || _normalizeSpecText(_componentSpecs(m).socket).includes(_normalizeSpecText(cpu_socket)));
  }
  if (ram_type) {
    candidates = candidates.filter(m => _componentSpecs(m).ram_type === ram_type);
  }
  if (case_max_ff) {
    candidates = candidates.filter(m => caseFitsMobo(case_max_ff, _componentSpecs(m).form_factor || "ATX"));
  }
  if (candidates.length === 0) return null;
  return _bestRankedComponent(candidates, "motherboard", budget);
}

function _bestRamUpgrade(rams, budget, detected_ram, detected_mobo) {
  const ram_specs = _componentSpecs(detected_ram);
  const mobo_specs = _componentSpecs(detected_mobo);
  const ram_type = ram_specs.type || mobo_specs.ram_type;
  const current_capacity = ram_specs.capacity_gb || 0;
  let candidates = rams.filter(r => (r.price_idr || 0) <= budget);
  if (ram_type) candidates = candidates.filter(r => _componentSpecs(r).type === ram_type);
  const better = candidates.filter(r => (_componentSpecs(r).capacity_gb || 0) > current_capacity);
  if (better.length === 0) return null;
  return _bestRankedComponent(better, "ram", budget, { current_capacity_gb: current_capacity, target_capacity_gb: Math.max(current_capacity + 1, 32) });
}

function _bestGpuUpgrade(gpus, budget, detected_gpu, useCase = "gaming") {
  const current_vram = _componentSpecs(detected_gpu).vram_gb || 0;
  const candidates = gpus.filter(g => (g.price_idr || 0) <= budget);
  const better = candidates.filter(g => (_componentSpecs(g).vram_gb || 0) > current_vram);
  const pool = better.length > 0 ? better : candidates;
  if (pool.length === 0) return null;
  const inStock = pool.filter(g => ["in_stock", "instock", "ready", "available", "stock"].includes(String(g.stock_status || "").trim().toLowerCase()));
  return _bestRankedComponent(inStock.length > 0 ? inStock : pool, "gpu", budget, { current_vram_gb: current_vram, use_case: useCase });
}

function _buildUpgradePriorities(components, budget, useCase, detected_existing, baseline) {
  const priorities = [];

  function add(slot, score, title, reason, candidate) {
    if (candidate === null || candidate === undefined) return;
    priorities.push({
      slot, score, title, reason,
      component: normalizeMarketplaceLinks(candidate),
      estimated_cost_idr: parseInt(candidate.price_idr || 0, 10),
      selected: false
    });
  }

  const detected_gpu = detected_existing.gpu;
  const gpu_specs = _componentSpecs(detected_gpu);
  if (!("gpu" in detected_existing)) {
    add("gpu", useCase === "gaming" ? UPGRADE_PRIORITY_SCORES.missing_gpu_gaming : UPGRADE_PRIORITY_SCORES.missing_gpu_general, "Add a dedicated GPU", "A GPU is the largest performance lever for gaming and visual workloads.", (baseline.components || {}).gpu);
  } else if (useCase === "gaming" && (gpu_specs.vram_gb || 0) < 8) {
    add("gpu", UPGRADE_PRIORITY_SCORES.weak_gaming_gpu, "Upgrade GPU first", "Your typed GPU looks below the 8GB VRAM target, so this is likely the biggest gaming improvement.", _bestGpuUpgrade(components.gpu || [], budget, detected_gpu, useCase));
  }

  const detected_ram = detected_existing.ram;
  const ram_specs = _componentSpecs(detected_ram);
  const recommendedRamCap = (useCase === "gaming" || useCase === "content_creation" || useCase === "productivity") ? 32 : 16;
  if (!("ram" in detected_existing)) {
    add("ram", UPGRADE_PRIORITY_SCORES.missing_ram, "Add RAM", "RAM is required for a complete build and affects multitasking smoothness.", (baseline.components || {}).ram);
  } else if ((ram_specs.capacity_gb || 0) < recommendedRamCap) {
    add("ram", UPGRADE_PRIORITY_SCORES.ram_capacity, "Increase RAM capacity", "Your typed RAM capacity is below the recommended target for this performance goal.", _bestRamUpgrade(components.ram || [], budget, detected_ram, detected_existing.motherboard));
  }

  const detected_psu = detected_existing.psu;
  const psu_specs = _componentSpecs(detected_psu);
  const firstGpuCandidate = (priorities.length > 0 && priorities[0].slot === "gpu") ? priorities[0].component : null;
  const gpu_rec = _componentSpecs(firstGpuCandidate).recommended_psu_w || _componentSpecs(detected_existing.gpu).recommended_psu_w || 550;
  if (!("psu" in detected_existing)) {
    add("psu", UPGRADE_PRIORITY_SCORES.missing_psu, "Add PSU", "A known PSU gives the upgrade plan safer power headroom.", (baseline.components || {}).psu);
  } else if ((psu_specs.wattage_w || 0) < gpu_rec) {
    add("psu", UPGRADE_PRIORITY_SCORES.psu_headroom, "Upgrade PSU headroom", `Your typed PSU is below the ${gpu_rec}W target for the planned graphics upgrade.`, pickPsu(components.psu || [], budget, gpu_rec));
  }

  if (!("motherboard" in detected_existing)) {
    add("motherboard", UPGRADE_PRIORITY_SCORES.missing_motherboard, "Choose compatible motherboard", "A motherboard is needed to anchor CPU socket, RAM generation, and case fit.", _pickUpgradeMotherboard(components.motherboard || [], budget, detected_existing) || (baseline.components || {}).motherboard);
  }

  if (!("ssd" in detected_existing)) {
    add("ssd", UPGRADE_PRIORITY_SCORES.missing_ssd, "Add fast SSD storage", "An NVMe SSD is a low-risk upgrade that improves boot and load times.", (baseline.components || {}).ssd);
  }

  priorities.sort((a, b) => b.score !== a.score ? b.score - a.score : a.estimated_cost_idr - b.estimated_cost_idr);
  return priorities;
}

function _selectPriorityUpgrades(priorities, budget) {
  const selected = {};
  let spent = 0;
  for (const item of priorities) {
    const cost = item.estimated_cost_idr || 0;
    if (cost <= 0 || spent + cost <= budget) {
      selected[item.slot] = item.component;
      item.selected = true;
      spent += cost;
    } else {
      item.selected = false;
    }
  }
  return selected;
}

function _componentRef(component) {
  if (!component) return "";
  return String(component.sku || component.id || "").trim();
}

function _componentPrice(component) {
  if (!component) return 0;
  return parseInt(component.price_idr || 0, 10);
}

function _buildTotal(build) {
  return REQUIRED_BUILD_SLOTS.reduce((sum, slot) => sum + _componentPrice(build[slot]), 0);
}

function _hasErrorCompatibility(warnings) {
  return warnings.some(w => w.severity === "error");
}

function _candidateCategory(slot) {
  return (slot === "cpu_cooler" || slot === "fan_cooler") ? "cooler" : slot;
}

function _candidateFitsSlot(slot, candidate, build, cpu_brand, gpu_vendor) {
  const specs = candidate.specs || {};

  if (slot === "cpu") {
    if (cpu_brand && (specs.brand || "").toLowerCase() !== cpu_brand.trim().toLowerCase()) return false;
    const motherboard = build.motherboard;
    if (motherboard) {
      const cpu_socket = _normalizeSpecText(specs.socket);
      const mobo_socket = _normalizeSpecText(_componentSpecs(motherboard).socket);
      if (cpu_socket && mobo_socket && !mobo_socket.includes(cpu_socket) && !cpu_socket.includes(mobo_socket)) return false;
    }
  } else if (slot === "gpu") {
    if (gpu_vendor) {
      const wanted = _GPU_VENDOR_ALIASES[gpu_vendor.trim().toLowerCase()];
      if (wanted && (specs.vendor || "").toLowerCase() !== wanted) return false;
    }
  } else if (slot === "motherboard") {
    const cpu = build.cpu;
    const ram = build.ram;
    if (cpu) {
      const cpu_socket = _normalizeSpecText(_componentSpecs(cpu).socket);
      const mobo_socket = _normalizeSpecText(specs.socket);
      if (cpu_socket && mobo_socket && !mobo_socket.includes(cpu_socket) && !cpu_socket.includes(mobo_socket)) return false;
    }
    if (ram) {
      const ram_type = _componentSpecs(ram).type;
      if (ram_type && specs.ram_type && ram_type !== specs.ram_type) return false;
    }
  } else if (slot === "ram") {
    const motherboard = build.motherboard;
    const required = motherboard ? _componentSpecs(motherboard).ram_type : null;
    if (required && specs.type !== required) return false;
  } else if (slot === "psu") {
    const gpu = build.gpu;
    const min_watts = gpu ? _componentSpecs(gpu).recommended_psu_w : 450;
    if ((specs.wattage_w || 0) < (min_watts || 450)) return false;
  } else if (slot === "case") {
    const motherboard = build.motherboard;
    const mobo_ff = motherboard ? (_componentSpecs(motherboard).form_factor || "ATX") : "ATX";
    if (!caseFitsMobo(specs.max_form_factor || "ATX", mobo_ff)) return false;
  } else if (slot === "cpu_cooler") {
    if (!["air", "liquid"].includes(specs.type)) return false;
  } else if (slot === "fan_cooler") {
    if (!_isCaseFanCandidate(candidate)) return false;
  } else if (slot === "ssd") {
    if ((specs.capacity_gb || 0) < 250) return false;
  }

  return true;
}

function _strategyTargetSpecs(slot, useCase, performancePriority) {
  const target = { use_case: useCase, performance_priority: performancePriority };
  if (slot === "ram") target.target_capacity_gb = (performancePriority === "gaming" || performancePriority === "productivity") ? 32 : 16;
  return target;
}

function _strategyCandidateScore(component, slot, budget, useCase, performancePriority, budgetStrategy) {
  if (!component) return -1000000.0;
  const target = _strategyTargetSpecs(slot, useCase, performancePriority);
  let score = _componentScore(component, slot, budget, target);
  if (budgetStrategy === "maximize") {
    score += _componentPerformanceUnits(component, slot, target) * 0.65;
    if (slot === "gpu" || slot === "cpu") score += _componentPrice(component) / 150000;
  } else if (budgetStrategy === "value") {
    score += _valueScore(_componentPerformanceUnits(component, slot, target), component);
    score -= _componentPrice(component) / 1000000;
  }
  return score;
}

function _replacementCandidates(catalog, build, slot, budget, useCase, budgetStrategy, performancePriority, cpu_brand, gpu_vendor) {
  const current = build[slot];
  const current_price = _componentPrice(current);
  const total = _buildTotal(build);
  const max_price = current_price + Math.max(0, budget - total);
  const category = _candidateCategory(slot);
  const current_ref = _componentRef(current);
  const target = _strategyTargetSpecs(slot, useCase, performancePriority);
  const current_score = _strategyCandidateScore(current, slot, Math.max(current_price, 1), useCase, performancePriority, budgetStrategy);

  const candidates = [];
  const items = catalog[category] || [];

  for (const candidate of items) {
    const candidate_price = _componentPrice(candidate);
    if (candidate_price <= current_price || candidate_price > max_price) continue;
    if (_componentRef(candidate) === current_ref) continue;
    if (!_candidateFitsSlot(slot, candidate, build, cpu_brand, gpu_vendor)) continue;
    const next_build = { ...build, [slot]: candidate };
    if (slot === "cpu_cooler") next_build.cooler = candidate;
    if (_hasErrorCompatibility(validateBuild(next_build))) continue;
    const candidate_score = _strategyCandidateScore(candidate, slot, Math.max(max_price, candidate_price, 1), useCase, performancePriority, budgetStrategy);
    if (candidate_score <= current_score + 4 && _componentPerformanceUnits(candidate, slot, target) <= _componentPerformanceUnits(current || {}, slot, target)) continue;
    candidates.push(candidate);
  }

  return candidates.sort((a, b) => {
    const scoreA = _strategyCandidateScore(a, slot, Math.max(max_price, 1), useCase, performancePriority, budgetStrategy);
    const scoreB = _strategyCandidateScore(b, slot, Math.max(max_price, 1), useCase, performancePriority, budgetStrategy);
    return scoreB !== scoreA ? scoreB - scoreA : _componentPrice(a) - _componentPrice(b);
  });
}

function _upgradeReason(slot, performancePriority) {
  if (slot === "gpu") return "Higher graphics tier improves gaming frame rate and visual settings first.";
  if (slot === "cpu") return "Stronger CPU improves minimum FPS, simulation, streaming, and multitasking headroom.";
  if (slot === "ram") return "More or faster memory improves modern game and workload headroom.";
  if (slot === "psu") return "Extra PSU headroom protects stability for stronger CPU/GPU combinations.";
  if (slot === "motherboard") return "A stronger platform improves upgrade runway and connectivity.";
  if (slot === "ssd") return "More NVMe storage improves application and game library flexibility.";
  if (slot === "cpu_cooler") return "More cooling headroom helps sustained boost clocks and noise.";
  if (slot === "case") return "Better case compatibility and airflow keeps future upgrades easier.";
  return `Improves the ${performancePriority.replace(/_/g, " ")} balance of the build.`;
}

function _makeUpgradeSuggestion(slot, current, candidate, build, performancePriority) {
  const added_cost = _componentPrice(candidate) - _componentPrice(current);
  return {
    slot, current: normalizeMarketplaceLinks(current), candidate: normalizeMarketplaceLinks(candidate),
    added_cost_idr: added_cost, projected_total_idr: _buildTotal(build) + added_cost,
    reason: _upgradeReason(slot, performancePriority)
  };
}

function _budgetUsage(total, budget, budgetStrategy, status) {
  const targets = BUDGET_USAGE_TARGETS[budgetStrategy];
  return {
    strategy: budgetStrategy,
    used_percent: budget ? parseFloat(((total / budget) * 100).toFixed(1)) : 0.0,
    target_min_percent: parseFloat((targets.min * 100).toFixed(1)),
    target_max_percent: parseFloat((targets.max * 100).toFixed(1)),
    status
  };
}

function _strategyStatus(total, budget, budgetStrategy, suggestions, applied_count) {
  if (budgetStrategy === "value") return "value_preserved";
  const used_ratio = budget ? total / budget : 0.0;
  const target = BUDGET_USAGE_TARGETS[budgetStrategy].min;
  if (used_ratio >= target) return applied_count ? "optimized" : "target_met";
  return (suggestions.length > 0) ? "under_target" : "catalog_limited";
}

function _budgetWarnings(total, budget, budgetStrategy, status, suggestions) {
  if (budgetStrategy === "value" || ["target_met", "optimized", "value_preserved"].includes(status)) return [];
  const remaining = Math.max(0, budget - total);
  const used_percent = budget ? parseFloat(((total / budget) * 100).toFixed(1)) : 0.0;
  return [{
    code: "budget_underused", severity: "warning", title: "Budget is not fully used",
    message: `This build uses ${used_percent}% of the available budget and leaves Rp ${remaining.toLocaleString("id-ID")} IDR unused.`.replace("Rp ", "").replace(" IDR", ""),
    recommendation: (suggestions.length > 0) ? "Review the suggested upgrades before buying." : "No compatible high-impact catalog upgrade is available for the remaining budget.",
    suggested_slots: suggestions.slice(0, 3).map(s => s.slot)
  }];
}

function _performanceBalanceSummary(build, useCase, performancePriority) {
  const cpu = build.cpu;
  const gpu = build.gpu;
  const ram = build.ram;
  const cpu_name = (cpu || {}).name || "CPU";
  const gpu_name = (gpu || {}).name || "GPU";
  const ram_specs = _componentSpecs(ram);

  const notes = [];
  if (useCase === "gaming" && gpu) notes.push(`GPU choice (${gpu_name}) is the primary gaming performance lever.`);
  if (cpu && cpu_name.toLowerCase().includes("x3d")) notes.push("X3D CPU cache helps gaming frame pacing and minimum FPS.");
  if (ram_specs.capacity_gb) notes.push(`${ram_specs.capacity_gb}GB RAM supports the selected workload target.`);
  if (notes.length === 0) notes.push(`CPU (${cpu_name}) and GPU (${gpu_name}) are checked against compatibility and budget balance.`);

  return { priority: performancePriority, summary: notes.join(" "), bottleneck_risk: (cpu && gpu) ? "low" : "review" };
}

function _buildAlternativeOptions(catalog, build, budget, useCase, budgetStrategy, performancePriority, cpu_brand, gpu_vendor) {
  const alternatives = {};
  for (const slot of ["cpu", "gpu", "ram", "ssd", "psu"]) {
    const candidates = _replacementCandidates(catalog, build, slot, budget, useCase, budgetStrategy, performancePriority, cpu_brand, gpu_vendor);
    if (candidates.length > 0) {
      alternatives[slot] = candidates.slice(0, 3).map(candidate => _makeUpgradeSuggestion(slot, build[slot], candidate, build, performancePriority));
    }
  }
  return alternatives;
}

function _applyBudgetStrategy(catalog, build, budget, useCase, budgetStrategy, performancePriority, cpu_brand, gpu_vendor) {
  const optimized = { ...build };
  let applied_count = 0;
  const suggestions = [];
  const order = PRIORITY_UPGRADE_ORDER[performancePriority] || PRIORITY_UPGRADE_ORDER.balanced;

  for (const slot of REQUIRED_BUILD_SLOTS) {
    if (optimized[slot] !== null && optimized[slot] !== undefined) continue;
    const candidates = _replacementCandidates(catalog, optimized, slot, budget, useCase, budgetStrategy, performancePriority, cpu_brand, gpu_vendor);
    if (candidates.length === 0) continue;
    const candidate = candidates[0];
    suggestions.push(_makeUpgradeSuggestion(slot, optimized[slot], candidate, optimized, performancePriority));
    optimized[slot] = normalizeMarketplaceLinks(candidate);
    if (slot === "cpu_cooler") optimized.cooler = optimized[slot];
    applied_count += 1;
  }

  if (budgetStrategy === "value") {
    for (const slot of order) {
      const candidates = _replacementCandidates(catalog, optimized, slot, budget, useCase, budgetStrategy, performancePriority, cpu_brand, gpu_vendor);
      if (candidates.length > 0) suggestions.push(_makeUpgradeSuggestion(slot, optimized[slot], candidates[0], optimized, performancePriority));
    }
    const total = _buildTotal(optimized);
    const status = _strategyStatus(total, budget, budgetStrategy, suggestions, applied_count);
    const usage = _budgetUsage(total, budget, budgetStrategy, status);
    return [
      optimized, usage, [], suggestions.slice(0, 5),
      _buildAlternativeOptions(catalog, optimized, budget, useCase, budgetStrategy, performancePriority, cpu_brand, gpu_vendor),
      _performanceBalanceSummary(optimized, useCase, performancePriority)
    ];
  }

  const target = BUDGET_USAGE_TARGETS[budgetStrategy].min;
  for (let pass = 0; pass < 3; pass++) {
    if (budget && _buildTotal(optimized) / budget >= target) break;
    let applied_this_pass = false;
    for (const slot of order) {
      if (budget && _buildTotal(optimized) / budget >= target) break;
      const candidates = _replacementCandidates(catalog, optimized, slot, budget, useCase, budgetStrategy, performancePriority, cpu_brand, gpu_vendor);
      if (candidates.length === 0) continue;
      const candidate = candidates[0];
      suggestions.push(_makeUpgradeSuggestion(slot, optimized[slot], candidate, optimized, performancePriority));
      optimized[slot] = normalizeMarketplaceLinks(candidate);
      if (slot === "cpu_cooler") optimized.cooler = optimized[slot];
      applied_count += 1;
      applied_this_pass = true;
    }
    if (!applied_this_pass) break;
  }

  const remaining_suggestions = [];
  for (const slot of order) {
    const candidates = _replacementCandidates(catalog, optimized, slot, budget, useCase, budgetStrategy, performancePriority, cpu_brand, gpu_vendor);
    if (candidates.length > 0) remaining_suggestions.push(_makeUpgradeSuggestion(slot, optimized[slot], candidates[0], optimized, performancePriority));
  }

  const total = _buildTotal(optimized);
  const status = _strategyStatus(total, budget, budgetStrategy, remaining_suggestions, applied_count);
  const usage = _budgetUsage(total, budget, budgetStrategy, status);
  const warnings = _budgetWarnings(total, budget, budgetStrategy, status, remaining_suggestions);
  return [
    optimized, usage, warnings, remaining_suggestions.slice(0, 5),
    _buildAlternativeOptions(catalog, optimized, budget, useCase, budgetStrategy, performancePriority, cpu_brand, gpu_vendor),
    _performanceBalanceSummary(optimized, useCase, performancePriority)
  ];
}

export function composeBuild(components, budget, useCase, {
  cpu_brand = null, gpu_vendor = null, include_optional_addons = false,
  optional_addon_slots = null, budget_strategy = null, performance_priority = null,
  allocation_overrides = null, _apply_budget_optimizer = true
} = {}) {
  if (!(useCase in USE_CASE_PROFILES)) throw new Error(`Unknown use case: ${useCase}. Valid: ${Object.keys(USE_CASE_PROFILES)}`);
  const strategy = normalizeBudgetStrategy(budget_strategy);
  const priority = normalizePerformancePriority(performance_priority, useCase);
  const initial_scoring_priority = _apply_budget_optimizer ? priority : null;
  const profile = strategyAllocationProfile(useCase, priority, strategy, allocation_overrides);

  const alloc = {};
  for (const [slot, pct] of Object.entries(profile)) {
    alloc[slot] = Math.floor(budget * pct / 100);
  }

  let build = {};
  let slot_budgets = {};
  let slot_targets = {};
  let leftover = 0;
  const unmet_preferences = [];

  function nextSlotBudget(slot) {
    return Math.max((alloc[slot] || 0) + leftover, 1);
  }

  // CPU
  let cpu_budget = alloc.cpu;
  if (strategy === "maximize" && initial_scoring_priority === "gaming" && budget >= 22000000) cpu_budget = Math.max(cpu_budget, Math.floor(budget * 0.24));
  slot_budgets.cpu = cpu_budget;
  const cpu = pickCpu(components.cpu || [], cpu_budget, cpu_brand, useCase, initial_scoring_priority);
  build.cpu = cpu;
  if (cpu) {
    leftover += alloc.cpu - (cpu.price_idr || 0);
    if (cpu_brand && (cpu.specs && cpu.specs.brand || "").toLowerCase() !== cpu_brand.trim().toLowerCase()) unmet_preferences.push(`Requested ${cpu_brand} CPU, but no ${cpu_brand} option fit the Rp ${alloc.cpu.toLocaleString("id-ID")} allocation — picked best fit instead.`);
  }

  const socket = cpu && cpu.specs ? cpu.specs.socket : null;
  const cpu_ddr = cpu && cpu.specs ? cpu.specs.ram_type : null;

  // Motherboard
  const mobo_budget = alloc.motherboard + leftover;
  slot_budgets.motherboard = mobo_budget;
  const mobo = pickMotherboard(components.motherboard || [], mobo_budget, socket || "");
  build.motherboard = mobo;
  if (mobo) leftover = alloc.motherboard + leftover - (mobo.price_idr || 0);
  const ram_type = (mobo && mobo.specs ? mobo.specs.ram_type : null) || cpu_ddr;

  // RAM
  const ram_budget = nextSlotBudget("ram");
  const ram_target = { target_capacity_gb: _targetRamCapacity(useCase, budget) };
  slot_budgets.ram = ram_budget;
  slot_targets.ram = ram_target;
  const ram = pickRam(components.ram || [], ram_budget, ram_type, ram_target.target_capacity_gb);
  build.ram = ram;
  if (ram) leftover = alloc.ram + leftover - (ram.price_idr || 0);

  // GPU
  const base_gpu_budget = nextSlotBudget("gpu");
  let gpu_budget = base_gpu_budget;
  if (strategy === "maximize" && initial_scoring_priority === "gaming" && budget >= 22000000) gpu_budget = Math.max(gpu_budget, Math.floor(budget * 0.42));
  slot_budgets.gpu = gpu_budget;
  slot_targets.gpu = { use_case: useCase, performance_priority: initial_scoring_priority };
  if (useCase === "office" && cpu && cpu.specs && cpu.specs.has_igpu) {
    build.gpu = null;
    leftover += alloc.gpu;
  } else {
    const gpu = pickGpu(components.gpu || [], gpu_budget, gpu_vendor, useCase, initial_scoring_priority);
    build.gpu = gpu;
    if (gpu) {
      leftover = base_gpu_budget - (gpu.price_idr || 0);
      if (gpu_vendor) {
        const want = _GPU_VENDOR_ALIASES[gpu_vendor.trim().toLowerCase()];
        const got = (gpu.specs && gpu.specs.vendor || "").toLowerCase();
        if (want && got !== want) unmet_preferences.push(`Requested ${gpu_vendor} GPU, but no ${gpu_vendor} option fit the budget — picked best fit instead.`);
      }
    } else {
      leftover = base_gpu_budget;
    }
  }

  // SSD
  const ssd_budget = nextSlotBudget("ssd");
  slot_budgets.ssd = ssd_budget;
  const ssd = pickSsd(components.ssd || [], ssd_budget);
  build.ssd = ssd;
  if (ssd) leftover = alloc.ssd + leftover - (ssd.price_idr || 0);

  // PSU
  let min_watts = 450;
  if (build.gpu) min_watts = Math.max(min_watts, build.gpu.specs && build.gpu.specs.recommended_psu_w || 500);
  const psu_budget = nextSlotBudget("psu");
  slot_budgets.psu = psu_budget;
  slot_targets.psu = { min_watts };
  const psu = pickPsu(components.psu || [], psu_budget, min_watts);
  build.psu = psu;
  if (psu) leftover = alloc.psu + leftover - (psu.price_idr || 0);

  // Case
  const mobo_ff = mobo && mobo.specs ? (mobo.specs.form_factor || "ATX") : "ATX";
  const case_budget = nextSlotBudget("case");
  slot_budgets.case = case_budget;
  slot_targets.case = { mobo_ff };
  const caseComp = pickCase(components.case || [], case_budget, mobo_ff);
  build.case = caseComp;
  if (caseComp) leftover = alloc.case + leftover - (caseComp.price_idr || 0);

  // CPU cooler
  const prefer_liquid = ["gaming", "content_creation"].includes(useCase) && budget >= 15000000;
  const cpu_cooler_budget = nextSlotBudget("cpu_cooler");
  slot_budgets.cpu_cooler = cpu_cooler_budget;
  slot_targets.cpu_cooler = { prefer_liquid };
  const cpu_cooler = pickCooler(components.cooler || [], cpu_cooler_budget, prefer_liquid);
  build.cpu_cooler = cpu_cooler;
  if (cpu_cooler) leftover = alloc.cpu_cooler + leftover - (cpu_cooler.price_idr || 0);

  // Fan cooler
  const fan_cooler_budget = nextSlotBudget("fan_cooler");
  slot_budgets.fan_cooler = fan_cooler_budget;
  build.fan_cooler = pickFanCooler(components.cooler || [], fan_cooler_budget);

  build.cooler = cpu_cooler;

  const normalizedBuild = {};
  for (const slot of REQUIRED_BUILD_SLOTS) {
    const comp = normalizeMarketplaceLinks(build[slot]);
    if (comp !== null && comp !== undefined) {
      comp.selection_rationale = _selectionRationale(slot, comp, slot_budgets[slot] !== undefined ? slot_budgets[slot] : (alloc[slot] || 0), useCase, slot_targets[slot]);
    }
    normalizedBuild[slot] = comp;
  }

  let budget_usage, budget_warnings, upgrade_suggestions, alternative_options, performance_balance;
  if (_apply_budget_optimizer) {
    [
      build, budget_usage, budget_warnings, upgrade_suggestions, alternative_options, performance_balance
    ] = _applyBudgetStrategy(components, normalizedBuild, budget, useCase, strategy, priority, cpu_brand, gpu_vendor);
  } else {
    const total_before = _buildTotal(normalizedBuild);
    const stat = _strategyStatus(total_before, budget, strategy, [], 0);
    budget_usage = _budgetUsage(total_before, budget, strategy, stat);
    budget_warnings = _budgetWarnings(total_before, budget, strategy, stat, []);
    upgrade_suggestions = [];
    alternative_options = {};
    performance_balance = _performanceBalanceSummary(normalizedBuild, useCase, priority);
    build = normalizedBuild;
  }

  for (const slot of REQUIRED_BUILD_SLOTS) {
    const comp = build[slot];
    if (comp !== null && comp !== undefined) {
      comp.selection_rationale = _selectionRationale(slot, comp, Math.max(slot_budgets[slot] !== undefined ? slot_budgets[slot] : _componentPrice(comp), _componentPrice(comp)), useCase, slot_targets[slot] || _strategyTargetSpecs(slot, useCase, priority));
    }
  }

  const missing_slots = Object.keys(build).filter(slot => REQUIRED_BUILD_SLOTS.includes(slot) && build[slot] === null);

  const optional_addons = { hdd: null, monitor: null, ups: null };
  const unavailable_optional_addons = [];
  const requested_addons = selectedOptionalAddonSlots(include_optional_addons, optional_addon_slots);
  if (requested_addons.length > 0) {
    for (const slot of requested_addons) {
      const candidates = components[slot] || [];
      let addon_budget = Math.max(Math.floor(budget * 0.15), 1);
      let pick = null;
      if (slot === "hdd") {
        addon_budget = Math.max(Math.floor(budget * 0.08), 1000000);
        pick = pickSsd(candidates, addon_budget);
      } else if (slot === "ups") {
        addon_budget = Math.max(addon_budget, 1500000);
        pick = pickUps(candidates, addon_budget, build);
      } else if (slot === "monitor") {
        pick = pickMonitor(candidates, addon_budget, build, useCase, budget);
      } else {
        pick = _bestRankedComponent(candidates.filter(c => (c.price_idr || 0) <= addon_budget), slot, addon_budget);
      }
      const norm_pick = normalizeMarketplaceLinks(pick);
      if (norm_pick !== null && norm_pick !== undefined) norm_pick.selection_rationale = _selectionRationale(slot, norm_pick, addon_budget, useCase);
      optional_addons[slot] = norm_pick;
      if (pick === null) unavailable_optional_addons.push(slot);
    }
  }

  const total = sumPrices(build);
  const status = _strategyStatus(total, budget, strategy, upgrade_suggestions, 0);
  if (budget_usage.used_percent !== (budget ? parseFloat(((total / budget) * 100).toFixed(1)) : 0.0)) {
    budget_usage = _budgetUsage(total, budget, strategy, status);
    budget_warnings = _budgetWarnings(total, budget, strategy, status, upgrade_suggestions);
  }

  const compatibility_warnings = validateBuild({
    cpu: build.cpu, motherboard: build.motherboard, ram: build.ram, gpu: build.gpu, psu: build.psu, case: build.case, cpu_cooler: build.cpu_cooler
  });
  const issues = compatibilityMessages(compatibility_warnings);

  return {
    use_case: useCase, budget_idr: budget, total_idr: total, remaining_idr: budget - total, budget_band: budgetBandFor(budget), budget_strategy: strategy,
    performance_priority: priority, budget_usage, budget_warnings, upgrade_suggestions, alternative_options, performance_balance,
    components: build, optional_addons, missing_slots, unavailable_optional_addons, compatibility_warnings, compatibility_issues: issues,
    preferences: { cpu_brand, gpu_vendor }, unmet_preferences
  };
}

function sumPrices(build) {
  return Object.values(build).reduce((sum, c) => sum + _componentPrice(c), 0);
}

export function selectedOptionalAddonSlots(include_optional_addons, optional_addon_slots = null) {
  if (optional_addon_slots === null) return include_optional_addons ? [...OPTIONAL_ADDON_SLOTS] : [];
  const selected = [];
  for (const slot of optional_addon_slots) {
    const norm_slot = String(slot || "").trim().toLowerCase();
    if (OPTIONAL_ADDON_SLOTS.includes(norm_slot) && !selected.includes(norm_slot)) selected.push(norm_slot);
  }
  return selected;
}

export function recommendUpgrade(components, budget, useCase, existingComponents) {
  const analysis = analyzeExistingComponents(existingComponents);
  const baseline = composeBuild(components, budget, useCase, { include_optional_addons: false });
  const detected_existing = analysis.detected_existing;
  const upgrade_priorities = _buildUpgradePriorities(components, budget, useCase, detected_existing, baseline);
  const recommended_components = _selectPriorityUpgrades(upgrade_priorities, budget);

  const combined_build = {};
  for (const slot of REQUIRED_BUILD_SLOTS) combined_build[slot] = detected_existing[slot] || recommended_components[slot];
  const compatibility_warnings = [...analysis.warning_objects, ...validateBuild(combined_build)];
  const compatibility_notes = [...analysis.warnings, ...compatibilityMessages(compatibility_warnings.slice(analysis.warning_objects.length))];

  return {
    mode: "upgrade", budget_idr: budget, use_case: useCase, recognized_existing: analysis.recognized, detected_existing, unknown_existing: analysis.unknown,
    recommendation: { components: recommended_components, total_idr: Object.values(recommended_components).reduce((sum, c) => sum + (c ? (c.price_idr || 0) : 0), 0) },
    upgrade_priorities: upgrade_priorities.map(p => {
      const { component, ...rest } = p;
      return rest;
    }),
    compatibility_notes, compatibility_warnings
  };
}

// Pre-process and apply price overrides
const rawPriceOverrides = {};

const rawCuratedRam = [
  {
    "sku": "RAM-DDR4-16-3200-VAL",
    "name": "Team T-Force Vulcan Z 16GB (2x8GB) DDR4-3200",
    "brand": "Team",
    "price_idr": 900000,
    "specs": { "type": "DDR4", "capacity_gb": 16, "speed_mhz": 3200, "modules": 2 }
  },
  {
    "sku": "RAM-DDR4-32-3200-VAL",
    "name": "Team T-Force Vulcan Z 32GB (2x16GB) DDR4-3200",
    "brand": "Team",
    "price_idr": 1700000,
    "specs": { "type": "DDR4", "capacity_gb": 32, "speed_mhz": 3200, "modules": 2 }
  },
  {
    "sku": "RAM-DDR4-16-3600-PERF",
    "name": "Klevv Bolt XR 16GB (2x8GB) DDR4-3600",
    "brand": "Klevv",
    "price_idr": 1100000,
    "specs": { "type": "DDR4", "capacity_gb": 16, "speed_mhz": 3600, "modules": 2 }
  },
  {
    "sku": "RAM-DDR4-32-3600-PERF",
    "name": "Klevv Bolt XR 32GB (2x16GB) DDR4-3600",
    "brand": "Klevv",
    "price_idr": 2100000,
    "specs": { "type": "DDR4", "capacity_gb": 32, "speed_mhz": 3600, "modules": 2 }
  },
  {
    "sku": "RAM-DDR5-16-5600-VAL",
    "name": "Team T-Force Vulcan 16GB (2x8GB) DDR5-5600",
    "brand": "Team",
    "price_idr": 1250000,
    "specs": { "type": "DDR5", "capacity_gb": 16, "speed_mhz": 5600, "modules": 2 }
  },
  {
    "sku": "RAM-DDR5-32-5600-VAL",
    "name": "Team T-Force Vulcan 32GB (2x16GB) DDR5-5600",
    "brand": "Team",
    "price_idr": 2250000,
    "specs": { "type": "DDR5", "capacity_gb": 32, "speed_mhz": 5600, "modules": 2 }
  },
  {
    "sku": "RAM-DDR5-32-6000-PERF",
    "name": "G.Skill Trident Z5 32GB (2x16GB) DDR5-6000",
    "brand": "G.Skill",
    "price_idr": 2950000,
    "specs": { "type": "DDR5", "capacity_gb": 32, "speed_mhz": 6000, "modules": 2 }
  },
  {
    "sku": "RAM-DDR5-32-6400-PERF",
    "name": "G.Skill Trident Z5 RGB 32GB (2x16GB) DDR5-6400",
    "brand": "G.Skill",
    "price_idr": 3400000,
    "specs": { "type": "DDR5", "capacity_gb": 32, "speed_mhz": 6400, "modules": 2 }
  },
  {
    "sku": "RAM-DDR5-64-6000-HEDT",
    "name": "G.Skill Trident Z5 64GB (2x32GB) DDR5-6000",
    "brand": "G.Skill",
    "price_idr": 5800000,
    "specs": { "type": "DDR5", "capacity_gb": 64, "speed_mhz": 6000, "modules": 2 }
  }
];

let processedComponents = [];
const componentMap = new Map();
const componentsByCategory = {};

export function initCatalog(rawComponents) {
  processedComponents = [];
  componentMap.clear();
  for (const k of Object.keys(componentsByCategory)) {
    delete componentsByCategory[k];
  }

  const priceOverrides = {};
  for (const [k, v] of Object.entries(rawPriceOverrides)) {
    if (k && !k.startsWith("_")) priceOverrides[k] = parseInt(v, 10);
  }

  processedComponents = rawComponents.map(c => {
    const sku = c.sku || c.id;
    return { ...c, price_idr: (sku && sku in priceOverrides) ? priceOverrides[sku] : c.price_idr };
  });

  for (const c of processedComponents) {
    const sku = c.sku || c.id;
    if (sku) componentMap.set(sku, c);
    const cat = c.category;
    if (!componentsByCategory[cat]) componentsByCategory[cat] = [];
    componentsByCategory[cat].push(c);
  }

  if (!componentsByCategory["ram"]) componentsByCategory["ram"] = [];
  const curatedRamCatalog = rawCuratedRam.map(r => ({
    sku: r.sku, name: r.name, brand: r.brand, category: "ram", subcategory: r.specs.type,
    price_idr: r.price_idr, image_path: null, product_url: null, specs: r.specs, source: "curated"
  }));
  for (const r of curatedRamCatalog) {
    if (!componentMap.has(r.sku)) {
      componentMap.set(r.sku, r);
      componentsByCategory["ram"].push(r);
    }
  }
}

export function findComponent(componentId) {
  return componentMap.get(componentId) || null;
}

export function loadComponents() {
  return processedComponents;
}

export function componentsByCategoryMap() {
  return componentsByCategory;
}
