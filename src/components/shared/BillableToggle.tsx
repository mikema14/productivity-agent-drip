interface BillableToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  size?: 'sm' | 'md';
  /** Label shown on the pill. Defaults to "Billable". */
  label?: string;
  disabled?: boolean;
  className?: string;
  /**
   * `pill` (default): the rounded switch used by the timer, lists and editors.
   * `yesno`: Review's square 30px key, `Yes` + amber dot / `No` + dim dot (R27).
   */
  variant?: 'pill' | 'yesno';
}

/**
 * Orange-accent pill toggle for the billable flag. Follows UI_DESIGN_SYSTEM.md:
 * active = bg-focus/15 text-focus border-focus/30, inactive = recessed/subtle.
 * Used everywhere a billable default can be set (timer, lists, items, log entries).
 */
export default function BillableToggle({
  checked,
  onChange,
  size = 'md',
  label = 'Billable',
  disabled = false,
  className = '',
  variant = 'pill',
}: BillableToggleProps) {
  if (variant === 'yesno') {
    return (
      <button
        type="button"
        aria-pressed={checked}
        aria-label={label}
        title={checked ? label : `Not ${label.toLowerCase()}`}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`h-[30px] px-2.5 inline-flex items-center gap-2 border rounded-[2px] font-mono text-[10.5px] tracking-[1px] uppercase transition-colors duration-150 disabled:opacity-40 ${
          checked ? 'border-focus/45 text-focus hover:bg-focus/5' : 'border-drip-border text-txt-muted hover:text-txt-primary'
        } ${className}`}
      >
        <span aria-hidden className={`w-1.5 h-1.5 ${checked ? 'bg-focus' : 'bg-txt-dim'}`} />
        {checked ? 'Yes' : 'No'}
      </button>
    );
  }

  const sizing = size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs';

  const stateClasses = checked
    ? 'bg-focus/15 text-focus border-focus/30'
    : 'bg-transparent text-txt-secondary border-focus/20 hover:text-txt-primary hover:bg-focus/5';

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`inline-flex items-center gap-1.5 rounded-full border font-medium transition-all disabled:opacity-40 ${sizing} ${stateClasses} ${className}`}
    >
      {checked && (
        <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3.5 8.5l3 3 6-6" />
        </svg>
      )}
      <span>{label}</span>
    </button>
  );
}
