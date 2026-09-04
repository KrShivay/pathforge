# Open Questions

> These are deferred production questions unless a question directly blocks the
> current scope in [`../../SCOPE.md`](../../SCOPE.md). Do not turn them into
> implementation work without explicit owner approval.

Unresolved items requiring a domain owner. Agents: when a decision depends on an **open** item, proceed with the safest reversible option, tag it `ASSUMPTION`, and reference the question number. Do not silently resolve open items. **Resolved** items are recorded in the log at the bottom and are `CONFIRMED_REQUIREMENT` unless noted.

## Lifecycle & versioning
- **Q1.** Exact operational distinction between *correction*, *amendment*, and *supplementary report*? (Glossary marks this `UNKNOWN`.)
- **Q2.** Exact lifecycle state names and the full legal transition set.
- **Q3.** Is a **draft** pinned to a catalog version, auto-migrated on catalog publish, or reconciled explicitly? (BUSINESS_REQUIREMENTS §7, §21 flag automatic silent migration as suspicious — but the chosen behavior is unconfirmed.)

## Catalog & resolution
- **Q4.** Which fields require full snapshotting (display/unit/interpretation) vs. which may safely remain identifier-only? The fixtures snapshot everything display-bearing; confirm the real boundary.
- **Q5.** Are `option_id`s guaranteed never reused across catalog versions? (INV-8 protection depends on the answer.)

## Rendering & PDF
- **Q7.** Must historical **renderer versions** remain executable, or only historical *payloads* remain renderable by the current renderer?
- **Q8.** Which supplied PDF variations (if any) are ever normative vs. all illustrative? (Manifest marks all `illustrative`.) — *Partly resolved by R-fmt: samples are directional, not a format to reproduce.*

## Amendment sub-questions (opened by R9)
- **Q9a.** Is the amended report's new "issue number" the same identifier space as an invoice/accession number, or a distinct report-issue sequence? (Owner used "invoice/issue number" interchangeably.)
- **Q9b.** Retention period for superseded report versions? (Regulatory — ties to Q11.)
- **Q9c.** Can a report be amended more than once (V3 supersedes V2 ...)? Assumed **yes** (lineage chains); confirm.

## Scope, scale, compliance
- **Q11.** Regulatory jurisdiction(s), required audit-retention period, and whether cryptographic/digital signatures are required.
- **Q12.** Must issued PDFs themselves be permanently retained, or only the payload + ability to re-render?
- **Q14.** Exact role/permission model and which roles the organization actually uses.

## Integrations
- **Q15.** Existing systems to integrate (LIS/HIS/EMR, identity provider, instruments, document archive, interface engines)?

---

## Resolved decisions log

| Ref | Question | Decision | Provenance |
| --- | --- | --- | --- |
| **R6** (was Q6) | PDF reproduction fidelity | **Semantic + structural equivalence** is sufficient. Same clinical content in the same order; font / line-wrap / pixel differences are acceptable. Not pixel-identical. | `CONFIRMED_REQUIREMENT` |
| **R9** (was Q9) | How amendments are presented | Amendment = **new version of the same logical report** (Option A), lineage retained in-system. Regenerated **PDF is a clean ordinary report with a new issue number + issue date and NO visible amendment marker**. See [amendment presentation](../expected-analysis/amendment-presentation.md). | `CONFIRMED_REQUIREMENT` |
| **R10** (was Q10) | Disciplines in scope | **Clinical pathology only** (lab-panel style: values, units, reference ranges, tables). No histopathology. | `CONFIRMED_REQUIREMENT` |
| **R13** (was Q13) | Scale | Current prototype has **one or two non-concurrent users**. Do not add scale infrastructure or optimization without explicit approval. | `CONFIRMED_REQUIREMENT` |
| **R-fmt** (was part of Q8) | Sample authority | Sample PDFs are **directional understanding aids**, not a format to reproduce. The house format is being **designed**, informed by the samples. | `CONFIRMED_REQUIREMENT` |

### Scope note carried into the docs
Scope is **clinical pathology; one or two non-concurrent users; single house format; data-to-preview-to-print/PDF; amendments retained only as the already-defined simple version behavior.** Enterprise authorization, integrations, production persistence, compliance programs, distributed systems, and speculative scale work are deferred by [`SCOPE.md`](../../SCOPE.md). The five samples are illustrative only.
