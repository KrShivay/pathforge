# Notes on the sample set

## These are illustrative, not authoritative
All five PDFs are vendor **sample/demo** reports (Pathofast, CoreLab Software, Dr Lal PathLabs) on dummy patients, each carrying its own "sample report" / "not valid for medical legal purpose" disclaimer. They are useful for **structure and rendering evidence** (`OBSERVED`), not as normative specifications of *this* platform's behavior. `authoritative` is `illustrative` for every row.

## Coverage gaps (be explicit about these)
- **All are initial reports.** None demonstrates amendment, correction, supersession, or version lineage. See the evidence boundary in `README.md`. Amendment semantics live in `INVARIANTS.md` (INV-4, INV-10) and `fixtures/report-amended.json`.
- **No multi-specimen sample.** Every report is single-subject/single-accession. Repeated-specimen ordering and pagination (a stated concern) is **not** evidenced here — tag any conclusion about it `UNKNOWN`.
- **Two vendor formats mixed.** Different providers = different templates. Do not merge their layout quirks into one "house style."

## The "Revised" trap in S005 (WM17S.pdf)
S005's header shows `Report Status : Revised`. This is **not** the missing amendment sample. The document contains a status string but **no version-lineage markup, no supersession reference, and no "this supersedes previously issued reports" indicator tied to a prior version** that you can profile. Treat "Revised" here as `OBSERVED` (a status label exists) but treat "how amendments are presented" as `UNKNOWN` from the PDFs. Do not reverse-engineer amendment presentation from this single status word.

## On the ASCII/box-drawing tables (S004, and treatment-goal tables in S003/S005)
Some interpretation and reference tables are drawn with monospaced box-drawing characters. That is almost certainly a **renderer/legacy artifact**, not a business requirement. Per README constraint 8, keep it `OBSERVED` and do not promote it to a layout rule.
