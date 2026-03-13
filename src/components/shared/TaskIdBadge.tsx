import { useState } from 'react';

interface TaskIdBadgeProps {
  taskId: string;
  taskName: string | null;
  className?: string;
}

export default function TaskIdBadge({ taskId, taskName, className = '' }: TaskIdBadgeProps) {
  const [showTooltip, setShowTooltip] = useState(false);

  return (
    <span
      className={`relative inline-flex ${className}`}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <span className="font-mono">#{taskId}</span>
      {showTooltip && taskName && (
        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2.5 py-1 text-xs text-txt-primary bg-drip-elevated border border-glass-border rounded-lg shadow-lg whitespace-nowrap z-50 pointer-events-none animate-fade-in">
          {taskName}
        </span>
      )}
    </span>
  );
}
