# Business Requirements (Deep Reference)

> **This is reference material, not the agent entry point.** Read the [project brief](../README.md) first, then
> [Architecture invariants](architecture-invariants.md). Consult this document for detail on a specific topic; you are not expected to
> retain it uniformly across a single pass.
>
> Two edits distinguish this copy from the original working document: **§16 points to
> [Architecture invariants](architecture-invariants.md)** rather than restating the invariants (single source of truth), and a few
> human-facing editorial asides have been removed. Substance is otherwise unchanged.

---

# Pathology Report Platform

## Business Requirements and Agent Context Pack

**Document purpose:**
Provide sufficient business, domain, workflow, architectural, document-analysis, and quality context for an engineering or analysis agent to understand the Pathology Report project before reviewing sample PDFs, source exports, schemas, wireframes, or implementation code.

**Status:** Working project context
**Audience:** Product engineers, software architects, AI coding agents, QA engineers, domain analysts, UI/UX engineers, document-processing engineers

---

# 1. Executive Summary

The Pathology Report project is a system for managing structured pathology-report information through its clinical/reporting lifecycle and producing accurate, auditable report outputs, including PDF exports.

The central requirement is that a pathology report is not treated as merely a document template populated with current database values. It is a **versioned clinical artifact** whose contents must remain historically reproducible and whose changes must be explicit, traceable, and clinically meaningful.

The system therefore needs to distinguish between:

- reference/catalog configuration,
- the clinical state of an individual report,
- the resolved content stored for that report,
- presentation/rendering rules,
- PDF/export representation,
- later amendments or corrections,
- changes to catalog/configuration occurring after the original report was created.

A critical business principle is:

> Changes in the current catalog must never silently rewrite the meaning or contents of an already-established clinical report.

Historical reports must remain understandable and reproducible even when the application's current catalog, wording, options, templates, terminology, or rendering rules have subsequently changed.

The application should consequently behave more like a versioned clinical record system than a conventional CRUD application with a PDF-print button attached to it.

---

# 2. Business Problem

Pathology reports combine several things that change independently over time:

1. Patient/case-specific clinical data.
2. Diagnostic findings and interpretations.
3. Structured reporting fields.
4. Reference/catalog definitions.
5. Terminology and display labels.
6. Report templates and section definitions.
7. Rendering and PDF-layout rules.
8. Clinical corrections and amendments.
9. Application and catalog releases.

A naive implementation tends to use the latest catalog and latest templates whenever a report is opened or regenerated.

That creates serious problems.

For example, if a catalog label, option, section, unit, interpretation text, or template changes after a report has been finalized, reopening or exporting the historical report must not make it appear that the newer content was present when the original report was signed.

The business therefore requires explicit separation between:

**Current configuration**

and

**historical clinical truth.**

---

# 3. Primary Business Objectives

The system should achieve the following outcomes.

## 3.1 Clinical fidelity

A report must faithfully represent the clinical state recorded for that report.

Historical reports must not change merely because reference data or application configuration has changed.

## 3.2 Reproducibility

It must be possible to reproduce or explain what information formed a particular issued report.

A future engineer, auditor, or authorized user should be able to determine:

- what data existed,
- what catalog/configuration applied,
- what values were resolved,
- what document was issued,
- what later changed.

## 3.3 Explicit report lifecycle

Drafts, finalized reports, amendments, corrected reports, and superseded reports must have explicit lifecycle semantics.

A change after finalization must not be indistinguishable from ordinary editing.

## 3.4 Auditability

Meaningful report changes must be attributable and explainable.

The system must preserve enough evidence to answer questions such as:

- What changed?
- When did it change?
- Why did it change?
- Which report was superseded?
- Which catalog/configuration produced or influenced the report?
- Was the clinical content changed, or only its presentation?

## 3.5 Stable PDF/document generation

PDF exports should be deterministic enough to support clinical use, archival use, comparison, regression testing, and troubleshooting.

The PDF renderer must not become the only source of truth for the report.

## 3.6 Safe evolution

The application must allow catalogs, templates, terminology, and rendering rules to evolve without corrupting historical reports.

---

# 4. High-Level Domain Model

The implementation should conceptually distinguish the following entities even if the final database uses different names.

## 4.1 Patient / Subject

The person associated with the pathology investigation.

Personally identifiable and protected health information must be handled according to the applicable privacy and security requirements.

Sample PDFs supplied for development or agent analysis should preferably be de-identified unless real clinical data is explicitly authorized for that environment.

## 4.2 Case / Accession

The pathology case or accession under which one or more specimens, investigations, observations, diagnoses, and reports exist.

## 4.3 Specimen

A clinical specimen or material associated with the case.

A case may contain one or more specimens.

