# PathForge

PathForge is a small clinical-pathology report prototype. It accepts structured
report data and turns it into a printable house-format report.

The current prototype scope is intentionally small: one or two users converting
report data into one house-format preview that can be printed or saved as PDF.
Read [SCOPE.md](SCOPE.md) before planning work; it is the authority on what is in
and out of scope.

## Repository layout

- `src/` contains the actual application domain, rendering, and service code.
- `mock-ui/app/` contains the React/Tauri desktop product entry. Its screens
  are adapter-backed and seeded from the checked-in report and catalog fixtures
  in memory.
- `scripts/` contains the legacy HTTP preview tooling and task dashboard; the
  HTTP preview is not the product launch path.
- `test/` contains tests for the production domain and report pipeline.
- `docs/` contains requirements, decisions, fixtures, and design guidance.

## Local setup

Prerequisites: Git, a Node version manager, and the Node.js version recorded in
`.nvmrc` (also mirrored in `.node-version`). The repository uses npm and commits
its lockfile; do not substitute a different installer in CI or when updating
dependencies.

```sh
nvm use
npm ci
(cd mock-ui && npm ci)
npm run verify
npm run build
npm start
```

`npm start` launches the PathForge Tauri desktop shell. For browser-only UI
development, run `cd mock-ui && npm run browser:dev`; this Vite server is a
development aid and is not required by a packaged desktop build. The internal
task dashboard remains available through `npm run dashboard`. Native ESM runs
directly in Node, so `npm run build` validates the core source rather than
emitting generated JavaScript. Use `npm run desktop:build` to build the Tauri
desktop bundle. The `desktop-windows` GitHub Actions job is the native Windows
verification route: it installs both lockfiles and the MSVC Rust toolchain, then
runs this same build command. A passing local macOS build is not a substitute
for that Windows job.

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
