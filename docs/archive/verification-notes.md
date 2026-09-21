# Verification and attempts to break it

> Historical record. The earlier test counts, failed provider attempts and weather-only future-draft behavior below describe their original sessions. Later Windows checks and successful live-AI generation are recorded in [current verification status](../development/verification-status.md) and [provider evidence](../evidence/README.md). The [current decision basis](../architecture/decision-basis.md) now requires complete future air forecasts. These later results do not rewrite the earlier attempts.

Run `npm.cmd ci`, `npm.cmd test`, and `npm.cmd run check`. Tests use Node’s test runner, isolated SQLite stores, controlled environmental/model responses and a development-only DOM implementation. They do not contact OpenAI or create accounts in the running app.

| Attempt | Behaviour checked | Evidence |
|---|---|---|
| 999/2000 readings, malformed timestamps, negative values, stuck sensor, sudden jump | Positive recommendation blocked; suspicious evidence is not silently deleted | `backend/tests/domain.test.js` |
| Strongly disagreeing neighbours, too little history, only one valid sensor, all offline | Current assessment stays unknown | `backend/tests/domain.test.js` |
| Attractive forecast with polluted local readings | Today becomes indoors | `backend/tests/week.test.js` |
| Polluted Monday with two outdoor days requested | Monday moves indoors; allowance moves to another eligible day; meals/rest remain identical | `backend/tests/week.test.js`, `frontend/tests/app.test.js` |
| Missing air forecast, missing weather, rain, wind, freezing precipitation, storm | Explicit weather-only future draft or indoor fallback; no invented observations | `backend/tests/week.test.js` |
| Midweek generation and elapsed activities | Earlier dates stay empty; completed planned slots do not consume an extra future slot | `backend/tests/week.test.js` |
| Snow in the forecast | Snow lesson with indoor alternative; ground cover is not asserted | `backend/tests/week.test.js` |
| Overlapping blocks or no eco slot | Validation error without corrupting a saved week | `backend/tests/week.test.js`, `backend/tests/api.test.js` |
| Delete an eco slot or close a day | Daily notice and allocation update | `backend/tests/week.test.js` |
| Uniform week versus one rainy outlier | Common clothing advice once; exceptional day called out; both languages contain no em dashes | `backend/tests/week.test.js` |
| Client sends a fabricated AQI, notice or another user’s ID | Server-owned facts and account scope prevail | `backend/tests/api.test.js` |
| Failed recheck after approval | Old approval invalidated before the failed request | `backend/tests/api.test.js` |
| Two browser revisions save the same week | Stale write rejected with 409 | `backend/tests/api.test.js` |
| Weak password, username under eight characters, repeated sign-in attempts | Validation and rate limiting; longer names and punctuation are accepted, and legacy short accounts can still sign in | `backend/tests/api.test.js` |
| Inspect password/session storage and sign out | Salted scrypt, hashed opaque token, cookie flags, revoked session | `backend/tests/api.test.js` |
| Close and reopen the SQLite file | Account, hashed session and private plan persist; expired sessions remain rejected | `backend/tests/storage.test.js` |
| Cross-origin POST, oversized body, wrong media type, static path traversal | Rejected without exposing `.env`, database or backend | `backend/tests/api.test.js` |
| Model refusal/incomplete response, unlisted material, instruction/air-safety text | Validated fallback; no authority over air decisions | `backend/tests/ai.test.js`, `backend/tests/week.test.js` |
| Bilingual model generation with private group name in settings | Strict bilingual schema; group/account identity excluded; invalid materials fall back visibly | `backend/tests/curriculum.test.js` |
| Model ranks a blocked, duplicated or fabricated outdoor date | Invalid order falls back; valid order applies only to server-eligible dates and pollution still moves today indoors | `backend/tests/curriculum.test.js`, `backend/tests/week.test.js` |
| Actual component flow with the HTTP server | Empty home, generation, toggle Friday, fixed times, add only in a real gap, edit/save/cancel text, bilingual activity selection, lesson-only holiday styling, copy messages, demo and pollution changes | `frontend/tests/app.test.js` |
| Repeated adjacent play labels in old and new plans | Coalesced without moving fixed routines, closing gaps or merging different translations | `backend/tests/week.test.js` |
| Changed holiday HTML, impossible dates, mismatched weekdays/scopes, off-site URLs, oversized responses | Reject the update; retain dated verified evidence | `backend/tests/holidays.test.js` |
| Holiday source offline after a successful refresh or process restart | Persisted events retained without renewing the successful fetch timestamp | `backend/tests/holidays.test.js` |
| Movable Easter, Saturday Halloween, cross-year weeks and missing annual programme | Correct lesson-day context, optional-event labels, no invented closures or recycled religious dates | `backend/tests/holidays.test.js` |
| Holiday endpoint without a session or with a fabricated demo/source URL | Authentication and source allowlist remain authoritative | `backend/tests/api.test.js` |
| Four example weeks × six air scenarios, then recheck and regenerate | Fixed dates retained, closures excluded, future decisions provisional, no account-week writes | `backend/tests/api.test.js` |
| Switch between Independence Day, Easter, Halloween and snow using rendered controls | Correct lessons, closures, weather symbols and language; leaving Demo restores the saved real plan | `frontend/tests/app.test.js` |
| Explicit substitute-date pair or missing paragraph year | Validate Sunday/Monday sequence or infer from the same dated article listing; reject unrelated dates, missing/remote/future publication evidence | `backend/tests/holidays.test.js` |

