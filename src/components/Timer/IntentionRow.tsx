import KeyButton from './KeyButton';

interface Props {
  intentions: string[];
  onEdit: () => void;
}

/**
 * Today's intention above the focus block, in every timer state. With none
 * set it is the entry point for setting one (the job the old sidebar button
 * had); with one set, EDIT opens the same modal. The old app allowed editing
 * while a session or break ran, so no state renders this row read-only.
 */
export default function IntentionRow({ intentions, onEdit }: Props) {
  const primary = intentions[0];

  if (!primary) {
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
      <KeyButton variant="ghost" size="sm" onClick={onEdit}>Edit</KeyButton>
    </div>
  );
}
