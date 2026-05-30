const TONES = new Set(['idle', 'processing', 'success', 'warning', 'error']);

const LIVE_REGION_PROPS = {
  error: { role: 'alert', ariaLive: 'assertive' },
  processing: { role: 'status', ariaLive: 'polite' },
  success: { role: 'status', ariaLive: 'polite' },
  warning: { role: 'alert', ariaLive: 'assertive' },
};

function classNames(...values) {
  return values.filter(Boolean).join(' ');
}

export default function StatusPanel({
  'aria-atomic': ariaAtomic,
  'aria-live': ariaLive,
  children,
  className = '',
  message,
  role,
  title,
  tone = 'idle',
  ...props
}) {
  const normalizedTone = TONES.has(tone) ? tone : 'idle';
  const liveRegionProps = LIVE_REGION_PROPS[normalizedTone] || {};
  const sectionRole = role ?? liveRegionProps.role;
  const sectionAriaLive = ariaLive ?? liveRegionProps.ariaLive;

  return (
    <section
      {...props}
      className={classNames('retro-status-panel', `is-${normalizedTone}`, className)}
      role={sectionRole}
      aria-live={sectionAriaLive}
      aria-atomic={ariaAtomic ?? (sectionRole || sectionAriaLive ? 'true' : undefined)}
    >
      {title && <strong className="retro-status-title">{title}</strong>}
      {message && <p className="retro-status-message">{message}</p>}
      {children && <div className="retro-status-content">{children}</div>}
    </section>
  );
}
