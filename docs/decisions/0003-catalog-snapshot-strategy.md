# ADR-0003: Catalog snapshot strategy

Status: resolved-value snapshot selected. `CONFIRMED_REQUIREMENT`

The exact production field boundary remains open. `UNKNOWN` (Q4)

## Decision

- Publish catalogs as immutable, identifiable versions. A new publish creates a new version; it does not rewrite a version already referenced by reports. `CONFIRMED_REQUIREMENT` (INV-2)
- At finalization, store the resolved clinical meaning needed to interpret, compare, and render the report. At minimum the current fixtures demonstrate `field_id`, optional `option_id`, display, value, unit, reference range, interpretation/flag, and source catalog version where applicable. `CONFIRMED_REQUIREMENT` for the snapshot mechanism; fixture fields are `OBSERVED`.
- Render a finalized version only from its resolved payload. The renderer must not query current catalog rows for historical display text, units, ranges, or interpretations. `CONFIRMED_REQUIREMENT` (INV-2, INV-5)
- Retain identifiers and catalog provenance for traceability, but do not make them the only source of historical meaning. `CONFIRMED_REQUIREMENT` (INV-5)
- Until Q5 is resolved, treat a catalog reference as `{ source_catalog_version, field_id/option_id }`; never assume an option id is globally unique or safe to remap. `ASSUMPTION` (Q5)
- For drafts, pin the catalog selected at creation and require an explicit reconciliation operation to adopt another version. Do not silently migrate on publish. `ASSUMPTION` (Q3)
- For amendments, clone every unchanged snapshot from the superseded version. A newly added or deliberately re-resolved field may carry its own catalog provenance, but that action must be explicit and auditable. `ASSUMPTION`, preserving INV-8 and INV-10.

The rejected strategy is identifier-only storage followed by render-time lookup, even when the identifier is paired with an old catalog version. It leaves historical correctness dependent on catalog availability and integrity. `CONFIRMED_REQUIREMENT` (fixture change notes; INV-5)

## Conservative snapshot boundary

Until Q4 is answered, snapshot every value whose later change could alter clinical interpretation or rendered clinical content: labels, selected-option text, units, ranges, flags, interpretations, methods when clinically relevant, ordering, and conditional-section inputs. `ASSUMPTION` (Q4)

Keep renderer-only choices such as fonts, margins, and pagination out of the clinical snapshot and record them with export metadata instead. `CONFIRMED_REQUIREMENT` (INV-6)

## Invariant check

| Invariant | Consequence |
| --- | --- |
| INV-2 | Catalog V2 cannot change an issued V1 payload. `CONFIRMED_REQUIREMENT` |
| INV-5 | A finalized payload remains understandable without any catalog service. `CONFIRMED_REQUIREMENT` |
| INV-8 | Missing/deprecated identifiers render from their historical snapshot; incompatible new resolution fails visibly. `CONFIRMED_REQUIREMENT` |
| INV-10 | An amendment begins with the old snapshots, not a fresh lookup. `CONFIRMED_REQUIREMENT` |

## Production blockers

- The exact snapshot boundary is `UNKNOWN` (Q4); the conservative boundary may be narrowed only by an approved decision and regression tests.
- Identifier-reuse policy is `UNKNOWN` (Q5).
- Draft reconciliation behavior is `UNKNOWN` (Q3); automatic migration is not authorized.
- No real catalog export is present, so fixture coverage does not prove compatibility with production catalog shapes. `UNKNOWN`

## Acceptance evidence

- After Catalog V2 publishes, R100/V1 still renders `Fasting Blood Sugar`, range `70-100 mg/dL`. `CONFIRMED_REQUIREMENT`
- R100/V2 amendment retains all unchanged V1 snapshots and changes only the intended value/flag. `CONFIRMED_REQUIREMENT`
- A V1 report using a later-deprecated option remains readable without remapping. `CONFIRMED_REQUIREMENT`

Related: [catalog change notes](../fixtures/catalog-change-notes.md), [initial report](../fixtures/report-initial.json), [amended report](../fixtures/report-amended.json), [canonical payload decision](0001-canonical-payload-and-version-identity.md).
