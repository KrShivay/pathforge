# PathForge

PathForge is a small clinical-pathology report prototype. It accepts structured
report data and turns it into a printable house-format report.

The current prototype scope is intentionally small: one or two users converting
report data into one house-format preview that can be printed or saved as PDF.
Read [SCOPE.md](SCOPE.md) before planning work; it is the authority on what is in
and out of scope.

## Local setup

Prerequisites: Git, a Node version manager, and the Node.js version recorded in
`.nvmrc` (also mirrored in `.node-version`). The repository uses npm and commits
its lockfile; do not substitute a different installer in CI or when updating
dependencies.

```sh
nvm use
npm ci
cp .env.example .env
npm run verify
npm run tauri dev
```

The React + Tauri desktop app under `src/` is the product. `npm run tauri dev`
runs the native shell with the local SQLite database; `npm run dev` serves the
same UI in a browser for quick iteration, and `npm run build` produces the
production web bundle. Load report data, generate the preview, then use
**Print / Save PDF**. The internal task dashboard remains available through
`npm run dashboard`.

The standalone app in [`desktop/`](desktop/) is frozen UX reference only — it is
not a build target and is not wired into `npm run verify` or CI.

`npm run verify` is the local and CI quality gate. It checks formatting, lint,
types, unit tests, domain fixtures, and the task ledger. Run `npm run format`
before verification when changing source or tests.

Only non-sensitive local settings belong in `.env`. Never commit credentials,
patient-identifiable data, production payloads, or secrets. `.env.example`
documents safe defaults; all other local `.env*` files remain ignored.

## Documentation

Start with the [project brief](docs/README.md). It defines the evidence
boundary, provenance labels, and expected work order.

| Area | Purpose |
| --- | --- |
| [Requirements](docs/requirements/) | The non-negotiable invariants, detailed business reference, and unresolved decisions. |
| [Reference](docs/reference/) | Project-specific terminology and meaning. |
| [Fixtures](docs/fixtures/) | Small, worked semantic examples for catalog and amendment behavior. |
| [Analysis](docs/expected-analysis/) | Current design specifications, including amendment presentation behavior. |
| [Samples](docs/samples/) | Metadata for the illustrative rendered-report sample set. |

The active source of truth is the structured material under `docs/`.
