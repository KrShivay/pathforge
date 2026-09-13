# Amendment Presentation & Behaviour (design spec)

**Provenance: `ASSUMPTION` — this is a confirmed design decision by the project owner, not evidence observed in any sample PDF. It is revisable, but it is the current intended behaviour.** No supplied sample demonstrates an amendment; this spec defines it rather than reverse-engineering it.

Related: [Architecture invariants](../requirements/architecture-invariants.md) INV-3, INV-4, INV-9, INV-10; [Business requirements](../requirements/business-requirements.md) BR-010/011/012, §6.3–§6.4; fixtures [`report-initial.json`](../fixtures/report-initial.json), [`report-amended.json`](../fixtures/report-amended.json), [`expected-comparison.json`](../fixtures/expected-comparison.json).

---

## Decision in one line

An amendment is a **new version of the same logical report**, retained with explicit lineage in the system. The **regenerated PDF is a clean, ordinary report** carrying a **new issue number and issue date** — with **no visible amendment marker** — while the system keeps the original version and a full audit record.

## Confirmed decisions

| # | Decision | Value | Provenance |
| --- | --- | --- | --- |
| A | Amendment identity model | **Option A** — new *version* of the same logical report (not a new report record). `R{n}/V2 supersedes R{n}/V1`. | `CONFIRMED_REQUIREMENT` (owner) |
| B | Visible amendment marker on PDF | **None.** No "AMENDED"/"REVISED" banner, no strikethrough, no changed-field callout. | `CONFIRMED_REQUIREMENT` (owner) |
| C | Visible surface change on PDF | **New issue number + new issue date only.** Everything else prints as a normal, clean report. | `CONFIRMED_REQUIREMENT` (owner) |
| D | Baseline for the amendment | The **superseded version's frozen payload** (INV-10). Only the corrected field(s) plus the new issue number/date change. Never rebuilt from the current catalog. | `CONFIRMED_REQUIREMENT` |
| E | Original version after amendment | Retained **immutably**; remains identifiable and auditable (INV-1, INV-3). | `CONFIRMED_REQUIREMENT` |

## What the reader sees

A patient/clinician receiving the amended PDF sees a normal clinical-pathology report. The **only** difference from the original document is the issue number and issue date. There is deliberately no on-page signal that a correction occurred.

> **Recorded consequence (not a blocker — a conscious trade-off):** a clinician who already acted on the original will not be alerted by the document itself that a value changed. This is an explicit owner decision (B). Any "notify the ordering clinician of a correction" behaviour, if ever needed, must live **outside** the PDF (workflow/notification), because the document carries no marker. Captured here so it is a decision on the record, not an oversight.

## What the system keeps (invisible to the reader)

- **Both versions**, immutable, under one logical report id (A, E).
- **Explicit supersession link** `V2 → supersedes → V1` (INV-4).
- **Audit record**: who amended, when, and why (`amendment_reason`), plus the lifecycle transition (INV-9).
- **Derivation guarantee**: V2's payload is V1's payload with only the intended delta applied (INV-10, decision D).

## "Without any other alteration" — why the invariant guarantees it

The owner's phrasing was: change the issue number, correct what needs correcting, and *nothing else moves*. That is exactly INV-10. Because V2 is derived from V1's **frozen resolved payload** — not re-resolved against today's catalog — a catalog change made between the two issue dates (e.g. a renamed test or revised reference range in a later catalog version) **cannot** leak into the amended PDF. Unchanged fields print byte-for-byte the same clinical content. If an amendment were instead rebuilt from the current catalog, "no other alteration" would silently break. The two requirements are the same requirement.

## Comparison behaviour

Diffing V1 against V2 must surface **exactly** the corrected clinical field(s) and the identifier/date change, and **nothing else**. This is `expected-comparison.json` → `CMP-1`. If any unchanged field appears in the diff, it indicates an INV-10 violation (the amendment was rebuilt from the current catalog rather than cloned from the baseline).

The new **issue number and issue date are identifier/provenance fields, not clinical content.** Semantic *clinical* comparison should treat them as non-clinical metadata (they always differ between versions by design); they belong to the version/provenance layer, not the clinical delta.

## Open sub-questions (routed to OPEN_QUESTIONS.md)

- **Q9a** Is the "issue number" the same identifier space as an invoice/accession number, or a distinct report-issue sequence? (Owner used "invoice/issue number" interchangeably.)
- **Q9b** Retention period for superseded versions? (Regulatory — still open, see Q11.)
- **Q9c** Can a report be amended more than once (V3 supersedes V2 …)? Assumed **yes**, lineage chains; confirm.
