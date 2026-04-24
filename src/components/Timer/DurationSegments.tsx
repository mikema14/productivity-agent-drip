const OPTIONS = [15, 25, 50, 90] as const;

interface Props {
  value: number;
  onChange: (minutes: number) => void;
}

export default function DurationSegments({ value, onChange }: Props) {
  return (
    <div
      className="inline-flex self-center items-center gap-0.5 p-[3px] rounded-[10px]"
      style={{
        background: 'oklch(1 0 0 / 0.04)',
        border: '0.5px solid oklch(1 0 0 / 0.08)',
      }}
    >
      {OPTIONS.map(opt => (
        <button
          key={opt}
          onClick={() => onChange(opt)}
          className={`h-7 text-[12px] font-medium rounded-lg transition-all duration-150 ${
            value === opt
              ? 'text-txt-primary'
              : 'text-txt-muted hover:text-txt-secondary'
          }`}
          style={{
            padding: '0 14px',
            fontVariantNumeric: 'tabular-nums',
            background: value === opt ? 'oklch(1 0 0 / 0.10)' : 'transparent',
            boxShadow: value === opt ? 'inset 0 1px 0 oklch(1 0 0 / 0.06)' : 'none',
          }}
        >
          {opt}m
        </button>
      ))}
    </div>
  );
}
