import { useState, useRef, useCallback } from 'react';

interface TaskIdBadgeProps {
  taskId: string;
  taskName: string | null;
  className?: string;
  /** Render the bare id without the `#` prefix (design rule 6; Plan surfaces). */
  plain?: boolean;
}

export default function TaskIdBadge({ taskId, taskName, className = '', plain = false }: TaskIdBadgeProps) {
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);
  const ref = useRef<HTMLSpanElement>(null);

  const showTooltip = useCallback(() => {
    if (!ref.current || !taskName) return;
    const rect = ref.current.getBoundingClientRect();
    // Position below the badge by default, centered horizontally
    setTooltipPos({
      x: rect.left + rect.width / 2,
      y: rect.bottom + 6,
    });
  }, [taskName]);

  const hideTooltip = useCallback(() => setTooltipPos(null), []);

  return (
    <span
      ref={ref}
      className={`relative inline-flex ${className}`}
      onMouseEnter={showTooltip}
      onMouseLeave={hideTooltip}
    >
      <span className="font-mono">{plain ? taskId : `#${taskId}`}</span>
      {tooltipPos && taskName && (
        <span
          className="fixed px-2.5 py-1.5 text-xs text-txt-primary bg-drip-elevated border border-focus/30 rounded-lg shadow-lg z-[9999] pointer-events-none animate-fade-in max-w-[280px] break-words"
          style={{
            left: `clamp(8px, ${tooltipPos.x}px, calc(100vw - 288px))`,
            top: `clamp(8px, ${tooltipPos.y}px, calc(100vh - 40px))`,
            transform: 'translateX(-50%)',
          }}
        >
          {taskName}
        </span>
      )}
    </span>
  );
}
