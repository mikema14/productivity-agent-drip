import type { CSSProperties, ReactNode } from 'react';
import { RAIL_ITEMS, isRailItemActive, type RailItem, type ViewId } from './views';

interface RailProps {
  view: ViewId;
  onNavigate: (view: ViewId) => void;
}

const dragRegion = { WebkitAppRegion: 'drag' } as CSSProperties;
const noDragRegion = { WebkitAppRegion: 'no-drag' } as CSSProperties;

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

function NowIcon() {
  return (
    <svg {...svgProps}>
      <circle cx="9" cy="9.5" r="6.5" />
      <line x1="9" y1="9.5" x2="9" y2="6.5" />
      <line x1="9" y1="9.5" x2="11.5" y2="9.5" />
      <line x1="9" y1="2" x2="9" y2="3" />
    </svg>
  );
}

function PlanIcon() {
  return (
    <svg {...svgProps}>
      <rect x="2" y="3" width="4" height="12" rx="1" />
      <rect x="7" y="3" width="4" height="8" rx="1" />
      <rect x="12" y="3" width="4" height="5" rx="1" />
    </svg>
  );
}

function ReviewIcon() {
  return (
    <svg {...svgProps}>
      <rect x="3.5" y="3" width="11" height="13" rx="1.5" />
      <path d="M6.5 3V2a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v1" />
      <line x1="6.5" y1="8" x2="11.5" y2="8" />
      <line x1="6.5" y1="11" x2="10" y2="11" />
    </svg>
  );
}

function InsightsIcon() {
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

const ICONS: Record<RailItem['id'], ReactNode> = {
  timer: <NowIcon />,
  plan: <PlanIcon />,
  review: <ReviewIcon />,
  insights: <InsightsIcon />,
};

/** The 4px amber square that marks the active rail item. */
function Led() {
  return <span aria-hidden data-testid="rail-led" className="absolute top-1.5 right-1.5 w-1 h-1 bg-focus shadow-led" />;
}

/**
 * 72px navigation rail. The whole rail is a window-drag region (it sits under
 * the traffic lights), each button opts out.
 */
export default function Rail({ view, onNavigate }: RailProps) {
  const settingsActive = view === 'settings';

  return (
    <nav
      aria-label="Primary"
      className="w-[72px] h-screen shrink-0 flex flex-col items-center gap-1 pt-[52px] pb-4 border-r border-drip-elevated bg-drip-bg"
      style={dragRegion}
    >
      {RAIL_ITEMS.map((item) => {
        const active = isRailItemActive(item, view);
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onNavigate(item.target)}
            aria-current={active ? 'page' : undefined}
            style={noDragRegion}
            className={`relative w-14 h-[52px] rounded-[2px] flex flex-col items-center justify-center gap-1 transition-colors duration-150 ${
              active ? 'bg-focus/10 text-focus' : 'text-txt-muted hover:text-txt-primary hover:bg-focus/5'
            }`}
          >
            {active && <Led />}
            {ICONS[item.id]}
            <span className="now-label">{item.label}</span>
          </button>
        );
      })}

      <div className="flex-1" />

      <button
        type="button"
        aria-label="Settings"
        onClick={() => onNavigate('settings')}
        aria-current={settingsActive ? 'page' : undefined}
        style={noDragRegion}
        className={`relative w-14 h-11 rounded-[2px] flex items-center justify-center transition-colors duration-150 ${
          settingsActive ? 'bg-focus/10 text-focus' : 'text-txt-muted hover:text-txt-primary hover:bg-focus/5'
        }`}
      >
        {settingsActive && <Led />}
        <GearIcon />
      </button>
    </nav>
  );
}
