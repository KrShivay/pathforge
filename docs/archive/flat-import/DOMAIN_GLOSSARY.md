# Domain Glossary

Definitions reflect **this project's intended semantics**. Pathology terminology varies between organizations; where a definition is a working assumption rather than a confirmed business decision, it is tagged. Confirm tagged entries against the full business specification before relying on them.

| Term | Meaning in this project | Provenance |
| --- | --- | --- |
| **Accession / Case** | The unit under which specimens, investigations, observations, and reports exist for a subject. | `ASSUMPTION` |
| **Specimen** | A clinical material associated with a case; a case may have several. | `CONFIRMED_REQUIREMENT` |
| **Report** | The *logical* pathology report; may have multiple issued versions over its life. | `CONFIRMED_REQUIREMENT` |
| **Report version / revision** | A clinically meaningful version of a report (initial, corrected, amended, supplementary). | `CONFIRMED_REQUIREMENT` |
| **Report payload** | The resolved clinical data bound to a specific report version. Self-contained: carries resolved-value snapshots, not just catalog identifiers. | `CONFIRMED_REQUIREMENT` |
| **Resolved value / snapshot** | A stored value that captures `option_id` + human `display` (+ `unit`/`interpretation` where relevant) as of the catalog version at issue time. `display` is authoritative for rendering. | `CONFIRMED_REQUIREMENT` (mechanism: `fixtures/catalog-change-notes.md`) |
| **Catalog** | Reference/configuration: sections, fields, permitted options, labels, units, templates, interpretations, formatting metadata. | `CONFIRMED_REQUIREMENT` |
| **Catalog version** | An immutable, identifiable snapshot of the catalog. Changes are events, not silent global replacements. | `CONFIRMED_REQUIREMENT` |
| **Finalization / sign-out / issue** | The act that establishes an immutable clinical report version. | `CONFIRMED_REQUIREMENT` |
| **Authorization** | Permission to perform a clinically meaningful action (finalize, amend, transition state). | `CONFIRMED_REQUIREMENT` |
| **Amendment** | A new version that changes/supplements a previously issued report; starts from the superseded payload (INV-10). | `CONFIRMED_REQUIREMENT` |
| **Correction vs amendment vs supplementary report** | Distinct version types. Exact operational distinction between them is **not yet fixed**. | `UNKNOWN` → `OPEN_QUESTIONS.md` |
| **Superseded report** | A prior version replaced by a later one; remains identifiable and auditable. | `CONFIRMED_REQUIREMENT` |
| **Semantic fingerprint** | A hash of the canonical payload used to accelerate/diagnose comparison. Never the authority for equality (INV-7). | `CONFIRMED_REQUIREMENT` |
| **Canonicalization** | Reducing a payload to a canonical semantic form (noise removed, fields/values ordered) before comparison or fingerprinting. | `CONFIRMED_REQUIREMENT` |
| **Document model** | Presentation-neutral representation derived from a payload; the renderer's input. | `CONFIRMED_REQUIREMENT` |
| **Renderer** | Produces PDF/HTML/other output from the document model. Must not query current clinical/catalog tables while rendering historical reports. | `CONFIRMED_REQUIREMENT` |
| **Export** | A produced artifact (PDF/HTML/machine-readable) plus enough metadata to identify which version and renderer config generated it. | `CONFIRMED_REQUIREMENT` |
| **Block / slide** | Histopathology sub-units. Applicability to this product's disciplines is unconfirmed. | `UNKNOWN` → `OPEN_QUESTIONS.md` |
