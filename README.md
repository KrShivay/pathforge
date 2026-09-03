# PathForge

PathForge is a versioned pathology reporting system with immutable clinical
records, catalog-aware amendments, and deterministic document generation.

## Documentation

Start with the [project brief](docs/README.md). It defines the evidence
boundary, provenance labels, and expected work order.

| Area | Purpose |
| --- | --- |
| [Requirements](docs/requirements/) | The non-negotiable invariants, detailed business reference, and unresolved decisions. |
| [Reference](docs/reference/) | Project-specific terminology and meaning. |
| [Fixtures](docs/fixtures/) | Small, worked semantic examples for catalog and amendment behavior. |
| [Samples](docs/samples/) | Metadata for the illustrative rendered-report sample set. |

The active source of truth is the structured material under `docs/`. The
original import bundle and flattened source files are retained under
[`docs/archive/`](docs/archive/) for provenance only.
