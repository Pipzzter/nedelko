# Architecture decision records

These records use the reference calorie-tracking app’s structure: context, drivers, alternatives, decision and consequences. They document this project’s Node/Preact architecture rather than copying its Java stack or optional Sonar policy.

Records 0001–0003 capture existing decisions retrospectively on 2026-09-21; their dates do not claim when the implementation was first written. Records 0004–0005 describe the new engineering workflow. Accepted design does not imply completed integration verification; see [verification status](../../development/verification-status.md).

Record 0006 separately documents the existing SQLite database choice, also retrospectively.

| ADR | Decision | Status |
| --- | --- | --- |
| [0001](0001-native-node-and-preact.md) | Native Node and local Preact without a build step | Accepted |
| [0002](0002-deterministic-evidence-boundaries.md) | Deterministic evidence and scheduling; untrusted AI | Accepted |
| [0003](0003-account-ownership-and-parent-links.md) | SQLite ownership, opaque sessions and parent links | Accepted |
| [0004](0004-containerized-local-stack.md) | Local Docker app and SonarQube with separate persistence | Accepted |
| [0005](0005-local-quality-gates.md) | Complete coverage reports and required pre-push gates | Accepted |
| [0006](0006-sqlite-application-database.md) | SQLite through built-in node:sqlite for application persistence | Accepted |

Use the [template](template.md). Number records sequentially. Preserve accepted records; supersede a decision with a new linked record when its premise changes.
