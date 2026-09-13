# Notes on the sample set

## Evidence status

Five illustrative sample PDFs are available locally and match the filenames in the manifest. Basic metadata and first-page text were checked on 2026-09-04. The files remain directional examples, not house-format requirements. See [PDF evidence status](../expected-analysis/pdf-evidence-gap.md). `OBSERVED`

The manifest marks every row `illustrative`; even after intake, these samples are directional evidence rather than specifications of this platform's house format. `CONFIRMED_REQUIREMENT` (R-fmt)

## Coverage gaps (be explicit about these)
- **S001 contains visible personal data.** It is intentionally ignored by Git and must be replaced with a de-identified copy before any sample PDFs are committed. `OBSERVED`
- **S005 restricts printing and copying.** It can be read locally but must not be treated as proof that PathForge should reproduce those restrictions. `OBSERVED`
- **The samples are not authoritative amendment examples.** Amendment semantics come from [Architecture invariants](../requirements/architecture-invariants.md) (INV-4, INV-10) and [`report-amended.json`](../fixtures/report-amended.json). `CONFIRMED_REQUIREMENT`
- **Multi-specimen behavior is not evidenced.** Repeated-specimen ordering and pagination remain `UNKNOWN`.
- **A single house format must be designed.** Do not merge manifest-described vendor or layout differences into a house-style rule. `CONFIRMED_REQUIREMENT` (R-fmt)

## S005 `Revised` metadata

S005 visibly contains a `Revised` status, but that single label does not define PathForge amendment presentation. `OBSERVED`

## Table-rendering metadata

ASCII or box-drawing tables occur in the reference samples. They are vendor rendering artifacts and must not be promoted to a PathForge rendering rule. `OBSERVED`
