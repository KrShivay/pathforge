# Delivery Plan

[`../SCOPE.md`](../SCOPE.md) is authoritative. The deliverable is a local-only
Windows desktop prototype: it must not require an HTTP server, localhost, cloud
hosting, SQLite, or an external integration. The task ledger is
[`tasks/tasks.json`](tasks/tasks.json).

## Current state and migration boundary

- Keep: `src/domain/`, `src/service/`, and `src/rendering/`; their fixture,
  immutable-version, amendment, and presentation-neutral model behavior is the
  application core.
- Adopt: `mock-ui/app/` and `mock-ui/src-tauri/` as the desktop application
  entry. The package and Tauri metadata now identify PathForge; its browser
  Vite command is development-only.
  Its layout, navigation, keyboard behavior, and print CSS are useful, but its
  fixtures, Zod-only schema, React context state, synthetic preview, and static
  history are not the application source of truth.
- Retire from the product path: `scripts/report-app.mjs`, its HTTP tests, and
  the legacy HTTP preview command. They may remain temporary developer tooling
  only until the desktop workflow replaces their coverage. Root `npm start` now
  launches the Tauri desktop entry.

Why: keeping the proven domain core avoids a rewrite, while moving the UI to
typed local adapters removes the current split-brain fixture state and the
localhost dependency.

## Ordered work packages

1. **Desktop entry and migration boundary** — make `mock-ui/` the single
   React/Tauri product entry and separate any browser-only development command
   from the packaged desktop launch. Acceptance: `npm start` and
   `npm run desktop:build` resolve through `mock-ui`, Tauri launches without
   `scripts/report-app.mjs` or a product HTTP endpoint, and packaging metadata
   says PathForge, not UI mock.
2. **Domain/service adapter** — add a typed UI-facing adapter over
   `src/service/` and `src/rendering/`. Map validation to actionable UI errors;
   expose finalization, amendment, history, and document-model construction
   entirely in-process. Acceptance: invalid input never finalizes; immutable
   versions and baselines come from the service, not UI fixtures.
3. **Local application state** — replace `report-context.tsx` fixture state with
   adapter-backed in-memory state for one desktop session. Add a local file only
   if restart persistence is proven necessary. Acceptance: samples, selection,
   and history reflect service data; no SQLite or network API exists.
4. **Editor and workflow** — connect new reports, result editing, keyboard
   traversal, validation, flags, review, finalization, amendments, and history.
   Acceptance: workflow tests cover entry through finalization and amendment,
   including empty, loading, validation-error, and success states.
5. **Preview and print** — render `buildReportDocumentModel` in React,
   preserving every configured clinical field and historical snapshot value.
   Keep the browser/WebView print dialog as the PDF route and exclude controls
   from print CSS. Acceptance: readable A4 output and catalog changes cannot
   alter finalized history.
6. **Windows delivery** — complete only the Tauri configuration, native CI
   verification, and docs needed for local Windows use. Acceptance: the
   `desktop-windows` CI job runs the pinned Node/Rust toolchains and
   `npm run desktop:build`; Windows build/launch does not depend on localhost
   and contains no secrets or patient-identifiable data.
7. **Cleanup and release verification** — remove obsolete product-path server
   code only after desktop tests replace it; retain dashboard tooling separately
   if useful. Acceptance: checks pass, no debug/dead route remains, and ledger
   evidence plus launch instructions describe the desktop architecture.

## Verification

Run the relevant commands after each package, then the full set at the end:

```sh
npm run verify
(cd mock-ui && npm run lint && npm test && npm run build && npm run test:e2e)
(cd mock-ui && npm run desktop:build) # locally on a Windows-capable environment;
                                      # desktop-windows runs this in CI
node .gitnexus/run.cjs detect-changes --scope all
```

Before any source-symbol edit, run GitNexus upstream impact analysis and report
any `HIGH`, `CRITICAL`, or `UNKNOWN` result. Before committing, rerun graph
change analysis; a partial or truncated result is not a clean result.
