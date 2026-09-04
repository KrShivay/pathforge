# PathForge desktop UI reference

The working React reference is in [`../../desktop`](../../desktop). Run it with
`npm run dev` from that directory. [`application-mockup.html`](application-mockup.html)
remains a dependency-free visual snapshot; use the React application for ongoing
development and interaction decisions.

## Product map

1. **Home** — primary report actions, recent finalized reports, and external
   backup status.
2. **Patients** — local patient search and recent report context.
3. **New report** — patient registration, test selection, dense keyboard-first
   result entry, and review/finalization.
4. **Report worklist** — report search context, print preview, properties,
   immutable version lineage, and amendment entry.
5. **Settings & backup** — lab identity, operators, referring doctors, test
   catalog entry points, local data location, and external backup status.

## Interaction contract

- Patient details come before test selection and result entry.
- Result entry keeps focus in the value column; `Enter` moves to the next test
  and numeric flags update immediately.
- Review shows the exact report shape beside the finalization checks.
- Finalized issues are immutable; corrections begin a new amendment version.
- Printing uses the browser print dialog only as the prototype fallback. The
  production path remains the gated WebView2 PDF service.

## Design rules

- Use Windows desktop density, Segoe UI, compact command bars, tables, panes,
  keyboard cues, and restrained system colors.
- Keep patient/report identity visible during clinical entry.
- Prefer structured controls over raw JSON. CSV/JSON remains an administrative
  catalog-import concern, not the daily reporting workflow.
- Keep audit evidence in the application and the printed pathology report clean.
