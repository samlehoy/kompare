'use client';

import { useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { RetroButton, RetroInput, RetroSelect, RetroTextarea } from '@/components/ui/FormControls.jsx';
import StatusPanel from '@/components/ui/StatusPanel.jsx';
import { api } from '@/lib/api.js';
import { writeAuditUpgradePrefill } from '@/lib/storage.js';
import { SLOT_ORDER, slotLabel, specLabel, formatSpecValue } from '@/lib/slots.js';

const BUILD_GOALS = [
  { value: 'General Gaming', label: 'General Gaming' },
  { value: 'Esports/FPS', label: 'Esports/FPS' },
  { value: '1080p', label: '1080p' },
  { value: '1440p', label: '1440p' },
  { value: 'Content Creation', label: 'Content Creation' },
  { value: 'Office/Student', label: 'Office/Student' },
];

const UPGRADE_SLOTS = new Set(SLOT_ORDER);

function errorMessage(error) {
  if (!error) return 'Could not audit this PC build.';
  if (typeof error === 'string') return error;
  return error.message || 'Could not audit this PC build.';
}

function coerceAudit(response) {
  return response?.audit || response || null;
}

function coerceText(value) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) return value.map(coerceText).filter(Boolean).join(', ');

  const preferredValue = value.name ?? value.model ?? value.value ?? value.component;
  if (preferredValue !== undefined && preferredValue !== value) {
    const preferredText = coerceText(preferredValue);
    if (preferredText) return preferredText;
  }

  const entries = Object.entries(value)
    .map(([key, entryValue]) => {
      const text = coerceText(entryValue);
      return text ? `${key.replace(/_/g, ' ')}: ${text}` : '';
    })
    .filter(Boolean);
  if (entries.length > 0) return entries.join(', ');

  try {
    return JSON.stringify(value) || '';
  } catch {
    return '';
  }
}

function normalizeDetectedParts(value) {
  if (!value) return [];

  const parts = Array.isArray(value)
    ? value.map((part, index) => ({ part, fallbackSlot: part?.slot || `part-${index}` }))
    : Object.entries(value).map(([slot, part]) => ({ part, fallbackSlot: slot }));

  return parts
    .map(({ part, fallbackSlot }, index) => {
      const item = typeof part === 'object' && part !== null ? part : { name: part };
      const slot = item.slot || fallbackSlot;
      const specs = item.extracted_specs || item.specs || item.attributes || {};
      const name = coerceText(item.name ?? item.component ?? item.value ?? item.model);

      return {
        key: `${slot}-${name || index}`,
        slot,
        slotLabel: item.slot_label || item.label || slotLabel(slot),
        name,
        confidence: item.confidence,
        source: item.source,
        specs,
      };
    })
    .filter((part) => part.slot || part.name);
}

function normalizeTextList(value) {
  if (!value) return [];
  const list = Array.isArray(value) ? value : Object.values(value);
  return list.map(coerceText).filter(Boolean);
}

function normalizeIssues(value) {
  if (!value) return [];
  const list = Array.isArray(value) ? value : Object.values(value);
  return list
    .map((issue, index) => {
      if (typeof issue === 'string') {
        return { key: issue, title: issue, message: '', severity: '' };
      }

      const title = issue?.title || issue?.slot || issue?.severity || `Issue ${index + 1}`;
      return {
        key: `${coerceText(title)}-${coerceText(issue?.message) || index}`,
        title: coerceText(title),
        message: coerceText(issue?.message || issue?.description),
        recommendation: coerceText(issue?.recommendation || issue?.next_step),
        severity: coerceText(issue?.severity),
      };
    })
    .filter((issue) => issue.title || issue.message);
}

function formatConfidence(value) {
  if (value === null || value === undefined || value === '') return '';
  const number = Number(value);
  if (!Number.isFinite(number)) return coerceText(value);
  return `${Math.round((number <= 1 ? number * 100 : number))}% confidence`;
}

function specEntries(slot, specs) {
  if (!specs || typeof specs !== 'object') return [];
  return Object.entries(specs)
    .map(([key, value]) => {
      if (value === null || value === undefined || value === '') return null;
      const formattedValue = Array.isArray(value)
        ? value.map(coerceText).filter(Boolean).join(', ')
        : (typeof value === 'object' ? coerceText(value) : formatSpecValue(key, value));
      return {
        key,
        label: specLabel(slot, key),
        value: formattedValue,
      };
    })
    .filter((spec) => spec?.value);
}

function statusLabel(status) {
  return String(status || 'audit result').replace(/_/g, ' ');
}

