# Catalog V1 → V2 change notes

Three deliberate kinds of change, each exercising a different invariant.

| Field | V1 | V2 | Kind of change | Exercises |
| --- | --- | --- | --- | --- |
| `tumour.grade` option `grade_2` | label `"Grade 2"` | label `"Intermediate grade"` | **Relabel** (same `option_id`, same clinical meaning, new display text) | INV-2, INV-5 |
| `diagnosis.type` option `in_situ_carcinoma` | active | `deprecated: true` | **Deprecation** | INV-8 |
| `tumour.mitotic_score` | — | added | **New field** | draft-vs-finalized reaction |

The relabel is the important one: `grade_2` was **not** renamed or re-meant. Only its human-facing display string changed. That is exactly the case where a naive "re-resolve against current catalog" would silently rewrite a signed report.

---

## The snapshot mechanism (READ THIS — it disambiguates the fixtures)

There are two architectures that could both make R100/V1 keep showing "Grade 2" after V2 publishes. **This project uses the first. The second is explicitly rejected.**

**CHOSEN — Resolved-value snapshot.**
At finalization, the report payload stores the *resolved* value: the stable `option_id` **and** the historical `display` string (plus unit/interpretation where applicable), captured as of the catalog version in force at issue time. Rendering a finalized report reads display text **from the payload**, never by looking the `option_id` back up in a catalog table.

- Why chosen: satisfies INV-5 (history interpretable without current catalog rows) and INV-8 (a later deprecation or relabel cannot reach back into the payload). The catalog table can be edited, versioned, or lost, and R100/V1 still renders correctly and identically.

**REJECTED — Identifier + pinned catalog version, re-resolve on read.**
Store only `option_id` plus `catalog_version: V1`, and at render time re-resolve the label by querying the V1 catalog.

- Why rejected: it makes historical fidelity depend on the V1 catalog rows remaining present, immutable, and correctly version-addressable forever. A mutated V1 row, a botched migration, or a reused `option_id` silently corrupts history. Pinning an identifier is **not** sufficient (see BUSINESS_REQUIREMENTS §8). This violates INV-5.

> **Rule for agents:** the report payload is self-contained. `display`, `unit`, and `interpretation` in a finalized payload are **snapshots**, authoritative for rendering. `option_id` + `source_catalog_version` are retained for lineage, audit, and change detection — not as the source of display text.

---

## Expected behavior after V2 publishes

```text
R100/V1 renders:      Tumour grade: Grade 2          ✅  (from snapshot)
R100/V1 must NOT be:  Tumour grade: Intermediate grade   ❌  (would violate INV-2)
```

A **new** report created after V2 uses V2 and would resolve `grade_2` to "Intermediate grade" — correct, because it is a new clinical artifact under the new catalog. Same `option_id`, different snapshot, different report. Both are right for their own issue time.
