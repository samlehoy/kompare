import { formatIDR } from '@/lib/format.js';
import { OPTIONAL_ADDON_ORDER, SLOT_ORDER, slotLabel, specPills } from '@/lib/slots.js';

function normalizeBuild(build) {
  const recommendation = build?.recommendation || {};
  const components = build?.components || recommendation.components || {};
  const budgetIdr = build?.budget_idr ?? recommendation.budget_idr ?? 0;
  const totalIdr = build?.total_idr ?? recommendation.total_idr ?? 0;
  const remainingIdr = build?.remaining_idr ?? recommendation.remaining_idr ?? (budgetIdr ? budgetIdr - totalIdr : 0);
  const warnings = build?.compatibility_warnings || recommendation.compatibility_warnings || [];
  const legacyIssues = build?.compatibility_issues || recommendation.compatibility_issues || [];
  const optionalAddons = build?.optional_addons || recommendation.optional_addons || {};
  const budgetUsage = build?.budget_usage || recommendation.budget_usage || null;
  const budgetWarnings = build?.budget_warnings || recommendation.budget_warnings || [];
  const upgradeSuggestions = build?.upgrade_suggestions || recommendation.upgrade_suggestions || [];
  const performanceBalance = build?.performance_balance || recommendation.performance_balance || null;

  const fallbackReason = build?.fallback_reason || recommendation.fallback_reason || '';

  return {
    budgetIdr,
    totalIdr,
    remainingIdr,
    components,
    warnings,
    legacyIssues,
    optionalAddons,
    budgetUsage,
    budgetWarnings,
    upgradeSuggestions,
    performanceBalance,
    aiAssisted: Boolean(build?.ai_assisted || recommendation.ai_assisted),
    localFallback: Boolean(
      build?.local_fallback
      || recommendation.local_fallback
      || build?.fallback
      || recommendation.fallback
      || fallbackReason
    ),
    fallbackReason,
  };
}

function fallbackLabel(reason) {
  if (!reason) return 'Deterministic fallback';

  const labels = {
    ai_ranker_rejected: 'AI ranker rejected',
    deterministic_validation_failed: 'Deterministic fallback',
    gemini_quota_exceeded: 'Gemini quota fallback',
    retrieval_incomplete: 'Retrieval fallback',
    vector_index_missing: 'Vector index fallback',
    vector_index_stale: 'Vector index fallback',
  };

  return labels[reason] || 'Deterministic fallback';
}

function marketplaceUrl(component) {
  if (!component) return '';
  const directUrl = component.product_url || component.url;
  if (directUrl) return directUrl;

  const links = Array.isArray(component.marketplace_links) ? component.marketplace_links : [];
  const firstLink = links.find((link) => link?.url);
  return firstLink?.url || '';
}

function componentKey(component, slot) {
  return component?.sku || component?.id || `${slot}-empty`;
}

function componentSpecs(slot, component) {
  return specPills(slot, component?.specs);
}

function marketplaceAccessibleName(component) {
  const componentName = component?.name || 'recommended component';
  return `View at EnterKomputer - ${componentName}`;
}

const SWAP_ACCESSIBLE_SLOT_NAMES = {
  cpu: 'processor',
  motherboard: 'motherboard',
  ram: 'memory',
  gpu: 'graphics card',
  ssd: 'solid-state drive',
  hdd: 'hard drive',
  psu: 'power supply',
  cpu_cooler: 'processor cooler',
  fan_cooler: 'case fan',
  case: 'case',
};

function swapAccessibleName(slot) {
  return `Swap ${SWAP_ACCESSIBLE_SLOT_NAMES[slot] || slotLabel(slot)}`;
}

function textFromIssue(issue) {
  if (!issue) return '';
  if (typeof issue === 'string') return issue;
  return [issue.title, issue.message, issue.recommendation].filter(Boolean).join(' ');
}

