// The sidebar: section names only. Clicking one opens that section's landing page; hovering one shows a quick list of its
// pages. The pages are never listed in the sidebar itself, so it stays short. Keyboard and touch users open the landing page.
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { NavGroup } from './catalog';

interface Props {
  groups: NavGroup[];
  activeGroup: string | undefined;
  /** the page being shown, so its entry in the hover list can be marked */
  page: string;
  onHub: (groupId: string) => void;
  onPage: (pageId: string) => void;
}

const wide = () => typeof window !== 'undefined' && window.matchMedia('(min-width: 861px) and (hover: hover)').matches;

/** The sticky header changes height when it wraps, so the sidebar's sticky offset follows it instead of a fixed 57px. */
function useTopbarHeight() {
  useEffect(() => {
    const bar = document.querySelector<HTMLElement>('.topbar');
    if (!bar) return;
    const set = () => document.documentElement.style.setProperty('--topbar-h', `${Math.ceil(bar.getBoundingClientRect().height)}px`);
    set();
    const ro = new ResizeObserver(set);
    ro.observe(bar);
    return () => ro.disconnect();
  }, []);
}

export default function SideNav({ groups, activeGroup, page, onHub, onPage }: Props) {
  const [open, setOpen] = useState<{ id: string; top: number; left: number } | null>(null);
  const timer = useRef<number>();
  useTopbarHeight();
  useEffect(() => () => window.clearTimeout(timer.current), []);

  // A fixed list would drift from its button if anything scrolls or the window changes, and Escape should always dismiss it
  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(null);
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    window.addEventListener('keydown', key);
    return () => { window.removeEventListener('scroll', close, true); window.removeEventListener('resize', close); window.removeEventListener('keydown', key); };
  }, [open]);

  const show = (id: string, el: HTMLElement) => {
    window.clearTimeout(timer.current);
    if (!wide()) return;
    const r = el.getBoundingClientRect();
    setOpen({ id, top: r.top, left: r.right });
  };
  const keep = () => window.clearTimeout(timer.current);
  const hide = () => { window.clearTimeout(timer.current); timer.current = window.setTimeout(() => setOpen(null), 140); };

  return (
    <>
      {groups.map((g) => {
        const single = g.items.length === 1;
        const count = g.items.reduce((n, i) => n + (i.count ?? 0), 0);
        const list = !single && open?.id === g.id && wide();
        return (
          <div key={g.id} className="navgroup" onMouseEnter={(e) => show(g.id, e.currentTarget)} onMouseLeave={hide}>
            <button
              className={`item navgroup-btn${activeGroup === g.id ? ' on' : ''}`}
              aria-current={activeGroup === g.id ? 'true' : undefined}
              onClick={() => { setOpen(null); if (single) onPage(g.items[0]!.id); else onHub(g.id); }}
            >
              <span>{g.title}</span>
              {!!count && <span className="count">{count}</span>}
              <span className="chev" aria-hidden="true">›</span>
            </button>
            {/* Rendered at the top of the page: the sidebar is sticky, which makes it its own stacking layer, so a list inside it would sit under the page */}
            {list && createPortal(
              <ul className="flyout" style={{ top: open.top, left: open.left }} onMouseEnter={keep} onMouseLeave={hide}>
                {g.items.map((it) => (
                  <li key={it.id}>
                    <button className={`flyout-item${page === it.id ? ' on' : ''}`} onClick={() => { setOpen(null); onPage(it.id); }}>
                      <span>{it.label}</span>
                      {!!it.count && <span className="count">{it.count}</span>}
                    </button>
                  </li>
                ))}
              </ul>,
              document.body,
            )}
          </div>
        );
      })}
    </>
  );
}
