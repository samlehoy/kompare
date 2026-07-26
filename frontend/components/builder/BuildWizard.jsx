'use client';

import { useEffect, useRef, useState } from 'react';
import AdvisorConsole from '@/components/advisor/AdvisorConsole.jsx';
import BuildResults from '@/components/results/BuildResults.jsx';
import SwapModal from '@/components/swap/SwapModal.jsx';
import { RetroButton, RetroInput, RetroSelect } from '@/components/ui/FormControls.jsx';
import StatusPanel from '@/components/ui/StatusPanel.jsx';
import { api } from '@/lib/api.js';
import { formatIDR, parseIDR } from '@/lib/format.js';

const USE_CASE_OPTIONS = [
  { value: 'gaming', label: 'Gaming' },
  { value: 'productivity', label: 'Productivity' },
  { value: 'content_creation', label: 'Content creation' },
  { value: 'office', label: 'Office' },
  { value: 'student', label: 'Student' },
];

const CPU_OPTIONS = [
  { value: '', label: 'Any CPU brand' },
  { value: 'AMD', label: 'AMD' },
  { value: 'Intel', label: 'Intel' },
];

const GPU_OPTIONS = [
  { value: '', label: 'Any GPU vendor' },
  { value: 'Nvidia', label: 'Nvidia' },
  { value: 'AMD', label: 'AMD Radeon' },
  { value: 'Intel', label: 'Intel Arc' },
];

const AI_PROFILE_OPTIONS = [
  { value: 'local_qwen', label: 'Local Qwen + Qdrant' },
  { value: 'gemini_free', label: 'Gemini free tier' },
];

const LOCAL_USE_CASE_BUDGET_RANGES = {
  gaming:           { min_idr: 7_000_000,  max_idr: 40_000_000 },
  productivity:     { min_idr: 5_000_000,  max_idr: 30_000_000 },
  content_creation: { min_idr: 8_000_000,  max_idr: 40_000_000 },
  office:           { min_idr: 4_000_000,  max_idr: 15_000_000 },
  student:          { min_idr: 5_000_000,  max_idr: 20_000_000 },
};

const RECOMMENDATION_MODES = [
  {
    value: 'fast',
    label: 'Fast compatibility',
    description: 'Quick deterministic recommendation using budget and compatibility rules.',
  },
  {
    value: 'ai',
    label: 'AI-assisted',
    description: 'Retrieves catalog candidates, ranks them with AI, then validates compatibility.',
  },
];

const OPTIONAL_ADDON_OPTIONS = [
  {
    value: 'hdd',
    label: 'Hard Drive / HDD',
    description: 'Bulk storage for files, recordings, and larger game libraries.',
  },
  {
    value: 'monitor',
    label: 'Monitor',
    description: 'Display recommendation matched to the build target.',
  },
  {
    value: 'ups',
    label: 'UPS',
    description: 'Power backup sized around the PC load.',
  },
];

