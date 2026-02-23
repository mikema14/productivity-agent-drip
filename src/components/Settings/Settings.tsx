import { useState, useEffect } from 'react';
import GoalsManagement from './GoalsManagement';
import TaskTrackingPreferences from './TaskTrackingPreferences';

export default function Settings() {
  const [settings, setSettings] = useState({
    apiBaseUrl: 'https://es.easyproject.com',
    apiKey: '',
    calendarUrl: '',
    pomodoroFocus: 25,
    pomodoroShortBreak: 5,
    pomodoroLongBreak: 10,
    sessionsUntilLongBreak: 3,
    defaultBillable: true,
    roundingMode: 'none' as 'none' | '5min' | '15min',
    workdayEndTime: '18:00',
    enableBoundaryCheck: false,
    openRouterApiKey: '',
    openRouterModel: 'anthropic/claude-4.5-sonnet-20250929',
  });

  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isTestingApi, setIsTestingApi] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const apiBaseUrl = await window.timerAPI.getSettings('apiBaseUrl') || 'https://es.easyproject.com';
      const apiKey = await window.timerAPI.getSettings('apiKey') || '';
      const calendarUrl = await window.timerAPI.getSettings('calendarUrl') || '';
      const pomodoroFocus = parseInt(await window.timerAPI.getSettings('pomodoroFocus') || '25');
      const pomodoroShortBreak = parseInt(await window.timerAPI.getSettings('pomodoroShortBreak') || '5');
      const pomodoroLongBreak = parseInt(await window.timerAPI.getSettings('pomodoroLongBreak') || '10');
      const sessionsUntilLongBreak = parseInt(await window.timerAPI.getSettings('sessionsUntilLongBreak') || '3');
      const defaultBillable = (await window.timerAPI.getSettings('defaultBillable') || 'true') === 'true';
      const roundingMode = (await window.timerAPI.getSettings('roundingMode') || 'none') as 'none' | '5min' | '15min';
      const workdayEndTime = await window.timerAPI.getSettings('workdayEndTime') || '18:00';
      const enableBoundaryCheck = (await window.timerAPI.getSettings('enableBoundaryCheck') || 'false') === 'true';
      const openRouterApiKey = await window.timerAPI.getSettings('openRouterApiKey') || '';
      const openRouterModel = await window.timerAPI.getSettings('openRouterModel') || 'anthropic/claude-4.5-sonnet-20250929';

      setSettings({
        apiBaseUrl,
        apiKey,
        calendarUrl,
        pomodoroFocus,
        pomodoroShortBreak,
        pomodoroLongBreak,
        sessionsUntilLongBreak,
        defaultBillable,
        roundingMode,
        workdayEndTime,
        enableBoundaryCheck,
        openRouterApiKey,
        openRouterModel,
      });
    } catch (error) {
      console.error('Failed to load settings:', error);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    setSaveMessage(null);

    try {
      await window.timerAPI.saveSettings('apiBaseUrl', settings.apiBaseUrl);
      await window.timerAPI.saveSettings('apiKey', settings.apiKey);
      await window.timerAPI.saveSettings('calendarUrl', settings.calendarUrl);
      await window.timerAPI.saveSettings('pomodoroFocus', settings.pomodoroFocus.toString());
      await window.timerAPI.saveSettings('pomodoroShortBreak', settings.pomodoroShortBreak.toString());
      await window.timerAPI.saveSettings('pomodoroLongBreak', settings.pomodoroLongBreak.toString());
      await window.timerAPI.saveSettings('sessionsUntilLongBreak', settings.sessionsUntilLongBreak.toString());
      await window.timerAPI.saveSettings('defaultBillable', settings.defaultBillable.toString());
      await window.timerAPI.saveSettings('roundingMode', settings.roundingMode);
      await window.timerAPI.saveSettings('workdayEndTime', settings.workdayEndTime);
      await window.timerAPI.saveSettings('enableBoundaryCheck', settings.enableBoundaryCheck.toString());
      await window.timerAPI.saveSettings('openRouterApiKey', settings.openRouterApiKey);
      await window.timerAPI.saveSettings('openRouterModel', settings.openRouterModel);

      setSaveMessage({ type: 'success', text: 'Settings saved successfully!' });
      setTimeout(() => setSaveMessage(null), 3000);
    } catch (error) {
      setSaveMessage({ type: 'error', text: 'Failed to save settings' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestApi = async () => {
    console.log('Test Connection clicked');

    if (!settings.apiKey) {
      console.log('No API key provided');
      setSaveMessage({ type: 'error', text: 'Please enter an API key first' });
      return;
    }

    setIsTestingApi(true);
    setSaveMessage(null);

    try {
      // Use the standard Redmine endpoint to verify authentication
      // This is better than testing with a specific issue ID
      const url = `${settings.apiBaseUrl}/users/current.json`;
      console.log('Testing API connection to:', url);
      console.log('Using API key:', settings.apiKey.substring(0, 10) + '...');

      // Use Electron's net module via IPC instead of fetch to avoid CORS
      const result = await window.timerAPI.testApiConnection?.(settings.apiBaseUrl, settings.apiKey);

      if (result) {
        console.log('API test successful:', result);
        setSaveMessage({
          type: 'success',
          text: `API connection successful! Authenticated as: ${result.user.firstname} ${result.user.lastname}`
        });
      }
    } catch (error) {
      console.error('API test error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      if (errorMessage.includes('401') || errorMessage.includes('Invalid API key')) {
        setSaveMessage({ type: 'error', text: 'Invalid API key' });
      } else if (errorMessage.includes('404')) {
        setSaveMessage({ type: 'error', text: 'API endpoint not found - check base URL' });
      } else {
        setSaveMessage({
          type: 'error',
          text: `Failed to connect: ${errorMessage}`
        });
      }
    } finally {
      console.log('Test completed');
      setIsTestingApi(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-8 py-6 h-full">
    <div className="flex flex-col h-full">
      <div className="flex-none px-6 py-4 border-b border-glass-border">
        <h1 className="text-2xl font-display font-semibold text-txt-primary">Settings</h1>
      </div>

      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-2xl space-y-8">
          {/* API Settings */}
          <section>
            <h2 className="text-lg font-display font-semibold text-txt-primary mb-4">Easy Project API</h2>
            <div className="space-y-4 glass-surface p-6">
              <div>
                <label className="block uppercase tracking-wider text-xs text-txt-muted mb-2">
                  API Base URL
                </label>
                <input
                  type="text"
                  value={settings.apiBaseUrl}
                  onChange={(e) => setSettings({ ...settings, apiBaseUrl: e.target.value })}
                  className="w-full px-4 py-2.5 bg-glass-bg border border-glass-border rounded-xl text-txt-primary placeholder-txt-dim focus:outline-none focus:ring-2 focus:ring-focus/30 focus:border-focus/30"
                  placeholder="https://es.easyproject.com"
                />
              </div>

              <div>
                <label className="block uppercase tracking-wider text-xs text-txt-muted mb-2">
                  API Key
                </label>
                <input
                  type="password"
                  value={settings.apiKey}
                  onChange={(e) => setSettings({ ...settings, apiKey: e.target.value })}
                  className="w-full px-4 py-2.5 bg-glass-bg border border-glass-border rounded-xl text-txt-primary placeholder-txt-dim focus:outline-none focus:ring-2 focus:ring-focus/30 focus:border-focus/30"
                  placeholder="Your Easy Project API key"
                />
                <p className="mt-1 text-xs text-txt-dim">
                  Find your API key in Easy Project under My Account → API access key
                </p>
              </div>

              <button
                onClick={handleTestApi}
                disabled={isTestingApi || !settings.apiKey}
                className="px-4 py-2 text-sm font-medium bg-focus/10 border border-focus/20 text-focus hover:bg-focus/20 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isTestingApi ? 'Testing...' : 'Test Connection'}
              </button>
            </div>
          </section>

          {/* Calendar Settings */}
          <section>
            <h2 className="text-lg font-display font-semibold text-txt-primary mb-4">Calendar Integration</h2>
            <div className="space-y-4 glass-surface p-6">
              <div>
                <label className="block uppercase tracking-wider text-xs text-txt-muted mb-2">
                  Outlook Calendar ICS URL
                </label>
                <input
                  type="text"
                  value={settings.calendarUrl}
                  onChange={(e) => setSettings({ ...settings, calendarUrl: e.target.value })}
                  className="w-full px-4 py-2.5 bg-glass-bg border border-glass-border rounded-xl text-txt-primary placeholder-txt-dim focus:outline-none focus:ring-2 focus:ring-focus/30 focus:border-focus/30"
                  placeholder="https://outlook.office365.com/owa/calendar/..."
                />
                <p className="mt-1 text-xs text-txt-dim">
                  Get this URL from Outlook Calendar → Share → Publish Calendar
                </p>
              </div>
            </div>
          </section>

          {/* Pomodoro Settings */}
          <section>
            <h2 className="text-lg font-display font-semibold text-txt-primary mb-4">Pomodoro Timer</h2>
            <div className="space-y-4 glass-surface p-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block uppercase tracking-wider text-xs text-txt-muted mb-2">
                    Focus Duration (minutes)
                  </label>
                  <input
                    type="number"
                    value={settings.pomodoroFocus}
                    onChange={(e) => setSettings({ ...settings, pomodoroFocus: parseInt(e.target.value) || 25 })}
                    min="1"
                    max="60"
                    className="w-full px-4 py-2.5 bg-glass-bg border border-glass-border rounded-xl text-txt-primary placeholder-txt-dim focus:outline-none focus:ring-2 focus:ring-focus/30 focus:border-focus/30"
                  />
                </div>

                <div>
                  <label className="block uppercase tracking-wider text-xs text-txt-muted mb-2">
                    Short Break (minutes)
                  </label>
                  <input
                    type="number"
                    value={settings.pomodoroShortBreak}
                    onChange={(e) => setSettings({ ...settings, pomodoroShortBreak: parseInt(e.target.value) || 5 })}
                    min="1"
                    max="30"
                    className="w-full px-4 py-2.5 bg-glass-bg border border-glass-border rounded-xl text-txt-primary placeholder-txt-dim focus:outline-none focus:ring-2 focus:ring-focus/30 focus:border-focus/30"
                  />
                </div>

                <div>
                  <label className="block uppercase tracking-wider text-xs text-txt-muted mb-2">
                    Long Break (minutes)
                  </label>
                  <input
                    type="number"
                    value={settings.pomodoroLongBreak}
                    onChange={(e) => setSettings({ ...settings, pomodoroLongBreak: parseInt(e.target.value) || 10 })}
                    min="1"
                    max="60"
                    className="w-full px-4 py-2.5 bg-glass-bg border border-glass-border rounded-xl text-txt-primary placeholder-txt-dim focus:outline-none focus:ring-2 focus:ring-focus/30 focus:border-focus/30"
                  />
                </div>

                <div>
                  <label className="block uppercase tracking-wider text-xs text-txt-muted mb-2">
                    Sessions until Long Break
                  </label>
                  <input
                    type="number"
                    value={settings.sessionsUntilLongBreak}
                    onChange={(e) => setSettings({ ...settings, sessionsUntilLongBreak: parseInt(e.target.value) || 3 })}
                    min="1"
                    max="10"
                    className="w-full px-4 py-2.5 bg-glass-bg border border-glass-border rounded-xl text-txt-primary placeholder-txt-dim focus:outline-none focus:ring-2 focus:ring-focus/30 focus:border-focus/30"
                  />
                </div>
              </div>
            </div>
          </section>

          {/* Time Logging Settings */}
          <section>
            <h2 className="text-lg font-display font-semibold text-txt-primary mb-4">Time Logging</h2>
            <div className="space-y-4 glass-surface p-6">
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="defaultBillable"
                  checked={settings.defaultBillable}
                  onChange={(e) => setSettings({ ...settings, defaultBillable: e.target.checked })}
                  className="w-4 h-4 text-focus border-glass-border bg-glass-bg rounded focus:ring-focus/30"
                />
                <label htmlFor="defaultBillable" className="ml-2 text-sm font-medium text-txt-secondary">
                  Mark entries as billable by default
                </label>
              </div>

              <div>
                <label className="block uppercase tracking-wider text-xs text-txt-muted mb-2">
                  Time Rounding
                </label>
                <select
                  value={settings.roundingMode}
                  onChange={(e) => setSettings({ ...settings, roundingMode: e.target.value as any })}
                  className="w-full px-4 py-2.5 bg-glass-bg border border-glass-border rounded-xl text-txt-primary focus:outline-none focus:ring-2 focus:ring-focus/30 focus:border-focus/30"
                >
                  <option value="none">No rounding</option>
                  <option value="5min">Round to nearest 5 minutes</option>
                  <option value="15min">Round to nearest 15 minutes</option>
                </select>
              </div>

              <div className="pt-4 border-t border-glass-border">
                <h3 className="text-sm font-display font-semibold text-txt-primary mb-3">Workday Boundaries</h3>

                <div className="flex items-center mb-3">
                  <input
                    type="checkbox"
                    id="enableBoundaryCheck"
                    checked={settings.enableBoundaryCheck}
                    onChange={(e) => setSettings({ ...settings, enableBoundaryCheck: e.target.checked })}
                    className="w-4 h-4 text-focus border-glass-border bg-glass-bg rounded focus:ring-focus/30"
                  />
                  <label htmlFor="enableBoundaryCheck" className="ml-2 text-sm font-medium text-txt-secondary">
                    Show confirmation when starting work outside preferred hours
                  </label>
                </div>

                <div>
                  <label className="block uppercase tracking-wider text-xs text-txt-muted mb-2">
                    Preferred Workday End Time
                  </label>
                  <input
                    type="time"
                    value={settings.workdayEndTime}
                    onChange={(e) => setSettings({ ...settings, workdayEndTime: e.target.value })}
                    disabled={!settings.enableBoundaryCheck}
                    className="px-4 py-2.5 bg-glass-bg border border-glass-border rounded-xl text-txt-primary focus:outline-none focus:ring-2 focus:ring-focus/30 focus:border-focus/30 disabled:opacity-40 disabled:text-txt-dim"
                  />
                  <p className="mt-1 text-xs text-txt-dim">
                    You'll be asked to confirm if you start work after this time
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* AI Insights */}
          <section>
            <h2 className="text-lg font-display font-semibold text-txt-primary mb-4">AI Insights</h2>
            <div className="space-y-4 glass-surface p-6">
              <div>
                <label className="block uppercase tracking-wider text-xs text-txt-muted mb-2">
                  OpenRouter API Key
                </label>
                <input
                  type="password"
                  value={settings.openRouterApiKey}
                  onChange={(e) => setSettings({ ...settings, openRouterApiKey: e.target.value })}
                  className="w-full px-4 py-2.5 bg-glass-bg border border-glass-border rounded-xl text-txt-primary placeholder-txt-dim focus:outline-none focus:ring-2 focus:ring-focus/30 focus:border-focus/30"
                  placeholder="sk-or-..."
                />
                <p className="mt-1 text-xs text-txt-dim">
                  Get your API key at openrouter.ai/keys — enables AI-powered work pattern analysis
                </p>
              </div>

              <div>
                <label className="block uppercase tracking-wider text-xs text-txt-muted mb-2">
                  Model
                </label>
                <input
                  type="text"
                  value={settings.openRouterModel}
                  onChange={(e) => setSettings({ ...settings, openRouterModel: e.target.value })}
                  className="w-full px-4 py-2.5 bg-glass-bg border border-glass-border rounded-xl text-txt-primary placeholder-txt-dim focus:outline-none focus:ring-2 focus:ring-focus/30 focus:border-focus/30"
                  placeholder="anthropic/claude-4.5-sonnet-20250929"
                />
                <p className="mt-1 text-xs text-txt-dim">
                  OpenRouter model identifier (e.g., anthropic/claude-4.5-sonnet-20250929)
                </p>
              </div>
            </div>
          </section>

          {/* Goals Management Section */}
          <section>
            <h2 className="text-lg font-display font-semibold text-txt-primary mb-4">
              Goals & Identity
            </h2>
            <div className="space-y-4 glass-surface p-6">
              <GoalsManagement />
            </div>
          </section>

          {/* Task Tracking Preferences Section */}
          <section>
            <h2 className="text-lg font-display font-semibold text-txt-primary mb-4">
              Task Tracking
            </h2>
            <div className="space-y-4 glass-surface p-6">
              <TaskTrackingPreferences />
            </div>
          </section>

          {/* Save Button */}
          <div className="flex items-center gap-4">
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="px-6 py-2.5 text-sm font-display font-medium text-drip-bg bg-focus hover:bg-focus-light rounded-xl disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving ? 'Saving...' : 'Save Settings'}
            </button>

            {saveMessage && (
              <div className={`px-4 py-2 rounded-xl text-sm ${
                saveMessage.type === 'success'
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                  : 'bg-red-500/10 text-red-400 border border-red-500/20'
              }`}>
                {saveMessage.text}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
    </div>
  );
}
