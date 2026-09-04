# Delivery Plan

This is the implementation handoff for the current prototype. [`../SCOPE.md`](../SCOPE.md)
is authoritative; the task ledger is [`tasks/tasks.json`](tasks/tasks.json).

## Current state

Done: fixture validation, historical-value preservation, semantic comparison,
simple amendment/version behavior, an in-memory service, and the
presentation-neutral document model.

Current priority: connect fixture-shaped input to a usable report preview and a
Print / Save as PDF action. `npm start` must run that product surface.

## Active prototype sequence

1. Keep the runtime and one-command verification green.
2. Accept pasted or sample report JSON and show validation errors.
3. Build the document model from the validated report.
4. Render one readable house-format preview without hiding clinical fields.
5. Verify browser printing and Save as PDF behavior.
6. Use the supplied PDFs only for a short directional visual review; do not copy
   vendor quirks or delay the prototype for exhaustive profiling.

Exit gate: a user can run `npm start`, load report data, see a correct preview,
and print or save it as PDF.

## Deferred until explicit owner approval

- Production databases and recovery infrastructure.
- Enterprise authorization, roles, retention, compliance, or signatures.
- External systems and integrations.
- Distributed systems, speculative scale work, or performance optimization.
- Server-side archival PDF infrastructure and multiple report/template systems.

## Definition of done for every task

- Acceptance criteria are met and linked to code, a decision, or evidence.
- Relevant tests run; formatting, lint, and type checks are clean.
- No debug output, secrets, or patient-identifiable data is committed.
- New uncertainty is recorded in `requirements/open-questions.md`.
- If an invariant is affected, the task includes a regression test naming that invariant.

## Progress workflow

Edit only `status`, `notes`, and newly added tasks in `tasks/tasks.json`; task IDs and completed acceptance evidence should remain stable. Keep no more than one task per area `in_progress`. Split work that cannot be accepted independently. The dashboard is a view, while Git history is the audit trail.
