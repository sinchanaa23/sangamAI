// The sidebar: section names only. Clicking one opens that section's landing page; hovering (or tabbing to) one shows a
// quick list of its pages. The pages are never listed in the sidebar itself, so it stays short.
import { useEffect, useRef, useState } from 'react';
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

export default function SideNav({ groups, activeGroup, page, onHub, onPage }: Props) {
  const [open, setOpen] = useState<{ id: string; top: number; left: number } | null>(null);
  const timer = useRef<number>();
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const show = (id: string, el: HTMLElement) => {
    window.clearTimeout(timer.current);
    if (!wide()) return;
    const r = el.getBoundingClientRect();
    setOpen({ id, top: r.top, left: r.right });
  };
  const hide = () => { window.clearTimeout(timer.current); timer.current = window.setTimeout(() => setOpen(null), 140); };

  return (
    <>
      {groups.map((g) => {
        const single = g.items.length === 1;
        const count = g.items.reduce((n, i) => n + (i.count ?? 0), 0);
        return (
          <div
            key={g.id}
            className="navgroup"
            onMouseEnter={(e) => show(g.id, e.currentTarget)}
            onMouseLeave={hide}
            onFocus={(e) => show(g.id, e.currentTarget)}
            onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) hide(); }}
          >
            <button
              className={`item navgroup-btn${activeGroup === g.id ? ' on' : ''}`}
              aria-haspopup={single ? undefined : 'true'}
              aria-expanded={single ? undefined : open?.id === g.id}
              onClick={() => { setOpen(null); if (single) onPage(g.items[0]!.id); else onHub(g.id); }}
            >
              <span>{g.title}</span>
              {!!count && <span className="count">{count}</span>}
              <span className="chev" aria-hidden="true">›</span>
            </button>
            {!single && open?.id === g.id && wide() && (
              <ul className="flyout" style={{ top: open.top, left: open.left }}>
                {g.items.map((it) => (
                  <li key={it.id}>
                    <button className={`flyout-item${page === it.id ? ' on' : ''}`} onClick={() => { setOpen(null); onPage(it.id); }}>
                      <span>{it.label}</span>
                      {!!it.count && <span className="count">{it.count}</span>}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })}
    </>
  );
}
