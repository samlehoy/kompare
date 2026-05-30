'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import AdvisorConsole from '@/components/advisor/AdvisorConsole.jsx';
import BuildResults from '@/components/results/BuildResults.jsx';
import { RetroButton, RetroInput, RetroSelect, RetroTextarea } from '@/components/ui/FormControls.jsx';
import StatusPanel from '@/components/ui/StatusPanel.jsx';
import { api } from '@/lib/api.js';
import { parseIDR } from '@/lib/format.js';
import { clearAuditUpgradePrefill, readAuditUpgradePrefill } from '@/lib/storage.js';

const DEFAULT_BUDGET = '7.000.000';

const USE_CASE_OPTIONS = [
  { value: 'gaming', label: 'Gaming' },
  { value: 'productivity', label: 'Productivity' },
  { value: 'content_creation', label: 'Content creation' },
  { value: 'office', label: 'Office' },
  { value: 'student', label: 'Student' },
];

const PART_FIELDS = [
  { name: 'cpu', label: 'CPU' },
  { name: 'motherboard', label: 'Motherboard' },
  { name: 'ram', label: 'RAM' },
  { name: 'gpu', label: 'GPU' },
  { name: 'ssd', label: 'SSD' },
  { name: 'hdd', label: 'HDD' },
  { name: 'psu', label: 'PSU' },
  { name: 'cpu_cooler', label: 'CPU Cooler' },
  { name: 'fan_cooler', label: 'Fan Cooler' },
  { name: 'case', label: 'Case' },
];

const EMPTY_PARTS = PART_FIELDS.reduce((parts, field) => ({
  ...parts,
  [field.name]: '',
}), {});

const FIELD_LABELS = PART_FIELDS.reduce((labels, field) => ({
  ...labels,
  [field.name]: field.label,
}), {});

function errorMessage(error) {
  if (!error) return 'Could not generate an upgrade recommendation.';
  if (typeof error === 'string') return error;
  return error.message || 'Could not generate an upgrade recommendation.';
}

function coerceText(value) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return value.name || value.model || value.value || JSON.stringify(value);
}

function mergePrefillParts(currentParts, prefillParts) {
  if (!prefillParts || typeof prefillParts !== 'object') return currentParts;

  return PART_FIELDS.reduce((nextParts, field) => {
    const value = coerceText(prefillParts[field.name]);
    if (!value) return nextParts;
    return {
      ...nextParts,
      [field.name]: value,
    };
  }, currentParts);
}

function recognizedEntries(recognized) {
  if (!recognized) return [];
  if (Array.isArray(recognized)) {
    return recognized
      .map((item, index) => ({
        key: item?.slot || item?.label || `recognized-${index}`,
        label: item?.label || FIELD_LABELS[item?.slot] || item?.slot || `Part ${index + 1}`,
        value: coerceText(item?.value ?? item?.name ?? item?.component ?? item),
      }))
      .filter((item) => item.value);
  }

  if (typeof recognized !== 'object') return [];
  return Object.entries(recognized)
    .map(([slot, value]) => ({
      key: slot,
      label: FIELD_LABELS[slot] || slot.replace(/_/g, ' '),
      value: coerceText(value),
    }))
    .filter((item) => item.value);
}

function priorityEntries(priorities) {
  if (!priorities) return [];
  const priorityList = Array.isArray(priorities) ? priorities : Object.values(priorities);
  return priorityList
    .map((priority, index) => {
      if (typeof priority === 'string') {
        return { key: priority, title: priority, reason: '' };
      }
      const title = priority?.title || priority?.slot || `Priority ${index + 1}`;
      return {
        key: `${title}-${index}`,
        title,
        reason: priority?.reason || priority?.description || priority?.message || '',
      };
    })
    .filter((priority) => priority.title);
}

function upgradeResultKey(result) {
  if (!result) return 'empty';
  const recommendation = result.recommendation || result;
  const components = recommendation.components || {};
  return [
    recommendation.budget_idr || result.budget_idr || 0,
    recommendation.total_idr || result.total_idr || 0,
    Object.entries(components)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([slot, component]) => `${slot}:${component?.sku || component?.id || component?.name || 'empty'}`)
      .join(','),
  ].join('|');
}

