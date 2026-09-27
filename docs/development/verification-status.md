# Verification status

This file records actual execution limits, separately from configured targets. Historical reports are preserved in [the archive](../archive/verification-notes.md).

## 2026-09-23 hackathon audit follow-up

On base commit `120950c7dce96c29332f6443afa6296c9e31e91b`, with uncommitted test and documentation changes, both `npm.cmd run verify` and the final `npm.cmd run gate` passed on Windows with Node 24.15.0: 249 tests, 98.54% backend and 95.66% frontend line coverage, every application module and all nine critical-file floors. Sonar reported `PASSED`; a subsequent read-only API check returned `OK` and 0 open issues. The isolated Postman suite passed 63 real-loopback requests and 319 assertions.

The first gate attempt stopped before Sonar because an existing demo test inspected an intermediate render. Its wait now follows the enabled Apply button; five focused runs and both complete checks then passed. The [follow-up record](../evidence/hackathon-audit-2026-09-23.md) preserves this failure, the correction, source hashes and command excerpts. Application source is unchanged; newer known product defects remain open. This run does not add live-model, environmental-provider, physical-phone or outside-team evidence.

## 2026-09-22 audit corrections

The web app is ready and tested on phone and desktop. The [audit-fix record](../evidence/audit-fixes-2026-09-22.md) describes the current local corrections and their verification. All entries below describe their stated source versions; statements such as “the only later change” apply to those historical checkpoints, not the current checkout.

The corrected source passed 213 tests, with 98.48% backend and 95.57% frontend line coverage, all critical-file floors and the live SonarQube quality gate (0 open issues). Both isolated and running-app Postman checks passed 63 requests and 319 assertions each. The record links the command output and exact source hashes.

Retired branding identifiers have been omitted from historical entries and redacted in the linked command transcript. Their timestamps, results and limitations remain historical; renaming the product does not rerun those checks. Original identifiers remain in Git history.

## 2026-09-21 final main checks and fresh AI replay

At main commit `e44f64c36662a52b48ec22a77d741768f05a1b4f`, `npm ci`, `npm run check`, `npm test`, `npm run test:coverage` and `npm run gate` all passed on Windows. The [full output](../evidence/final-verification-2026-09-21.txt) records 122 JavaScript files, 30 documentation files, 202 passing tests and no test failures. Backend line coverage was 97.99% (5,078/5,182), frontend 94.88% (4,056/4,275), and all nine critical-file floors passed. The live Sonar quality gate returned `PASSED` at 20:44:07 UTC. The scanner also reported one LCOV inconsistency warning; a passing gate does not mean zero findings.

A fresh authenticated `npm run verify:ai` run completed at 20:35:46 UTC against `a07fdd83ec018b5dea7d4aef6e57d8048b73cdaf` in an isolated worktree. It returned five accepted bilingual days from `gpt-5.6-terra`, source `ai`, in 129,875 ms. [The artifact](../evidence/live-ai-2026-09-21.json) contains validated lessons and sessions, with explicitly synthetic environmental inputs and bundled holidays. Account details, cookies and provider request identifiers are excluded; the script checked its output against the temporary account and configured key. The only later application change is the one-line empty-occasion badge correction in PR36; backend and AI script source are unchanged.

The [backup recording](../evidence/demo-2026-09-21/demo.webm) runs for 1:54.76 and was checked by full playback plus 27 sampled frames. It shows the offline demo, parent sharing, a separate real authenticated AI generation (`source: ai`, 97,952 ms), synthetic pollution moving the lesson indoors, non-modal refresh and 390-pixel parent/authenticated views. Its [record](../evidence/demo-2026-09-21/smoke-summary.json) identifies the fixture method and exact code commit; no real private plans were used. A later cosmetic empty-occasion label fix is documented separately in the release record.

The [final parent rendering check](../evidence/parent-render-2026-09-21/parent-render-summary.json) passed on `e44f64c`: all rendered titles matched their API labels in English and Macedonian, empty or missing occasion lists produced no stray text, and the genuine badge remained visible. The 390-pixel view had no overflow and there were no JavaScript errors. This supplemental check used the offline demo and made no paid calls.

The [release record](../evidence/release-2026-09-21.md) contains the submission checklist and remaining checks. The user's original untracked `findings.md` is preserved; it was not part of these changes. A teammate's authenticated repository access, a second-machine setup and team readiness remain unverified. Optional upstream cancellation on client disconnect remains unimplemented, and the unused `extractSchedule`, `noticeTone` and `suggestWeeklyThemes` service exports remain outside the active application flows.

## 2026-09-21 current Windows verification after application fixes

