# ADR-0001: Canonical payload and version identity

Status: accepted for fixture-driven implementation, with production blockers listed below. `ASSUMPTION`

## Decision

- A logical report and an issued report version are separate identities. Every issued version has a stable identity and belongs to one logical report. `CONFIRMED_REQUIREMENT` (INV-3, INV-4)
- Use `{ report_id, version }` as the fixture/domain identity until persistence is selected. Do not treat `issue_number`, accession/invoice number, a filename, or a PDF checksum as the internal identity. `ASSUMPTION` (Q9a)
- Store the immutable `resolved_payload` inside a version envelope. Keep lifecycle, lineage, issue metadata, audit references, and renderer/export metadata outside that clinical payload. `CONFIRMED_REQUIREMENT` (INV-1, INV-3, INV-6)
- Derive the canonical **clinical** form from `resolved_payload`; never from a PDF and never by resolving identifiers against the current catalog. `CONFIRMED_REQUIREMENT` (INV-2, INV-5, INV-6)
- Canonicalization sorts map keys, preserves clinically meaningful array order, preserves value types, and omits annotations such as `_comment` and `changed_in_this_version`. `ASSUMPTION`
- Include semantic identifiers and resolved clinical values in clinical comparison. Exclude issue/version/audit timestamps, actor fields, `source_catalog_version`, renderer configuration, pagination, and other provenance/presentation fields from the clinical result; compare those separately when requested. `ASSUMPTION`, consistent with `expected-comparison.json`
- A fingerprint may be stored as a diagnostic/cache value, but equality is decided by an explainable field-by-field comparison of canonical forms. `CONFIRMED_REQUIREMENT` (INV-7)

Minimum version envelope for Phase 2:

```text
report_id                 logical report identity
version                   stable version component
lifecycle_state           draft/finalized working state
supersedes                nullable version identity
issue_number, issue_date  per-issue provenance; non-clinical
source_catalog_version    provenance, not a render-time lookup key
resolved_payload          canonical clinical input
```

The envelope names mirror the fixtures and are not a database schema. `ASSUMPTION`

## Invariant check

| Invariant | Consequence |
| --- | --- |
| INV-1 | Finalization freezes the version envelope's clinical payload. `CONFIRMED_REQUIREMENT` |
| INV-3/INV-4 | Version identity and `supersedes` remain stable and queryable. `CONFIRMED_REQUIREMENT` |
| INV-6 | Renderer/PDF changes cannot enter the clinical canonical form. `CONFIRMED_REQUIREMENT` |
| INV-7 | Comparator output contains changed paths/values; a hash cannot overrule it. `CONFIRMED_REQUIREMENT` |

## Production blockers

- Whether the printed issue number shares an identifier space with invoice/accession numbers is `UNKNOWN` (Q9a). Keep these fields separate.
- The complete clinical payload schema, including specimens, panels, methods, and validation rules, is `UNKNOWN`; current fixtures prove only the small glucose example.
- Persistence-specific identity generation and concurrency guarantees are `UNKNOWN` until storage and integration constraints are chosen (Q15).

## Acceptance evidence

- `CMP-1` must report only fasting-glucose value/flag as clinical changes. `CONFIRMED_REQUIREMENT`
- `CMP-2` and `CMP-3` must report clinical equality despite catalog or renderer changes. `CONFIRMED_REQUIREMENT`
- Comparator output must explain each changed path without relying on its fingerprint. `CONFIRMED_REQUIREMENT` (INV-7)

Related: [architecture invariants](../requirements/architecture-invariants.md), [comparison fixture](../fixtures/expected-comparison.json), [catalog snapshot decision](0003-catalog-snapshot-strategy.md).
