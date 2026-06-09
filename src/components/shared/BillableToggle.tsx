interface BillableToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  size?: 'sm' | 'md';
  /** Label shown on the pill. Defaults to "Billable". */
  label?: string;
  disabled?: boolean;
  className?: string;
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
}: BillableToggleProps) {
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