## 4.4 Report

The logical pathology report.

A logical report can have multiple issued versions during its lifetime.

## 4.5 Report Version / Revision

A clinically meaningful version of the report.

Examples may include:

- initial finalized report,
- corrected report,
- amended report,
- supplementary report.

The exact terminology should follow the domain/business specification.

## 4.6 Report Payload

The resolved clinical/report data associated with a specific report version.

This is distinct from today's catalog.

The payload should preserve sufficient values and semantic context to reconstruct the report meaningfully.

## 4.7 Catalog

Reference/configuration data used by the reporting application.

Examples could include:

- report sections,
- structured fields,
- permissible values,
- display labels,
- terminology,
- units,
- templates,
- conditional sections,
- predefined interpretations,
- formatting metadata.

The precise catalog schema is implementation-specific.

## 4.8 Catalog Version

An immutable identifiable version or snapshot of the catalog/configuration.

Catalog version changes must be explicitly represented rather than silently replacing the interpretation of previously stored clinical data.

## 4.9 Rendered Artifact

An output derived from a report version, such as:

- PDF,
- printable HTML,
- document preview,
- machine-readable export.

The rendered artifact is an output representation, not the authoritative clinical model by itself.

## 4.10 Amendment

A new report version that changes or supplements a previously issued report.

An amendment must preserve its relationship with the report version it supersedes or extends.

---

# 5. Fundamental Architectural Principle

Three layers must remain conceptually separate:

### Layer A: Clinical/report state

What was actually recorded for the case/report.

### Layer B: Catalog/reference state

What definitions, options, labels, templates, and reference configuration existed.

### Layer C: Presentation/export state

How the clinical information is visually rendered.

These layers interact but must not be collapsed into one another.

For example:

Changing a label in the catalog is not automatically a clinical change.

Changing CSS or PDF pagination is not automatically a clinical change.

Changing the diagnosis is a clinical change.

An implementation that cannot distinguish these categories will eventually generate incorrect historical reports.

---

# 6. Report Lifecycle Requirements

At minimum, the domain model should support a lifecycle similar to:

**Draft → Finalized/Issued → potentially Superseded by Amendment/Correction**

Exact state names may differ.

## 6.1 Draft state

While a report is genuinely editable:

- clinical content may change,
- unresolved values may be resolved against permitted catalog information,
- validation may be applied,
- preview output may be regenerated.

Draft behavior must still be deterministic and traceable enough for debugging.

## 6.2 Finalization / Issue

Finalization establishes a clinically meaningful report version.

After finalization:

- the report version becomes immutable from a clinical-history perspective,
- its resolved content must not silently change,
- its provenance must be retained,
- subsequent modifications must follow the supported correction/amendment workflow.

A database update that modifies the finalized record in place is therefore an anti-pattern unless the specific field is explicitly non-clinical and designed to remain mutable.

## 6.3 Amendment / Correction

An amendment should normally start from the **payload of the report version being amended**, not by rebuilding the report from today's catalog.

This is important.

Suppose:

- Report V1 was issued using Catalog V12.
- Catalog V13 later renames or restructures several fields.
- A user then creates an amendment to V1.

The amendment should not silently reinterpret V1 through Catalog V13.

Instead, the amendment starts with the historical V1 clinical payload and then explicitly applies the amendment.

Current catalog information may assist the editing experience where appropriate, but it must not erase historical semantics.

## 6.4 Supersession

When an amended or corrected report supersedes another version:

- both versions must remain identifiable,
- the supersession relationship must be explicit,
- the earlier version must remain auditable,
- the new version must indicate its lineage.

---

# 7. Catalog Versioning Requirements

Catalog evolution is a first-class business event.

It must not be modeled simply as:

> update database row and use new value everywhere.

A catalog version may change because of:

- terminology changes,
- new structured fields,
- removed fields,
- changed options,
- changed ordering,
- new sections,
- revised default values,
- revised explanatory text,
- template changes,
- unit changes,
- business-rule changes.

The system must determine how reports react to catalog changes based on report lifecycle state.

For example:

### Finalized report

Should continue representing its historical state.

### Existing draft

May require an explicit catalog migration/reconciliation process depending on business rules.

### New report

Normally uses the current applicable catalog version.

The reaction to a catalog change must therefore be modeled intentionally.

---

# 8. Resolved Values and Historical Meaning

Do not assume storing a catalog identifier is sufficient.

Consider:

```text
selected_option_id = 481
```

If option `481` is renamed, removed, reused, or semantically modified, that identifier alone may no longer describe what the clinician originally selected.

Depending on the final data model, the report payload may therefore need to preserve resolved information such as:

- stable semantic identifier,
- value,
- historical display text,
- unit,
- interpretation,
- source catalog version,
- structured metadata necessary for future rendering.

