# PDF evidence status

Status: local reference samples received; safe sample set incomplete. `OBSERVED`

## Intake check

Five PDFs are available locally under `docs/samples/pdfs/` and match the current
[`manifest.csv`](../samples/manifest.csv) filenames. They are intentionally
ignored by Git. `OBSERVED` on 2026-09-04.

| ID | Pages | Size | Basic intake result |
| --- | ---: | --- | --- |
| S001 | 3 | A4 | Contains visible name, phone, birth date, and address; replace before committing. `OBSERVED` |
| S002 | 2 | A4 | Readable sample using dummy identity. `OBSERVED` |
| S003 | 3 | A4 | Readable sample using dummy identity. `OBSERVED` |
| S004 | 2 | 595 x 876 pt | Readable sample using dummy identity. `OBSERVED` |
| S005 | 7 | A4 | Encrypted with print/copy restrictions; readable text uses dummy identity. `OBSERVED` |

## Current use

The files are directional references only. They can inform a short visual review
of hierarchy, tables, and pagination, but they do not define PathForge's house
format. The working prototype must not wait for exhaustive PDF profiling.
`CONFIRMED_REQUIREMENT` (R-fmt; `SCOPE.md`)

Remaining evidence gap: obtain a de-identified replacement for S001 before any
sample PDFs are committed or shared. `UNKNOWN`

Do not derive amendment behavior from S005's `Revised` label; use the amendment
specification and fixtures. `CONFIRMED_REQUIREMENT`

Related: [sample notes](../samples/manifest-notes.md), [project scope](../../SCOPE.md).