export default function UpgradePlanner() {
  const [budgetText, setBudgetText] = useState(DEFAULT_BUDGET);
  const [useCase, setUseCase] = useState('gaming');
  const [parts, setParts] = useState(EMPTY_PARTS);
  const [notes, setNotes] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [referencedSlot, setReferencedSlot] = useState('');
  const requestSequence = useRef(0);

  useEffect(() => {
    const prefill = readAuditUpgradePrefill();
    if (prefill?.parts) {
      setParts((currentParts) => mergePrefillParts(currentParts, prefill.parts));
    }
    clearAuditUpgradePrefill();
  }, []);

  const recognized = useMemo(() => recognizedEntries(result?.recognized_existing), [result]);
  const priorities = useMemo(() => priorityEntries(result?.upgrade_priorities), [result]);
  const resultKey = upgradeResultKey(result);

  function updatePart(name, value) {
    setParts((currentParts) => ({
      ...currentParts,
      [name]: value,
    }));
  }

  function existingComponentsForSubmit() {
    const existingComponents = PART_FIELDS.reduce((components, field) => ({
      ...components,
      [field.name]: parts[field.name].trim(),
    }), {});
    const trimmedNotes = notes.trim();
    if (trimmedNotes) existingComponents.notes = trimmedNotes;
    return existingComponents;
  }

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

  async function handleSubmit(event) {
    event.preventDefault();

    const requestId = requestSequence.current + 1;
    requestSequence.current = requestId;
    setLoading(true);
    setError('');

    try {
      const nextResult = await api.recommendUpgrade({
        budgetIdr: parseIDR(budgetText),
        useCase,
        existingComponents: existingComponentsForSubmit(),
      });
      if (requestSequence.current !== requestId) return;
      setResult(nextResult);
      setReferencedSlot('');
    } catch (nextError) {
      if (requestSequence.current !== requestId) return;
      setResult(null);
      setReferencedSlot('');
      setError(errorMessage(nextError));
    } finally {
      if (requestSequence.current === requestId) {
        setLoading(false);
      }
    }
  }

  return (
    <div className="workflow-stack upgrade-planner">
      <form className="upgrade-form" onSubmit={handleSubmit}>
        <div className="retro-form-grid">
          <RetroInput
            label="Upgrade budget (IDR)"
            name="upgrade-budget"
            inputMode="numeric"
            value={budgetText}
            onChange={(event) => setBudgetText(event.target.value)}
          />
          <RetroSelect
            label="Use case"
            name="upgrade-use-case"
            options={USE_CASE_OPTIONS}
            value={useCase}
            onChange={(event) => setUseCase(event.target.value)}
          />
        </div>

        <div className="upgrade-part-grid" aria-label="Existing parts">
          {PART_FIELDS.map((field) => (
            <RetroInput
              key={field.name}
              label={field.label}
              name={`existing-${field.name}`}
              value={parts[field.name]}
              onChange={(event) => updatePart(field.name, event.target.value)}
            />
          ))}
        </div>

        <RetroTextarea
          label="Additional notes"
          name="upgrade-notes"
          rows={4}
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
        />

        <div className="retro-actions">
          <RetroButton type="submit" loading={loading}>
            Recommend upgrade
          </RetroButton>
        </div>
      </form>

      {loading && (
        <StatusPanel
          tone="processing"
          title="RECOMMENDING"
          message="Checking your existing parts against the current upgrade budget."
        />
      )}

      {error && (
        <StatusPanel
          tone="error"
          title="UPGRADE FAILED"
          message={error}
        />
      )}

      {!loading && result && (
        <>
          {recognized.length > 0 && (
            <StatusPanel title="Recognized existing components" className="upgrade-recognized-panel">
              <dl className="upgrade-recognized-list">
                {recognized.map((item) => (
                  <div key={item.key}>
                    <dt>{item.label}</dt>
                    <dd>{item.value}</dd>
                  </div>
                ))}
              </dl>
            </StatusPanel>
          )}

          {priorities.length > 0 && (
            <StatusPanel title="Upgrade priorities" className="upgrade-priority-panel">
              <ol className="upgrade-priority-list">
                {priorities.map((priority) => (
                  <li key={priority.key}>
                    <strong>{priority.title}</strong>
                    {priority.reason && <p>{priority.reason}</p>}
                  </li>
                ))}
              </ol>
            </StatusPanel>
          )}

          <BuildResults
            build={result}
            mode="upgrade"
            highlightedSlot={referencedSlot}
          />

          <AdvisorConsole
            key={resultKey}
            mode="upgrade"
            context={result}
            onReferenceSlot={focusReferencedSlot}
          />
        </>
      )}
    </div>
  );
}