function DetailList({ items, title }) {
  if (items.length === 0) return null;

  return (
    <div className="audit-detail-list">
      <strong>{title}</strong>
      <ul>
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

function DetectedPart({ part }) {
  const specs = specEntries(part.slot, part.specs);
  const confidence = formatConfidence(part.confidence);
  const meta = [confidence, part.source && `from ${part.source}`].filter(Boolean).join(' ');

  return (
    <article className="audit-part-row">
      <div className="audit-part-slot">{part.slotLabel}</div>
      <div className="audit-part-body">
        <h3>{part.name || 'Unnamed detected part'}</h3>
        {meta && <p>{meta}</p>}
        {specs.length > 0 && (
          <div className="spec-pills" aria-label={`${part.slotLabel} specs`}>
            {specs.map((spec) => (
              <span key={spec.key} className="spec-pill">
                <strong>{spec.label}</strong>
                <span>{spec.value}</span>
              </span>
            ))}
          </div>
        )}
      </div>
    </article>
  );
}

export default function BuildAudit() {
  const router = useRouter();
  const [file, setFile] = useState(null);
  const [partsList, setPartsList] = useState('');
  const [goal, setGoal] = useState('General Gaming');
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const requestSequence = useRef(0);

  const audit = coerceAudit(result);
  const detectedParts = useMemo(() => normalizeDetectedParts(audit?.detected_parts), [audit]);
  const compatibilityIssues = useMemo(() => normalizeIssues(audit?.compatibility_issues || audit?.issues), [audit]);
  const missingSlots = useMemo(() => normalizeTextList(audit?.missing_slots), [audit]);
  const budgetNotes = useMemo(() => normalizeTextList(audit?.budget_notes), [audit]);
  const nextSteps = useMemo(() => normalizeTextList(audit?.suggested_next_steps || audit?.next_steps), [audit]);

  const applicableParts = useMemo(() => (
    detectedParts.filter((part) => UPGRADE_SLOTS.has(part.slot) && part.name)
  ), [detectedParts]);

  async function handleSubmit(event) {
    event.preventDefault();

    const trimmedPartsList = partsList.trim();
    if (!file && !trimmedPartsList) {
      setResult(null);
      setError('Paste a parts list or upload a cart screenshot first.');
      return;
    }

    const requestId = requestSequence.current + 1;
    requestSequence.current = requestId;
    setLoading(true);
    setError('');

    try {
      const nextResult = await api.auditBuild({
        image: file,
        goal,
        partsList: trimmedPartsList,
      });
      if (requestSequence.current !== requestId) return;
      setResult(nextResult);
    } catch (nextError) {
      if (requestSequence.current !== requestId) return;
      setResult(null);
      setError(errorMessage(nextError));
    } finally {
      if (requestSequence.current === requestId) {
        setLoading(false);
      }
    }
  }

  function applyDetectedParts() {
    const parts = {};
    for (const part of applicableParts) {
      if (!parts[part.slot]) parts[part.slot] = part.name;
    }

    const count = Object.keys(parts).length;
    if (count === 0) return;
    writeAuditUpgradePrefill({ parts, count });
    router.push('/upgrade');
  }

  return (
    <div className="workflow-stack build-audit">
      <form className="audit-form" onSubmit={handleSubmit}>
        <RetroInput
          label="Cart screenshot"
          name="cart-screenshot"
          type="file"
          accept="image/png,image/jpeg,image/webp"
          onChange={(event) => setFile(event.target.files?.[0] || null)}
        />
        <RetroSelect
          label="Build goal"
          name="build-goal"
          options={BUILD_GOALS}
          value={goal}
          onChange={(event) => setGoal(event.target.value)}
        />
        <RetroTextarea
          label="Parts list"
          name="parts-list"
          fieldClassName="audit-parts-field"
          rows={6}
          placeholder={'CPU: Ryzen 5 5600\nGPU: RTX 3060 12GB'}
          value={partsList}
          onChange={(event) => setPartsList(event.target.value)}
        />
        <div className="retro-actions audit-actions">
          <RetroButton type="submit" loading={loading}>
            Audit build
          </RetroButton>
        </div>
      </form>

      {loading && (
        <StatusPanel
          tone="processing"
          title="AUDITING"
          message="Checking detected parts, compatibility, and missing build details."
        />
      )}

      {error && (
        <StatusPanel
          tone="error"
          title="AUDIT FAILED"
          message={error}
        />
      )}

      {!loading && audit && (
        <section className="audit-result" aria-label="Build audit result">
          <StatusPanel
            tone={compatibilityIssues.length > 0 ? 'warning' : 'success'}
            title={statusLabel(audit.status).toUpperCase()}
            message={audit.summary || 'Audit complete.'}
          />

          {applicableParts.length > 0 && (
            <div className="retro-actions audit-apply-actions">
              <RetroButton type="button" onClick={applyDetectedParts}>
                Apply detected parts
              </RetroButton>
            </div>
          )}

          {detectedParts.length > 0 && (
            <div className="audit-section" aria-label="Detected parts">
              <h2>Detected parts</h2>
              <div className="audit-part-list">
                {detectedParts.map((part) => (
                  <DetectedPart key={part.key} part={part} />
                ))}
              </div>
            </div>
          )}

          {compatibilityIssues.length > 0 && (
            <div className="audit-section" aria-label="Compatibility issues">
              <h2>Compatibility issues</h2>
              <div className="audit-issue-list">
                {compatibilityIssues.map((issue) => (
                  <article key={issue.key} className="audit-issue">
                    {issue.severity && <span>{issue.severity}</span>}
                    <strong>{issue.title}</strong>
                    {issue.message && <p>{issue.message}</p>}
                    {issue.recommendation && <small>{issue.recommendation}</small>}
                  </article>
                ))}
              </div>
            </div>
          )}

          <div className="audit-detail-grid">
            <DetailList title="Missing slots" items={missingSlots} />
            <DetailList title="Budget notes" items={budgetNotes} />
            <DetailList title="Next steps" items={nextSteps} />
          </div>
        </section>
      )}
    </div>
  );
}