This entry records the later Windows run at application merge [`a506e04`](https://github.com/AI-Tech-Summit-Filip-Avramchev/gun-mayhem-repo/commit/a506e04). It does not replace the restricted-session attempts below.

Environment: Windows, Node 24.15.0, npm 11.12.1, Docker 29.7.2 and Compose 5.4.0.

Observed checks:

- The required pre-push gate for [PR #34](https://github.com/AI-Tech-Summit-Filip-Avramchev/gun-mayhem-repo/pull/34) passed all 202 tests using the normal project runner. Backend line coverage was 97.99% (5,078/5,182); frontend was 94.88% (4,056/4,275). Every authored application module was represented and all nine critical-file floors passed.
- The live SonarQube quality gate passed at 20:23:34 UTC. This is an observed server result, separate from the configured thresholds and earlier fixture-only checks.
- Browser checks held dashboard requests and advanced existing browser timers to exercise normal and two polluted-scenario polls. The editor retained focus and draft text, the selected scenario remained active, the edit revision stayed at 1, and no waiting modal or inert background appeared. At a 390-pixel viewport there was no horizontal overflow. These are targeted browser observations, not a full accessibility audit.
- [Committed live-AI evidence](../evidence/README.md) records an authenticated `gpt-5.6-terra` weekly generation on 21 September 2026 with accepted `source: ai`. The provider call was real; the environmental inputs and clock were synthetic and the holiday data was the bundled snapshot. The artifact records its exact elapsed time and validated output. No live-environment, deployment or educational-outcome claim follows from it.

Remaining release checks: the final repeat of the live-AI command and release recording are pending at this documentation checkpoint. A teammate's repository access and clean-machine setup have not been verified; an anonymous repository fetch returned 404, which does not establish their authenticated permissions. The owner-reported teacher pilot is documented as an attributed paraphrase in [research](../product/research.md), without measured time savings.

## 2026-09-21 engineering setup

The implementation session uses Node 26.8.1, npm 11.19.0, Docker CLI 29.5.2 and Compose v5.1.4. The supported application minimum remains Node 24.

Observed checks:

- Compose validates with `docker compose --profile analysis config --quiet`; the hook passes `sh -n`; `git diff --check` passes.
- `npm run check` passes: 112 JavaScript files and 24 documentation files checked.
- A run of 16 test files that need neither HTTP listeners nor DOM packages passes all 124 tests. Separate startup tests pass both tests, with 100% native line coverage of `backend/server.js`. The conditions module reaches 98.90% native line coverage in the available subset. These are partial measurements, not whole-project coverage.
- The full `npm run verify` run reaches the suite and fails: 130 tests pass, 35 fail. The failing API fixtures cannot open loopback listeners and the DOM files cannot import the missing `linkedom` dependency. No passing full-coverage summary is produced.
- After adding idempotent Sonar provisioning coverage, all seven tooling tests pass in a focused run. Sonar API calls use fixtures in these tests; this does not replace a live server check.

- Full test/coverage verification is blocked here: API listeners fail with `listen EPERM`, and DOM tooling cannot be installed because registry DNS is unavailable. Offline installation also fails due to missing cached packages.
- Docker execution is blocked by permission denied on the host Docker socket. Image build, health checks, persistence and a live Sonar quality-gate result are not verified in this session.
- A 91% coverage configuration does not establish achieved coverage. A full successful `npm run test:coverage` is still required on a host with test dependencies and loopback access.
- `npm run hooks:install` could not write `.git/config` (`Operation not permitted`). The hook file is executable and versioned, but this clone’s hook path has not been activated; run the installer outside this restricted session.

After local prerequisites are available, run `npm ci`, `npm run hooks:install`, `npm run verify`, then follow [Sonar setup](quality-gates.md) and run `npm run gate`. Start the [Docker stack](../operations/docker.md) and verify health and data across a restart. Update this record with observed results; do not replace failures with an assumed pass.

## 2026-09-21 Nedelko UI and scheduling changes

This entry describes the later implementation from `problems.md`; it does not replace the engineering-setup record above.

- `npm run check` passes for 117 JavaScript files and 26 documentation files. Both the application and `static-analysis/compose.yaml` pass `docker compose ... config --quiet`. `git diff --check` and hook shell syntax checks pass.
- The focused native domain/storage/tooling run passes 80 tests, including direct detail editing, exact duration-preserving reordering, explicit time boundaries, immutable elapsed times, holiday customization persistence, material validation and Sonar policy fixtures.
- The standard `npm run verify` still fails because loopback listeners are denied and the pinned `linkedom` package is unavailable. Registry DNS and an incomplete local archive cache prevent installing the missing dependency. No passing standard coverage summary was created.
- A separate temporary test harness used an already available JSDOM installation and dispatched requests directly to the real HTTP handlers without opening sockets. Under that supplemental harness, all 180 tests passed. V8 measured every authored application JS module: backend 98.54% lines (3033/3078), frontend 98.65% (1239/1256). This checks rendering, application/API behavior and the new boundaries, but does **not** establish actual browser layout, HTTP socket operation, compatibility with the pinned DOM dependency, or a passing standard verification gate. The temporary adapters and coverage files are outside the repository; they are not used by project scripts or the push hook.
- `npm run gate` fails explicitly because `SONAR_TOKEN` is unconfigured. No live Sonar scan or server quality-gate pass is claimed.
- `npm run hooks:install` and unstaging the five reference screenshots are blocked by read-only `.git/config` and `.git/index`. The screenshot files were not edited; ignore rules cover new reference screenshots, but ignore rules do not unstage the existing ones. No commit or push was made.

On a host with the required permissions and dependencies, unstage `img.png` through `img_4.png`, install the hook, run `npm ci` and `npm run verify`, configure `static-analysis/.env`, and run `npm run gate`. The text-based AI schedule assistant requires a configured provider; direct time editing and drag reordering do not. The screenshot alone does not identify the provider failure, and no live AI request was made in this session.

## 2026-09-21 live local SonarQube verification

This later run had Docker, registry and loopback access. The earlier restricted-session results above remain historical records.

- `npm ci` succeeds with the pinned `linkedom` dependency. `npm run hooks:install` succeeds and sets the repository-local `core.hooksPath` to `.githooks`.
- `npm run verify` passes: 117 JavaScript files, 26 documentation files and all 180 tests, with no failures. Standard V8 coverage includes every authored application JS module: backend 98.54% lines (3033/3078), frontend 98.65% (1239/1256).
- `npm --prefix static-analysis start` starts the pinned SonarQube 26.9.0.129388 and PostgreSQL 17.11 images. Both services become healthy; the dashboard returns HTTP 200 and the system API reports `UP`. Sonar is published only on `127.0.0.1:9000`; PostgreSQL has no published host port. The scanner image runs through amd64 emulation on this Apple Silicon host.
- The fresh instance's default admin password was changed and saved in the ignored, mode-0600 `.local/sonar-admin.json`. `npm run sonar:configure` created the private analysis project and assigned its custom gate with the inherited Sonar way conditions plus 91% overall line and new-code coverage thresholds.
- `npm run gate` passes end to end, including tests, coverage, Docker analysis upload and a server-side `QUALITY GATE STATUS: PASSED` verdict. A second `npm run sonar:scan` also passes with a non-admin scanner account's user token. That token is stored in ignored, mode-0600 `static-analysis/.env`; the temporary admin setup token was revoked. A project analysis token was tested and revoked after the gate API rejected it with HTTP 403; the setup instructions now specify a user token.
- Sonar reports 98.6% line coverage, 93.9% combined line/condition coverage and 0.5% duplication. It reports 272 open findings: 270 code smells, one major bug (`javascript:S1534`, duplicate `homeHabit` at `frontend/src/locales/index.js:119`) and one minor vulnerability finding (`javascript:S4036`, PATH lookup at `scripts/install-hooks.js:7`), with zero security hotspots. These findings were not remediated or suppressed during this execution task. A passing gate is not a claim that the project has no findings.
- After stopping and restarting both analysis services, both return healthy. API assertions confirm the same server ID, private project, assigned quality policy, both completed analyses and all 272 findings persist. The saved admin password authenticates and `admin` / `admin` is rejected. The latest gate verdict is `OK`, evaluating 98.6% overall lines and zero new issues against the first analysis; it does not establish that the initial findings meet a zero-issue policy. A local verification snapshot is saved in ignored `.local/sonar-verification.json`.
- No commit or push was made. Application source and existing staged work were not changed by this verification run.

## 2026-09-21 Sonar refactor and bugfix

This later remediation was applied to the uncommitted working tree in two groups:

- `refactor:` split HTTP dispatch, scheduling validation, daily adaptation, parent-message construction and UI rendering into named functions; simplified conditional expressions and parsing; increased the contrast of the 17 flagged text/background pairs to at least 4.7:1; and bound hook installation and gate Git calls to the standard system executable. A full scan after this group reported zero code smells and vulnerabilities, with only the existing duplicate locale-key bug remaining.
- `bugfix:` removed the duplicate `homeHabit` locale entry while preserving the effective Macedonian and English labels. The existing activity-editor test now checks both displayed labels.

The final `npm run gate` completed successfully at 12:36 UTC. It checked 120 JavaScript files and 26 documentation files, passed all 183 tests, verified complete application source coverage, uploaded the Docker scanner report and received `QUALITY GATE STATUS: PASSED`.

Native V8 line coverage is **98.00% backend** (5346/5455) and **93.08% frontend** (4008/4306). Sonar reports **95.8% overall line coverage**, **93.7% combined line/condition coverage**, **93.0% new-code coverage** and **0.6% overall duplication**. Formatting separates more source statements onto individual lines, so these native line counts differ from the earlier compact source.

An authenticated API check at 12:37 UTC confirms **zero open issues, zero bugs, zero vulnerabilities, zero code smells and zero security hotspots**, with gate status `OK`. The snapshot is saved locally in ignored `.local/sonar-remediation-final.json`.

The added regression tests cover mixed English/Macedonian duration quantities, long unmatched input, normalized registration addresses, malformed email separators/whitespace, hostile PATH entries and preservation of custom Git hooks. A separate comparison against the saved pre-refactor source confirmed identical bilingual parent messages for 12 synthetic scenario/mode combinations. No live provider requests or actual-user outcomes are claimed.

No commit or push was made. Existing staged work was preserved.

## 2026-09-21 Postman API package verification

Added the standalone `api-tests` package with a Postman v2.1 collection, blank local environment and a pinned Postman CLI runner. See [API test usage and scope](api-tests.md).

- `npm run test:api` passed against the actual HTTP app on an ephemeral loopback port with in-memory SQLite: **60 requests, 302 assertions, zero failures**. The suite uses synthetic demo planning, local library suggestions and a newly generated test account; no live-provider or model result is claimed.
- `npm --prefix api-tests run test:local -- --base-url http://127.0.0.1:4174` passed the same **60 requests and 302 assertions** against the app built and started by Docker Compose. The temporary app service was stopped afterwards. Its newly created named volumes remain, including the disposable test account; no existing database or Sonar volume was removed.
- `npm --prefix api-tests audit` reported zero known npm dependency vulnerabilities. The CLI is supplied as a platform binary; this npm result is not an independent audit of its bundled implementation.
- `npm run gate` passed: **121 JavaScript files, 27 documentation files, 183 tests, zero failures**. Backend coverage remains **98.00%** and frontend coverage **93.08%**, with complete authored application-source inventory.
- The fresh Docker Sonar scan included `api-tests/scripts/run.js` and passed its quality gate. An authenticated API check confirmed **zero open issues, bugs, vulnerabilities, code smells and security hotspots**, **95.8% line coverage** and **93.7% combined coverage**. The API runner is tooling and follows the existing script coverage treatment; no application source was excluded.

No commit or push was made.

## 2026-09-21 running-server edit recovery

The browser's application on port 4173 was still running a backend process started before the direct-edit endpoint existed. An isolated demo probe reproduced `POST /api/week/day/edit` returning `404 {"error":"not_found"}`, while the same process returned the expected `409 plan_changed` for a stale revision on `/api/week/recheck`. The frontend files on disk already called the new direct-edit route. The earlier isolated and Docker checks did not verify this older native process.

Stopped only that identified app process and restarted the same checkout with `npm run dev` on port 4173. The watcher PID is recorded in ignored `.local/server.pid`. The existing SQLite database and caches were retained. Backend changes now restart the development process; in-memory demos are discarded on restart as documented.

Real headless Chromium verification against port 4173 used a new synthetic demo and exercised pointer dragging, reorder arrows, regular-activity content editing, bilingual eco-content editing and timetable review/application. Every mutation returned HTTP 200; the requested row order and time boundary were retained, edited content survived page reload, approval remained invalidated, and no browser exceptions occurred. The probe demo was deleted afterwards. A local screenshot is saved in ignored `.local/browser-editing-verified.png`. The browser driver was installed outside the repository and added no application dependency.

Expanded the Postman collection with complete-day reordering, reviewed time-boundary editing and refresh-persistence checks. Both `npm --prefix api-tests run test:local` against the corrected port 4173 process and `npm run test:api` against an isolated app passed **63 requests and 317 assertions**, with zero failures. All mutation data was synthetic; no existing account plan was edited by these checks.

The subsequent full `npm run gate` passed all **183 tests**, with **98.00% backend** and **93.08% frontend** line coverage. The fresh Sonar scan completed at 13:48 UTC with quality gate `OK`; authenticated API checks confirmed **zero open issues, bugs, vulnerabilities, code smells and security hotspots**. No commit or push was made.

## 2026-09-21 generation-warning banner removal

Removed the saved generation-warning banner and its unapplied-brief message from Home in both languages. Library/mixed source information remains inside the existing collapsed Manage week section. Request errors, backend validation and authenticated diagnostics are retained.

The existing DOM integration test verifies the banner is absent and library source is shown inside Manage week, then disappears after successful AI replacement. A real Chromium check against port 4173 used a synthetic demo response with `ai_invalid_output` to verify the screenshot's messages are absent in Macedonian and English, with no browser exceptions. It did not call a model or change an account plan.

`npm run gate` passed all **183 tests**, with **98.00% backend** and **93.05% frontend** line coverage. The fresh Sonar gate passed at 13:56 UTC, and authenticated API checks confirmed **zero open issues and security hotspots**. No commit or push was made.
