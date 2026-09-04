# Pathology Report Platform — Agent Brief

**Read this file first. It is the primary interface to this project.**
Everything else is reference material you consult as needed, not context you must hold uniformly.

You are working on a platform that manages **versioned clinical pathology reports** and generates document/PDF representations of them. The central idea: a report is not a template filled with today's database values. It is a **historical clinical artifact** that must remain reproducible and meaningful even after the application's catalogs, templates, terminology, and rendering rules have changed.

---

## The 10 operational constraints

You must satisfy all of these. They override convenience, and they override anything you might infer from a single sample.

1. Finalized report versions are **immutable historical clinical artifacts**.
2. Current catalog changes must **never silently alter** finalized reports.
3. Amendments start from the **superseded report payload**, not from today's catalog.
4. **Semantic/content comparison is authoritative**; fingerprints/hashes are secondary optimizations.
5. Clinical state, catalog state, and presentation state are **separate concerns** and must not be collapsed into one another.
6. PDFs are **rendered output**, not the canonical clinical model.
7. Historical meaning must remain interpretable **without relying on mutable current catalog rows**.
8. PDF observations are **descriptive evidence** until explicitly promoted to confirmed rules.
9. Unknown behavior must remain **explicitly marked unknown** — never invented.
10. The sample manifest describes **initial reports only**, but the five PDF binaries are absent and its metadata is not direct PDF evidence. Amendment behaviour is defined by design in [Amendment presentation](expected-analysis/amendment-presentation.md) and the fixtures. (Amendment = new version of the same report, clean reprint with a new issue number, no visible marker — see that spec.)

Constraint 10 matters more than it looks. Do not infer that a behavior is absent from the system because it is absent from five documents.

---

## Sample limitation (evidence boundary)

> The manifest names five PDFs as **initial reports** and **directional design aids, not a format to reproduce** (R-fmt), but the binaries are absent. The manifest therefore gives no direct PDF evidence about amendment presentation; that is defined by design in [Amendment presentation](expected-analysis/amendment-presentation.md), [Business requirements](requirements/business-requirements.md), [Architecture invariants](requirements/architecture-invariants.md), and the fixtures. See [PDF evidence gap](expected-analysis/pdf-evidence-gap.md) before making any sample claim. **Scope: clinical pathology only** (R10).

---

## What files exist

```text
/docs
├── README.md                              ← you are here
├── requirements/
│   ├── architecture-invariants.md         ← non-negotiable constraints (source of truth)
│   ├── business-requirements.md           ← detailed domain/business reference
│   └── open-questions.md                  ← unresolved items; add to this rather than guessing
├── reference/
│   └── domain-glossary.md                 ← exact meaning of project terms
├── fixtures/                              ← "show me": worked semantic examples
│   ├── catalog-v1.json
│   ├── catalog-v2.json
│   ├── catalog-change-notes.md
│   ├── report-initial.json                ← R100/V1, issued under Catalog V1
│   ├── report-amended.json                ← R100/V2, amends V1
│   └── expected-comparison.json
├── expected-analysis/                      ← current design decisions and analysis specs
│   ├── amendment-presentation.md
│   └── pdf-evidence-gap.md             ← authoritative status of absent PDF evidence
└── samples/                               ← observed output: sample metadata
    ├── manifest.csv
    └── manifest-notes.md
```

**What is missing / not yet evidenced:** all five PDF binaries named in the manifest, any amended-report PDF, multi-specimen clinical-pathology examples, and any real catalog export. The fixtures stand in for the semantics; they are illustrative, not scraped from production.

---

## How to classify every conclusion you draw

Tag **every** conclusion in your output with exactly one provenance label. This is mandatory. It is the mechanism that stops "all five PDFs used 10 pt text" from silently becoming "`BODY_FONT_SIZE = 10` is a business requirement."

| Label | Meaning |
| --- | --- |
| `CONFIRMED_REQUIREMENT` | Explicitly defined by business/domain specification. |
| `OBSERVED` | Directly present in supplied PDFs or fixtures. |
| `INFERRED` | Supported by multiple observations, not explicitly confirmed. |
| `ASSUMPTION` | Necessary working assumption with insufficient evidence. |
| `UNKNOWN` | Cannot currently be determined. |

**Handling uncertainty that blocks progress:** If a decision depends on something you can only tag `ASSUMPTION` or `UNKNOWN`, add the question to [Open questions](requirements/open-questions.md), then proceed with the **safest reversible** option and tag that choice `ASSUMPTION`. Never convert an unknown into a confident requirement to unblock yourself.

---

## What you must produce

Work in this order. Do **not** start by designing the report template or generating production code from PDF screenshots — understanding the domain contract comes first.

1. **PDF profiling report** — descriptive observations per sample (coordinates, typography, sections, pagination), each tagged `OBSERVED`. Emit evidence, not rules.
2. **Section & field inventory** — visible label → likely semantic field, with cardinality and provenance labels.
3. **Cross-sample comparison matrix** — what is consistent across samples vs. sample-specific anomaly.
4. **Observed layout rules** — only patterns supported across multiple samples; each tagged.
5. **Suspected conditional rules** — with the evidence, tagged `INFERRED` at most.
6. **Explicit unknowns** — routed to [Open questions](requirements/open-questions.md).
7. **Domain-model, lifecycle, and catalog/version-interaction proposals** — evaluated against [Architecture invariants](requirements/architecture-invariants.md) and [Amendment presentation](expected-analysis/amendment-presentation.md).
8. **Proposed canonical report payload**, **document-model / rendering proposal**, **amendment workflow**, **semantic-comparison strategy**, **migration/backward-compat strategy**, **security/privacy risks**, **test matrix**, **implementation risks**, and **questions requiring a domain owner**.

For every architecture decision, evaluate it against: clinical correctness, historical stability, catalog evolution, amendment correctness, auditability, security/privacy, maintainability, performance, testability, backward compatibility.

**Flag as high-severity any design that permits: `catalog update → historical report changes`.**

---

## The one-paragraph version

Treat finalized reports as historical clinical truth. Keep clinical, catalog, and presentation concerns separate. Amend from the old payload, never from today's catalog. Compare content semantically; use hashes only as an accelerator. Profile the PDFs descriptively before declaring any rule, tag every conclusion with its provenance, and when you don't know, say so in [Open questions](requirements/open-questions.md) instead of guessing.
