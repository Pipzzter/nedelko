# Architecture decision records

These records use the reference calorie-tracking app’s structure: context, drivers, alternatives, decision and consequences. They document this project’s Node/Preact architecture rather than copying its Java stack or optional Sonar policy.

Records 0001–0003 capture existing decisions retrospectively on 2026-09-21; their dates do not claim when the implementation was first written. Records 0004–0005 describe the new engineering workflow. Accepted design does not imply completed integration verification; see [verification status](../../development/verification-status.md).

Record 0006 separately documents the existing SQLite database choice, also retrospectively. Records 0007–0008 describe the later conservative forecast/refresh boundaries and tighter local analysis setup.

| ADR | Decision | Status |
| --- | --- | --- |
| [0001](0001-native-node-and-preact.md) | Native Node and local Preact without a build step | Accepted |
| [0002](0002-deterministic-evidence-boundaries.md) | Deterministic evidence and scheduling; untrusted AI | Accepted |
| [0003](0003-account-ownership-and-parent-links.md) | SQLite ownership, opaque sessions and parent links | Accepted |
| [0004](0004-containerized-local-stack.md) | Local Docker app and SonarQube with separate persistence | Accepted |
| [0005](0005-local-quality-gates.md) | Complete coverage reports and required pre-push gates | Accepted |
| [0006](0006-sqlite-application-database.md) | SQLite through built-in node:sqlite for application persistence | Accepted |
| [0007](0007-conservative-forecast-and-refresh-boundaries.md) | Complete future air forecasts and revision-stable, approval-invalidating reads | Accepted |
| [0008](0008-critical-coverage-and-analysis-secrets.md) | Critical-file coverage floors and required private Sonar database password | Accepted |
| [0009](0009-nedelko-product-identity.md) | Sole Nedelko identity with preserved account data and analysis history | Accepted |
| [0010](0010-teacher-authored-timetables.md) | Per-day teacher-authored timelines with automatic overlap resolution | Accepted |
| [0011](0011-audit-corrections.md) | Mode-specific instructions, conservative refresh display and complete quality policy | Accepted |
| [0014](0014-openai-fast-mode.md) | Configurable Sol Fast mode and actual provider-tier diagnostics | Accepted |
| [0015](0015-continuous-ai-timetables.md) | Continuous AI schedules with explicit breaks and preserved elapsed history | Accepted |

Use the [template](template.md). Number records sequentially. Preserve accepted records; supersede a decision with a new linked record when its premise changes.
