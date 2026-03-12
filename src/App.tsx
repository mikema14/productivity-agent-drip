import { useState, useEffect } from 'react';
import Sidebar from './components/Layout/Sidebar';
import MainContent from './components/Layout/MainContent';
import Timer from './components/Timer/Timer';
import DailyLog from './components/DailyLog/DailyLog';
import Settings from './components/Settings/Settings';
import ProgressPage from './components/Progress/ProgressPage';
import ListPlanningView from './components/Lists/ListPlanningView';
import AllListsOverview from './components/Lists/AllListsOverview';
import CreateListModal from './components/Lists/CreateListModal';
import { useListsStore } from './stores/listsStore';
import { loadSessionCount, checkTimerHydration, cleanupTimerIntervals, setupMainTimerListeners } from './stores/timerStore';
import { useLogStore } from './stores/logStore';

function App() {
  const [currentView, setCurrentView] = useState('timer');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showCreateList, setShowCreateList] = useState(false);

  // Load session count and check for stuck timer states on mount
  useEffect(() => {
    loadSessionCount();
    checkTimerHydration();
    setupMainTimerListeners(); // Setup main process timer event listeners
  }, []);

  // Cleanup intervals on unmount
  useEffect(() => {
    return () => {
      console.log('App unmounting - cleaning up timer intervals');
      cleanupTimerIntervals();
    };
  }, []);

  // Restore log state on mount - load entries for the selected date
  useEffect(() => {
    const { selectedDate, loadDay } = useLogStore.getState();
    const dateToLoad = selectedDate || new Date().toISOString().split('T')[0];
    loadDay(dateToLoad);
  }, []);

  // Check for 6+ days without logging on startup
  useEffect(() => {
    const checkLastLog = async () => {
      try {
        if (window.timerAPI.getDaysSinceLastLog) {
          const days = await window.timerAPI.getDaysSinceLastLog();
          if (days !== null && days >= 6) {
            window.timerAPI.showNotification(
              'Time to Log Your Work',
              `It's been ${days} days since your last log. Don't forget to track your progress!`
            );
          }
        }
      } catch (error) {
        console.error('Failed to check last log date:', error);
      }
    };

    checkLastLog();
  }, []);

  const renderView = () => {
    switch (currentView) {
      case 'timer':
        return <Timer />;
      case 'daily-log':
        return <DailyLog />;
      case 'progress':
        return <ProgressPage />;
      case 'settings':
        return <Settings />;
      case 'lists':
        return <ListPlanningView />;
      case 'all-lists':
        return <AllListsOverview />;
      default:
        return <Timer />;
    }
  };

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar onNavigate={setCurrentView} currentView={currentView} collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(c => !c)} onCreateList={() => setShowCreateList(true)} />
      <MainContent>{renderView()}</MainContent>
      {showCreateList && (
        <CreateListModal onClose={() => { setShowCreateList(false); useListsStore.getState().loadLists(); }} />
      )}
    </div>
  );
}

export default App;