The exact degree of snapshotting should be determined from the catalog design.

The important requirement is:

> Historical report meaning must not depend exclusively on mutable reference rows.

---

# 9. Semantic Equality and Change Detection

The system may use a **semantic fingerprint** or similar hash/fingerprint for:

- fast comparisons,
- caching,
- change detection optimization,
- diagnostics,
- audit support.

However:

> The semantic fingerprint must not become the authoritative definition of content equality.

The source of truth is the actual semantic/content comparison.

The fingerprint is an optimization and diagnostic mechanism.

This protects the system from problems such as:

- hash implementation changes,
- incorrectly omitted fields,
- normalization bugs,
- collision assumptions,
- future schema evolution.

The application should be able to explain why two report payloads are considered equal or different independently of their fingerprint.

---

# 10. Content Comparison

The implementation should define canonical rules for comparing clinical/report content.

Comparison should distinguish between at least:

### Clinically meaningful differences

Examples:

- diagnosis changed,
- finding changed,
- value changed,
- interpretation changed,
- specimen assignment changed.

### Semantic but non-clinical structural changes

Examples depend on domain behavior and may include changed structured metadata.

### Presentation-only differences

Examples:

- font change,
- line wrapping,
- pagination,
- spacing,
- graphical alignment.

A PDF binary comparison is not an acceptable substitute for semantic comparison.

Two clinically identical reports can produce different PDF bytes.

Conversely, two PDFs that look nearly identical may contain clinically significant text differences.

---

# 11. PDF Export Requirements

The supplied PDFs are evidence of expected document behavior, but they should initially be treated as **observed artifacts**, not automatically as the normative specification.

The first job when analyzing the PDFs is descriptive:

> Determine what actually exists.

Only after recurring patterns are established should the system infer formal rendering rules.

This distinction matters because real PDFs often contain:

- manual exceptions,
- legacy behavior,
- inconsistent spacing,
- renderer quirks,
- one-off formatting,
- historical template differences,
- scanner artifacts,
- font substitutions.

Encoding every accidental inconsistency as a business rule would fossilize decades of document entropy into the new architecture.

---

# 12. PDF Profiling Requirements

Before implementing exact rendering logic, create or use a profiler capable of describing each sample PDF.

Where technically possible, capture:

- PDF page count,
- page dimensions,
- orientation,
- margins,
- text blocks,
- coordinates,
- font family,
- font size,
- font weight,
- line height,
- text alignment,
- headers,
- footers,
- page numbering,
- tables,
- borders,
- graphical separators,
- whitespace,
- section spacing,
- repeated elements,
- conditional elements,
- text overflow behavior,
- page-break behavior,
- signatures,
- logos,
- barcodes/QR codes where present,
- accession identifiers,
- dates/times,
- specimen blocks,
- diagnosis sections,
- comments/notes,
- amendment indicators,
- supplementary pages.

The profiler should first emit observations rather than hard-coded conclusions.

For example, prefer:

```text
Observed:
Diagnosis heading begins approximately 31 mm from left margin
in 17/20 samples.
```

over immediately creating:

```text
DIAGNOSIS_LEFT_MARGIN = 31mm
```

The former is evidence.

The latter is a rule.

The transition between them should be deliberate.

---

# 13. Sample PDF Classification

Each supplied PDF should be classified according to its purpose.

Suggested dimensions include:

- report type,
- initial vs amended report,
- number of specimens,
- short vs long report,
- one-page vs multi-page,
- presence of tables,
- presence of signatures,
- unusual formatting,
- legacy vs current layout,
- abnormal/rare section combinations.

Do not give an agent twenty near-identical PDFs and assume that constitutes good test coverage.

The set should deliberately contain representative variation.

---

# 14. Required PDF Analysis Output

For each representative PDF, the analyzing agent should produce:

### Document metadata

- filename,
- report/category type,
- page count,
- approximate template/version if known,
- whether the sample is authoritative or merely illustrative.

### Section map

Identify visible sections in document order.

### Data-field map

For each relevant value:

- visible label,
- example value,
- likely semantic field,
- repetition/cardinality,
- whether required/optional,
- source if known.

### Layout observations

Describe coordinates, spacing, alignment, font hierarchy, pagination, headers, and footers.

### Conditional behavior

Identify evidence such as:

- section appears only when populated,
- page header repeats after page break,
- signature appears only after finalization,
- amendment text appears only on revised reports.

Do not infer a condition merely because one sample happens not to contain a field.

Multiple samples should be compared.

### Unknowns

Any ambiguous behavior should be explicitly marked as unknown instead of invented.

---

# 15. Functional Business Requirements

## BR-001 Report creation

