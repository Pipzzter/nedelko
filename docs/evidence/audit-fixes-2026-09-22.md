# Audit fixes, 22 September 2026

This follow-up records the verified source snapshot after the audit of `7f1c8ba4af83279012f212cb5c2259f149761574`. The audit and earlier release records remain historical. At the time of the checks below, the fixes had not yet been committed or pushed.

The web app is ready and tested on phone and desktop. The existing real-model examples and backup recording remain linked in the [evidence index](README.md). This engineering run adds deterministic HTTP, DOM, provider-boundary and tooling verification; it does not claim a new physical-device run, a new recording or a new teacher study.

## Corrected behavior

| Audit area | Resolution | Regression evidence |
| --- | --- | --- |
| Contradictory parent instructions | Eco instructions follow the server-selected mode. New per-row bilingual variants retain distinct activities; generic notes cannot override them. Teacher details, indoor backups and parent notices agree. | `backend/tests/week.test.js`, `backend/tests/authored-timetable.test.js`, `frontend/tests/components.test.js` |
| Timetable collisions and oversized fallback play | Default routines are normalized before searching for free slots. Fallback compaction respects 90 minutes; explicit long teacher requests retain their duration. | `backend/tests/week.test.js`, `backend/tests/authored-timetable.test.js` |
| Lost occasion context | Timing/reordering retains server-owned discussion and lessons. Authored lessons receive occasion markers when their accepted content covers the event. | `backend/tests/manual-day-edit.test.js`, `backend/tests/authored-timetable.test.js` |
| Stale air display and malformed upstream data | Measurement timestamps control expiry, failed refreshes show unknown, any future observation fails QC, malformed provider arrays and forecast timestamps cannot become clean air. | `frontend/tests/app.test.js`, `frontend/tests/components.test.js`, `backend/tests/conditions.test.js`, `backend/tests/domain.test.js` |
| Inbox race and login mismatch | Late reads cannot undo a read action or populate another inbox; existing usernames can use the login field, while registration still requires email. | `frontend/tests/components.test.js`, `backend/tests/api.test.js` |
| Interface resilience | Provisional calendar wording, accessible welcome dialog, response shape checks and bilingual rendering recovery. | `frontend/tests/components.test.js`, `frontend/tests/view-data.test.js` |
| Provider and refresh boundaries | HTTP disconnects abort model work and reject late results before storage. Refresh failures report fixed codes and counters. Model timeline text receives learning-content validation. | `backend/tests/provider-boundaries.test.js`, `backend/tests/api.test.js`, `backend/tests/features.test.js` |
| Verification drift | Postman checks duration preservation and collision shifts; date-sensitive account/DOM tests pin clocks. Critical coverage inventory and all inherited Sonar conditions are enforced. | `api-tests/postman/nedelko.postman_collection.json`, `scripts/tests/quality.test.js`, `static-analysis/tests/sonar.test.js` |
| Dead code and documentation | Removed unused AI services, duplicate legacy validators and test-only UI. Corrected active timetable, editing, asset and operation documentation; dated records retain their original scope. | [Decision basis](../architecture/decision-basis.md), [ADR-0011](../architecture/adrs/0011-audit-corrections.md) |

## Execution record

All checks below passed on the corrected local source. The [command transcript](audit-fixes-checks-2026-09-22.txt) preserves the output; the [machine-readable record](audit-fixes-2026-09-22.json) includes coverage, Sonar results and SHA-256 hashes for 140 source/configuration files. Local absolute paths and disposable identifiers are redacted in the transcript.

| Command or check | Observed result |
| --- | --- |
| `npm.cmd run gate` | Exit 0; 122 JavaScript files checked; 213 tests passed, 0 failed; documentation links passed. |
| Backend line coverage | 98.48% (4,660/4,732). |
| Frontend line coverage | 95.57% (3,860/4,039). All authored modules and all nine critical-file floors passed. |
| Live SonarQube analysis | Quality gate `PASSED`; subsequent API status `OK`, 0 open issues; overall line coverage 97.1%, new coverage 96.6%. Inherited gate conditions remain enforced. |
| `npm.cmd run test:api` | Exit 0; isolated application: 63 requests, 319 assertions, 0 failures. |
| `npm.cmd --prefix api-tests run test:local` | Exit 0; running application: 63 requests, 319 assertions, 0 failures. |

The native loopback application at `http://127.0.0.1:4173` was restarted with the fixes before the running-app Postman check. A final disposable demo probe confirmed the current 60-minute freshness contract; its plan was deleted afterward. The Postman runner uses a disposable account and synthetic demo plans.

Test providers and environmental inputs are synthetic. Live Sonar analysis is separate from live model/environmental testing. The pre-push hook is installed for this checkout. These checks ran before committing; the file hashes identify that verified source independently of later commits.

## Remaining submission facts

Independent GitHub-account access, a fresh-machine installation and every teammate's understanding are not established by these code changes. A three-day hackathon does not provide month-long retention evidence; the existing teacher feedback remains an attributed account of its actual scope. The recorded video keeps its original source version and is not relabelled as a recording of these local fixes. Loopback hosting, bearer-link access and PM2.5-only screening remain documented product boundaries.
