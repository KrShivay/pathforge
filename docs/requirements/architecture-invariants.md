# Architecture Invariants

**This file is the single source of truth for the project's non-negotiable constraints.**
[Business requirements](business-requirements.md) references these by number and must not restate or renumber them. If the two ever disagree, this file wins.

Each invariant is a hard architectural constraint. A design that violates any of them is incorrect, not merely suboptimal.

---

### INV-1 — Finalized immutability
A finalized report version must not be mutated into a clinically different report. In-place database updates to a finalized clinical record are an anti-pattern except for fields explicitly designated non-clinical and mutable.

### INV-2 — Catalog changes do not rewrite history
Publishing or editing catalog/configuration must never silently change the resolved content or meaning of an already-finalized report. `catalog update → historical report changes` is a high-severity defect.

### INV-3 — Stable version identity
Every issued report version has a stable, unique identity that persists for the life of the system.

### INV-4 — Amendment lineage
Every amendment/correction retains an explicit, queryable relationship to the version it supersedes or supplements.

### INV-5 — History interpretable without current catalog
A historical clinical payload must remain fully interpretable without assuming today's catalog state equals the catalog state at issue time. It must not depend exclusively on mutable current reference rows. (See the snapshot mechanism in [Catalog V1 → V2 change notes](../fixtures/catalog-change-notes.md).)

### INV-6 — Renderer changes ≠ clinical changes
A change in renderer, font, CSS, pagination, or PDF bytes must never be classified as a clinical-content change. Semantic comparison must be able to report two reports as clinically equal despite differing bytes.

### INV-7 — Fingerprints are never the authority
A semantic fingerprint/hash may accelerate or diagnose equality checks but must never be the sole authority for clinical/content equality. The system must be able to explain equality/inequality independently of the fingerprint.

### INV-8 — No silent remapping
Missing, deprecated, or incompatible historical references must not be silently remapped to semantically different current values. Such situations fail visibly.

### INV-9 — Explicit, auditable lifecycle
Every report lifecycle transition (draft → finalized → superseded, etc.) is explicit and produces durable audit evidence.

### INV-10 — Amend from historical baseline
Reconstructing or amending an old report begins from the historical resolved payload of the version being amended, never from an uncontrolled re-resolution against today's catalog. Current catalog data may assist the editing UI but must not overwrite historical semantics.

---

## Acceptance tests that directly exercise these invariants

These must pass. Fixtures under [`docs/fixtures/`](../fixtures/) are sized to make them runnable.

- **Historical stability (INV-2, INV-5):** finalize under Catalog V1 → publish Catalog V2 with meaningful changes → retrieve original → clinical content unchanged.
- **Amendment baseline (INV-10):** finalize under V1 → publish V2 → create amendment → amendment starts from V1 payload; V2 has not rewritten unchanged historical values.
- **Semantic comparison (INV-6, INV-7):** presentation-only change does not register as a clinical change; equality is explainable without the fingerprint.
- **Deleted reference (INV-8):** deprecate a catalog option in V2 → old reports using it remain interpretable; no silent remap.
- **Audit reconstruction (INV-9):** major lifecycle events and versions are reconstructable from provenance data.
