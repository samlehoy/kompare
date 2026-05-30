'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import RetroWindow from '@/components/shell/RetroWindow.jsx';
import { RetroButton, RetroInput } from '@/components/ui/FormControls.jsx';
import StatusPanel from '@/components/ui/StatusPanel.jsx';
import { api } from '@/lib/api.js';
import { formatIDR } from '@/lib/format.js';
import { SWAP_SPEC_KEYS, slotLabel, specPills } from '@/lib/slots.js';

function errorMessage(error) {
  if (!error) return 'Could not load swap candidates.';
  if (typeof error === 'string') return error;
  return error.message || 'Could not load swap candidates.';
}

function componentId(component) {
  return component?.sku || component?.id || '';
}

function isCurrentComponent(component, currentSku) {
  return Boolean(currentSku && componentId(component) === currentSku);
}

function candidateItems(response) {
  if (Array.isArray(response)) return response;
  return Array.isArray(response?.items) ? response.items : [];
}

function marketplaceLabel(link) {
  const raw = String(link?.marketplace || '').trim();
  if (raw.toLowerCase() === 'enterkomputer' || String(link?.url || '').toLowerCase().includes('enterkomputer')) {
    return 'EnterKomputer';
  }
  if (!raw) return 'Marketplace';
  return raw
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function marketplaceLink(component) {
  if (!component) return null;

  const links = [];
  const seen = new Set();
  const addLink = (marketplace, url) => {
    if (!url || seen.has(url)) return;
    seen.add(url);
    links.push({ marketplace, url });
  };

  addLink('enterkomputer', component.product_url || component.primary_url || component.url);
  if (Array.isArray(component.marketplace_links)) {
    component.marketplace_links.forEach((link) => addLink(link?.marketplace, link?.url));
  }

  return (
    links.find((link) => String(link.marketplace || '').toLowerCase() === 'enterkomputer')
    || links.find((link) => String(link.url || '').toLowerCase().includes('enterkomputer'))
    || links[0]
    || null
  );
}

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

function isVisibleElement(element) {
  return Boolean(
    element
    && !element.hasAttribute('hidden')
    && (element.offsetWidth || element.offsetHeight || element.getClientRects().length)
  );
}

function focusableElements(container) {
  if (!container) return [];
  return Array.from(container.querySelectorAll(FOCUSABLE_SELECTOR)).filter(isVisibleElement);
}

export default function SwapModal({
  slot,
  budgetIdr,
  useCase,
  currentBuild,
  currentSku,
  preferredSku,
  onClose,
  onPick,
}) {
  const [query, setQuery] = useState('');
  const [items, setItems] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pickError, setPickError] = useState('');
  const [confirming, setConfirming] = useState(false);
  const dialogRef = useRef(null);
  const previousFocusRef = useRef(null);
  const title = `SWAP_${String(slot || '').toUpperCase()}.EXE`;
  const label = slotLabel(slot);

  useEffect(() => {
    previousFocusRef.current = document.activeElement;
    const frame = window.requestAnimationFrame(() => {
      const dialog = dialogRef.current;
      const [firstFocusable] = focusableElements(dialog);
      (firstFocusable || dialog)?.focus();
    });

    return () => {
      window.cancelAnimationFrame(frame);
      const previousFocus = previousFocusRef.current;
      if (previousFocus && document.contains(previousFocus)) {
        previousFocus.focus();
      }
    };
  }, []);

  useEffect(() => {
    let active = true;

    async function loadCandidates() {
      setLoading(true);
      setError('');
      try {
        const response = await api.listSwapCandidates({
          budgetIdr,
          useCase,
          slot,
          currentBuild,
          q: query,
          limit: 50,
        });
        if (!active) return;

        const nextItems = candidateItems(response);
        setItems(nextItems);
        setSelectedId((current) => {
          const preferred = nextItems.find((item) =>
            componentId(item) === preferredSku && !isCurrentComponent(item, currentSku)
          );
          if (preferred) return componentId(preferred);
          if (nextItems.some((item) => componentId(item) === current)) return current;
          const firstSwap = nextItems.find((item) => !isCurrentComponent(item, currentSku));
          return componentId(firstSwap || nextItems[0]);
        });
      } catch (nextError) {
        if (!active) return;
        setItems([]);
        setSelectedId('');
        setError(errorMessage(nextError));
      } finally {
        if (active) setLoading(false);
      }
    }

    loadCandidates();

    return () => {
      active = false;
    };
  }, [budgetIdr, currentBuild, currentSku, preferredSku, query, slot, useCase]);

  const selected = useMemo(
    () => items.find((item) => componentId(item) === selectedId) || null,
    [items, selectedId]
  );
  const selectedIsCurrent = isCurrentComponent(selected, currentSku);

  async function confirmSwap() {
    if (!selected || selectedIsCurrent) return;
    setConfirming(true);
    setPickError('');
    try {
      await onPick(selected);
    } catch (nextError) {
      setPickError(errorMessage(nextError));
    } finally {
      setConfirming(false);
    }
  }

  function handleBackdropClick(event) {
    if (event.target === event.currentTarget && !confirming) {
      onClose();
    }
  }

  function trapTabFocus(event) {
    const dialog = dialogRef.current;
    const focusables = focusableElements(dialog);

    if (focusables.length === 0) {
      event.preventDefault();
      dialog?.focus();
      return;
    }

    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    const active = document.activeElement;

    if (event.shiftKey && active === first) {
      event.preventDefault();
      last.focus();
      return;
    }

    if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function handleDialogKeyDown(event) {
    if (event.key === 'Escape' && !confirming) {
      event.preventDefault();
      event.stopPropagation();
      onClose();
      return;
    }

    if (event.key === 'Tab') {
      trapTabFocus(event);
    }
  }

  return (
    <div className="modal-backdrop" onClick={handleBackdropClick}>
      <div
        ref={dialogRef}
        className="modal-window"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        onKeyDown={handleDialogKeyDown}
      >
        <RetroWindow title={title} as="div" className="swap-modal-window">
          <div className="swap-modal-toolbar">
            <RetroInput
              label={`Search ${label}`}
              name="swap-query"
              placeholder="Type model, brand, or spec"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>

          {loading && (
            <StatusPanel
              tone="processing"
              title="LOADING"
              message={`Scanning ${label} swap candidates.`}
            />
          )}

          {error && (
            <StatusPanel
              tone="error"
              title="SWAP LIST FAILED"
              message={error}
            />
          )}

          {!loading && !error && items.length === 0 && (
            <StatusPanel
              tone="warning"
              title="NO MATCHES"
              message="No compatible swap candidates were found."
            />
          )}

          {!loading && !error && items.length > 0 && (
            <div className="swap-list" aria-label={`${label} swap candidates`}>
              {items.map((item) => {
                const id = componentId(item);
                const specs = specPills(slot, item.specs, SWAP_SPEC_KEYS, 3);
                const isSelected = selectedId === id;
                const isCurrent = isCurrentComponent(item, currentSku);
                const link = marketplaceLink(item);
                const linkLabel = marketplaceLabel(link);

                return (
                  <article
                    key={id}
                    className={`swap-card ${isSelected ? 'is-selected' : ''} ${isCurrent ? 'is-current' : ''}`.trim()}
                  >
                    <span className="swap-card-head">
                      <span>
                        <span className="swap-card-title">{item.name}</span>
                        {item.brand && <span className="swap-card-brand">{item.brand}</span>}
                      </span>
                      {isCurrent && <span className="swap-card-badge">CURRENT</span>}
                    </span>
                    <span className="swap-card-price">
                      <span>{formatIDR(item.price_idr)}</span>
                      {typeof item.price_delta_idr === 'number' && (
                        <span>{item.price_delta_idr >= 0 ? '+' : ''}{formatIDR(item.price_delta_idr)}</span>
                      )}
                    </span>
                    {specs.length > 0 && (
                      <span className="spec-pills" aria-label={`${item.name} specs`}>
                        {specs.map((spec) => (
                          <span key={spec.key} className="spec-pill">
                            <strong>{spec.key}</strong>
                            <span>{spec.value}</span>
                          </span>
                        ))}
                      </span>
                    )}
                    {item.compatibility_summary && (
                      <span className="swap-card-copy">{item.compatibility_summary}</span>
                    )}
                    <span className="swap-card-projection">
                      {typeof item.projected_total_idr === 'number' && (
                        <span>Total: {formatIDR(item.projected_total_idr)}</span>
                      )}
                      {typeof item.projected_remaining_idr === 'number' && (
                        <span>Remaining: {formatIDR(item.projected_remaining_idr)}</span>
                      )}
                    </span>
                    <span className="swap-card-actions">
                      <button
                        type="button"
                        className="swap-select-button"
                        aria-pressed={isSelected}
                        aria-label={`Select ${item.name}`}
                        onClick={() => setSelectedId(id)}
                      >
                        {isSelected ? 'Selected' : 'Select'}
                      </button>
                      {link?.url && (
                        <a
                          className="marketplace-link"
                          href={link.url}
                          target="_blank"
                          rel="noreferrer"
                          aria-label={`View at ${linkLabel} - ${item.name}`}
                        >
                          View at {linkLabel}
                        </a>
                      )}
                    </span>
                  </article>
                );
              })}
            </div>
          )}

          {pickError && (
            <StatusPanel
              tone="error"
              title="SWAP FAILED"
              message={pickError}
            />
          )}

          <div className="modal-actions">
            <RetroButton type="button" onClick={onClose} disabled={confirming}>
              Cancel
            </RetroButton>
            <RetroButton
              type="button"
              onClick={confirmSwap}
              disabled={!selected || selectedIsCurrent || loading}
              loading={confirming}
            >
              Swap
            </RetroButton>
          </div>
        </RetroWindow>
      </div>
    </div>
  );
}
