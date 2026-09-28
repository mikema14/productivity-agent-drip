const OPTIONS = [15, 25, 50, 90] as const;

interface Props {
  value: number;
  onChange: (minutes: number) => void;
}

/** Joined strip of session lengths; the selected key is amber with an LED square above it. */
export default function DurationSegments({ value, onChange }: Props) {
  return (
    <div className="inline-flex flex-col items-start">
      <div aria-hidden className="flex mb-1">
        {OPTIONS.map(opt => (
          <span key={opt} className="w-[52px] flex justify-center">
            <span className={`w-1 h-1 ${value === opt ? 'bg-focus shadow-led' : 'bg-transparent'}`} />
          </span>
        ))}
      </div>
      <div role="group" aria-label="Duration in minutes" className="flex border border-drip-border">
        {OPTIONS.map((opt, i) => (
          <button
            key={opt}
            type="button"
            aria-pressed={value === opt}
            onClick={() => onChange(opt)}
            className={`w-[52px] h-[34px] font-mono text-[13px] tabular-nums transition-colors duration-150 ${
              i < OPTIONS.length - 1 ? 'border-r border-drip-border' : ''
            } ${
              value === opt
                ? 'bg-focus text-drip-bg font-semibold'
                : 'bg-transparent text-txt-secondary font-medium hover:text-txt-primary hover:bg-focus/5'
            }`}
          >
            {opt}
          </button>
        ))}
      </div>
    </div>
  );
}
