# Open Questions

Unresolved items requiring a domain owner. Agents: when a decision depends on any of these, proceed with the safest reversible option, tag it `ASSUMPTION`, and reference the question number. Do not silently resolve these.

## Lifecycle & versioning
- **Q1.** Exact operational distinction between *correction*, *amendment*, and *supplementary report*? (Glossary marks this `UNKNOWN`.)
- **Q2.** Exact lifecycle state names and the full legal transition set.
- **Q3.** Is a **draft** pinned to a catalog version, auto-migrated on catalog publish, or reconciled explicitly? (BUSINESS_REQUIREMENTS §7, §21 flag automatic silent migration as suspicious — but the chosen behavior is unconfirmed.)

## Catalog & resolution
- **Q4.** Which fields require full snapshotting (display/unit/interpretation) vs. which may safely remain identifier-only? The fixtures snapshot everything display-bearing; confirm the real boundary.
- **Q5.** Are `option_id`s guaranteed never reused across catalog versions? (INV-8 protection depends on the answer.)

## Rendering & PDF
- **Q6.** Is pixel-identical PDF reproduction required, or is semantic + structural equivalence sufficient? (Affects golden-test strategy.)
- **Q7.** Must historical **renderer versions** remain executable, or only historical *payloads* remain renderable by the current renderer?
- **Q8.** Which supplied PDF variations (if any) are ever normative vs. all illustrative? (Manifest currently marks all `illustrative`.)
- **Q9.** How are amendments/corrections **presented** on the document? No supplied PDF evidences this; S005's "Revised" status is a status label only (see `samples/manifest-notes.md`).

## Scope, scale, compliance
- **Q10.** Which pathology disciplines are in scope (histopath, clinical chemistry, haematology, serology…)? Samples span several vendors/disciplines but scope is unstated.
- **Q11.** Regulatory jurisdiction(s), required audit-retention period, and whether cryptographic/digital signatures are required.
- **Q12.** Must issued PDFs themselves be permanently retained, or only the payload + ability to re-render?
- **Q13.** Expected scale (reports/day, concurrent users, catalog size, historical report count) — architecture differs by orders of magnitude.
- **Q14.** Exact role/permission model and which roles the organization actually uses.

## Integrations
- **Q15.** Existing systems to integrate (LIS/HIS/EMR, identity provider, instruments, document archive, interface engines)?
