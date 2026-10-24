// Shown only inside a section's pages: a way back to the section's landing page, and its other pages.
import type { NavGroup } from './catalog';

export default function SubNav({ group, page, onHub, onPage }: { group: NavGroup; page: string; onHub: () => void; onPage: (pageId: string) => void }) {
  if (group.items.length < 2) return null;
  return (
    <nav className="subnav" aria-label={`${group.title} pages`}>
      <button className="subnav-back" onClick={onHub}><span aria-hidden="true">←</span> {group.title}</button>
      <ul>
        {group.items.map((it) => (
          <li key={it.id}>
            <button className={`subnav-pill${page === it.id ? ' on' : ''}`} aria-current={page === it.id ? 'page' : undefined} onClick={() => onPage(it.id)}>
              {it.label}{!!it.count && <span className="count">{it.count}</span>}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}
