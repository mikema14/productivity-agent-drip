interface Props {
  intentions: string[];
  onEdit: () => void;
}

export default function IntentionRow({ intentions, onEdit }: Props) {
  if (intentions.length === 0) return null;

  const primary = intentions[0];

  return (
    <div
      role="group"
      aria-label={`Today's intention: ${primary}`}
      className="flex items-center justify-between gap-3 px-4 h-14 bg-focus/5 border border-focus/15 rounded-2xl"
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <span className="text-focus text-base shrink-0">🎯</span>
        <div className="min-w-0">
          <span className="text-[10.5px] uppercase tracking-widest text-txt-muted font-medium block">Today's intention</span>
          <span className="text-sm text-txt-secondary truncate block">{primary}</span>
        </div>
      </div>
      <button
        onClick={onEdit}
        className="text-xs text-txt-muted hover:text-focus hover:bg-focus/10 px-2.5 py-1 rounded-lg transition-all duration-150 shrink-0"
      >
        Edit
      </button>
    </div>
  );
}