function IssueList({ issues, title }) {
  const items = (issues || []).map(textFromIssue).filter(Boolean);
  if (items.length === 0) return null;

  return (
    <div className="result-issues">
      <strong>{title}</strong>
      <ul>
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

function BudgetGuidance({ result }) {
  const usage = result.budgetUsage;
  const warnings = result.budgetWarnings || [];
  const suggestions = result.upgradeSuggestions || [];
  const balance = result.performanceBalance;

  if (!usage && warnings.length === 0 && suggestions.length === 0 && !balance?.summary) {
    return null;
  }

  return (
    <div className="budget-guidance">
      {usage && (
        <div className="budget-usage">
          <strong>Budget usage</strong>
          <span>{usage.used_percent}% used</span>
          <small>
            {usage.strategy?.replace(/_/g, ' ') || 'balanced'}
            {' '}
            target
            {usage.target_min_percent ? ` ${usage.target_min_percent}%+` : ''}
          </small>
        </div>
      )}

      {warnings.map((warning) => (
        <div className="budget-warning" key={warning.code || warning.title}>
          <strong>{warning.title}</strong>
          <p>{warning.message}</p>
          {warning.recommendation && <small>{warning.recommendation}</small>}
        </div>
      ))}

      {suggestions.length > 0 && (
        <div className="upgrade-suggestions">
          <strong>Recommended upgrades</strong>
          <ul>
            {suggestions.slice(0, 3).map((suggestion) => {
              const candidate = suggestion.candidate || {};
              const key = `${suggestion.slot}-${candidate.sku || candidate.id || candidate.name}`;

              return (
                <li key={key}>
                  <span>{slotLabel(suggestion.slot)}</span>
                  <b>{candidate.name}</b>
                  {suggestion.added_cost_idr ? <small>+{formatIDR(suggestion.added_cost_idr)}</small> : null}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {balance?.summary && (
        <div className="performance-balance">
          <strong>Performance balance</strong>
          <p>{balance.summary}</p>
        </div>
      )}
    </div>
  );
}

export default function BuildResults({
  build,
  mode = 'build',
  onSwap,
  highlightedSlot = '',
  selectedOptionalAddons = null,
}) {
  if (!build) return null;

  const result = normalizeBuild(build);
  const overBudget = result.remainingIdr < 0;
  const selectedOptionalAddonSet = Array.isArray(selectedOptionalAddons)
    ? new Set(selectedOptionalAddons)
    : null;
  const optionalAddons = OPTIONAL_ADDON_ORDER
    .map((slot) => [slot, result.optionalAddons?.[slot]])
    .filter(([slot, component]) => (
      Boolean(component)
      && (!selectedOptionalAddonSet || selectedOptionalAddonSet.has(slot))
    ));

  return (
    <section className="build-results" aria-label={mode === 'upgrade' ? 'Upgrade recommendation results' : 'Build recommendation results'}>
      <aside className="summary-panel">
        <div>
          <span className="summary-kicker">{mode === 'upgrade' ? 'Upgrade result' : 'Build result'}</span>
          <h2>{formatIDR(result.totalIdr)}</h2>
        </div>
        <dl className="summary-stats">
          <div>
            <dt>Budget</dt>
            <dd>{formatIDR(result.budgetIdr)}</dd>
          </div>
          <div>
            <dt>{overBudget ? 'Over budget' : 'Remaining'}</dt>
            <dd>{formatIDR(Math.abs(result.remainingIdr))}</dd>
          </div>
        </dl>
        {(result.aiAssisted || result.localFallback) && (
          <div className="summary-markers" aria-label="Recommendation source">
            {result.aiAssisted && <span>AI-assisted</span>}
            {result.localFallback && <span>{fallbackLabel(result.fallbackReason)}</span>}
          </div>
        )}
        <BudgetGuidance result={result} />
        <IssueList issues={result.warnings} title="Compatibility warnings" />
        <IssueList issues={result.legacyIssues} title="Compatibility issues" />
      </aside>

      <div className="part-list">
        {SLOT_ORDER.map((slot) => {
          const component = result.components?.[slot] || null;
          const specs = componentSpecs(slot, component);
          const url = marketplaceUrl(component);
          const label = slotLabel(slot);
          const isReferenced = highlightedSlot === slot;

          return (
            <article
              key={componentKey(component, slot)}
              className={`part-row ${component ? '' : 'is-empty'} ${isReferenced ? 'is-referenced' : ''}`.trim()}
              data-part-slot={slot}
              tabIndex={-1}
            >
              <div className="part-slot">{label}</div>
              <div className="part-body">
                <h3>{component?.name || 'No recommendation'}</h3>
                {component?.brand && <p>{component.brand}</p>}
                {specs.length > 0 && (
                  <div className="spec-pills" aria-label={`${label} specs`}>
                    {specs.map((spec) => (
                      <span key={spec.key} className="spec-pill">
                        <strong>{spec.key}</strong>
                        <span>{spec.value}</span>
                      </span>
                    ))}
                  </div>
                )}
                {url && (
                  <a
                    href={url}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={marketplaceAccessibleName(component)}
                  >
                    View at EnterKomputer
                  </a>
                )}
              </div>
              <div className="part-price">
                {component ? formatIDR(component.price_idr) : '-'}
                {onSwap && component && (
                  <button
                    type="button"
                    aria-label={swapAccessibleName(slot)}
                    onClick={() => onSwap(slot, component.sku || component.id)}
                  >
                    Swap
                  </button>
                )}
              </div>
            </article>
          );
        })}
      </div>

      {optionalAddons.length > 0 && (
        <section className="optional-addon-panel" aria-label="Optional add-ons">
          <div className="optional-addon-heading">
            <span className="summary-kicker">Optional add-ons</span>
            <p>Selected optional add-ons are separate from the core tower total.</p>
          </div>
          <div className="part-list optional-addon-list">
            {optionalAddons.map(([slot, component]) => {
              const specs = componentSpecs(slot, component);

              return (
                <article key={slot} className={`part-row ${component ? '' : 'is-empty'}`}>
                  <div className="part-slot">{slotLabel(slot)}</div>
                  <div className="part-body">
                    <h3>{component?.name || 'No recommendation'}</h3>
                    {specs.length > 0 && (
                      <div className="spec-pills" aria-label={`${slotLabel(slot)} specs`}>
                        {specs.map((spec) => (
                          <span key={spec.key} className="spec-pill">
                            <strong>{spec.key}</strong>
                            <span>{spec.value}</span>
                          </span>
                        ))}
                      </div>
                    )}
                    {marketplaceUrl(component) && (
                      <a
                        href={marketplaceUrl(component)}
                        target="_blank"
                        rel="noreferrer"
                        aria-label={marketplaceAccessibleName(component)}
                      >
                        View at EnterKomputer
                      </a>
                    )}
                  </div>
                  <div className="part-price">{component ? formatIDR(component.price_idr) : '-'}</div>
                </article>
              );
            })}
          </div>
        </section>
      )}
    </section>
  );
}
