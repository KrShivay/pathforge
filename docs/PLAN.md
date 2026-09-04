# Delivery Plan

This is the implementation handoff. It keeps planning in one place and execution
state in [`tasks/tasks.json`](tasks/tasks.json). The detailed business reference
remains authoritative; this file only states the order, gates, and first slices.

## Current readiness

Already defined:

- Ten architecture invariants, including immutable finalized versions and historical catalog snapshots.
- Initial/amended fixtures and expected semantic comparison.
- Amendment presentation: a new issue of the same logical report, with retained lineage.
- Scope: clinical pathology, one designed house format, semantic rather than pixel fidelity.
- Small sample manifest and a domain glossary.

Required before production coding:

- Confirm lifecycle transitions, clinical validation rules, roles, regulatory jurisdiction/retention, and integration boundaries. These remain Q1-Q15 in [`requirements/open-questions.md`](requirements/open-questions.md).
- Profile the supplied PDFs and produce a section/field inventory. The repository currently contains only the amendment presentation analysis in the canonical `docs/expected-analysis/` tree.
- Agree the canonical payload, state machine, snapshot boundary, audit events, and error behavior against INV-1 through INV-10.
- Define measurable acceptance tests for historical stability, amendment baseline, semantic equality, deleted references, rendering, and audit reconstruction.

The unknowns do **not** prevent reversible scaffolding or fixture-driven domain work. They do prevent production authorization, retention, integration, and lifecycle behavior from being declared complete.

## Phase 0 — Evidence and decisions

1. Profile each sample as descriptive evidence (`OBSERVED`), never as a template contract.
2. Produce the section/field inventory and cross-sample matrix; route uncertainty to the open-question log.
3. Hold a short domain-owner review of Q1-Q15. Record decisions in the resolved log instead of deleting questions.
4. Write three compact decision records: canonical payload/version identity, lifecycle/audit transitions, and catalog snapshot strategy.

Exit gate: every production-significant choice is `CONFIRMED_REQUIREMENT`, or is explicitly reversible and tagged `ASSUMPTION` with an open-question reference.

## Phase 1 — Project setup

1. Establish the runtime, package manager, supported versions, environment template, and one-command local start.
2. Add formatting, linting, type checking, unit tests, and fixture validation to a single verification command.
3. Create module boundaries for clinical domain, catalog, comparison, document model/renderer, persistence, and audit. Modules may begin as empty interfaces.
4. Add CI for install, verification, and build; pin dependencies and prohibit secrets/clinical data in the repository and logs.
5. Add a local task dashboard that reads `docs/tasks/tasks.json` without mutating it.

Exit gate: a clean checkout installs, verifies, builds, and opens the task dashboard using documented commands.

## Phase 2 — Fixture-driven domain core

Build the smallest end-to-end domain slice before UI or PDF styling:

1. Parse and validate the catalog/report fixtures.
2. Canonicalize report payloads while excluding presentation and issue metadata.
3. Compare two payloads semantically and return an explainable list of changes; hashes are diagnostic only.
4. Finalize a draft into an immutable version with stable identity and an audit event.
5. Create an amendment by cloning the superseded resolved payload, then link old and new versions.

Exit gate: invariant acceptance tests pass against the supplied V1/V2 and initial/amended fixtures, including proof that a catalog update cannot change the historical report.

## Phase 3 — Persistence and service boundary

1. Choose storage only after lifecycle, retention, and integration constraints are confirmed.
2. Implement append-oriented report versions and audit events; enforce optimistic concurrency on finalization.
3. Expose use-case APIs for create draft, validate, finalize, retrieve history, compare, and amend.
4. Reject missing/deprecated references visibly; never silently remap them.

Exit gate: transactional and restart/recovery tests demonstrate durable version identity, lineage, and audit reconstruction.

## Phase 4 — Document generation

1. Map a frozen report payload to a presentation-neutral document model.
2. Implement the single house format and deterministic PDF generation without querying current catalog rows.
3. Store export metadata: report-version identity, renderer/config version, checksum, time, and actor/process.
4. Test long values, missing optionals, pagination, font substitution, multiple specimens, and renderer upgrades.

Exit gate: golden structural tests and PDF content extraction confirm the right clinical content/order; renderer-only changes remain clinically equal.

## Phase 5 — Product surface and hardening

1. Add workflow UI and permissions once role decisions are confirmed.
2. Integrate identity/LIS/HIS/archive systems through adapters after Q15 is resolved.
3. Add encryption, redaction, structured audit access, backup/restore, observability, load tests, and failure injection.
4. Complete security/privacy review and operational runbooks before real clinical data is allowed.

Exit gate: domain-owner acceptance, threat model, recovery exercise, performance target, and release checklist are signed off.

## Definition of done for every task

- Acceptance criteria are met and linked to code, a decision, or evidence.
- Relevant tests run; formatting, lint, and type checks are clean.
- No debug output, secrets, or patient-identifiable data is committed.
- New uncertainty is recorded in `requirements/open-questions.md`.
- If an invariant is affected, the task includes a regression test naming that invariant.

## Progress workflow

Edit only `status`, `notes`, and newly added tasks in `tasks/tasks.json`; task IDs and completed acceptance evidence should remain stable. Keep no more than one task per area `in_progress`. Split work that cannot be accepted independently. The dashboard is a view, while Git history is the audit trail.
