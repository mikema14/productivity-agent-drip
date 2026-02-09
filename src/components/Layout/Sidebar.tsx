import { useState } from 'react';

interface SidebarProps {
  onNavigate: (view: string) => void;
  currentView: string;
}

export default function Sidebar({ onNavigate, currentView }: SidebarProps) {
  const menuItems = [
    { id: 'timer', label: 'Timer', icon: '⏱️' },
    { id: 'daily-log', label: 'Daily Log', icon: '📋' },
    { id: 'dashboard', label: 'Dashboard', icon: '📊' },
    { id: 'monthly-wrapup', label: 'Monthly Wrap-Up', icon: '📅' },
    { id: 'settings', label: 'Settings', icon: '⚙️' }
  ];

  return (
    <div className="w-64 bg-gray-900 text-white h-screen flex flex-col">
      {/* App Header */}
      <div className="p-6 border-b border-gray-800">
        <h1 className="text-2xl font-bold">Drip</h1>
        <p className="text-sm text-gray-400 mt-1">Consistent Progress</p>
      </div>

      {/* Navigation Menu */}
      <nav className="flex-1 p-4">
        <ul className="space-y-2">
          {menuItems.map((item) => (
            <li key={item.id}>
              <button
                onClick={() => !item.disabled && onNavigate(item.id)}
                disabled={item.disabled}
                className={`
                  w-full flex items-center gap-3 px-4 py-3 rounded-lg
                  transition-colors duration-200
                  ${
                    currentView === item.id
                      ? 'bg-blue-600 text-white'
                      : item.disabled
                      ? 'text-gray-600 cursor-not-allowed'
                      : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                  }
                `}
              >
                <span className="text-xl">{item.icon}</span>
                <span className="font-medium">{item.label}</span>
                {item.disabled && (
                  <span className="ml-auto text-xs text-gray-500">Soon</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-gray-800">
        <p className="text-xs text-gray-500 text-center">
          Drip v1.0
        </p>
      </div>
    </div>
  );
}
