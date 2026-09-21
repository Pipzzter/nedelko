# Planner fixes, September 2026

> Historical branch and smoke-test record. The 20 September check below is separate from the later repeatable authenticated generation in [live-AI evidence](../evidence/README.md). See [current verification status](../development/verification-status.md) for the subsequent full Windows tests, coverage, Sonar gate and browser observations. Earlier counts and limitations are retained as recorded.

Six local branches form a stack based on `feat/simplify-planning-navigation` at `a8b0704`. Review and merge in this order; each branch includes its predecessors. No publishing is part of this work.

| Order | Branch | Scope |
| --- | --- | --- |
| 1 | `fix/prompt-topic-coverage` | Preserve and validate explicit daily topic requests |
| 2 | `fix/whole-day-activity-planning` | Send complete timetable slots to AI and avoid repeated activities |
| 3 | `fix/stable-readonly-parent-links` | Reliable creation, stable URLs and parent access boundaries |
| 4 | `feat/single-page-kindergarten` | One Home workspace, kindergarten setup and copy cleanup |
| 5 | `feat/targeted-ai-schedule-editing` | Selected activity and day schedule proposals, protected routines |
| 6 | `fix/live-indoor-day-alerts` | Indoor changes and eligible replacement-day alerts |

The existing untracked `findings.md` belongs to the working tree and is excluded from this stack.

Each branch adds one focused implementation commit. The sixth branch contains the complete implementation and the final documentation updates. The first five commits are `3b55bfa`, `dc33ca2`, `dc49746`, `a4af9ee`, and `d033b06`; resolve the sixth by its branch tip.

Review each branch against the preceding row, and the first against `a8b0704`. The stack includes the existing navigation/demo work below that base; it does not merge or publish anything automatically.

Validation on the complete stack: `npm.cmd test` passed all 137 deterministic domain, API, security and rendered-DOM tests; `npm.cmd run check` passed for 80 JavaScript files. The tests include topic coverage, slot uniqueness, link stability/read-only access, selected-activity isolation, schedule times and locked rows, stale/cross-account proposals, and indoor replacement alerts. Visual browser verification was unavailable because the connected computer-use inventory returned no browsers.

A live generation smoke check on 2026-09-20 used the configured AI provider with the requested five topics and a synthetic September 21–25 timetable. It completed in 64 seconds, passed the topic and slot validators, and supplied 30 supporting sessions. Its main titles covered good habits, healthy food, recycling, exercise and saving electricity while retaining the supplied holiday context. This single synthetic check is not a production reliability claim; no account plan was created or overwritten.

Runtime limits: automatic evidence checks run once a minute while the server is awake, so changes apply when detected, not continuously between checks. Parent links remain loopback-only. AI remains dependent on the configured provider; failed or rejected suggestions preserve saved plans.
