# PathForge prototype scope

This file is the authority for the current product scope. Requirements and plans
apply only when they support this scope. Expanding it requires explicit owner
approval.

## Goal

Build a working prototype that converts clinical-pathology report data into one
clear house-format report that a user can preview, print, or save as a PDF.

## Current operating context

- One or two users; concurrent editing is not a current use case.
- Small, local use. Expected volume does not justify distributed systems or
  scale-focused engineering.
- Favor the shortest reliable path to a usable prototype.

## In scope

- Accept report data using the defined fixture-shaped input.
- Validate required report fields and show actionable errors.
- Preserve the clinical meaning of finalized report data when catalog labels or
  presentation rules later change.
- Produce one presentation-neutral document model.
- Show a usable report preview with a print action.
- Let the browser print or save the report as PDF.
- Support the already-defined simple amendment/version behavior without adding
  a multi-user workflow.
- Use simple local/in-memory storage only where the prototype needs it.
- Tests for clinical correctness and the data-to-report path.

## Out of scope unless the owner explicitly requests it

- Multi-user concurrency beyond the existing lightweight guard.
- Enterprise roles, permissions, identity providers, or approval workflows.
- LIS, HIS, EMR, instrument, billing, archive, or other external integrations.
- Distributed services, queues, caching, high-availability infrastructure, or
  performance optimization for hypothetical scale.
- A production database, legal retention engine, digital signatures, compliance
  certification, or enterprise disaster-recovery program.
- Multiple report designers, multiple house formats, or a general-purpose
  template platform.
- Preserving old renderer executables or adding PDF features not required by the
  approved report layout.

## Working rule for agents

Do not implement an out-of-scope item, add abstraction for a hypothetical future
need, or turn an open production question into current work without explicit
owner approval. Prefer working report behavior over additional planning. Keep
documentation changes short and limited to what implementation or handoff needs.
