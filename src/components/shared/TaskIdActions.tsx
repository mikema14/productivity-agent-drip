import { useEffect, useRef, useState } from 'react';
import { isTaskId } from '../../utils/taskLink';

/**
 * One app-wide handler for every element marked `data-task-id`:
 * - right-click → native menu (Copy id · Copy link · Open in Easy8)
 * - ⌘-click → open the task in the browser (the row underneath does not react)
 * - plain click on an id that is not inside a button, link or picker row → copy the id
 * Mounted once in App; ids opt in with the attribute, nothing else to wire per screen.
 */
const INTERACTIVE = 'button, a, input, textarea, select, label, [role="button"], [role="option"], [role="menuitem"]';

function taskIdFrom(event: Event): { el: HTMLElement; id: string } | null {
  const target = event.target;
  if (!(target instanceof Element)) return null;
  const el = target.closest<HTMLElement>('[data-task-id]');
  const id = el?.dataset.taskId;
  return el && isTaskId(id) ? { el, id } : null;
}

export default function TaskIdActions() {
  const [copied, setCopied] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const act = (action: 'copy' | 'open' | 'menu', id: string) => {
      void window.timerAPI.taskIdAction?.(action, id);
      if (action === 'copy') {
        setCopied(id);
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => setCopied(null), 1400);
      }
    };

    // Picker rows pick on mousedown: keep right-click, Ctrl-click (= right-click on a Mac) and ⌘-click on an id
    // from reaching them; preventDefault keeps focus in the search box so its suggestion list stays open.
    const onMouseDown = (e: MouseEvent) => {
      if (!(e.button === 2 || (e.button === 0 && (e.metaKey || e.ctrlKey)))) return;
      if (!taskIdFrom(e)) return;
      e.preventDefault();
      e.stopPropagation();
    };
    const onClick = (e: MouseEvent) => {
      if (e.button !== 0) return;
      const hit = taskIdFrom(e);
      if (!hit) return;
      if (e.metaKey) {
        e.preventDefault();
        e.stopPropagation();
        act('open', hit.id);
        return;
      }
      if (e.shiftKey || e.altKey || e.ctrlKey) return;
      // The row's own click wins; a draggable Plan card (dnd-kit role=button) is not a row action.
      const row = hit.el.parentElement?.closest(INTERACTIVE);
      if (row && row.getAttribute('aria-roledescription') !== 'sortable') return;
      e.preventDefault();
      e.stopPropagation();
      act('copy', hit.id);
    };
    const onContextMenu = (e: MouseEvent) => {
      const hit = taskIdFrom(e);
      if (!hit) return;
      e.preventDefault();
      e.stopPropagation();
      act('menu', hit.id);
    };

    document.addEventListener('mousedown', onMouseDown, true);
    document.addEventListener('click', onClick, true);
    document.addEventListener('contextmenu', onContextMenu, true);
    return () => {
      document.removeEventListener('mousedown', onMouseDown, true);
      document.removeEventListener('click', onClick, true);
      document.removeEventListener('contextmenu', onContextMenu, true);
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  if (!copied) return null;
  return (
    <div
      role="status"
      data-testid="task-id-copied"
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[10000] pointer-events-none px-3 py-1.5 rounded-[2px] border border-drip-border bg-drip-elevated font-display text-[12px] text-txt-secondary animate-fade-in"
    >
      Copied <span className="font-mono text-focus">{copied}</span>
    </div>
  );
}
