import { useState, useEffect, useRef } from 'react';
import { useLogStore } from '../../stores/logStore';

interface DayData {
  date: string;
  minutes: number;
  deepMinutes: number;
}

interface CalendarPopoverProps {
  selectedDate: string;
  onSelectDate: (date: string) => void;
  onClose: () => void;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

export default function CalendarPopover({ selectedDate, onSelectDate, onClose }: CalendarPopoverProps) {
  const initDate = new Date(selectedDate);
  const [viewYear, setViewYear] = useState(initDate.getFullYear());
  const [viewMonth, setViewMonth] = useState(initDate.getMonth() + 1);
  const [monthData, setMonthData] = useState<DayData[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const popoverRef = useRef<HTMLDivElement>(null);
  const cacheRef = useRef(new Map<string, DayData[]>());
  const logStore = useLogStore() as any;

  // Fetch month data
  useEffect(() => {
    const key = `${viewYear}-${viewMonth}`;
    if (cacheRef.current.has(key)) {
      setMonthData(cacheRef.current.get(key)!);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    logStore.getMonthlyStats(viewYear, viewMonth).then((stats: any) => {
      const data: DayData[] = stats?.dailyMinutes || [];
      cacheRef.current.set(key, data);
      setMonthData(data);
      setIsLoading(false);
    });
  }, [viewYear, viewMonth]);

  // Track selectedDate changes from parent (arrow nav)
  useEffect(() => {
    const d = new Date(selectedDate);
    const y = d.getFullYear();
    const m = d.getMonth() + 1;
    if (y !== viewYear || m !== viewMonth) {
      setViewYear(y);
      setViewMonth(m);
    }
  }, [selectedDate]);

  // Click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        onClose();
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  // Escape key
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Month navigation
  const now = new Date();
  const isCurrentMonth = viewYear === now.getFullYear() && viewMonth === now.getMonth() + 1;
  const canGoNext = !isCurrentMonth;
  const todayStr = now.toISOString().split('T')[0];
  const isOnToday = selectedDate === todayStr;

  const handlePrevMonth = () => {
    if (viewMonth === 1) {
      setViewYear(viewYear - 1);
      setViewMonth(12);
    } else {
      setViewMonth(viewMonth - 1);
    }
  };

  const handleNextMonth = () => {
    if (!canGoNext) return;
    if (viewMonth === 12) {
      setViewYear(viewYear + 1);
      setViewMonth(1);
    } else {
      setViewMonth(viewMonth + 1);
    }
  };

  // Build calendar grid
  const firstDay = new Date(viewYear, viewMonth - 1, 1);
  const daysInMonth = new Date(viewYear, viewMonth, 0).getDate();

  let startDayOfWeek = firstDay.getDay() - 1;
  if (startDayOfWeek < 0) startDayOfWeek = 6;

  const cells: Array<{ day: number | null; data: DayData | null }> = [];
  for (let i = 0; i < startDayOfWeek; i++) {
    cells.push({ day: null, data: null });
  }
  for (let day = 1; day <= daysInMonth; day++) {
    const dayData = monthData.find(d => new Date(d.date).getDate() === day);
    cells.push({ day, data: dayData || null });
  }

  const handleDayClick = (day: number) => {
    const dateStr = `${viewYear}-${String(viewMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    onSelectDate(dateStr);
  };

  return (
    <div
      ref={popoverRef}
      className="absolute top-full right-0 mt-2 z-50 w-72 bg-drip-elevated border border-focus/30 rounded-xl shadow-glass p-4 animate-scale-in"
      onMouseDown={(e) => e.stopPropagation()}
    >
      {/* Header: month nav + today button */}
      <div className="flex items-center justify-between mb-3">
        <button
          onClick={handlePrevMonth}
          className="w-7 h-7 flex items-center justify-center rounded-lg text-txt-muted hover:text-txt-primary hover:bg-focus/5 transition-all"
        >
          <svg width="12" height="12" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M9 3L5 7L9 11" />
          </svg>
        </button>

        <div className="text-center flex-1">
          <span className="text-sm font-display font-semibold text-txt-primary tracking-tight">
            {MONTH_NAMES[viewMonth - 1]}
          </span>
          <span className="text-[10px] text-txt-dim font-mono ml-1.5">{viewYear}</span>
        </div>

        <div className="flex items-center gap-1">
          {!isOnToday && (
            <button
              onClick={() => onSelectDate(todayStr)}
              className="px-2 py-0.5 text-[10px] text-txt-muted border border-focus/20 rounded-lg hover:bg-focus/5 hover:text-txt-secondary transition-all"
            >
              Today
            </button>
          )}
          <button
            onClick={handleNextMonth}
            disabled={!canGoNext}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-txt-muted hover:text-txt-primary hover:bg-focus/5 transition-all disabled:opacity-20 disabled:cursor-not-allowed"
          >
            <svg width="12" height="12" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M5 3L9 7L5 11" />
            </svg>
          </button>
        </div>
      </div>

      {/* Day labels */}
      <div className="grid grid-cols-7 gap-1 mb-1">
        {DAY_LABELS.map((label, i) => (
          <div key={i} className="text-center text-[9px] text-txt-dim font-mono uppercase tracking-wider py-0.5">
            {label}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-1">
        {isLoading ? (
          <div className="col-span-7 flex items-center justify-center py-8">
            <div className="w-4 h-4 border-2 border-focus/20 border-t-focus rounded-full animate-spin" />
          </div>
        ) : (
          cells.map((cell, i) => {
            if (cell.day === null) {
              return <div key={`e-${i}`} />;
            }

            const minutes = cell.data?.minutes || 0;
            const hasActivity = minutes > 0;
            const dateStr = `${viewYear}-${String(viewMonth).padStart(2, '0')}-${String(cell.day).padStart(2, '0')}`;
            const isToday = isCurrentMonth && cell.day === now.getDate();
            const isSelected = dateStr === selectedDate;

            return (
              <button
                key={cell.day}
                onClick={() => handleDayClick(cell.day!)}
                className={`cal-cell relative rounded-lg flex flex-col items-center justify-center aspect-square transition-colors
                  ${isSelected ? 'bg-focus/20 text-txt-primary' : 'hover:bg-focus/10 text-txt-secondary'}
                  ${isToday ? 'ring-1 ring-focus ring-offset-1 ring-offset-drip-elevated' : ''}
                `}
              >
                <span className={`text-[11px] font-mono leading-none ${isSelected ? 'font-semibold text-txt-primary' : ''}`}>
                  {cell.day}
                </span>
                {hasActivity && (
                  <span className="w-1 h-1 rounded-full bg-focus mt-0.5" />
                )}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
