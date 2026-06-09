interface Reflection {
  date: string;
  reflection: string;
  notes: string | null;
}

interface ReflectionsSectionProps {
  reflections: Reflection[];
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function ReflectionsSection({ reflections }: ReflectionsSectionProps) {
  if (reflections.length === 0) {
    return (
      <div className="bg-transparent border border-focus/30 rounded-xl p-6 h-full flex flex-col items-center justify-center text-center">
        <div className="text-txt-dim/20 text-3xl font-mono mb-2">&mdash;</div>
        <p className="text-xs text-txt-dim">No reflections yet this month</p>
        <p className="text-[10px] text-txt-dim/60 mt-1">Use End Day to capture thoughts</p>
      </div>
    );
  }

  return (
    <div className="bg-transparent border border-focus/30 rounded-xl p-6 h-full">
      <h2 className="text-xs uppercase tracking-[0.15em] text-txt-muted font-display mb-5">Reflections</h2>

      <div className="space-y-0">
        {reflections.map((r, i) => (
          <div key={r.date} className="flex gap-3 group">
            {/* Timeline connector */}
            <div className="flex flex-col items-center pt-1.5">
              <div className="reflection-dot group-hover:scale-125 transition-transform" />
              {i < reflections.length - 1 && (
                <div className="w-px flex-1 bg-gradient-to-b from-focus/20 to-transparent mt-1" />
              )}
            </div>

            {/* Content */}
            <div className="pb-5 min-w-0">
              <div className="text-[10px] text-txt-dim font-mono uppercase tracking-wider mb-1">
                {formatDate(r.date)}
              </div>
              <div className="text-sm text-txt-secondary leading-relaxed">{r.reflection}</div>
              {r.notes && (
                <div className="text-xs text-txt-dim mt-1.5 pl-3 border-l border-focus/20 italic">
                  {r.notes}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