Authorized users must be able to create a pathology report associated with the appropriate clinical case/accession.

## BR-002 Structured clinical data

The report must support structured clinical data according to the applicable reporting/catalog configuration.

## BR-003 Catalog association

Each report or report version must retain sufficient information to determine which catalog/configuration influenced its clinical state.

## BR-004 Draft editing

Authorized users must be able to modify reports while they remain in an editable lifecycle state.

## BR-005 Validation

The system must validate report data according to applicable business and catalog rules before finalization.

Validation rules must themselves be version-aware where necessary.

## BR-006 Finalization

Authorized users must be able to finalize/issue an eligible report.

Finalization must establish an immutable clinical version.

## BR-007 Historical preservation

Finalized report content must remain historically stable regardless of future catalog changes.

## BR-008 PDF rendering

The system must generate a PDF representation of an applicable report version.

## BR-009 Deterministic rendering

Given the same report payload, relevant renderer version/configuration, and deterministic inputs, the generated output should be reproducible within explicitly defined tolerances.

## BR-010 Amendment

Authorized users must be able to create an amendment/correction to an issued report.

## BR-011 Amendment baseline

An amendment must normally use the superseded report payload as its clinical baseline.

It must not silently rebuild that historical report using the latest catalog.

## BR-012 Version lineage

Every amended/corrected report version must identify its relationship to the version it supersedes or supplements.

## BR-013 Audit trail

The system must maintain an audit trail for clinically meaningful lifecycle and content changes.

## BR-014 Catalog publishing

Catalog/configuration changes must be versioned and publishable without rewriting historical reports.

## BR-015 Change detection

The system must support determining whether relevant semantic content has changed.

## BR-016 Content comparison source of truth

Actual normalized semantic/content comparison must remain authoritative.

Fingerprints/hashes may accelerate comparison but must not replace it.

## BR-017 Export history

Where required by business policy, the application should retain enough export metadata to identify what report version and rendering configuration generated a document.

## BR-018 Backward readability

Older report versions must remain readable even when current catalog definitions no longer contain all historical fields/options.

## BR-019 Error visibility

Catalog incompatibilities, migration issues, unresolved historical references, or rendering failures must fail visibly.

The system must not silently substitute unrelated values.

## BR-020 Authorization

Only authorized actors may perform clinically meaningful actions such as finalization, amendment, or report-state transitions.

---

# 16. Data Integrity Invariants

> The authoritative, numbered invariants live in **[Architecture invariants](architecture-invariants.md)** (INV-1 … INV-10).
> They are intentionally **not** duplicated here, to avoid two sources of truth that can drift apart.
> Refer to invariants by their `INV-n` identifiers throughout this document, requirements, tests, and bug reports.
>
> The mapping is 1:1 with the original numbering: Invariant 1 → INV-1, … Invariant 10 → INV-10.

# 17. Non-Functional Requirements

## 17.1 Security

The system should follow least-privilege access principles.

Sensitive patient information should be protected:

- in transit,
- at rest,
- in backups,
- in logs,
- in development/test environments.

Sensitive clinical values must not accidentally appear in diagnostic logs or telemetry.

## 17.2 Privacy

Production patient data should not be used for development, AI-agent analysis, demonstrations, or external testing unless explicitly authorized.

Prefer de-identified sample reports.

## 17.3 Auditability

Clinically relevant actions should produce durable audit evidence.

Audit records should themselves not be casually editable.

## 17.4 Reliability

Finalization and amendment workflows must be transactional enough to prevent partially issued reports.

A failure during PDF rendering should not leave the database claiming a document was successfully issued when it was not, unless the architecture intentionally separates those events and exposes the incomplete state.

## 17.5 Performance

Normal report editing should remain interactive.

Potentially expensive operations such as:

- full PDF generation,
- large historical comparisons,
- bulk migrations,
- catalog reconciliation

may be isolated from the immediate UI path where appropriate.

## 17.6 Scalability

Avoid designs where report retrieval requires recursively reconstructing the entire historical catalog graph.

Historical reports should remain reasonably self-contained.

## 17.7 Maintainability

Business rules should be explicit and testable.

Avoid embedding important clinical behavior exclusively in:

- UI components,
- PDF templates,
- database triggers,
- hidden callbacks,
- undocumented catalog conventions.

## 17.8 Observability

The system should record enough operational metadata to diagnose:

- failed report generation,
- catalog-resolution problems,
- comparison mismatches,
- rendering errors,
- amendment failures.

Observability must not leak protected clinical data.

## 17.9 Testability

Domain logic should be testable independently from PDF rendering and UI code.

## 17.10 Backward compatibility

New software/catalog versions must continue to support required historical reports.

---

# 18. Recommended Architectural Boundaries

