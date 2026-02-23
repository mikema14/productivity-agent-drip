import { ReactNode } from 'react';

interface SidebarProps {
  onNavigate: (view: string) => void;
  currentView: string;
  collapsed: boolean;
  onToggle: () => void;
}

function SidebarToggleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1.5" y="2.5" width="15" height="13" rx="2" />
      <line x1="6.5" y1="2.5" x2="6.5" y2="15.5" />
    </svg>
  );
}

const svgProps = {
  width: 18,
  height: 18,
  viewBox: '0 0 18 18',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.5,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

function TimerIcon() {
  return (
    <svg {...svgProps}>
      <circle cx="9" cy="9.5" r="6.5" />
      <line x1="9" y1="9.5" x2="9" y2="6.5" />
      <line x1="9" y1="9.5" x2="11.5" y2="9.5" />
      <line x1="9" y1="2" x2="9" y2="3" />
    </svg>
  );
}

function ClipboardIcon() {
  return (
    <svg {...svgProps}>
      <rect x="3.5" y="3" width="11" height="13" rx="1.5" />
      <path d="M6.5 3V2a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v1" />
      <line x1="6.5" y1="8" x2="11.5" y2="8" />
      <line x1="6.5" y1="11" x2="10" y2="11" />
    </svg>
  );
}

function BarChartIcon() {
  return (
    <svg {...svgProps}>
      <rect x="2.5" y="9" width="3" height="7" rx="0.5" />
      <rect x="7.5" y="5" width="3" height="11" rx="0.5" />
      <rect x="12.5" y="2" width="3" height="14" rx="0.5" />
    </svg>
  );
}


function GearIcon() {
  return (
    <svg {...svgProps}>
      <circle cx="9" cy="9" r="2.5" />
      <path d="M9 1.5v2M9 14.5v2M1.5 9h2M14.5 9h2M3.7 3.7l1.4 1.4M12.9 12.9l1.4 1.4M3.7 14.3l1.4-1.4M12.9 5.1l1.4-1.4" />
    </svg>
  );
}

export default function Sidebar({ onNavigate, currentView, collapsed, onToggle }: SidebarProps) {
  const menuItems: { id: string; label: string; icon: ReactNode }[] = [
    { id: 'timer', label: 'Timer', icon: <TimerIcon /> },
    { id: 'daily-log', label: 'Daily Log', icon: <ClipboardIcon /> },
    { id: 'progress', label: 'Progress', icon: <BarChartIcon /> },
    { id: 'settings', label: 'Settings', icon: <GearIcon /> },
  ];

  return (
    <div className={`${collapsed ? 'w-[76px]' : 'w-64'} bg-drip-surface/60 backdrop-blur-xl border-r border-glass-border text-txt-primary h-screen flex flex-col overflow-hidden transition-all duration-200`}>
      {/* Titlebar header — clears macOS traffic lights */}
      {collapsed ? (
        <div
          className="h-[68px] flex items-end pb-2 shrink-0 pl-[33px]"
          style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
        >
          <button
            onClick={onToggle}
            title="Expand sidebar"
            className="text-txt-muted hover:text-txt-secondary transition-colors duration-200"
            style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
          >
            <SidebarToggleIcon />
          </button>
        </div>
      ) : (
        <div
          className="h-[52px] flex items-center shrink-0 pl-[78px] gap-2"
          style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
        >
          <button
            onClick={onToggle}
            title="Collapse sidebar"
            className="text-txt-muted hover:text-txt-secondary transition-colors duration-200"
            style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
          >
            <SidebarToggleIcon />
          </button>
          <span className="text-[13px] font-medium text-txt-secondary font-display">Drip</span>
        </div>
      )}

      {/* Navigation Menu */}
      <nav className="flex-1 p-3">
        <ul className="space-y-0.5">
          {menuItems.map((item) => (
            <li key={item.id}>
              <button
                onClick={() => onNavigate(item.id)}
                title={collapsed ? item.label : undefined}
                className={`
                  w-full flex items-center ${collapsed ? 'justify-center' : ''} gap-2.5 px-3 py-2 rounded-md
                  transition-all duration-200
                  ${
                    currentView === item.id
                      ? 'bg-white/[0.08] text-focus'
                      : 'text-txt-secondary hover:bg-white/[0.05] hover:text-txt-primary'
                  }
                `}
              >
                <span className="shrink-0">{item.icon}</span>
                {!collapsed && <span className="font-normal font-display text-[13px] whitespace-nowrap">{item.label}</span>}
              </button>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
