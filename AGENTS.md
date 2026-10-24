# Sangam — HACK4SDG 24-hour build

Instructions for any coding agent (ZCode, Claude Code, OpenCode, …) working in this repo.

## Read first

1. `Sangam for HACK4SDG proposal and 24-hour build plan.docx` (repo root) — the final reference; it wins over any agent's own ideas.
2. `Sangam HACK4SDG tasks and Claude prompts for each person.docx` (repo root) — who does what.
3. Your role's context file, if one exists — currently `P3-CONTEXT.md` (Supplier lead). It records everything past sessions did, the file map, data caveats and next steps.

## Rules (from the team plan)

- Four people work in parallel; each owns a set of folders. Work ONLY inside your role's owned files. If a change is needed elsewhere, write a two-line note for that file's owner instead of editing it.
- Commit messages start with your area: `supplier: `, `agents: `, `buyer: `, `ecosystem: `.
- main is never pushed to directly; merges go through pull requests at the 3-hour checkpoints.
- Never invent a data figure. Anything unsourced is left empty and tagged estimated, or asked about.

## Session continuity

A new session forgets the last one, and the person (or model) resuming may be different. At the **end of every working session**, update your role's context file (`P3-CONTEXT.md` for the Supplier lead): current state, files touched, decisions made, verification status, next steps, and a dated session-log entry — then commit it. When starting, read it before writing any code.
