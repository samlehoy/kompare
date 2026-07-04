export const ALLOCATION_SLOTS = [
  { value: 'cpu', label: 'CPU' },
  { value: 'gpu', label: 'GPU' },
  { value: 'ram', label: 'RAM' },
  { value: 'motherboard', label: 'Motherboard' },
  { value: 'ssd', label: 'SSD' },
  { value: 'psu', label: 'PSU' },
  { value: 'case', label: 'Casing' },
  { value: 'cpu_cooler', label: 'CPU cooler' },
  { value: 'fan_cooler', label: 'Fan cooler' },
];

export const LOCAL_ALLOCATION_PRESET_METADATA = {
  slots: ALLOCATION_SLOTS.map((slot) => slot.value),
  profiles: {
    gaming: { cpu: 18, gpu: 33, ram: 7, motherboard: 10, ssd: 10, psu: 8, case: 7, cpu_cooler: 5, fan_cooler: 2 },
    productivity: { cpu: 27, gpu: 17, ram: 12, motherboard: 12, ssd: 14, psu: 7, case: 6, cpu_cooler: 4, fan_cooler: 1 },
    content_creation: { cpu: 24, gpu: 26, ram: 12, motherboard: 10, ssd: 13, psu: 7, case: 4, cpu_cooler: 3, fan_cooler: 1 },
    office: { cpu: 28, gpu: 0, ram: 12, motherboard: 18, ssd: 20, psu: 8, case: 8, cpu_cooler: 5, fan_cooler: 1 },
    student: { cpu: 22, gpu: 16, ram: 12, motherboard: 14, ssd: 14, psu: 8, case: 8, cpu_cooler: 5, fan_cooler: 1 },
  },
  priorityShifts: {
    gaming: { cpu: 2, gpu: 4, motherboard: -1, ssd: -2, case: -2, fan_cooler: -1 },
    productivity: { cpu: 5, gpu: -7, ram: 4, ssd: 4, case: -3, cpu_cooler: -1, fan_cooler: -2 },
    best_value: { cpu: -1, gpu: -2, ram: 2, ssd: 2, psu: 1, cpu_cooler: -1, fan_cooler: -1 },
    balanced: {},
    upgrade_friendly: { cpu: -2, gpu: -6, ram: -1, motherboard: 5, ssd: -2, psu: 4, case: 3, fan_cooler: -1 },
  },
  strategyShifts: {
    value: { cpu: -1, gpu: -2, ram: 1, ssd: 2, psu: 1, cpu_cooler: -1 },
    balanced: {},
    maximize: { cpu: 2, gpu: 3, ram: -1, motherboard: -1, ssd: -2, case: -2, cpu_cooler: 1 },
  },
};

export function normalizeAllocationPresetMetadata(metadata) {
  const profiles = metadata?.profiles;
  if (!profiles || typeof profiles !== 'object') return LOCAL_ALLOCATION_PRESET_METADATA;

  return {
    slots: Array.isArray(metadata.slots) ? metadata.slots : LOCAL_ALLOCATION_PRESET_METADATA.slots,
    profiles,
    priorityShifts: metadata.priorityShifts || metadata.priority_shifts || LOCAL_ALLOCATION_PRESET_METADATA.priorityShifts,
    strategyShifts: metadata.strategyShifts || metadata.strategy_shifts || LOCAL_ALLOCATION_PRESET_METADATA.strategyShifts,
  };
}

export function allocationProfileForUseCase(useCase, metadata = LOCAL_ALLOCATION_PRESET_METADATA) {
  return { ...(metadata.profiles[useCase] || metadata.profiles.gaming || LOCAL_ALLOCATION_PRESET_METADATA.profiles.gaming) };
}

export function allocationTotal(allocations) {
  return ALLOCATION_SLOTS.reduce((total, slot) => total + Number(allocations[slot.value] || 0), 0);
}

function applyAllocationShift(profile, shift = {}) {
  const next = { ...profile };
  ALLOCATION_SLOTS.forEach((slot) => {
    next[slot.value] = cleanAllocationValue((next[slot.value] || 0) + (shift[slot.value] || 0));
  });
  return next;
}

export function cleanAllocationValue(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.max(0, Math.min(100, Math.round(number)));
}

export function suggestedAllocationProfile(useCase, budgetStrategy, performancePriority, metadata = LOCAL_ALLOCATION_PRESET_METADATA) {
  const useCaseProfile = allocationProfileForUseCase(useCase, metadata);
  const priorityProfile = applyAllocationShift(
    useCaseProfile,
    metadata.priorityShifts[performancePriority],
  );
  return normalizeAllocationProfile(
    applyAllocationShift(priorityProfile, metadata.strategyShifts[budgetStrategy]),
    performancePriority,
  );
}

function preferredAllocationSlots(performancePriority) {
  if (performancePriority === 'productivity') return ['cpu', 'ram', 'ssd'];
  if (performancePriority === 'upgrade_friendly') return ['motherboard', 'psu', 'case'];
  if (performancePriority === 'best_value') return ['gpu', 'ssd', 'ram'];
  return ['gpu', 'cpu'];
}

function normalizeAllocationProfile(profile, performancePriority) {
  const next = {};
  ALLOCATION_SLOTS.forEach((slot) => {
    next[slot.value] = cleanAllocationValue(profile[slot.value] || 0);
  });

  let total = allocationTotal(next);
  const preferredSlots = preferredAllocationSlots(performancePriority);
  const addSlots = [...preferredSlots, ...ALLOCATION_SLOTS.map((slot) => slot.value)];
  const reduceSlots = [...ALLOCATION_SLOTS]
    .map((slot) => slot.value)
    .sort((left, right) => (next[right] || 0) - (next[left] || 0));

  while (total < 100) {
    const slot = addSlots.find((candidate) => (next[candidate] || 0) < 60);
    if (!slot) break;
    next[slot] += 1;
    total += 1;
  }

  while (total > 100) {
    const slot = reduceSlots.find((candidate) => (next[candidate] || 0) > 0);
    if (!slot) break;
    next[slot] -= 1;
    total -= 1;
  }

  return next;
}
