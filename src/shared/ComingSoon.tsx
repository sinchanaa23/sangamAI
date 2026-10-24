/** Placeholder for a page another teammate is building, so the sidebar works from hour 0. */
export default function ComingSoon({ title, owner, what }: { title: string; owner: string; what: string }) {
  return (
    <div className="stack">
      <div>
        <h1 className="lead">{title}</h1>
        <p className="muted" style={{ marginTop: 6 }}>{what}</p>
      </div>
      <div className="card"><p className="small muted">Being built by {owner}. This page fills in at the next merge.</p></div>
    </div>
  );
}
