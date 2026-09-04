# ADR-0002: Lifecycle and audit transitions

Status: accepted as a minimal internal model; legal workflow and authorization remain blocked. `ASSUMPTION`

## Decision

- Support one editable state (`draft`) and one immutable issued state (`finalized`) for the first domain slice. These are working internal names, not confirmed legal terminology. `ASSUMPTION` (Q2)
- Finalization is a one-way transition. A finalized clinical payload is never edited or reverted in place. `CONFIRMED_REQUIREMENT` (INV-1, INV-9)
- Creating an amendment clones the selected finalized version's resolved payload into a new draft under the same logical report and records `supersedes` immediately. It never re-resolves the baseline from today's catalog. `CONFIRMED_REQUIREMENT` (INV-4, INV-10, R9)
- When the amendment is finalized, retain both versions and append explicit finalization and supersession audit evidence. Treat `superseded` as an append-only relation/event or derived projection, not as permission to mutate the old clinical payload. `CONFIRMED_REQUIREMENT` (INV-1, INV-4, INV-9)
- Perform version creation/finalization, lineage creation, and their required audit writes atomically. A render failure must remain visible and must not imply a successful export. `CONFIRMED_REQUIREMENT` (BR-019 and NFR 17.4)

Minimal internal transition model:

```text
create report -> draft -> finalize -> finalized
                                  \
                                   create amendment draft from frozen payload
                                    -> finalize new version
                                    -> append old-version superseded relation/event
```

The exact event names below are replaceable implementation vocabulary. `ASSUMPTION`

| Event | Required references/evidence |
| --- | --- |
| `report_draft_created` | event id, report/version identity, actor, time |
| `report_version_finalized` | event id, version identity, actor, time, source catalog provenance |
| `amendment_draft_created` | new and baseline version identities, actor, time, amendment reason |
| `report_version_superseded` | old and new version identities, actor, time, reason |
| `export_succeeded` / `export_failed` | version identity, renderer/config identity, time, artifact checksum or safe error code |

Audit events are append-only and refer to immutable versions rather than copying clinical values into ordinary application logs. `ASSUMPTION`; this minimizes protected-data exposure while preserving reconstruction from the version store.

## Invariant check

| Invariant | Consequence |
| --- | --- |
| INV-1 | Only drafts accept clinical edits; issue creates an immutable version. `CONFIRMED_REQUIREMENT` |
| INV-3/INV-4 | Events and lineage use stable version identities. `CONFIRMED_REQUIREMENT` |
| INV-9 | Every lifecycle transition produces durable audit evidence. `CONFIRMED_REQUIREMENT` |
| INV-10 | Amendment creation accepts a historical version, not a current catalog, as its baseline. `CONFIRMED_REQUIREMENT` |

## Reversible implementation guidance

- Reject edits and repeat finalization of a finalized version with a domain error. `ASSUMPTION`
- Inject actor and clock values; do not read global time inside domain comparison logic. `ASSUMPTION`
- Require an amendment reason in the fixture-driven flow and preserve the fixture's `amendment_type` as descriptive metadata only. `ASSUMPTION` (Q1)
- Permit the lineage shape to represent chains, but do not claim repeated amendments are production-approved. `ASSUMPTION` (Q9c)
- Keep authorization behind an interface; actor presence is not proof of permission. `ASSUMPTION` (Q14)

## Production blockers

- Correction, amendment, and supplementary-report semantics are `UNKNOWN` (Q1).
- The full state/transition set and its legal terminology are `UNKNOWN` (Q2).
- Authorized roles and signing permissions are `UNKNOWN` (Q14).
- Audit/version/PDF retention and digital-signature obligations are `UNKNOWN` (Q9b, Q11, Q12).

Related: [architecture invariants](../requirements/architecture-invariants.md), [amendment presentation](../expected-analysis/amendment-presentation.md), [open questions](../requirements/open-questions.md).
