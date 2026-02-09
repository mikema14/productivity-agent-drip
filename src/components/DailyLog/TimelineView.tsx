import type { LogEntry } from '../../stores/logStore';

interface TimelineViewProps {
  entries: LogEntry[];
}

export default function TimelineView({ entries }: TimelineViewProps) {
  const HOUR_HEIGHT = 120; // px per hour
  const START_HOUR = 8; // 08:00
  const END_HOUR = 18; // 18:00
  const TOTAL_HOURS = END_HOUR - START_HOUR;

  const hours = Array.from({ length: TOTAL_HOURS + 1 }, (_, i) => START_HOUR + i);

  // Calculate position for entry based on startTime
  const getEntryPosition = (entry: LogEntry) => {
    if (!entry.startTime) return null;

    const time = new Date(entry.startTime);
    const hour = time.getHours();
    const minutes = time.getMinutes();

    const top = (hour - START_HOUR) * HOUR_HEIGHT + (minutes * 2);
    const height = entry.durationMinutes * 2;

    return { top, height };
  };

  // Get border color based on entry type and status
  const getBorderColor = (entry: LogEntry) => {
    if (entry.logged) return 'border-green-500';
    if (entry.type === 'pomodoro') return 'border-red-500';
    if (entry.type === 'calendar') return 'border-purple-500';
    return 'border-gray-400';
  };

  // Get icon based on entry type
  const getIcon = (entry: LogEntry) => {
    if (entry.type === 'pomodoro') return '🍅';
    if (entry.type === 'calendar') return '📅';
    return '📝';
  };

  const scheduledEntries = entries.filter(e => e.startTime);
  const unscheduledEntries = entries.filter(e => !e.startTime);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
      {/* Timeline Grid */}
      <div className="relative" style={{ height: TOTAL_HOURS * HOUR_HEIGHT }}>
        {/* Hour labels and lines */}
        {hours.map((hour) => (
          <div
            key={hour}
            className="absolute w-full"
            style={{ top: (hour - START_HOUR) * HOUR_HEIGHT }}
          >
            <div className="flex items-start">
              <div className="w-14 text-xs font-medium text-gray-500 dark:text-gray-400 pr-2 text-right">
                {hour.toString().padStart(2, '0')}:00
              </div>
              <div className="flex-1 border-t border-dashed border-gray-200 dark:border-gray-600" />
            </div>
          </div>
        ))}

        {/* Scheduled entries */}
        {scheduledEntries.map((entry) => {
          const position = getEntryPosition(entry);
          if (!position) return null;

          return (
            <div
              key={entry.id}
              className={`absolute border-l-4 ${getBorderColor(entry)} bg-blue-50 dark:bg-blue-900/20 rounded px-2 py-1 text-xs overflow-hidden`}
              style={{
                top: position.top,
                height: Math.max(position.height, 30), // Min height 30px
                left: 60,
                right: 16,
              }}
            >
              <div className="flex items-start gap-1">
                <span className="text-base leading-none">{getIcon(entry)}</span>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-gray-900 dark:text-white truncate">
                    {entry.title}
                  </div>
                  <div className="text-gray-600 dark:text-gray-400">
                    {entry.durationMinutes}m
                    {entry.taskId && ` • #${entry.taskId}`}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Unscheduled entries */}
      {unscheduledEntries.length > 0 && (
        <div className="border-t border-gray-200 dark:border-gray-700 p-4">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
            Unscheduled
          </h3>
          <div className="space-y-2">
            {unscheduledEntries.map((entry) => (
              <div
                key={entry.id}
                className={`border-l-4 ${getBorderColor(entry)} bg-blue-50 dark:bg-blue-900/20 rounded px-2 py-1.5 text-xs`}
              >
                <div className="flex items-center gap-1">
                  <span className="text-base">{getIcon(entry)}</span>
                  <div className="flex-1 min-w-0">
                    <span className="font-medium text-gray-900 dark:text-white">
                      {entry.title}
                    </span>
                    <span className="text-gray-600 dark:text-gray-400 ml-2">
                      {entry.durationMinutes}m
                      {entry.taskId && ` • #${entry.taskId}`}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