A maintainable implementation will probably require clear boundaries between:

### Clinical domain service

Owns report lifecycle and clinical invariants.

### Catalog service/module

Owns catalog definitions and catalog versions.

### Resolution layer

Transforms permitted catalog references and user selections into stable report payload semantics.

### Comparison/canonicalization layer

Determines semantic equality and creates fingerprints.

### Document model

Transforms clinical report payload into a presentation-neutral report/document representation.

### Renderer

Produces PDF/HTML/other output from the document model.

### Audit subsystem

Records meaningful actions and state transitions.

These do not necessarily need to be independent deployable microservices.

Logical boundaries matter more than arbitrary service count.

---

# 19. Recommended Report Generation Flow

A useful conceptual pipeline is:

```text
Clinical Report Version
        |
        v
Stable/Resolved Report Payload
        |
        v
Presentation-Neutral Document Model
        |
        v
Renderer Configuration
        |
        v
PDF / HTML / Other Artifact
```

The renderer should not directly query arbitrary current clinical/catalog database tables while generating historical reports.

Inputs to the rendering process should be explicit.

---

# 20. Canonicalization and Fingerprinting

Where fingerprints are required, use a canonical semantic representation.

Conceptually:

```text
report payload
    ↓
remove non-semantic noise
    ↓
canonical field ordering
    ↓
canonical value representation
    ↓
semantic serialized representation
    ↓
fingerprint
```

Do not blindly fingerprint raw JSON because insignificant differences such as key ordering or incidental metadata may create false changes.

Similarly, do not remove fields from the canonical form merely because they are inconvenient.

Every excluded field should have an explicit reason.

---

# 21. Important Edge Cases

The agent should actively consider at least the following scenarios.

## Catalog changes after finalization

Historical report must remain stable.

## Catalog changes while a report is still draft

Business rules must define whether the draft stays pinned, migrates automatically, or requires explicit reconciliation.

Automatic silent migration should be treated suspiciously.

## Deleted catalog option

Historical reports using the option must remain readable.

## Renamed option

Determine whether this is presentation-only or semantic.

The implementation must not guess.

## Changed unit

Historical value must retain the unit under which it was clinically recorded.

## Changed interpretation text

Historical report must not silently gain the new interpretation.

## Amendment after multiple catalog releases

Start from the superseded report payload.

## Multiple amendments

Maintain lineage and supersession correctly.

## PDF renderer upgrade

Clinical content should compare equal even if PDF bytes or line wrapping differ.

## Font substitution

May affect pagination without constituting a clinical content change.

## Long text

Test overflow and page-break behavior.

## Extremely short report

Ensure unnecessary empty sections are handled according to evidence/business rules.

## Multiple specimens

Verify repeated-section ordering and pagination.

## Missing optional values

Do not render placeholder noise unless explicitly required.

## Historical malformed data

System should expose controlled fallback behavior rather than crashing or silently inventing data.

## Concurrent editing/finalization

Prevent two actors from accidentally finalizing incompatible versions.

---

# 22. Testing Strategy

Testing should operate at multiple levels.

## Domain tests

Verify:

- allowed state transitions,
- finalization immutability,
- amendment lineage,
- catalog-version behavior,
- semantic comparison.

## Catalog tests

Verify:

- version publication,
- stable identifiers,
- historical lookup,
- incompatible-change handling.

## Canonicalization tests

Verify semantically identical payloads produce equivalent canonical representations.

## Fingerprint tests

Verify expected fingerprint stability while keeping content comparison authoritative.

## Renderer tests

Verify:

- section ordering,
- formatting,
- conditional visibility,
- headers/footers,
- pagination.

## Golden document tests

Use approved representative reports as reference artifacts.

Golden tests should compare appropriate properties rather than relying only on raw PDF binary equality.

Possible comparison levels include:

- extracted text,
- section structure,
- positioned text,
- document metadata,
- rendered page images,
- semantic document tree.

## End-to-end tests

Cover important workflows such as:

```text
Create case
→ create report
→ populate structured values
→ finalize
→ generate PDF
→ publish newer catalog
→ reopen historical report
→ verify unchanged
→ create amendment
→ verify amendment starts from historical payload
→ modify relevant value
→ finalize amendment
→ verify version lineage
```

---

# 23. What Must Be Shared With an Agent Alongside Sample PDFs

A useful handoff package should contain more than a directory called `pdfs-final-final-v3`.

Recommended package:

