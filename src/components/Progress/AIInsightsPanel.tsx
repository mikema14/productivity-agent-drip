import { useState, useEffect } from 'react';
import type { WeeklySummary } from '../../types';
import { generateWeeklyPatterns, generateReflectionSynthesis, generateActionableCoaching } from '../../services/ai';

interface Reflection {
  date: string;
  reflection: string;
  notes: string | null;
}

interface MonthlyStats {
  totalMinutes: number;
  deepWorkMinutes: number;
  daysWorked: number;
  dailyMinutes: Array<{ date: string; minutes: number; deepMinutes: number }>;
}

interface AIInsightsPanelProps {
  weeklySummaries: WeeklySummary[];
  reflections: Reflection[];
  monthlyStats: MonthlyStats | null;
  timeOfDay: Array<{ hour: number; minutes: number }>;
  period: string;
}

type TabId = 'patterns' | 'reflections' | 'coaching';

interface InsightState {
  text: string | null;
  error: string | null;
  loading: boolean;
}

type InsightsRecord = Record<TabId, InsightState>;

const TAB_META: Record<TabId, { label: string; icon: string }> = {
  patterns: { label: 'Patterns', icon: '~' },
  reflections: { label: 'Synthesis', icon: '>' },
  coaching: { label: 'Coach', icon: '*' },
};

const EMPTY_INSIGHTS: InsightsRecord = {
  patterns: { text: null, error: null, loading: false },
  reflections: { text: null, error: null, loading: false },
  coaching: { text: null, error: null, loading: false },
};

function cacheKey(period: string) {
  return `ai-insights-${period}`;
}

function loadCachedInsights(period: string): InsightsRecord {
  try {
    const raw = sessionStorage.getItem(cacheKey(period));
    if (raw) return JSON.parse(raw);
  } catch {}
  return { ...EMPTY_INSIGHTS };
}

function saveInsightsToCache(period: string, insights: InsightsRecord) {
  try {
    // Don't cache loading states
    const toSave: InsightsRecord = {
      patterns: { ...insights.patterns, loading: false },
      reflections: { ...insights.reflections, loading: false },
      coaching: { ...insights.coaching, loading: false },
    };
    sessionStorage.setItem(cacheKey(period), JSON.stringify(toSave));
  } catch {}
}

export default function AIInsightsPanel({
  weeklySummaries,
  reflections,
  monthlyStats,
  timeOfDay,
  period,
}: AIInsightsPanelProps) {
  const [activeTab, setActiveTab] = useState<TabId>('patterns');
  const [insights, setInsights] = useState<InsightsRecord>(() => loadCachedInsights(period));

  // Restore cached insights when period changes
  useEffect(() => {
    setInsights(loadCachedInsights(period));
  }, [period]);

  const generateInsight = async (tab: TabId) => {
    setInsights(prev => ({
      ...prev,
      [tab]: { text: null, error: null, loading: true }
    }));

    try {
      let result: { text: string; type: string } | { error: string } | null = null;

      if (tab === 'patterns') {
        result = await generateWeeklyPatterns(weeklySummaries, timeOfDay);
      } else if (tab === 'reflections') {
        result = await generateReflectionSynthesis(period, reflections);
      } else if (tab === 'coaching') {
        const patternsText = insights.patterns.text || 'No pattern analysis available yet.';
        const reflectionsText = insights.reflections.text || 'No reflection synthesis available yet.';
        if (!monthlyStats) {
          setInsights(prev => {
            const updated = { ...prev, coaching: { text: null, error: 'No monthly data available.', loading: false } };
            saveInsightsToCache(period, updated);
            return updated;
          });
          return;
        }
        result = await generateActionableCoaching(patternsText, reflectionsText, monthlyStats);
      }

      if (result === null) {
        setInsights(prev => {
          const updated = { ...prev, [tab]: { text: null, error: 'Add your OpenRouter API key in Settings to enable AI insights.', loading: false } };
          saveInsightsToCache(period, updated);
          return updated;
        });
      } else if ('error' in result) {
        setInsights(prev => {
          const updated = { ...prev, [tab]: { text: null, error: result.error, loading: false } };
          saveInsightsToCache(period, updated);
          return updated;
        });
      } else {
        setInsights(prev => {
          const updated = { ...prev, [tab]: { text: result.text, error: null, loading: false } };
          saveInsightsToCache(period, updated);
          return updated;
        });
      }
    } catch {
      setInsights(prev => {
        const updated = { ...prev, [tab]: { text: null, error: 'Something went wrong. Try again.', loading: false } };
        saveInsightsToCache(period, updated);
        return updated;
      });
    }
  };

  const current = insights[activeTab];

  return (
    <div className="ai-panel-border rounded-2xl p-5 flex flex-col" style={{ maxHeight: '500px' }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4 flex-none">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-focus animate-pulse" />
          <span className="text-xs uppercase tracking-[0.15em] text-txt-muted font-display">AI Insights</span>
        </div>
        <button
          onClick={() => generateInsight(activeTab)}
          disabled={current.loading}
          className="px-3 py-1 text-[10px] uppercase tracking-wider font-display text-focus border border-focus/20 rounded-lg hover:bg-focus/10 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {current.loading ? 'Working...' : current.text ? 'Redo' : 'Generate'}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-0.5 mb-4 flex-none">
        {(Object.keys(TAB_META) as TabId[]).map(tab => {
          const meta = TAB_META[tab];
          const isActive = activeTab === tab;
          const hasContent = insights[tab].text;

          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-2 text-[10px] uppercase tracking-wider font-display rounded-lg transition-all
                ${isActive
                  ? 'bg-white/[0.06] text-focus border border-focus/15'
                  : 'text-txt-dim hover:text-txt-muted border border-transparent'
                }
              `}
            >
              <span className="font-mono mr-1 opacity-50">{meta.icon}</span>
              {meta.label}
              {hasContent && <span className="ml-1 inline-block w-1 h-1 rounded-full bg-focus/60" />}
            </button>
          );
        })}
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {current.loading ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 py-8">
            <div className="w-6 h-6 border-2 border-focus/20 border-t-focus rounded-full animate-spin" />
            <span className="text-[10px] uppercase tracking-widest text-txt-dim">Analyzing</span>
          </div>
        ) : current.error ? (
          <div className="text-xs text-txt-dim leading-relaxed py-4">{current.error}</div>
        ) : current.text ? (
          <div className="text-[13px] text-txt-secondary leading-[1.7] whitespace-pre-wrap">{current.text}</div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full py-8 text-center">
            <div className="text-2xl text-txt-dim/30 mb-2 font-mono">{TAB_META[activeTab].icon}</div>
            <p className="text-xs text-txt-dim max-w-[200px]">
              Click Generate to get AI-powered {activeTab === 'patterns' ? 'pattern analysis' : activeTab === 'reflections' ? 'reflection synthesis' : 'coaching suggestions'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
