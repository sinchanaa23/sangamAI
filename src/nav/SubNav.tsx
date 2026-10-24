// Shown only inside a section's pages: a way back to the section's landing page, and its other pages.
import type { NavGroup } from './catalog';
import { useUiLang } from '../i18n';
import type { Workspace } from '../ui';
import { groupTitle, itemLabel } from './translate';

export default function SubNav({ workspace, group, page, onHub, onPage }: { workspace: Workspace; group: NavGroup; page: string; onHub: () => void; onPage: (pageId: string) => void }) {
  const { lang } = useUiLang();
  if (group.items.length < 2) return null;
  return (
    <nav className="subnav" aria-label={`${groupTitle(lang, group)}`}>
      <button className="subnav-back" onClick={onHub}><span aria-hidden="true">←</span> {groupTitle(lang, group)}</button>
      <ul>
        {group.items.map((it) => (
          <li key={it.id}>
            <button className={`subnav-pill${page === it.id ? ' on' : ''}`} aria-current={page === it.id ? 'page' : undefined} onClick={() => onPage(it.id)}>
              {itemLabel(lang, workspace, it)}{!!it.count && <span className="count">{it.count}</span>}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}
