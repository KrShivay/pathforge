# Task Tracking

[`tasks.json`](tasks.json) is the sole progress ledger. It is intentionally a
small, dependency-aware JSON file so humans, scripts, and the local dashboard
can read the same state without a project-management service.

## Fields

| Field | Allowed value / meaning |
| --- | --- |
| `id` | Stable unique ID such as `DOC-001`; never reuse it. |
| `title` | One independently verifiable outcome. |
| `status` | `todo`, `in_progress`, `blocked`, or `done`. |
| `priority` | `P0` prerequisite/critical, `P1` planned, or `P2` later. |
| `area` | Phase/group used by the dashboard. |
| `dependsOn` | IDs that must be `done` first. |
| `acceptanceCriteria` | Observable checks required for `done`. |
| `notes` | Short evidence, blocker, or open-question reference. |

Rules: valid JSON only; dependencies must reference existing IDs; a task cannot
depend on itself; `done` means all acceptance criteria were verified. Update the
task in the same change as the work it tracks.
