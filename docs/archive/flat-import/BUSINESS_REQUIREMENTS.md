# Business Requirements (Deep Reference)

**This is reference material, not the agent entry point.** Read `README.md` first, then `INVARIANTS.md`. Consult this document for detail on specific topics; you are not expected to retain it uniformly.

Two changes were made to the original working document when it became the *deep reference* layer of this package. Apply them when you paste in the verbatim body:

1. **Section 16 (Data Integrity Invariants) is removed** and replaced by the pointer block below. The authoritative, numbered invariants live only in `INVARIANTS.md` (INV-1 … INV-10). Do not restate or renumber them here — a second copy will drift. Refer to them everywhere as `INV-n`.

2. **Editorial asides are stripped** from this agent-facing copy (the "distributed debugging exercise," "archaeology through Git history," "enough suffering in civilization," and similar lines). Keep the single sharpening distinction — *a versioned clinical record system, not a CRUD app with a print button* — because it earns its place. Humor belongs in human design discussion, not machine-operational context.

> **Paste the original working document body here, verbatim, sections 1–39, with the two edits above applied.** It is unchanged in substance; only §16 and the asides differ. Everything the original says about lifecycle, catalog versioning, resolved values, canonicalization, edge cases, testing, and deliverables remains the deep reference and is still in force.

---

## §16 — Data Integrity Invariants (pointer)

> The authoritative, numbered invariants live in **`INVARIANTS.md`** (INV-1 … INV-10).
> They are intentionally **not** duplicated here to avoid two sources of truth that can drift.
> Refer to invariants by their `INV-n` identifiers throughout requirements, tests, and bug reports.

---

## Quick index into the deep reference

- Business problem & objectives → orig. §2–§3
- Domain model → §4
- Three-layer architectural principle → §5
- Report lifecycle → §6
- Catalog versioning → §7
- Resolved values & historical meaning → §8 (the *why identifier-alone is insufficient* argument; see `fixtures/catalog-change-notes.md` for the chosen snapshot mechanism)
- Semantic equality / change detection → §9–§10
- PDF export, profiling, classification, analysis output → §11–§14
- Functional requirements BR-001…BR-020 → §15
- **Invariants → `INVARIANTS.md`** (was §16)
- Non-functional requirements → §17
- Architectural boundaries & generation flow → §18–§20
- Edge cases → §21
- Testing strategy → §22
- Handoff package, manifest, glossary, business rules → §23–§28
- Agent instructions → §29–§31
- Decisions not to reopen; assumptions to validate → §32–§33
- Pre-implementation info & acceptance criteria → §34–§35
- Agent deliverables & context prompt → §36–§38 (the §37 prompt is condensed into `README.md`)
- Definition of success → §39
