# Notes on the sample set

## Evidence status

The manifest names five illustrative sample PDFs, but none of the binary files is present in the repository. Vendor, page-count, section, feature, and report-kind values are manifest-provided metadata and remain unverified against the documents. They are not direct `OBSERVED` PDF evidence. See the authoritative [PDF evidence gap](../expected-analysis/pdf-evidence-gap.md). `UNKNOWN`

The manifest marks every row `illustrative`; even after intake, these samples are directional evidence rather than specifications of this platform's house format. `CONFIRMED_REQUIREMENT` (R-fmt)

## Coverage gaps (be explicit about these)
- **All five binaries are absent.** Typography, layout, content, disclaimers, report status, and pagination cannot be verified. `UNKNOWN`
- **The manifest labels every row `initial`.** This is metadata, not confirmation that the unseen documents contain no amendment, correction, supersession, or version-lineage evidence. Amendment semantics come from [Architecture invariants](../requirements/architecture-invariants.md) (INV-4, INV-10) and [`report-amended.json`](../fixtures/report-amended.json). `CONFIRMED_REQUIREMENT`
- **Multi-specimen behavior is not evidenced.** Repeated-specimen ordering and pagination remain `UNKNOWN`.
- **A single house format must be designed.** Do not merge manifest-described vendor or layout differences into a house-style rule. `CONFIRMED_REQUIREMENT` (R-fmt)

## S005 `Revised` metadata

The S005 manifest row mentions a `Revised` status. Without `WM17S.pdf`, neither the label nor the absence of version-lineage or supersession text can be verified. Do not use this metadata to infer amendment presentation. `UNKNOWN`

## Table-rendering metadata

The manifest describes ASCII or box-drawing tables in S003–S005. This remains unverified metadata until the binaries are supplied and must not be promoted to a rendering rule. `UNKNOWN`