const ALLOCATION_SLOTS = [
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

const LOCAL_ALLOCATION_PRESET_METADATA = {
  slots: ALLOCATION_SLOTS.map((slot) => slot.value),
  profiles: {
  gaming: { cpu: 18, gpu: 33, ram: 7, motherboard: 10, ssd: 10, psu: 8, case: 7, cpu_cooler: 5, fan_cooler: 2 },
  productivity: { cpu: 27, gpu: 17, ram: 12, motherboard: 12, ssd: 14, psu: 7, case: 6, cpu_cooler: 4, fan_cooler: 1 },
  content_creation: { cpu: 24, gpu: 26, ram: 12, motherboard: 10, ssd: 13, psu: 7, case: 4, cpu_cooler: 3, fan_cooler: 1 },
  office: { cpu: 28, gpu: 0, ram: 12, motherboard: 18, ssd: 20, psu: 8, case: 8, cpu_cooler: 5, fan_cooler: 1 },
  student: { cpu: 22, gpu: 16, ram: 12, motherboard: 14, ssd: 14, psu: 8, case: 8, cpu_cooler: 5, fan_cooler: 1 },
  },
};

const MIN_BUDGET_IDR = 3_000_000;

const LOADING_STATUS = {
  ai: {
    title: 'AI BUILD IN PROGRESS',
    message: 'Local AI is ranking real catalog candidates, checking compatibility, and preparing a safe fallback if needed. This can take about a minute.',
  },
  build: {
    title: 'GENERATING',
    message: 'Building a compatible parts list.',
  },
};

function errorMessage(error) {
  if (!error) return '';
  if (typeof error === 'string') return error;
  return error.message || 'Could not generate a build.';
}

function activeBuildBudget(build) {
  return build?.budget_idr ?? build?.recommendation?.budget_idr ?? 0;
}

function activeBuildComponents(build) {
  return build?.components || build?.recommendation?.components || {};
}

function activeBuildUseCase(build, fallbackUseCase) {
  return build?.use_case || build?.recommendation?.use_case || fallbackUseCase;
}

function activeBuildKey(build, fallbackUseCase) {
  if (!build) return 'empty';

  const components = activeBuildComponents(build);
  const componentKey = Object.entries(components || {})
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([slot, component]) => `${slot}:${component?.sku || component?.id || 'empty'}`)
    .join(',');

  return [
    activeBuildBudget(build),
    activeBuildUseCase(build, fallbackUseCase),
    build?.total_idr ?? build?.recommendation?.total_idr ?? 0,
    componentKey,
  ].join('|');
}

function normalizeAllocationPresetMetadata(metadata) {
  const profiles = metadata?.profiles;
  if (!profiles || typeof profiles !== 'object') return LOCAL_ALLOCATION_PRESET_METADATA;

  return {
    slots: Array.isArray(metadata.slots) ? metadata.slots : LOCAL_ALLOCATION_PRESET_METADATA.slots,
    profiles,
  };
}

function allocationProfileForUseCase(useCase, metadata = LOCAL_ALLOCATION_PRESET_METADATA) {
  return { ...(metadata.profiles[useCase] || metadata.profiles.gaming || LOCAL_ALLOCATION_PRESET_METADATA.profiles.gaming) };
}

function optionLabel(options, value) {
  return options.find((option) => option.value === value)?.label || value;
}

function suggestedAllocationLabel(useCase) {
  return optionLabel(USE_CASE_OPTIONS, useCase);
}

function allocationTotal(allocations) {
  return ALLOCATION_SLOTS.reduce((total, slot) => total + Number(allocations[slot.value] || 0), 0);
}



