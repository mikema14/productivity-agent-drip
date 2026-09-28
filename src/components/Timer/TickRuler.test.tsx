import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import TickRuler, { labelStep } from './TickRuler';

function ticks() {
  return Array.from(screen.getByTestId('tick-ruler').querySelectorAll('[data-tick]'));
}
function labels() {
  return Array.from(screen.getByTestId('tick-ruler').querySelectorAll('[data-label]')).map(l => l.textContent);
}

describe('TickRuler', () => {
  it('25 min: 26 ticks and labels 00…25 every 5', () => {
    render(<TickRuler totalMinutes={25} elapsedSeconds={0} />);
    expect(ticks()).toHaveLength(26);
    expect(labels()).toEqual(['00', '05', '10', '15', '20', '25']);
  });

  it('90 min: labels every 15', () => {
    render(<TickRuler totalMinutes={90} elapsedSeconds={0} />);
    expect(labelStep(90)).toBe(15);
    expect(labels()).toEqual(['00', '15', '30', '45', '60', '75', '90']);
  });

  it('50 min labels every 10, 2 min every minute', () => {
    expect(labelStep(50)).toBe(10);
    expect(labelStep(15)).toBe(5);
    render(<TickRuler totalMinutes={2} elapsedSeconds={0} />);
    expect(labels()).toEqual(['00', '01', '02']);
  });

  it('600 s elapsed of 25 min lights the first 10 ticks amber', () => {
    render(<TickRuler totalMinutes={25} elapsedSeconds={600} active />);
    const lit = ticks().filter(t => t.classList.contains('bg-focus'));
    expect(lit).toHaveLength(10);
    expect(lit.map(t => t.getAttribute('data-tick'))).toEqual(['0', '1', '2', '3', '4', '5', '6', '7', '8', '9']);
    expect(ticks()[10]).toHaveClass('bg-txt-dim');
  });

  it('emerald tone in break, dimmed when paused', () => {
    render(<TickRuler totalMinutes={5} elapsedSeconds={120} tone="emerald" dimmed />);
    expect(ticks()[1]).toHaveClass('bg-break');
    expect(screen.getByTestId('tick-ruler')).toHaveClass('opacity-50');
  });
});
