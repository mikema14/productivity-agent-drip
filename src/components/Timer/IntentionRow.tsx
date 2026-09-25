import KeyButton from './KeyButton';

interface Props {
  intentions: string[];
  onEdit: () => void;
  /** When true the row is display-only (running states). */
  readonly?: boolean;
}

/**
 * Today's intention above the focus block. With none set it is the entry
 * point for setting one (the job the old sidebar button had), unless readonly.
 */
export default function IntentionRow({ intentions, onEdit, readonly = false }: Props) {
  const primary = intentions[0];

  if (!primary) {
    if (readonly) return null;
    return (
      <div className="flex items-center h-9 border-b border-drip-elevated">
        <KeyButton variant="ghost" size="sm" onClick={onEdit}>Set intention</KeyButton>
      </div>
    );
  }

  return (
    <div
      role="group"
      aria-label={`Today's intention: ${primary}`}
      className="flex items-center justify-between gap-3 h-9 border-b border-drip-elevated"
    >
      <div className="flex items-baseline gap-3 min-w-0">
        <span className="now-label text-txt-muted shrink-0">Intention</span>
        <span className="text-[13px] text-txt-secondary truncate">{primary}</span>
      </div>
      {!readonly && (
        <KeyButton variant="ghost" size="sm" onClick={onEdit}>Edit</KeyButton>
      )}
    </div>
  );
}