function normalizeAllocationProfile(profile) {
  const next = {};
  ALLOCATION_SLOTS.forEach((slot) => {
    next[slot.value] = cleanAllocationValue(profile[slot.value] || 0);
  });

  let total = allocationTotal(next);
  const addSlots = ['gpu', 'cpu', ...ALLOCATION_SLOTS.map((slot) => slot.value)];
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

function suggestedAllocationProfile(useCase, metadata = LOCAL_ALLOCATION_PRESET_METADATA) {
  const useCaseProfile = allocationProfileForUseCase(useCase, metadata);
  return normalizeAllocationProfile(useCaseProfile);
}

function cleanAllocationValue(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.max(0, Math.min(100, Math.round(number)));
}

export default function BuildWizard() {
  const [budget, setBudget] = useState('');
  const [useCase, setUseCase] = useState('gaming');
  const [cpuBrand, setCpuBrand] = useState('');
  const [gpuVendor, setGpuVendor] = useState('');
  const [budgetRanges, setBudgetRanges] = useState(LOCAL_USE_CASE_BUDGET_RANGES);

  const [recommendationMode, setRecommendationMode] = useState('ai');
  const [aiProfile, setAiProfile] = useState('gemini_free');
  const [allocationPresetMetadata, setAllocationPresetMetadata] = useState(LOCAL_ALLOCATION_PRESET_METADATA);
  const [allocationPresetSource, setAllocationPresetSource] = useState('local');
  const [advancedAllocationEnabled, setAdvancedAllocationEnabled] = useState(false);
  const [allocationOverrides, setAllocationOverrides] = useState(() => suggestedAllocationProfile('gaming'));
  const [allocationMode, setAllocationMode] = useState('suggested');
  const [pendingSuggestedAllocation, setPendingSuggestedAllocation] = useState(null);
  const [allocationError, setAllocationError] = useState('');
  const [selectedOptionalAddons, setSelectedOptionalAddons] = useState({
    hdd: false,
    monitor: false,
    ups: false,
  });
  const [submittedOptionalAddons, setSubmittedOptionalAddons] = useState([]);
  const [build, setBuild] = useState(null);
  const [error, setError] = useState('');
  const [loadingMode, setLoadingMode] = useState('');
  const [swapTarget, setSwapTarget] = useState(null);
  const [referencedSlot, setReferencedSlot] = useState('');
  const requestSequence = useRef(0);

  const loading = Boolean(loadingMode);
  const currentAllocationTotal = allocationTotal(allocationOverrides);
  const currentSuggestionLabel = suggestedAllocationLabel(useCase);

  useEffect(() => {
    let cancelled = false;
    api.listAllocationPresets()
      .then((metadata) => {
        if (cancelled) return;
        const normalized = normalizeAllocationPresetMetadata(metadata);
        setAllocationPresetMetadata(normalized);
        setAllocationPresetSource('backend');
        setAllocationOverrides((current) => {
          if (allocationMode === 'custom') return current;
          return suggestedAllocationProfile(useCase, normalized);
        });
      })
      .catch(() => {
        if (!cancelled) setAllocationPresetSource('local');
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    api.listUseCases?.().then((data) => {
      if (data?.use_cases) {
        const ranges = {};
        for (const uc of data.use_cases) {
          if (uc.budget_range) ranges[uc.key] = uc.budget_range;
        }
        if (Object.keys(ranges).length > 0) setBudgetRanges(ranges);
      }
    }).catch(() => {});
  }, []);

  async function submitBuild() {
    const budgetIdr = parseIDR(budget);
    const aiAssisted = recommendationMode === 'ai';

    if (budgetIdr < MIN_BUDGET_IDR) {
      setError('Budget is too low. Minimum Rp 3 juta for a reasonable PC build.');
      setBuild(null);
      return;
    }

    if (advancedAllocationEnabled && currentAllocationTotal !== 100) {
      setAllocationError(`Advanced allocation must total 100%. Current total is ${currentAllocationTotal}%.`);
      setBuild(null);
      return;
    }

    const requestId = requestSequence.current + 1;
    requestSequence.current = requestId;
    setError('');
    setAllocationError('');
    setLoadingMode(aiAssisted ? 'ai' : 'build');

    try {
      const optionalAddonList = OPTIONAL_ADDON_OPTIONS
        .filter((addon) => selectedOptionalAddons[addon.value])
        .map((addon) => addon.value);
      const payload = {
        budgetIdr,
        useCase,
        cpuBrand,
        gpuVendor,

        aiProfile: aiAssisted ? aiProfile : undefined,
        allocationOverrides: advancedAllocationEnabled ? allocationOverrides : undefined,
        includeOptionalAddons: optionalAddonList.length > 0,
        selectedOptionalAddons: optionalAddonList,
      };
      const nextBuild = aiAssisted
        ? await api.recommendAiBuild(payload)
        : await api.recommendBuild(payload);
      if (requestSequence.current !== requestId) return;
      setBuild(nextBuild);
      setSubmittedOptionalAddons(optionalAddonList);
      setSwapTarget(null);
      setReferencedSlot('');
    } catch (nextError) {
      if (requestSequence.current !== requestId) return;
      setError(errorMessage(nextError));
      setBuild(null);
      setSubmittedOptionalAddons([]);
      setReferencedSlot('');
    } finally {
      if (requestSequence.current === requestId) {
        setLoadingMode('');
      }
    }
  }

  function handleSubmit(event) {
    event.preventDefault();
    submitBuild();
  }

  function toggleOptionalAddon(addon, checked) {
    setSelectedOptionalAddons((current) => ({
      ...current,
      [addon]: checked,
    }));
  }

  function syncSuggestedAllocation({ nextUseCase = useCase } = {}) {
    const nextAllocation = suggestedAllocationProfile(nextUseCase, allocationPresetMetadata);
    if (allocationMode === 'custom') {
      setPendingSuggestedAllocation(nextAllocation);
    } else {
      setAllocationOverrides(nextAllocation);
      setPendingSuggestedAllocation(null);
    }
    setAllocationError('');
  }

  function handleUseCaseChange(event) {
    const nextUseCase = event.target.value;
    setUseCase(nextUseCase);
    syncSuggestedAllocation({ nextUseCase });
  }

  function toggleAdvancedAllocation(event) {
    const enabled = event.target.checked;
    setAdvancedAllocationEnabled(enabled);
    setAllocationOverrides(suggestedAllocationProfile(useCase, allocationPresetMetadata));
    setAllocationMode('suggested');
    setPendingSuggestedAllocation(null);
    setAllocationError('');
  }

  function updateAllocation(slot, value) {
    setAllocationOverrides((current) => ({
      ...current,
      [slot]: cleanAllocationValue(value),
    }));
    setAllocationMode('custom');
    setPendingSuggestedAllocation(null);
    setAllocationError('');
  }

  function resetAllocation() {
    setAllocationOverrides(suggestedAllocationProfile(useCase, allocationPresetMetadata));
    setAllocationMode('suggested');
    setPendingSuggestedAllocation(null);
    setAllocationError('');
  }

  function applyPendingSuggestedAllocation() {
    if (!pendingSuggestedAllocation) return;
    setAllocationOverrides(pendingSuggestedAllocation);
    setAllocationMode('suggested');
    setPendingSuggestedAllocation(null);
    setAllocationError('');
  }

  async function pickSwap(component) {
    if (!build || !swapTarget) return;

    const requestId = requestSequence.current + 1;
    requestSequence.current = requestId;
    const buildComponents = activeBuildComponents(build);
    const nextComponentId = component?.sku || component?.id;
    setError('');

    try {
      const nextBuild = await api.swapComponent({
        budgetIdr: activeBuildBudget(build),
        useCase: activeBuildUseCase(build, useCase),
        slot: swapTarget.slot,
        newComponentId: nextComponentId,
        currentBuild: buildComponents,
      });
      if (requestSequence.current !== requestId) return;
      setBuild(nextBuild);
      setSwapTarget(null);
      setReferencedSlot('');
    } catch (nextError) {
      if (requestSequence.current !== requestId) return;
      setError(errorMessage(nextError));
      throw nextError;
    }
  }

  const parsedBudget = parseIDR(budget);
  const currentRange = budgetRanges[useCase] || LOCAL_USE_CASE_BUDGET_RANGES.gaming;
  const budgetBelowMin = parsedBudget > 0 && parsedBudget < currentRange.min_idr;
  const buildComponents = activeBuildComponents(build);
  const buildBudgetIdr = activeBuildBudget(build);
  const buildUseCase = activeBuildUseCase(build, useCase);
  const buildKey = activeBuildKey(build, useCase);
  const loadingStatus = LOADING_STATUS[loadingMode] || LOADING_STATUS.build;

  function focusReferencedSlot(slot) {
    setReferencedSlot(slot);
    window.requestAnimationFrame(() => {
      const row = Array.from(document.querySelectorAll('[data-part-slot]'))
        .find((element) => element.getAttribute('data-part-slot') === slot);
      if (!row) return;
      row.focus({ preventScroll: true });
      row.scrollIntoView({ block: 'center', behavior: 'smooth' });
    });
  }

  function reviewSwapSuggestion(suggestion) {
    const slot = suggestion?.slot;
    if (!slot) return;
    const currentComponent = buildComponents?.[slot];
    setSwapTarget({
      slot,
      currentSku: currentComponent?.sku || currentComponent?.id || suggestion?.current?.sku || suggestion?.current?.id || '',
      preferredSku: suggestion?.candidate?.sku || suggestion?.candidate?.id || '',
    });
  }

  return (
    <div className="workflow-stack">
      <form className="retro-form-grid" onSubmit={handleSubmit}>
        <RetroInput
          label="Budget (IDR)"
          name="budget"
          inputMode="numeric"
          placeholder="20.000.000"
          value={budget}
          onChange={(event) => setBudget(event.target.value)}
        />
        <RetroSelect
          label="Use case"
          name="use-case"
          options={USE_CASE_OPTIONS}
          value={useCase}
          onChange={handleUseCaseChange}
        />
        <div className="budget-slider-group">
          <input
            type="range"
            className="retro-slider"
            aria-label="Budget slider"
            min={currentRange.min_idr}
            max={currentRange.max_idr}
            step={500_000}
            value={Math.min(Math.max(parsedBudget || currentRange.min_idr, currentRange.min_idr), currentRange.max_idr)}
            onChange={(e) => setBudget(String(Number(e.target.value)))}
          />
          <div className="budget-slider-labels">
            <small>{formatIDR(currentRange.min_idr)}</small>
            <small>{formatIDR(currentRange.max_idr)}</small>
          </div>
          {budgetBelowMin && (
            <p className="budget-range-warning" role="alert">
              ⚠️ Below recommended minimum for {optionLabel(USE_CASE_OPTIONS, useCase)} ({formatIDR(currentRange.min_idr)}). Results may not be optimal.
            </p>
          )}
        </div>
        <RetroSelect
          label="CPU"
          name="cpu-brand"
          options={CPU_OPTIONS}
          value={cpuBrand}
          onChange={(event) => setCpuBrand(event.target.value)}
        />
        <RetroSelect
          label="GPU"
          name="gpu-vendor"
          options={GPU_OPTIONS}
          value={gpuVendor}
          onChange={(event) => setGpuVendor(event.target.value)}
        />

        <div className="advanced-allocation-control">
          <label className={`retro-checkbox advanced-allocation-toggle ${advancedAllocationEnabled ? 'selected' : ''}`}>
            <input
              type="checkbox"
              aria-label="Use advanced allocation"
              checked={advancedAllocationEnabled}
              disabled={loading}
              onChange={toggleAdvancedAllocation}
            />
            <span>
              <strong>Use advanced allocation</strong>
              <small>Adjust how the core tower budget is split before compatibility checks run.</small>
              <small>{allocationPresetSource === 'backend' ? 'Backend allocation presets loaded.' : 'Using local allocation fallback.'}</small>
            </span>
          </label>
          {advancedAllocationEnabled && (
            <fieldset className="advanced-allocation-panel">
              <legend className="retro-field-label">Advanced allocation</legend>
              <div className={`allocation-total ${currentAllocationTotal === 100 ? 'is-valid' : 'is-invalid'}`}>
                <strong>Total</strong>
                <span>{currentAllocationTotal}%</span>
              </div>
              <div className="allocation-source">
                <strong>{allocationMode === 'custom' ? 'Custom allocation' : `Suggested by: ${currentSuggestionLabel}`}</strong>
                {pendingSuggestedAllocation && (
                  <span>
                    Suggested allocation changed. Apply suggested split?
                    <RetroButton type="button" className="retro-button-secondary" disabled={loading} onClick={applyPendingSuggestedAllocation}>
                      Apply suggested allocation
                    </RetroButton>
                  </span>
                )}
              </div>
              <div className="allocation-grid">
                {ALLOCATION_SLOTS.map((slot) => (
                  <div className="allocation-row" key={slot.value}>
                    <span className="allocation-slot-label">{slot.label}</span>
                    <input
                      aria-label={`${slot.label} allocation slider`}
                      className="allocation-slider"
                      type="range"
                      min="0"
                      max="60"
                      step="1"
                      value={allocationOverrides[slot.value] || 0}
                      disabled={loading}
                      onChange={(event) => updateAllocation(slot.value, event.target.value)}
                    />
                    <input
                      aria-label={`${slot.label} allocation percent`}
                      className="allocation-number"
                      type="number"
                      min="0"
                      max="100"
                      step="1"
                      value={allocationOverrides[slot.value] || 0}
                      disabled={loading}
                      onChange={(event) => updateAllocation(slot.value, event.target.value)}
                    />
                    <span className="allocation-percent">%</span>
                  </div>
                ))}
              </div>
              {allocationError && (
                <p className="allocation-error" role="alert">{allocationError}</p>
              )}
              <div className="allocation-actions">
                <RetroButton type="button" className="retro-button-secondary" disabled={loading} onClick={resetAllocation}>
                  Reset allocation
                </RetroButton>
              </div>
            </fieldset>
          )}
        </div>
        <fieldset className="retro-mode-field">
          <legend className="retro-field-label">Recommendation mode</legend>
          <div className="retro-mode-options">
            {RECOMMENDATION_MODES.map((mode) => (
              <label
                className={`retro-mode-option ${recommendationMode === mode.value ? 'selected' : ''}`}
                key={mode.value}
              >
                <input
                  type="radio"
                  name="recommendation-mode"
                  value={mode.value}
                  checked={recommendationMode === mode.value}
                  disabled={loading}
                  onChange={(event) => setRecommendationMode(event.target.value)}
                />
                <span>
                  <strong>{mode.label}</strong>
                  <small>{mode.description}</small>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
        {recommendationMode === 'ai' && (
          <RetroSelect
            label="AI profile"
            name="ai-profile"
            options={AI_PROFILE_OPTIONS}
            value={aiProfile}
            onChange={(event) => setAiProfile(event.target.value)}
          />
        )}
        <fieldset className="retro-optional-field">
          <legend className="retro-field-label">Optional add-ons</legend>
          <div className="retro-optional-options">
            {OPTIONAL_ADDON_OPTIONS.map((addon) => (
              <label
                className={`retro-checkbox retro-optional-option ${
                  selectedOptionalAddons[addon.value] ? 'selected' : ''
                }`}
                key={addon.value}
              >
                <input
                  type="checkbox"
                  checked={selectedOptionalAddons[addon.value]}
                  disabled={loading}
                  onChange={(event) => toggleOptionalAddon(addon.value, event.target.checked)}
                />
                <span>
                  <strong>{addon.label}</strong>
                  <small>{addon.description}</small>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
        <div className="retro-actions" style={{ gridColumn: '1 / -1' }}>
          <RetroButton type="submit" disabled={loading} loading={loading}>
            Generate build
          </RetroButton>
        </div>
      </form>

      {loading && (
        <StatusPanel
          tone="processing"
          title={loadingStatus.title}
          message={loadingStatus.message}
        />
      )}

      {error && (
        <StatusPanel
          tone="error"
          title="BUILD FAILED"
          message={error}
        />
      )}

      {!loading && !error && build && (
        <StatusPanel
          tone="success"
          title="BUILD READY"
          message={`Generated for ${parsedBudget ? formatIDR(parsedBudget) : 'your budget'}.`}
        />
      )}

      <BuildResults
        build={build}
        mode="build"
        highlightedSlot={referencedSlot}
        selectedOptionalAddons={submittedOptionalAddons}
        onSwap={(slot, currentSku) => setSwapTarget({ slot, currentSku })}
      />

      {build && (
        <AdvisorConsole
          key={buildKey}
          mode="build"
          context={build}
          onReferenceSlot={focusReferencedSlot}
          onReviewSwapSuggestion={reviewSwapSuggestion}
        />
      )}

      {swapTarget && build && (
        <SwapModal
          slot={swapTarget.slot}
          budgetIdr={buildBudgetIdr}
          useCase={buildUseCase}
          currentBuild={buildComponents}
          currentSku={swapTarget.currentSku}
          preferredSku={swapTarget.preferredSku}
          onClose={() => setSwapTarget(null)}
          onPick={pickSwap}
        />
      )}
    </div>
  );
}
