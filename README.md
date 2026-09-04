# PathForge

PathForge is a versioned pathology reporting system with immutable clinical
records, catalog-aware amendments, and deterministic document generation.

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

Open <http://127.0.0.1:4173> to view delivery progress. `npm start` is the
one-command local entry point after installation. Native ESM runs directly in
Node, so `npm run build` validates the source rather than emitting generated
JavaScript.

`npm run verify` is the local and CI quality gate. It checks formatting, lint,
types, unit tests, domain fixtures, and the task ledger. Run `npm run format`
before verification when changing domain source or its tests.

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
