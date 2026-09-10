# PathForge desktop UI reference

The working React/Tauri desktop entry is in [`../../mock-ui`](../../mock-ui).
Run `npm run browser:dev` from that directory for browser-only UI development;
use `npm run desktop:dev` to launch the desktop shell. The
[`application-mockup.html`](application-mockup.html) file remains a
dependency-free visual snapshot.

## Product map

1. **Home** — primary report actions and recent fixture-backed reports.
2. **Patient context** — an explicit boundary explaining that patient records
   are not modeled by the current report fixture.
3. **New report** — report issue context, test selection, dense keyboard-first
   result entry, and review/finalization.
4. **Report worklist** — report search context, print preview, properties,
   immutable version lineage, and amendment entry.
5. **Settings** — the active in-memory adapter boundary and fixture scope.

## Interaction contract

- Report issue context comes before test selection and result entry.
- Result entry keeps focus in the value column; `Enter` moves to the next test
  and numeric flags update immediately.
- Review shows the exact report shape beside the finalization checks.
- Finalized issues are immutable; corrections begin a new amendment version.
- Printing uses the browser print dialog; browser print/save-as-PDF is the
  currently supported PDF flow.

## Design rules

- Use Windows desktop density, Segoe UI, compact command bars, tables, panes,
  keyboard cues, and restrained system colors.
- Keep report identity and issue metadata visible during clinical entry.
- Prefer structured controls over raw JSON. CSV/JSON remains an administrative
  catalog-import concern, not the daily reporting workflow.
- Keep audit evidence in the application and the printed pathology report clean.
