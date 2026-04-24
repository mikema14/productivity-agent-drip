import type { PomodoroSession } from '../../types';

interface Props {
  previous: PomodoroSession;
  onContinue: () => void;
}

function RefreshIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3.5 10a6.5 6.5 0 1 1 1.1 3.6" />
      <path d="M3.5 14.5V10h4.5" />
    </svg>
  );
}

export default function ContinuePreviousCTA({ previous, onContinue }: Props) {
  const displayTitle = previous.comment || previous.task_id || 'Previous session';

  return (
    <div
      className="w-full flex items-center px-4 rounded-xl overflow-hidden"
      style={{
        height: 56,
        background: 'linear-gradient(180deg, oklch(0.78 0.14 70 / 0.18), oklch(0.78 0.14 70 / 0.08))',
        border: '0.5px solid oklch(0.78 0.14 70 / 0.38)',
        boxShadow: '0 8px 20px -12px oklch(0.78 0.14 70 / 0.4)',
      }}
    >
      {/* Refresh icon — amber, 20×20 */}
      <span className="text-focus shrink-0" style={{ width: 20, height: 20 }}>
        <RefreshIcon />
      </span>

      {/* Text block */}
      <div className="flex flex-col justify-center min-w-0 gap-0.5" style={{ marginLeft: 14, flex: 1 }}>
        <div className="flex items-center gap-2">
          <span
            className="text-focus font-semibold uppercase"
            style={{ fontSize: 11, letterSpacing: '0.08em' }}
          >
            Continue previous
          </span>
          {previous.task_id && (
            <span className="font-mono text-[11px] text-focus bg-focus/[0.18] border border-focus/20 px-1.5 py-0.5 rounded-full leading-none">
              #{previous.task_id}
            </span>
          )}
        </div>
        <span className="text-[13.5px] font-medium text-txt-primary truncate">{displayTitle}</span>
      </div>

      {/* Primary continue button */}
      <button
        onClick={onContinue}
        className="shrink-0 ml-3 flex items-center gap-1.5 bg-focus font-semibold text-[13px] rounded-[10px] transition-all duration-150 hover:brightness-110 active:scale-[0.98]"
        style={{
          height: 40,
          paddingLeft: 16,
          paddingRight: 16,
          color: 'oklch(0.18 0.01 60)',
        }}
      >
        Continue
        <span>→</span>
      </button>
    </div>
  );
}