```text
/pathology-report-context
│
├── README.md
├── BUSINESS_REQUIREMENTS.md
├── DOMAIN_GLOSSARY.md
├── ARCHITECTURE_PRINCIPLES.md
├── BUSINESS_RULES.md
├── OPEN_QUESTIONS.md
│
├── samples/
│   ├── manifest.csv
│   ├── report-001.pdf
│   ├── report-002.pdf
│   ├── report-003.pdf
│   └── ...
│
├── expected-analysis/
│   ├── report-001.md
│   ├── report-002.md
│   └── ...
│
├── schemas/
│   ├── current-report-schema.json
│   ├── catalog-schema.json
│   └── document-model-schema.json
│
├── lifecycle/
│   ├── report-states.md
│   └── amendment-examples.md
│
├── catalog-examples/
│   ├── catalog-v1.json
│   ├── catalog-v2.json
│   └── change-notes.md
│
└── fixtures/
    ├── representative-report.json
    ├── amended-report.json
    └── comparison-examples.json
```

Not every file is mandatory on day one, but this is the direction the handoff should converge toward.

---

# 24. Sample PDF Manifest

Provide a manifest instead of forcing the agent to infer why each PDF exists.

Recommended columns:

| Field Meaning         |                                                  |
| --------------------- | ------------------------------------------------ |
| sample_id             | Stable identifier                                |
| filename              | PDF filename                                     |
| report_type           | Known report category                            |
| report_version_type   | Initial/amended/corrected/etc.                   |
| page_count            | Number of pages                                  |
| specimen_count        | If known                                         |
| template_version      | If known                                         |
| catalog_version       | If known                                         |
| produced_date         | Prefer approximate/non-PHI metadata if necessary |
| authoritative         | Whether exact behavior should be replicated      |
| notable_features      | Why this sample matters                          |
| expected_sections     | Known visible sections                           |
| known_anomalies       | Intentional or legacy oddities                   |
| deidentified          | Yes/no                                           |
| notes                 | Additional context                               |

Example:

```text
S001,
report-001.pdf,
Histopathology,
Initial,
2,
3,
Template-7,
Catalog-14,
2026-Q1,
yes,
"multiple specimens; diagnosis continues to second page",
"Header; Patient; Specimens; Diagnosis; Comment; Signature",
"",
yes
```

---

# 25. Information to Provide About Each PDF

Ideally add a short annotation document for important samples.

Example:

```text
Sample: S004

Purpose:
Demonstrates an amended report.

Important observations:
- Page one explicitly identifies the report as amended.
- Original specimen structure is preserved.
- Only diagnosis/comment content changed.
- Signature metadata corresponds to the amendment.
- The report should not be interpreted as a brand-new case.

Authoritative behavior:
- Amendment labeling.
- Section ordering.
- Version relationship.

Non-authoritative behavior:
- Exact printer margin.
- Legacy footer whitespace.

Known source:
Report payload generated under Catalog V11.
Amendment created after Catalog V13 was published.
```

This type of information is extremely valuable to an agent.

---

# 26. Domain Glossary to Include

At minimum define the project's exact meaning of:

- accession,
- case,
- specimen,
- block,
- slide, if applicable,
- investigation/test,
- report,
- report version,
- diagnosis,
- comment,
- interpretation,
- finalization,
- authorization,
- sign-out,
- amendment,
- correction,
- supplementary report,
- superseded report,
- catalog,
- catalog version,
- template,
- report payload,
- resolved value,
- semantic fingerprint,
- canonicalization,
- document model,
- renderer,
- export.

Pathology terminology varies between organizations.

The glossary should reflect this product's intended semantics rather than assuming every laboratory uses identical terms.

---

# 27. Business Rules Document

Where known, provide rules explicitly.

Examples:

```text
RULE-RPT-001
A finalized report cannot be clinically edited in place.

RULE-RPT-002
Any clinical modification to a finalized report creates a new report version through the supported correction/amendment workflow.

RULE-CAT-001
Publishing a new catalog version does not modify finalized report payloads.

RULE-AMD-001
Creating an amendment clones/derives its baseline from the report version being amended.

RULE-CMP-001
Semantic equality is determined from canonical content comparison.

RULE-CMP-002
A semantic fingerprint may optimize equality checks but cannot override a detected content difference.

RULE-PDF-001
PDF generation consumes an explicit report/document payload rather than resolving historical values directly from the latest catalog.
```

Rules should have stable identifiers so requirements, tests, implementation, and bugs can refer to the same thing.

---

# 28. Architecture Information to Share

If available, the agent should receive:

- current architecture diagram,
- current repository/module structure,
- database schema,
- key entity relationships,
- API contracts,
- catalog format,
- report payload examples,
- rendering technology,
- PDF library,
- frontend framework,
- backend framework,
- database technology,
- object/file storage mechanism,
- authentication/authorization approach,
- deployment environment,
- runtime versions,
- CI/CD setup,
- test framework,
- coding conventions.

The agent should be told which parts are:

