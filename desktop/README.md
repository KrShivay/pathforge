# PathForge desktop reference

> **Frozen reference — not the active app.** The canonical product is the
> React + Tauri app at the repository root (`src/`, run with `npm run tauri
> dev`). This package is kept only as UX reference for the result-entry
> workflow, dense tables, keyboard navigation, review step, and result flags.
> It has its own `package.json`/lockfile and is intentionally excluded from the
> root `npm run verify` and CI. Do not add features here.

This package is the working Windows-style application mock originally used to
guide the Tauri implementation. It is React + TypeScript + Vite + Tailwind CSS,
with shadcn-style local components, React Hook Form, Zod, Vitest, and Playwright.

```sh
npm ci
npm run dev
npm run lint
npm test
npm run test:e2e
npm run build
```

The current screens are functional prototype UI backed by local fixtures and
React context. The Tauri shell is scaffolded in `src-tauri`, but SQLite
repositories and the WebView2 PDF command are intentionally not faked here.
They remain implementation gates behind the same screens.

Printing currently calls the browser print dialog. Replace that adapter with the
approved WebView2 `PrintToPdf`/`PrintToPdfStream` service after the PDF spike,
then persist the generated file and immutable report snapshot in one transaction.
