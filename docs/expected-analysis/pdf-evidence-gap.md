# PDF evidence gap and cross-sample work stub

Status: blocked pending the five binary sample files. `UNKNOWN`

## Repository audit

- No file with a case-insensitive `.pdf` extension exists in the current repository worktree. `OBSERVED` on 2026-09-04.
- [`manifest.csv`](../samples/manifest.csv) names five samples, but their binary files are absent. `OBSERVED`
- Manifest page counts, sections, and notable features are supplied metadata; without the binaries they cannot be independently promoted to PDF observations. `UNKNOWN`
- Therefore coordinate, typography, extraction, pagination, section/field, and cross-sample layout analysis cannot currently be verified. `UNKNOWN`

This blocks the PDF-evidence portion of the Phase 0 exit gate. `UNKNOWN`

Fixture-driven work against INV-1 through INV-10 can proceed as a reversible implementation slice because those requirements and fixtures are present. `ASSUMPTION`

## Expected intake

Place the exact files below under `docs/samples/pdfs/`, or update the manifest filenames in the same change. `ASSUMPTION`

| ID | Expected filename | Binary present | Profile | Field map | Cross-sample row |
| --- | --- | --- | --- | --- | --- | --- |
| S001 | `urineroutinechemistrymicroscopy12mlsamplepdfformat.pdf` | no `OBSERVED` | pending `UNKNOWN` | pending `UNKNOWN` | pending `UNKNOWN` |
| S002 | `Anemia_package_Sample_Report.pdf` | no `OBSERVED` | pending `UNKNOWN` | pending `UNKNOWN` | pending `UNKNOWN` |
| S003 | `Diabetic_package_Sample_Report.pdf` | no `OBSERVED` | pending `UNKNOWN` | pending `UNKNOWN` | pending `UNKNOWN` |
| S004 | `S192.pdf` | no `OBSERVED` | pending `UNKNOWN` | pending `UNKNOWN` | pending `UNKNOWN` |
| S005 | `WM17S.pdf` | no `OBSERVED` | pending `UNKNOWN` | pending `UNKNOWN` | pending `UNKNOWN` |

## Work to run once supplied

1. Verify PDF signatures, record SHA-256 checksums, and confirm de-identification before extraction. `ASSUMPTION`
2. Record per-sample page geometry, fonts, text blocks/order, tables, headers/footers, pagination, signatures/marks, and extraction limitations as `OBSERVED`.
3. Map visible fields and sections with cardinality; keep ambiguous mappings `UNKNOWN`.
4. Build a five-row matrix of shared patterns and anomalies. Promote only multi-sample support to `INFERRED`; the samples remain illustrative under R-fmt.
5. Route newly discovered production questions to the open-question log; do not derive amendment behavior from S005's `Revised` label. `CONFIRMED_REQUIREMENT`

No substitute PDF analysis was fabricated from the manifest or the older non-canonical `docs/context/expected-analysis/` notes. `OBSERVED`

Related: [sample notes](../samples/manifest-notes.md), [project evidence boundary](../README.md), [open questions](../requirements/open-questions.md).
