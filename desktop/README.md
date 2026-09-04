# PathForge desktop reference

This package is the working Windows-style application mock used to guide the
Tauri implementation. It is React + TypeScript + Vite + Tailwind CSS, with
shadcn-style local components, React Hook Form, Zod, Vitest, and Playwright.

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
