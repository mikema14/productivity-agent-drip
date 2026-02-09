interface TimelineItemProps {
  timestamp: string | null;  // ISO datetime or null
  children: React.ReactNode; // Entry/session content
  isFirst?: boolean;         // First in list
  isLast?: boolean;          // Last in list (hide connector)
  isMerged?: boolean;        // Show purple node for merged entries
  sourceCount?: number;      // Badge count for merged items
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
          timestamp ? 'text-gray-500' : 'text-gray-300'
        }`}>
          {formatTime(timestamp)}
        </span>
      </div>

      {/* Timeline Visual */}
      <div className="flex-shrink-0 flex flex-col items-center">
        <div className="relative flex items-center justify-center">
          <div className={`${
            isMerged ? 'w-4 h-4 bg-purple-400' : 'w-3 h-3 bg-gray-300'
          } rounded-full border-2 border-white shadow-sm relative z-10`}>
            {isMerged && sourceCount > 1 && (
              <span className="absolute -top-1 -right-1 bg-purple-600 text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center font-bold">
                {sourceCount}
              </span>
            )}
          </div>
        </div>
        {!isLast && <div className="w-0.5 flex-1 bg-gray-200 min-h-[60px]" />}
      </div>

      {/* Content */}
      <div className="flex-1 pb-2">
        {children}
      </div>
    </div>
  );
}