- existing production constraints,
- approved design,
- proposed architecture,
- experimental,
- replaceable.

---

# 29. Agent Instructions for Reviewing the PDFs

Give the analysis agent explicit instructions similar to:

```text
Do not immediately design the new report template.

First profile the supplied PDFs and describe what is actually present.

Distinguish:
1. recurring behavior,
2. probable business rules,
3. presentation conventions,
4. sample-specific anomalies,
5. unknowns.

Do not convert an observation into a requirement unless:
- supporting evidence exists across samples,
- it is explicitly documented,
- or it is confirmed as a business requirement.

Do not infer clinical semantics solely from visual position.

Do not treat the current catalog as the authoritative explanation of historical PDFs.

Do not assume the PDF is the canonical data model.

Where behavior is ambiguous, record the ambiguity.

Preserve historical/version semantics throughout recommendations.
```

---

# 30. Agent Instructions for Proposed Architecture

The agent should be asked to evaluate every proposal against:

- historical reproducibility,
- report immutability,
- amendment correctness,
- catalog evolution,
- auditability,
- backward compatibility,
- renderer independence,
- testability,
- maintainability,
- security,
- performance.

The agent should explicitly identify any design that could allow:

```text
catalog update
        ↓
historical report changes
```

as a high-severity architecture problem.

---

# 31. Questions the Agent Should Answer During Analysis

The agent's output should eventually clarify:

### PDF/document questions

- What sections exist?
- What is their ordering?
- Which elements repeat?
- Which are conditional?
- What pagination behavior exists?
- Which formatting patterns are consistent?
- Which anomalies appear sample-specific?

### Clinical-model questions

- What information appears to be case-level?
- What is specimen-level?
- What is report-level?
- What is version-level?

### Catalog questions

- Which visible elements likely come from configuration?
- Which values must be snapshotted?
- Which references can safely remain identifiers?

### Lifecycle questions

- How is a finalized report recognized?
- How are amendments represented?
- What differs between initial and amended reports?

### Architecture questions

- What data is required to reproduce a historical report?
- Which data should belong to the immutable report payload?
- Which data can safely remain external/current?

---

# 32. Known Design Decisions That Should Not Be Reopened Without Evidence

Based on the current architecture direction, preserve these principles unless new evidence demonstrates a concrete problem:

### Catalog updates are events

A catalog release is something report state may react to according to defined rules.

It is not silent global replacement of historical meaning.

### Content comparison is authoritative

Semantic fingerprints are useful but secondary.

### Amendments preserve historical baseline

An amendment starts from the superseded report's resolved clinical state.

### Existing finalized reports remain historical artifacts

They do not automatically adopt newer catalog semantics.

### Profiling precedes normalization

Real exports are analyzed descriptively before declaring universal formatting rules.

These are load-bearing decisions rather than implementation trivia.

---

# 33. Assumptions That Must Be Validated

The following should be treated as assumptions until confirmed against the complete business specification:

- exact pathology disciplines covered,
- exact report lifecycle/state names,
- meaning of amendment vs correction vs supplementary report,
- whether issued PDFs themselves must be permanently retained,
- whether cryptographic signatures are required,
- whether digital signatures are required,
- exact regulatory jurisdiction,
- required audit-retention period,
- whether a draft is pinned to a catalog version,
- whether drafts may migrate between catalog versions,
- exact template-version semantics,
- whether historical renderer versions must remain executable,
- whether exact pixel-identical PDF reproduction is required,
- which PDF artifacts are normative,
- which PDF variations are legacy defects,
- exact role/permission model.

Do not invent answers to these from the PDFs.

---

# 34. Information Still Worth Providing Before Implementation

For an implementation-grade handoff, attach or define:

## Clinical workflow

Describe who creates, edits, reviews, signs, amends, prints, and consumes the report.

## Roles and permissions

For example:

- pathologist,
- technician,
- administrator,
- reviewer,
- external viewer.

Only include roles actually used by the organization.

## Expected scale

Provide approximate:

- reports/day,
- concurrent users,
- catalog size,
- retention period,
- PDF size,
- number of historical reports.

Architecture decisions can differ dramatically between 500 reports a month and several million reports a year.

## Regulatory/security requirements

State applicable standards and jurisdictions explicitly.

Do not ask an engineering agent to infer compliance obligations from the word "pathology."

## Current technology stack

Provide exact versions where possible.

## Existing system constraints

Document integrations such as:

- LIS,
- HIS,
- EMR/EHR,
- identity provider,
- laboratory instruments,
- external APIs,
- document archive,
- messaging/interface engines.

## Success criteria

Examples could include:

- all agreed sample report categories render correctly,
- historical reports remain stable across catalog upgrades,
- amendment lineage is preserved,
- no current-catalog dependency exists when displaying finalized historical reports,
- agreed PDF regression suite passes.

