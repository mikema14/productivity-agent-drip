interface TimelineItemProps {
  timestamp: string | null;
  children: React.ReactNode;
  isFirst?: boolean;
  isLast?: boolean;
  isMerged?: boolean;
  sourceCount?: number;
}

export default function TimelineItem({
  timestamp,
  children,
  isFirst = false,
  isLast = false,
  isMerged = false,
  sourceCount = 1
}: TimelineItemProps) {
  const formatTime = (isoString: string | null): string => {
    if (!isoString) return '--:--';
    return new Date(isoString).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
  };

  return (
    <div className="flex gap-3">
      {/* Timestamp */}
      <div className="flex-shrink-0 w-14 text-right">
        <span className={`text-sm font-mono ${
          timestamp ? 'text-txt-dim' : 'text-txt-dim/40'
        }`}>
          {formatTime(timestamp)}
        </span>
      </div>

      {/* Timeline Visual */}
      <div className="flex-shrink-0 flex flex-col items-center">
        <div className="relative flex items-center justify-center">
          <div className={`${
            isMerged ? 'w-4 h-4 bg-focus' : 'w-3 h-3 bg-txt-dim/40'
          } rounded-full border-2 border-drip-bg shadow-sm relative z-10`}>
            {isMerged && sourceCount > 1 && (
              <span className="absolute -top-1 -right-1 bg-focus text-drip-bg text-[10px] rounded-full w-4 h-4 flex items-center justify-center font-bold">
                {sourceCount}
              </span>
            )}
          </div>
        </div>
        {!isLast && <div className="w-px flex-1 bg-focus/20 min-h-[60px]" />}
      </div>

      {/* Content */}
      <div className="flex-1 pb-2">
        {children}
      </div>
    </div>
  );
}
