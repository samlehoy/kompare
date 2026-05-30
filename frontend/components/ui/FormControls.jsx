import { useId } from 'react';

const EMPTY_OPTIONS = [];

function classNames(...values) {
  return values.filter(Boolean).join(' ');
}

function useControlId(id) {
  const generatedId = useId();
  return id || generatedId;
}

export function RetroButton({
  children,
  className = '',
  disabled = false,
  loading = false,
  type = 'button',
  ...props
}) {
  return (
    <button
      {...props}
      className={classNames('retro-button', loading && 'is-loading', className)}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading ? 'true' : props['aria-busy']}
    >
      {loading && <span className="retro-button-loader" aria-hidden="true" />}
      <span className="retro-button-label">{children}</span>
    </button>
  );
}

export function RetroInput({
  className = '',
  fieldClassName = '',
  id,
  label,
  name,
  type = 'text',
  ...props
}) {
  const controlId = useControlId(id);

  return (
    <div className={classNames('retro-field', fieldClassName)}>
      {label && <label className="retro-field-label" htmlFor={controlId}>{label}</label>}
      <input
        className={classNames('retro-control', 'retro-input', className)}
        id={controlId}
        name={name}
        type={type}
        {...props}
      />
    </div>
  );
}

export function RetroSelect({
  children,
  className = '',
  fieldClassName = '',
  id,
  label,
  name,
  options = EMPTY_OPTIONS,
  ...props
}) {
  const controlId = useControlId(id);

  return (
    <div className={classNames('retro-field', fieldClassName)}>
      {label && <label className="retro-field-label" htmlFor={controlId}>{label}</label>}
      <select
        className={classNames('retro-control', 'retro-select', className)}
        id={controlId}
        name={name}
        {...props}
      >
        {children ?? options.map((option) => {
          const value = typeof option === 'string' ? option : option.value;
          const optionLabel = typeof option === 'string' ? option : option.label;

          return (
            <option key={value} value={value}>
              {optionLabel}
            </option>
          );
        })}
      </select>
    </div>
  );
}

export function RetroTextarea({
  className = '',
  fieldClassName = '',
  id,
  label,
  name,
  rows = 4,
  ...props
}) {
  const controlId = useControlId(id);

  return (
    <div className={classNames('retro-field', fieldClassName)}>
      {label && <label className="retro-field-label" htmlFor={controlId}>{label}</label>}
      <textarea
        className={classNames('retro-control', 'retro-textarea', className)}
        id={controlId}
        name={name}
        rows={rows}
        {...props}
      />
    </div>
  );
}
