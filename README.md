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
desktop-compatible production bundle. `npm run build:web` produces the
GitHub Pages bundle for `https://krshivay.github.io/pathforge/`. Load report data,
generate the preview, then use **Print / Save PDF**.

`npm run verify` is the local and CI quality gate. It checks formatting, lint,
CSS integrity, types, unit tests, and domain fixtures. Run `npm run format`
before verification when changing source or tests.

Only non-sensitive local settings belong in `.env`. Never commit credentials,
patient-identifiable data, production payloads, or secrets. `.env.example`
documents safe defaults; all other local `.env*` files remain ignored.

## Documentation

- [SCOPE.md](SCOPE.md) — authoritative product scope; read before planning work.
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — layers, the ten correctness
  invariants, key design decisions, and amendment behaviour.
- [docs/reference/domain-glossary.md](docs/reference/domain-glossary.md) —
  project-specific terminology.
- [docs/fixtures/](docs/fixtures/) — worked semantic examples exercised by the
  domain and rendering tests.
- [docs/release/windows.md](docs/release/windows.md) — signed Windows release
  process.