## Live checks, 2026-09-20

Additional automated coverage for the readable editor and generation changes:

- Times are read-only in the editor. Domain/API tests reject overlapping or changed existing times; adding a row requires a real gap. The DOM flow covers collapse/reopen, active text saves and cancel, plus bilingual activity descriptions.
- Delete week, cancel deletion, delete-and-regenerate, stale writes after regeneration, authentication, cross-origin requests, account isolation and demo-profile retention are exercised through HTTP/DOM tests.
- Distinct city rain/wind/hot/cold/snow fixtures update future learning choices and outdoor allocation, preserve fixed routines and manual edits, and always retain indoor backups. Identical forecasts do not trigger arbitrary changes.
- A missing temperature is not interpreted as cold weather. An unsuitable default time selects another eligible free slot during generation without overlapping meals or rest.
- Yom Kippur receives a bilingual discussion inside an existing slot without automatic closure or replacement of the eco lesson. Friday preparation retains the Bosniak holiday's Monday date. Elapsed discussions are not duplicated, teacher text is preserved, and only related rows are marked. Halloween and All Saints' Day can share a Friday with separate lesson context. The curated preview still applies, saves and reappears on Home.
- The model boundary validates whole-day session titles and an exact five-date outdoor ranking. Forecast input excludes raw PM2.5/AQI, sensor data and the group name. A model-ranked day still moves indoors when the deterministic current-air gate fails. Mocked credit, quota, spending-limit, rate-limit, authentication, access and model failures stay distinct and use library fallback. Unknown provider fields and raw private error messages are excluded from diagnostics. An HTTP/DOM fixture verifies that the saved error details reach the editor collapsed by default. These are mocked responses, not a successful live AI claim.

- Skopje centre, Bitola and Ohrid each returned 168 weather hours. Their current assessments accepted 4, 4 and 3 nearby sensors respectively in the checked snapshot.
- The CAMS responses contained 73 usable hourly PM2.5 entries, despite requesting seven days. Missing later air hours are preserved as unknown.
- A small Responses API check returned **429 `credit_balance_exhausted`**. A subsequent direct request using credentials read from `.env`, bypassing app code, returned the same code and type `insufficient_quota`. The server's environment was checked to load the file's key and model without an inherited override. Live AI generation is not verified; the plan editor identifies the fallback as library examples.
- The running local server returned version 1.0.0. No connected browser was available in the automation environment. DOM flows and responsive CSS were checked in code, but no desktop/mobile screenshot or visual browser verification is claimed.
- The holiday importer successfully fetched official HTML on 2026-09-20. After adding explicit support for observed-day pairs and dated-listing year inference, all seven discovered/seeded announcements imported without a partial result: Catholic Easter Monday (6 April), Orthodox Good Friday (10 April), Orthodox Easter Monday (13 April), Republic Day observed (3 August), Dormition (28 August), Independence Day (8 September) and Yom Kippur (21 September). The remaining events retain the verified annual snapshot. This is not a claim that every historical announcement is crawled.

No real teacher/parent trial, accessibility audit, penetration test, production deployment, actual message delivery or measured environmental impact has been performed. Do not present synthetic demo users or automated test accounts as real adoption.

## Demo parity follow-up, 2026-09-20

`npm.cmd test` passes 122 tests; `npm.cmd run check` checks 71 JavaScript files. The removed classroom simulation's tests have been replaced by coverage of the current shared workflows. HTTP tests verify matching demo/account parent response shapes, read-only parent endpoints, retired classroom routes, opt-in sharing, revocation and isolation from saved account plans. DOM flows verify identical teacher navigation, the sample-week entry, bilingual parent pages, revoked-link recovery and switching between isolated demo URLs. These are automated fixtures, not real family use or a live AI result.

## Planning navigation follow-up, 2026-09-20

The full 122-test suite and syntax checks for 71 JavaScript files pass after the navigation change. The account DOM flow covers both empty-week entry points, the shared active navigation item, regeneration failure and cancellation without losing the saved week, old create/edit bookmarks, pending-edit protection, deletion and subsequent creation. The demo DOM flow covers successful regeneration, fixed-date retention and the same shared parent page. Both languages are exercised. Visual browser verification could not run because the UI tool reported no connected browsers; no screenshot or actual phone check is claimed for these follow-ups.
