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
npm run build
npm start
```

Open <http://127.0.0.1:4173>, load or paste report JSON, generate the preview,
then use **Print / Save PDF**. `npm start` is the one-command product entry
point. The internal task dashboard remains available through `npm run
dashboard`. Native ESM runs directly in Node, so `npm run build` validates the
source rather than emitting generated JavaScript.

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
