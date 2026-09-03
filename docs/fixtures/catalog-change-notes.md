# Catalog V1 -> V2 change notes

Clinical-pathology example (a glucose panel). Four deliberate kinds of change, each exercising a different invariant.

| Field | V1 | V2 | Kind of change | Exercises |
| --- | --- | --- | --- | --- |
| `test.fasting_glucose` display | `"Fasting Blood Sugar"` | `"Fasting Plasma Glucose"` | **Relabel** (same field, same clinical meaning, new display text) | INV-2, INV-5 |
| `test.fasting_glucose` reference range | `70-100` | `74-106` | **Reference-range change** (a value's *interpretation context* changed) | INV-2, INV-5, INV-8 |
| `interpretation.glucose` option `glu_prediabetes` | active | `deprecated: true` | **Deprecation** | INV-8 |
| `test.random_glucose` | -- | added | **New field** | draft-vs-finalized reaction |

The relabel and the reference-range change are the important ones. Neither renamed the field nor changed what was clinically recorded for an already-issued report — but a naive "re-resolve against the current catalog" on read would silently rewrite a signed report's label **and its reference range**, making an old normal/abnormal flag look different than when it was issued.

---

## The snapshot mechanism (READ THIS -- it disambiguates the fixtures)

Two architectures could both keep R100/V1 stable after V2 publishes. **This project uses the first. The second is explicitly rejected.**

**CHOSEN -- Resolved-value snapshot.**
At finalization, the report payload stores the *resolved* value: the stable `field_id`/`option_id` **and** the historical `display`, `unit`, `reference_range`, and any `interpretation`, captured as of the catalog version in force at issue time. Rendering a finalized report reads these **from the payload**, never by looking the id back up in a catalog table.

- Why chosen: satisfies INV-5 (history interpretable without current catalog rows) and INV-8 (a later deprecation, relabel, or range change cannot reach into the payload). The catalog table can be edited, versioned, or lost, and R100/V1 still renders correctly and identically.

**REJECTED -- Identifier + pinned catalog version, re-resolve on read.**
Store only ids plus `catalog_version: V1`, and at render time re-resolve label/unit/range by querying the V1 catalog.

- Why rejected: it makes historical fidelity depend on V1 catalog rows remaining present, immutable, and correctly version-addressable forever. A mutated V1 row, a botched migration, or a reused id silently corrupts history. Pinning an identifier is **not** sufficient (BUSINESS_REQUIREMENTS §8). Violates INV-5.

> **Rule for agents:** the report payload is self-contained. `display`, `unit`, `reference_range`, and `interpretation` in a finalized payload are **snapshots**, authoritative for rendering. `field_id`/`option_id` + `source_catalog_version` are retained for lineage, audit, and change detection -- not as the source of display text.

---

## Expected behaviour after V2 publishes

```text
R100/V1 renders:      Fasting Blood Sugar   (ref 70-100 mg/dL)     from snapshot
R100/V1 must NOT be:  Fasting Plasma Glucose (ref 74-106 mg/dL)    would violate INV-2
```

A **new** report created after V2 uses V2 and would show "Fasting Plasma Glucose (ref 74-106)" -- correct, because it is a new clinical artifact under the new catalog. Same `field_id`, different snapshot, different report. Both are right for their own issue time.

## Amendment interaction (Option A -- see expected-analysis/amendment-presentation.md)

When R100/V1 is amended to R100/V2 **after** catalog V2 is published, the amendment is cloned from V1's frozen snapshot (INV-10). Unchanged fields therefore still render "Fasting Blood Sugar (70-100)", NOT the V2 relabel/range. The amended PDF is a clean report with a new issue number/date and no visible amendment marker; only the corrected field differs from the original.