---

# 35. Suggested Acceptance Criteria

A release should not be considered functionally complete merely because a sample PDF visually resembles the original.

At minimum, acceptance should demonstrate:

### Historical stability test

1. Create/finalize report using Catalog A.
2. Capture its semantic payload and output.
3. Publish Catalog B with meaningful changes.
4. Retrieve the original report.
5. Verify its clinical content remains unchanged.

### Amendment baseline test

1. Finalize report using Catalog A.
2. Publish Catalog B.
3. Create amendment.
4. Verify amendment starts from the original report payload.
5. Verify Catalog B has not silently rewritten unchanged historical values.

### Semantic comparison test

Verify presentation-only changes do not appear as clinical changes.

### Deleted-reference test

Remove/deprecate a catalog option in a later version.

Verify old reports remain interpretable.

### Rendering test

Generate representative short, long, single-page, multi-page, repeated-specimen, and amended reports.

### Audit test

Verify major lifecycle events and versions can be reconstructed from audit/provenance data.

---

# 36. Recommended Agent Deliverables

After receiving this context and the sample PDFs, the agent should produce:

1. PDF profiling report.
2. Section and field inventory.
3. Cross-sample comparison matrix.
4. Observed layout rules.
5. Suspected conditional rules.
6. Explicit unknowns.
7. Domain-model recommendations.
8. Report lifecycle model.
9. Catalog/report version interaction model.
10. Proposed canonical report payload.
11. Rendering/document model proposal.
12. Amendment workflow.
13. Semantic comparison strategy.
14. Migration/backward-compatibility strategy.
15. Security/privacy risks.
16. Test matrix.
17. Implementation risks.
18. Questions that genuinely require domain-owner clarification.

The agent should not begin by generating production code from PDF screenshots.

Understanding the domain contract comes first.

---

# 37. Suggested Context Prompt to Send to an Engineering Agent

Use this as the instruction accompanying the files:

```text
You are working on a Pathology Report platform.

Read BUSINESS_REQUIREMENTS.md and all supplied project context before
making architectural or implementation recommendations.

The system manages versioned clinical pathology reports and generates
document/PDF representations.

Treat finalized report versions as historical clinical artifacts.

Critical constraints:

1. A current catalog change must never silently rewrite a historical
   finalized report.

2. Catalog versions and clinical report versions are distinct concepts.

3. When creating an amendment, begin from the resolved payload of the
   report version being amended rather than rebuilding the historical
   report using the latest catalog.

4. Semantic/content comparison is the authority for determining
   meaningful equality.

5. Fingerprints/hashes are optimization and audit aids only.

6. The PDF is an output representation, not automatically the canonical
   clinical data model.

7. Profile supplied PDFs descriptively before converting recurring
   observations into normative rendering rules.

8. Explicitly separate:
   - clinical semantics,
   - catalog/reference semantics,
   - rendering/presentation behavior.

9. Preserve historical reproducibility, auditability, backward
   compatibility, and amendment lineage.

10. Do not silently guess domain rules from a single PDF.

When reviewing PDFs:

- inventory sections and fields,
- identify repeated and conditional elements,
- profile typography and layout,
- compare samples,
- identify apparent report categories,
- identify amendment/version behavior,
- distinguish consistent patterns from anomalies,
- record unknowns explicitly.

For every proposed architecture decision, evaluate:

- clinical correctness,
- historical stability,
- catalog evolution,
- amendment correctness,
- auditability,
- security/privacy,
- maintainability,
- performance,
- testability,
- backwards compatibility.

Do not implement code until the relevant business behavior and data
ownership boundaries are understood.
```

---

# 38. Minimum Handoff Package

If there is not enough time to assemble the complete documentation set, the minimum useful package is:

```text
1. This business/context document.
2. Representative sample PDFs.
3. PDF manifest explaining why each sample exists.
4. Current report payload/schema example.
5. Current catalog/schema example.
6. Example of an initial report and its amendment.
7. Known lifecycle/business rules.
8. Current technology stack.
9. Explicit list of unresolved questions.
10. Exact approved architecture invariants.
```

Items 4, 5, and 6 are especially valuable.

The PDFs show what the system looks like.

The payloads and catalog show what the system means.

An implementation needs both.

---

# 39. Definition of Success

The project is successful when the application can evolve its catalogs, templates, software, and rendering technology while preserving the clinical meaning and provenance of every report version that has already been issued.

A correctly designed system should be able to answer:

> "What did this report mean when it was issued?"

without needing to pretend that today's catalog, today's template, or today's application behavior existed at that time.

That historical integrity is the central business and architectural requirement of the project.
