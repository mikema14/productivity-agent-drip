import type { WeeklySummary } from '../types';

interface MonthlyStats {
  totalMinutes: number;
  deepWorkMinutes: number;
  daysWorked: number;
  dailyMinutes: Array<{ date: string; minutes: number; deepMinutes: number }>;
}

interface Reflection {
  date: string;
  reflection: string;
  notes: string | null;
}

interface AIInsightResult {
  text: string;
  type: 'patterns' | 'reflections' | 'coaching';
}

async function getAIConfig(): Promise<{ apiKey: string; model: string } | null> {
  const apiKey = await window.timerAPI.getSettings('openRouterApiKey');
  if (!apiKey) return null;

  const model = await window.timerAPI.getSettings('openRouterModel') || 'anthropic/claude-4.5-sonnet-20250929';
  return { apiKey, model };
}

export async function generateWeeklyPatterns(
  weeklySummaries: WeeklySummary[],
  timeOfDay: Array<{ hour: number; minutes: number }>
): Promise<AIInsightResult | { error: string } | null> {
  const config = await getAIConfig();
  if (!config) return null;

  const systemPrompt = `You are a productivity analyst. Analyze the user's weekly work summaries to identify patterns. Be concise and specific to the data. No generic advice. Use 3-5 sentences max.`;

  const userMessage = JSON.stringify({
    weeks: weeklySummaries.map(w => ({
      week_start: w.week_start,
      deep_work_minutes: w.deep_work_minutes,
      total_minutes: w.total_minutes,
      sessions_completed: w.sessions_completed,
      avg_session_minutes: Math.round(w.avg_session_minutes),
      peak_hour: w.peak_hour,
      morning_minutes: w.morning_minutes,
      afternoon_minutes: w.afternoon_minutes,
      evening_minutes: w.evening_minutes,
    })),
    time_of_day_distribution: timeOfDay
  });

  const result = await window.aiAPI.callOpenRouter(config.apiKey, config.model, systemPrompt, userMessage);

  if (result.success && result.text) {
    return { text: result.text, type: 'patterns' };
  }
  return { error: result.error || 'Failed to generate patterns' };
}

export async function generateReflectionSynthesis(
  period: string,
  reflections: Reflection[]
): Promise<AIInsightResult | { error: string } | null> {
  const config = await getAIConfig();
  if (!config) return null;

  if (reflections.length === 0) {
    return { error: 'No reflections to analyze for this period.' };
  }

  const systemPrompt = `You are a thoughtful coach. Synthesize the user's daily reflections to surface recurring themes, emotional patterns, and self-awareness moments. Be concise and specific. Use 3-5 sentences max.`;

  const userMessage = JSON.stringify({
    period,
    reflections: reflections.map(r => ({
      date: r.date,
      reflection: r.reflection,
      notes: r.notes || undefined
    }))
  });

  const result = await window.aiAPI.callOpenRouter(config.apiKey, config.model, systemPrompt, userMessage);

  if (result.success && result.text) {
    return { text: result.text, type: 'reflections' };
  }
  return { error: result.error || 'Failed to synthesize reflections' };
}

export async function generateActionableCoaching(
  patternsText: string,
  reflectionsText: string,
  currentStats: MonthlyStats
): Promise<AIInsightResult | { error: string } | null> {
  const config = await getAIConfig();
  if (!config) return null;

  const systemPrompt = `You are a productivity coach. Based on the analysis of work patterns and reflections, give 2-3 specific, actionable suggestions. Be direct and concrete. No generic advice like "take breaks" or "stay focused."`;

  const userMessage = JSON.stringify({
    patterns_analysis: patternsText,
    reflections_analysis: reflectionsText,
    current_month: {
      total_hours: Math.round(currentStats.totalMinutes / 60 * 10) / 10,
      deep_work_hours: Math.round(currentStats.deepWorkMinutes / 60 * 10) / 10,
      deep_work_percent: currentStats.totalMinutes > 0
        ? Math.round((currentStats.deepWorkMinutes / currentStats.totalMinutes) * 100)
        : 0,
      days_worked: currentStats.daysWorked
    }
  });

  const result = await window.aiAPI.callOpenRouter(config.apiKey, config.model, systemPrompt, userMessage);

  if (result.success && result.text) {
    return { text: result.text, type: 'coaching' };
  }
  return { error: result.error || 'Failed to generate coaching suggestions' };
}
