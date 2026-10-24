// A section's own landing page: what the section is for, and a card for each of its pages.
import type { Workspace } from '../ui';
import { GROUP_BLURB, ITEM_DESC, WORKSPACE_LABEL } from './catalog';
import type { NavGroup } from './catalog';

export default function SectionHub({ workspace, group, onPage }: { workspace: Workspace; group: NavGroup; onPage: (pageId: string) => void }) {
  return (
    <div className="stack">
      <div>
        <div className="eyebrow">{WORKSPACE_LABEL[workspace]}</div>
        <h1 className="lead" style={{ marginTop: 6 }}>{group.title}</h1>
        <p className="muted" style={{ marginTop: 8 }}>{GROUP_BLURB[`${workspace}:${group.id}`]}</p>
      </div>
      <div className="hub-grid">
        {group.items.map((it, i) => (
          <button key={it.id} className="hub-card" onClick={() => onPage(it.id)}>
            <span className="hub-idx">{String(i + 1).padStart(2, '0')}</span>
            <span className="hub-title">{it.label}{!!it.count && <span className="count">{it.count}</span>}</span>
            <span className="hub-desc">{ITEM_DESC[`${workspace}:${it.id}`]}</span>
            <span className="hub-go">Open <span aria-hidden="true">→</span></span>
          </button>
        ))}
      </div>
    </div>
  );
}
