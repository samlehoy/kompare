'use client';

import { useState } from 'react';
import { RetroButton, RetroTextarea } from '@/components/ui/FormControls.jsx';
import StatusPanel from '@/components/ui/StatusPanel.jsx';
import { api } from '@/lib/api.js';
import { formatIDR } from '@/lib/format.js';
import { SLOT_ICONS, slotLabel } from '@/lib/slots.js';

const MAX_HISTORY_MESSAGES = 8;
const MAX_API_HISTORY = 6;

function errorMessage(error) {
  if (!error) return 'The advisor could not answer right now.';
  if (typeof error === 'string') return error;
  return error.message || 'The advisor could not answer right now.';
}

function trimMessages(messages) {
  return messages.slice(-MAX_HISTORY_MESSAGES);
}

function historyForApi(messages) {
  return messages.slice(-MAX_API_HISTORY).map((message) => ({
    role: message.role,
    content: message.content,
  }));
}

function slotButtonLabel(slot) {
  return SLOT_ICONS[slot] || slotLabel(slot).toUpperCase();
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function componentName(component) {
  return component?.name || component?.model || component?.sku || component?.id || 'Component';
}

function componentSku(component) {
  return component?.sku || component?.id || '';
}

function evidenceSpecs(specs) {
  if (Array.isArray(specs)) {
    return specs
      .map((spec, index) => ({
        key: `${spec?.label || spec?.key || index}`,
        label: spec?.label || spec?.key || `Spec ${index + 1}`,
        value: spec?.value,
      }))
      .filter((spec) => spec.value !== null && spec.value !== undefined && spec.value !== '');
  }

  if (!specs || typeof specs !== 'object') return [];
  return Object.entries(specs)
    .filter(([, value]) => value !== null && value !== undefined && value !== '')
    .map(([key, value]) => ({
      key,
      label: key.replace(/_/g, ' '),
      value,
    }));
}

function rationaleItems(rationale) {
  if (Array.isArray(rationale)) return rationale.filter(Boolean);
  return rationale ? [rationale] : [];
}

function suggestionSlotLabel(suggestion) {
  return suggestion?.label || slotButtonLabel(suggestion?.slot);
}

export default function AdvisorConsole({
  mode = 'build',
  context,
  onReferenceSlot,
  onReviewSwapSuggestion,
}) {
  const [question, setQuestion] = useState('');
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const advisorLabel = mode === 'upgrade'
    ? 'Ask the PC Upgrade Advisor'
    : 'Ask the PC Build Advisor';

  async function askQuestion(rawQuestion) {
    const nextQuestion = String(rawQuestion || '').trim();
    if (!nextQuestion || loading) return;

    const userMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: nextQuestion,
    };
    const nextMessages = trimMessages([...messages, userMessage]);

    setMessages(nextMessages);
    setQuestion('');
    setError('');
    setLoading(true);

    try {
      const response = await api.askBuildAdvisor({
        mode,
        question: nextQuestion,
        context,
        history: historyForApi(messages),
      });
      const advisorMessage = {
        id: `advisor-${Date.now()}`,
        role: 'assistant',
        content: response?.answer || 'No advisor answer was returned.',
        fallback: Boolean(response?.fallback),
        referencedSlots: asArray(response?.referenced_slots),
        evidenceCards: asArray(response?.evidence_cards),
        costSavingSuggestions: asArray(response?.cost_saving_suggestions),
        suggestedQuestions: asArray(response?.suggested_questions).filter(Boolean),
      };
      setMessages((current) => trimMessages([...current, advisorMessage]));
    } catch (nextError) {
      setError(errorMessage(nextError));
    } finally {
      setLoading(false);
    }
  }

  function submitQuestion(event) {
    event.preventDefault();
    askQuestion(question);
  }

  return (
    <section className="advisor-console" aria-label={mode === 'upgrade' ? 'Upgrade advisor console' : 'Build advisor console'}>
      <StatusPanel
        tone="idle"
        title={mode === 'upgrade' ? 'UPGRADE ADVISOR' : 'BUILD ADVISOR'}
        message="Ask about compatibility, budget pressure, or swap trade-offs."
      />

      <div className="advisor-thread" aria-live="polite">
        {messages.length === 0 && (
          <p className="advisor-empty">Advisor console ready.</p>
        )}
        {messages.map((message) => (
          <article
            key={message.id}
            className={`advisor-message is-${message.role}`}
          >
            <div className="advisor-message-head">
              <strong>{message.role === 'assistant' ? 'ADVISOR' : 'YOU'}</strong>
              {message.fallback && <span>LOCAL FALLBACK</span>}
            </div>
            <p>{message.content}</p>
            {message.referencedSlots?.length > 0 && (
              <div className="advisor-references" aria-label="Referenced slots">
                {message.referencedSlots.map((slot) => (
                  <button
                    key={slot}
                    type="button"
                    onClick={() => onReferenceSlot?.(slot)}
                  >
                    {slotButtonLabel(slot)}
                  </button>
                ))}
              </div>
            )}
            {message.evidenceCards?.length > 0 && (
              <section className="advisor-detail-section" aria-label="Evidence used">
                <h3>Evidence used</h3>
                <div className="advisor-evidence-list">
                  {message.evidenceCards.map((card, index) => {
                    const specs = evidenceSpecs(card.specs);
                    const rationale = rationaleItems(card.rationale);
                    const key = `${card.slot || 'evidence'}-${card.name || index}`;

                    return (
                      <article key={key} className="advisor-evidence-card">
                        <div className="advisor-card-head">
                          <span>{card.label || slotLabel(card.slot)}</span>
                          {typeof card.price_idr === 'number' && <strong>{formatIDR(card.price_idr)}</strong>}
                        </div>
                        <h4>{card.name || 'Referenced component'}</h4>
                        {card.brand && <p className="advisor-muted">{card.brand}</p>}
                        {specs.length > 0 && (
                          <dl className="advisor-spec-list">
                            {specs.map((spec) => (
                              <div key={spec.key}>
                                <dt>{spec.label}</dt>
                                <dd>{spec.value}</dd>
                              </div>
                            ))}
                          </dl>
                        )}
                        {rationale.length > 0 && (
                          <ul className="advisor-rationale-list">
                            {rationale.map((item) => (
                              <li key={item}>{item}</li>
                            ))}
                          </ul>
                        )}
                      </article>
                    );
                  })}
                </div>
              </section>
            )}
            {message.costSavingSuggestions?.length > 0 && (
              <section className="advisor-detail-section" aria-label="Cost-saving swaps">
                <h3>Cost-saving swaps</h3>
                <div className="advisor-savings-list">
                  {message.costSavingSuggestions.map((suggestion, index) => {
                    const candidate = suggestion.candidate || {};
                    const current = suggestion.current || {};
                    const candidateLabel = componentName(candidate);
                    const currentLabel = componentName(current);
                    const key = `${suggestion.slot || 'saving'}-${componentSku(candidate) || candidateLabel}-${index}`;

                    return (
                      <article key={key} className="advisor-saving-card">
                        <div className="advisor-card-head">
                          <span>{suggestionSlotLabel(suggestion)}</span>
                          {typeof suggestion.savings_idr === 'number' && (
                            <strong>Save {formatIDR(suggestion.savings_idr)}</strong>
                          )}
                        </div>
                        <p>
                          <strong>{candidateLabel}</strong>
                          <span> instead of {currentLabel}</span>
                        </p>
                        <dl className="advisor-projection-list">
                          {typeof suggestion.projected_total_idr === 'number' && (
                            <div>
                              <dt>Projected total</dt>
                              <dd>{formatIDR(suggestion.projected_total_idr)}</dd>
                            </div>
                          )}
                          {typeof suggestion.projected_remaining_idr === 'number' && (
                            <div>
                              <dt>{suggestion.projected_remaining_idr < 0 ? 'Over budget' : 'Remaining'}</dt>
                              <dd>{formatIDR(Math.abs(suggestion.projected_remaining_idr))}</dd>
                            </div>
                          )}
                        </dl>
                        {suggestion.compatibility_summary && (
                          <p className="advisor-muted">{suggestion.compatibility_summary}</p>
                        )}
                        {onReviewSwapSuggestion && suggestion.slot && (
                          <button
                            type="button"
                            onClick={() => onReviewSwapSuggestion(suggestion)}
                          >
                            Review alternatives for {suggestionSlotLabel(suggestion)}
                          </button>
                        )}
                      </article>
                    );
                  })}
                </div>
              </section>
            )}
            {message.suggestedQuestions?.length > 0 && (
              <div className="advisor-suggestions" aria-label="Suggested questions">
                {message.suggestedQuestions.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    disabled={loading}
                    onClick={() => askQuestion(suggestion)}
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            )}
          </article>
        ))}
      </div>

      {error && (
        <StatusPanel
          tone="error"
          title="ADVISOR FAILED"
          message={error}
        />
      )}

      <form className="advisor-form" onSubmit={submitQuestion}>
        <RetroTextarea
          label={advisorLabel}
          name={`${mode}-advisor-question`}
          rows={3}
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
        />
        <RetroButton type="submit" loading={loading} disabled={!question.trim()}>
          Ask
        </RetroButton>
      </form>
    </section>
  );
}
