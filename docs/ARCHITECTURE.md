# PathForge architecture

PathForge turns structured clinical-pathology report data into one house-format
report that a user can preview, print, or save as PDF. This document is the
single reference for how the system is structured and the correctness rules it
must not violate. [`../SCOPE.md`](../SCOPE.md) governs what is in scope; this
document governs how the in-scope code behaves.

The guiding idea: **a finalized report is a historical clinical artifact, not a
template filled with today's data.** It must stay reproducible and meaningful
after catalogs, labels, and rendering rules change.

## Layers

Data flows one direction: validated report → document model → rendered output.
Clinical state, catalog state, and presentation state are kept separate and are
never collapsed into one another.

| Layer | Location | Responsibility |
| --- | --- | --- |
| Domain | [`src/domain/`](../src/domain/) | Validation, canonicalization, semantic comparison, lifecycle, lineage, hashing. Pure logic, no UI or storage. |
| Rendering | [`src/rendering/`](../src/rendering/) | Builds the presentation-neutral **document model** from a validated payload and the house-format config. |
| Service | [`src/service/`](../src/service/) | Report lifecycle orchestration behind ports; the in-memory adapter is the current storage. |
| Report/PDF | [`src/components/report/`](../src/components/report/) | Printable report React tree and the browser print / save-as-PDF path. |
| App shell | [`src/pages/`](../src/pages/), [`src/store/`](../src/store/) | React + Tauri desktop UI, contexts, and branding. |
| Native | [`src-tauri/`](../src-tauri/) | Tauri (Rust) shell and local SQLite. |

Worked semantic examples live in [`fixtures/`](fixtures/) and are exercised
directly by the domain and rendering tests — they are the executable form of the
rules below. Terminology is defined in
[`reference/domain-glossary.md`](reference/domain-glossary.md).

## Invariants (non-negotiable)

A design that violates any of these is incorrect, not merely suboptimal. Each
has a regression test under [`../test/`](../test/).

- **INV-1 — Finalized immutability.** A finalized report version is never mutated
  into a clinically different report. In-place edits to a finalized clinical
  record are an anti-pattern except for fields explicitly designated non-clinical.
- **INV-2 — Catalog changes do not rewrite history.** Editing or publishing a
  catalog must never change the resolved content of an already-finalized report.
  `catalog update → historical report changes` is a high-severity defect.
- **INV-3 — Stable version identity.** Every issued version has a stable, unique
  identity for the life of the system.
- **INV-4 — Amendment lineage.** Every amendment retains an explicit, queryable
  `supersedes` relationship to the version it replaces.
- **INV-5 — History interpretable without the current catalog.** A finalized
  payload is fully interpretable without assuming today's catalog equals the
  catalog at issue time; it must not depend on mutable current reference rows.
- **INV-6 — Renderer changes ≠ clinical changes.** A change in font, CSS,
  pagination, or PDF bytes is never a clinical-content change. Semantic
  comparison can report two reports clinically equal despite differing bytes.
- **INV-7 — Fingerprints are never the authority.** A hash may accelerate or
  diagnose equality, but equality is decided by an explainable field-by-field
  comparison of canonical forms.
- **INV-8 — No silent remapping.** Missing, deprecated, or incompatible
  historical references are never silently remapped to different current values;
  such cases fail visibly.
- **INV-9 — Explicit, auditable lifecycle.** Every transition
  (draft → finalized → superseded) is explicit and produces durable audit evidence.
- **INV-10 — Amend from the historical baseline.** Amending an old report starts
  from that version's frozen resolved payload, never from a fresh re-resolution
  against today's catalog. Current catalog data may assist the editing UI but
  must not overwrite historical semantics.

## Key design decisions

### Canonical payload and version identity

A logical report and an issued version are separate identities;
`{ report_id, version }` is the domain identity (never the printed issue number,
accession/invoice number, filename, or PDF checksum). The immutable
`resolved_payload` lives inside a version envelope alongside non-clinical
metadata (`lifecycle_state`, `supersedes`, `issue_number`/`issue_date`,
`source_catalog_version`). The canonical **clinical** form is derived only from
`resolved_payload` — never from a PDF and never by re-resolving identifiers
against the current catalog. Canonicalization sorts map keys, preserves
clinically meaningful array order and value types, and drops annotations. Clinical
comparison includes semantic identifiers and resolved values and excludes
issue/version/audit/provenance and presentation fields. See
[`src/domain/canonicalization.mjs`](../src/domain/canonicalization.mjs),
[`comparison.mjs`](../src/domain/comparison.mjs), and the `CMP-*` cases in
[`fixtures/expected-comparison.json`](fixtures/expected-comparison.json).

### Lifecycle and audit

One editable state (`draft`) and one immutable issued state (`finalized`).
Finalization is one-way. Creating an amendment clones the selected finalized
version's resolved payload into a new draft under the same logical report and
records `supersedes` immediately — it never re-resolves from today's catalog.
Version creation, lineage, and the required audit writes happen atomically; a
render failure stays visible and never implies a successful export. Audit events
are append-only and reference immutable versions rather than copying clinical
values into logs. See [`src/domain/lifecycle.mjs`](../src/domain/lifecycle.mjs)
and [`lineage.mjs`](../src/domain/lineage.mjs).

### Catalog snapshot strategy

Catalogs are immutable, identifiable versions; a new publish creates a new
version and never rewrites one already referenced by reports. At finalization the
system stores the **resolved clinical meaning** (display, value, unit, reference
range, interpretation/flag, source catalog version) — not just identifiers — so a
finalized version renders only from its own payload and the renderer never queries
current catalog rows for historical text. The rejected alternative is
identifier-only storage with render-time lookup, which makes historical
correctness depend on catalog availability. Renderer-only choices (fonts,
margins, pagination) stay out of the clinical snapshot. The exact production
snapshot boundary is deliberately conservative for the prototype: snapshot any
value whose later change could alter clinical interpretation. See
[`fixtures/catalog-change-notes.md`](fixtures/catalog-change-notes.md).

## Amendment behaviour

An amendment is a **new version of the same logical report**
(`R{n}/V2 supersedes R{n}/V1`), retained with explicit lineage. The regenerated
PDF is a **clean, ordinary report** with a **new issue number and issue date and
no visible amendment marker** — everything else prints as a normal report. The
system keeps both versions immutably, the `V2 → supersedes → V1` link, and an
audit record (who amended, when, why).

Because V2 is derived from V1's frozen payload (INV-10), a catalog change made
between the two issue dates cannot leak into the amended PDF: unchanged fields
print identical clinical content. Diffing V1 against V2 must surface exactly the
corrected field(s) plus the identifier/date change and nothing else — any
unchanged field appearing in the diff signals an INV-10 violation.

> **Recorded trade-off (owner decision, not an oversight):** with no on-page
> marker, a clinician who acted on the original is not alerted by the document
> that a value changed. Any "notify on correction" behaviour must live outside
> the PDF, in workflow/notification.

## Acceptance tests that exercise the invariants

- **Historical stability (INV-2, INV-5):** finalize under Catalog V1 → publish V2
  → retrieve original → clinical content unchanged.
- **Amendment baseline (INV-10):** finalize under V1 → publish V2 → amend →
  amendment starts from the V1 payload; V2 has not rewritten unchanged values.
- **Semantic comparison (INV-6, INV-7):** a presentation-only change is not a
  clinical change; equality is explainable without the fingerprint.
- **Deleted reference (INV-8):** deprecate a catalog option in V2 → old reports
  using it stay interpretable with no silent remap.
- **Audit reconstruction (INV-9):** lifecycle events and versions reconstruct
  from provenance data.
