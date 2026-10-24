// A section's own landing page: what the section is for, and a card for each of its pages.
import type { Workspace } from '../ui';
import { GROUP_BLURB, ITEM_DESC, WORKSPACE_LABEL } from './catalog';
import type { NavGroup } from './catalog';
import { COMMON, tr, useUiLang } from '../i18n';
import { groupTitle, itemLabel } from './translate';

export default function SectionHub({ workspace, group, onPage }: { workspace: Workspace; group: NavGroup; onPage: (pageId: string) => void }) {
  const { lang } = useUiLang();
  return (
    <div className="stack">
      <div>
        <div className="eyebrow">{WORKSPACE_LABEL[workspace]}</div>
        <h1 className="lead" style={{ marginTop: 6 }}>{groupTitle(lang, group)}</h1>
        <p className="muted" style={{ marginTop: 8 }}>{GROUP_BLURB[`${workspace}:${group.id}`]}</p>
      </div>
      <div className="hub-grid">
        {group.items.map((it, i) => (
          <button key={it.id} className="hub-card" onClick={() => onPage(it.id)}>
            <span className="hub-idx">{String(i + 1).padStart(2, '0')}</span>
            <span className="hub-title">{itemLabel(lang, workspace, it)}{!!it.count && <span className="count">{it.count}</span>}</span>
            <span className="hub-desc">{ITEM_DESC[`${workspace}:${it.id}`]}</span>
            <span className="hub-go">{tr(lang, COMMON, 'open')} <span aria-hidden="true">→</span></span>
          </button>
        ))}
      </div>
    </div>
  );
}
