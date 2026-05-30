export const SLOT_ORDER = ['cpu', 'motherboard', 'ram', 'gpu', 'ssd', 'psu', 'cpu_cooler', 'fan_cooler', 'case'];
export const OPTIONAL_ADDON_ORDER = ['hdd', 'monitor', 'ups'];

export const SLOT_LABELS = {
  cpu: 'Processor / CPU',
  motherboard: 'Motherboard',
  ram: 'RAM',
  gpu: 'VGA / GPU',
  ssd: 'SSD',
  hdd: 'Hard Drive / HDD',
  psu: 'PSU',
  cpu_cooler: 'CPU Cooler',
  fan_cooler: 'Fan Cooler',
  case: 'Casing',
  monitor: 'Monitor',
  ups: 'UPS',
};

export function slotLabel(slot) {
  return SLOT_LABELS[slot] || String(slot || '').replace(/_/g, ' ');
}

export const SLOT_ICONS = {
  cpu: 'CPU',
  motherboard: 'MB',
  ram: 'RAM',
  gpu: 'GPU',
  ssd: 'SSD',
  hdd: 'HDD',
  psu: 'PSU',
  cpu_cooler: 'COOL',
  fan_cooler: 'FAN',
  case: 'CASE',
  monitor: 'MON',
  ups: 'UPS',
};

export const SUMMARY_KEYS = {
  cpu: ['socket', 'cores', 'threads', 'base_clock_ghz', 'tdp_w'],
  motherboard: ['socket', 'form_factor', 'ram_type', 'chipset'],
  ram: ['type', 'capacity_gb', 'speed_mhz', 'module_count'],
  gpu: ['vram_gb', 'vendor', 'recommended_psu_w', 'tdp_w'],
  ssd: ['capacity_gb', 'interface', 'form_factor'],
  hdd: ['capacity_gb', 'interface', 'form_factor_in'],
  psu: ['wattage_w', 'rating', 'modular'],
  cpu_cooler: ['type', 'tdp_w', 'fan_size_mm'],
  fan_cooler: ['type', 'fan_size_mm'],
  case: ['form_factor', 'color'],
  monitor: ['size_inch', 'resolution', 'refresh_hz'],
  ups: ['capacity_va', 'wattage_w'],
};

export const SWAP_SPEC_KEYS = {
  cpu: ['socket', 'cores', 'threads', 'tdp_w'],
  motherboard: ['socket', 'form_factor', 'ram_type', 'chipset'],
  ram: ['type', 'capacity_gb', 'speed_mhz'],
  gpu: ['vram_gb', 'vendor', 'recommended_psu_w'],
  ssd: ['capacity_gb', 'interface', 'form_factor'],
  hdd: ['capacity_gb', 'interface', 'form_factor_in'],
  psu: ['wattage_w', 'rating'],
  cpu_cooler: ['type', 'tdp_w', 'fan_size_mm'],
  fan_cooler: ['type', 'fan_size_mm'],
  case: ['form_factor', 'max_form_factor'],
};

export const SPEC_LABELS = {
  socket: 'Socket',
  cores: 'Cores',
  threads: 'Threads',
  base_clock_ghz: 'Base clock',
  tdp_w: 'TDP',
  form_factor: 'Form factor',
  max_form_factor: 'Fits board',
  ram_type: 'Memory type',
  chipset: 'Chipset',
  type: {
    ram: 'Memory type',
    cpu_cooler: 'Cooler type',
    fan_cooler: 'Fan type',
  },
  capacity_gb: {
    ram: 'Capacity',
    ssd: 'Capacity',
    hdd: 'Capacity',
  },
  speed_mhz: 'Speed',
  module_count: 'Modules',
  vram_gb: 'VRAM',
  vendor: 'GPU vendor',
  recommended_psu_w: 'PSU target',
  wattage_w: 'Wattage',
  rating: 'Efficiency',
  modular: 'Modular',
  fan_size_mm: 'Fan size',
  size_inch: 'Size',
  resolution: 'Resolution',
  refresh_hz: 'Refresh rate',
  capacity_va: 'Capacity',
  interface: 'Interface',
  form_factor_in: 'Drive size',
  color: 'Color',
};

export function specLabel(slot, key) {
  const label = SPEC_LABELS[key];
  if (label && typeof label === 'object') return label[slot] || key.replace(/_/g, ' ');
  return label || key.replace(/_/g, ' ');
}

export function formatSpecValue(key, value) {
  if (key === 'wattage_w' || key === 'tdp_w' || key === 'recommended_psu_w') return `${value}W`;
  if (key === 'capacity_gb' || key === 'vram_gb') return `${value} GB`;
  if (key === 'speed_mhz') return `${value} MHz`;
  if (key === 'fan_size_mm') return `${value} mm`;
  if (key === 'size_inch') return `${value}"`;
  if (key === 'refresh_hz') return `${value} Hz`;
  if (key === 'capacity_va') return `${value} VA`;
  if (key === 'base_clock_ghz') return `${value} GHz`;
  if (key === 'form_factor_in') return `${value}"`;
  if (typeof value === 'boolean') return value ? 'yes' : 'no';
  return String(value);
}

export function specPills(slot, specs, keysBySlot = SUMMARY_KEYS, limit = 4) {
  if (!specs) return [];
  const keys = keysBySlot[slot] || Object.keys(specs);
  const out = [];
  for (const key of keys) {
    const value = specs[key];
    if (value === null || value === undefined || value === '') continue;
    out.push({ key: specLabel(slot, key), value: formatSpecValue(key, value) });
    if (out.length >= limit) break;
  }
  return out;
}
