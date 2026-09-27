# Hackathon audit follow-up, 23 September 2026

The supplied audit reviewed `f3c0dd6`. This follow-up inspected `120950c7dce96c29332f6443afa6296c9e31e91b` on Windows with Node 24.15.0 and npm 11.12.1. The initial working tree was clean. Changes below are uncommitted tests and documentation; application behavior is unchanged. This is a fresh engineering check, not an outside-team setup or judging score.

## Findings against the current checkout

| Audit item | Current evidence and disposition |
| --- | --- |
| Missing backup recording | Already resolved: both [demo.mp4](../../demo.mp4) and the [earlier WebM](demo-2026-09-21/demo.webm) are tracked and linked from the README. No new recording or playback review was performed here. |
| Audience only implied | Already resolved: the README names the kindergarten teacher and parent roles in its opening and “Who it is for” section. |
| Scattered limitations | Already resolved: the README has a consolidated “Not finished, and known issues” section, including newer review findings. Those findings remain open. |
| Five-minute refresh claim | Already resolved: [product research](../product/research.md) says every minute, matching the server worker. |
| Missing `Secure` session cookie | Still a limitation for future hosting. The current deployment is loopback HTTP; this follow-up does not introduce HTTPS deployment or change cookie behavior. |
| `noticeTone()` denylist | The named legacy helper is absent from current application source. This does not establish that the remaining model-content validation is exhaustive. |
| Untested holiday/change components | Added direct bilingual behavior tests in [components.test.js](../../frontend/tests/components.test.js). Both modules now have 100% measured line coverage. |
| Browser/server validation drift | Existing tests compare all canonical weather bounds. Added comparisons for operating-window boundaries, malformed times, positive routine intervals and integer outdoor-day counts in [plan-form.test.js](../../frontend/tests/plan-form.test.js). Routine preferences intentionally allow overlap; generated timetables receive separate server checks. These comparisons do not claim parity for every server-side text or schema constraint. |
| Uncertain messages/timeline coverage | The fresh run measures `backend/domain/messages.js` at 98.84% lines (170/172) and `backend/domain/timeline.js` at 100% (51/51). Both are imported by existing tests. |

The new component assertions distinguish public holidays, community holidays and optional classroom themes; preserve preparation dates; check escaped titles and empty states; and require replacement-day notices to remain provisional with a same-morning check. They exercise both selectable teacher controls and read-only notices.

## Fresh execution results

The [machine-readable record](hackathon-audit-2026-09-23.json) contains the base commit, SHA-256 hashes of the changed test files and test guide, coverage inventory, timestamps and a read-only Sonar API snapshot. [Selected command output](hackathon-audit-2026-09-23-checks.txt) preserves the failure and final results. Full local transcripts remain in ignored `.local/`.

| Check | Observed result |
| --- | --- |
| `npm.cmd run hooks:install` | Passed; the repository-local hook path is `.githooks`. No commit or push occurred. |
| `npm.cmd run verify` after the test correction | Exit 0; 249 tests passed, 0 failed or skipped; syntax and documentation links passed. |
| Backend line coverage | 98.54% (4,848/4,920). |
| Frontend line coverage | 95.66% (3,879/4,055). Every authored application module and all nine critical-file floors passed. |
| `npm.cmd run gate` after the test correction | Exit 0; 249 tests passed and Sonar reported `QUALITY GATE STATUS: PASSED` at 05:12:22 UTC. |
| Sonar read-only API check | Gate `OK`, 0 open issues, 0 bugs, vulnerabilities, code smells or security hotspots. This is a scanner result, not a claim that all known product defects are fixed. |
| `npm.cmd run test:api` | Exit 0; 63 requests and 319 assertions passed against an isolated app using real loopback TCP, in-memory SQLite and synthetic demos. |

The HTTP-fixture permission tests deliberately inject `EPERM` and `EACCES`, so their fallback diagnostics appear in otherwise successful output. They are not evidence that this host blocked normal listeners. The Postman run required and used an actual listener. The [test guide](../development/quality-gates.md) now distinguishes the shared fixture's in-memory fallback from TCP verification and Postman's listener requirement.

## Failed attempt and correction

An initial `verify` run passed all 249 tests. The first separate `gate` attempt then passed 248 and failed the existing demo DOM test; it stopped before Sonar. That test waited only for `.note-proposal`, which renders before the follow-up inbox request returns the library-source explanation. It sometimes inspected the intermediate “Preparing a suggestion” state.

[demo.test.js](../../frontend/tests/demo.test.js) now waits for the enabled Apply button, the observable completed review state, before checking the provenance label and applying the proposal. No sleeps, retries or weakened provenance assertions were added. Five separate focused runs passed, followed by the successful full `verify` and `gate` runs above.

## Limits

No new paid model call, live environmental-provider check, browser recording, physical-phone run, outside-team setup or repository-access check was performed. Existing recordings and past results retain their original dates and source versions. The newer environmental-cache, sensor-identity, parent-note, editing and validation findings in the README remain open; passing this suite does not resolve them. Application decision rules and deployment scope are unchanged.
