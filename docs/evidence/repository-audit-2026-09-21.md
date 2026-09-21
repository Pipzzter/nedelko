# Hackathon Repository Audit — Nedelko

> **Historical audit:** This report was supplied in the local checkout as `findings.md` and records the pre-publication state at `ac1d473`. It predates the completed Nedelko branding commit `d5f9f85` and the timetable update. Retired product identifiers have been redacted; the original observations, scores and reported test outcomes below are historical, not fresh verification of the current project. See the [later timetable verification](teacher-timetable-2026-09-21.md) for that change's observed checks.

**Reviewer:** Impartial audit (read-only; no application code modified — this `findings.md` is the sole file created).
**Date:** 2026-09-21
**Repo (remote):** `github.com/AI-Tech-Summit-Filip-Avramchev/gun-mayhem-repo` — the directory/repo is named `gun-mayhem-repo` for administrative reasons; the product is **Nedelko** (a kindergarten weekly eco-activity planner). Do not judge by the folder name.
**Method:** Orientation (file tree, git history, stack) → I ran the test suite + coverage myself → I personally read the crown-jewel security/AI files (`auth.js`, `security.js`, `app.js`, `ai.js`, `database.js`, `week.js`, `parent-view.js`) → five parallel sub-reviewers read every remaining source and test file in full. Findings below are cross-checked between my direct reads and the reviewers; overlapping areas agreed.

> **Scope caveat that affects everything below:** at review time the **working tree is NOT clean** (see the boxed warning in §1). All test results and file reads reflect the *working-tree* (in-progress Nedelko rebrand) state, which is self-consistent and green, but is **not what is committed/pushed** to `origin/main`.

---

## 0. What it is / stack (confirmed from code, not the folder name)

- **Product:** A Macedonian + English (bilingual) Monday–Friday kindergarten planner for teachers in Skopje and other supported Macedonian cities. It adapts indoor/outdoor eco-activities to **live PM2.5 air quality** (pulse.eco) and **weather forecasts** (Open-Meteo), overlays **holidays/occasions**, and produces a revocable **read-only parent share link** with parent notes. An **optional OpenAI** integration generates the bilingual lesson content and ranks outdoor days; without a key it falls back to a deterministic library.
- **Stack:** Native **Node.js ≥24** HTTP server (no web framework, no build step), `node:sqlite`, `node:crypto`; frontend is **vendored Preact 10.29.8 + HTM 3.1.1** as browser ES modules (no bundler). Tests use `node:test` + `linkedom`. Ships Docker/Compose + a SonarQube static-analysis stack + a local pre-push quality gate + a Postman API suite. `package.json` has **zero runtime dependencies** (one devDep: `linkedom`).
- **Entry points:** `backend/server.js` (loopback bind) → `backend/http/app.js` (routing); `frontend/index.html` → `frontend/src/app.js`.

---

## 1. Overall verdict

This is an **exceptional hackathon submission** — closer to a disciplined production prototype than a weekend hack. The engineering is genuinely strong across the board: a clean layered architecture, **zero runtime dependencies**, a security posture (scrypt auth, hashed session tokens, fully-parameterized SQL, layered path-traversal defense, strict CSP, uniform SSRF controls, defense-in-depth CSRF) that exceeds most loopback apps, **202 passing tests** with real adversarial/mutation coverage at **~98% backend / ~95% frontend line coverage**, and an AI integration that does real generative work while being architecturally forbidden from overriding any safety-critical decision. Documentation and honesty are standout: a comprehensive README with a real architecture diagram, ADRs, and a verification log that carefully separates verified-now from pending — including self-disclosure of dead code and unproven claims. The dominant weaknesses are (a) an **uncommitted, unpushed in-progress rebrand** that currently breaks the "everything pushed" requirement and includes untracked files at risk of loss, (b) the app is **loopback-only** with no hosting/delivery/recovery (honestly disclosed, but it caps real-world "usefulness next month"), and (c) a handful of minor drift/dead-code/stability items (client↔server validation duplication, a ~220s account-lock window during AI generation, a duplicate schedule-validation table). None of the code-level issues are disqualifying; the most urgent action is purely operational: **commit, add the untracked files, and push before the deadline.**

> ### ⚠️ TIME-SENSITIVE: the working tree is dirty and does NOT match the remote
> `HEAD == origin/main` (`ac1d473`), but `git status` shows a substantial **uncommitted Nedelko rebrand**: ~34 modified tracked files, **deleted** `[retired Postman collection path]` and the `[retired workflow name]` skill, plus **untracked** `api-tests/postman/nedelko.postman_collection.json` and `docs/development/skills/nedelko-pr-workflow/`. It touches backend source (`services/auth.js` cookie `[retired cookie name]`→`nedelko_session`; `storage/database.js` adds a `databaseFilename()` resolver + `NEDELKO_DATABASE_PATH`; `http/app.js`, `server.js`, `conditions.js`), tests, README and docs. The changes postdate the last commit (disk timestamps 23:03 vs last commit 22:51); I made no changes. **Consequences:** (1) judges who clone the repo get the previously branded committed version, not this WIP; (2) the untracked new Postman collection and skill dir are **not in git** and will be lost if not `git add`-ed; (3) the project's **own pre-push gate refuses a dirty tree** (`scripts/gate.js:10-18`), so this must be resolved before it can be pushed at all. **Action: finish or stash the rebrand, `git add -A`, run `npm run verify`, commit, and push.**

---

## 2. Rubric-mapped scoring (estimates, mapped to the exact rubric wording)

Ranges reflect genuine uncertainty (I could not run the live UI or verify remote accessibility / outside-tester from the repo). Justifications cite specific files.

| Category | Avail | Est. range | Justification (with evidence) |
|---|---|---|---|
| **Usefulness** (named user, still used next month?) | 30 | **23–27** | Clearly-named user: a kindergarten teacher in Skopje (a city with acute winter PM2.5) planning weekly eco-activities and adapting indoor/outdoor by real air/weather, sharing with parents. Recurring weekly value is genuine; a caveated teacher-pilot note exists (`README.md:15-17`, `docs/product/research.md`). **Caps:** loopback-only HTTP, no message delivery, no account recovery, no hosted access (`README.md:70-76`) — a teacher would need the laptop running as a server; impact is honestly unproven. |
| **Does the demo work?** (one full path, unaided) | 20 | **17–19** | `npm start` runs with **no build/deps** on Node 24; credential-free demo mode needs no API key (`http/app.js:219-245`, `config/demo.js`). Backup **demo.webm** (115 s, 1280×900, reached end) + 26 screenshots + `smoke-summary.json` evidence (`docs/evidence/demo-2026-09-21/`). 202/202 tests incl. a full DOM integration test pass. **Cap:** I could not drive the live UI here; live-AI path needs a key (demo uses library). |
| **Is the AI doing real work?** (not a chatbox) | 20 | **17–19** | The model **generates the core work product** — a full bilingual 5-day eco-curriculum (goals, indoor/outdoor variants, habits, per-slot session plans, occasion-aware lessons) **and** ranks outdoor days. Strict JSON-schema output + independent server re-validation (`services/curriculum.js`, `domain/curriculum.js:280-328`, `domain/session-plan.js`). Real authenticated evidence (`docs/evidence/live-ai-2026-09-21.json`, `gpt-5.6-terra`, `source:"ai"`) plus a *second* independently-worded demo run. Far beyond a chatbox. **Note:** app stays fully usable without AI (deterministic fallback), and AI is correctly barred from safety decisions — that's a strength, not a deduction. |
| **How did you build it?** | 15 | **13–15** | Sensible layered structure; **81 commits over 2 build days** (both active, not one dump), **37 merged PRs** with conventional, descriptive messages; many `fix(...)` following `feat(...)` (bug→fix); a PR-workflow skill (trace of process); explicit **honesty about AI** (`README.md:19-25`) and about dead code / unverified items (`docs/evidence/release-2026-09-21.md:57`, `verification-status.md`). **Dings:** working tree currently dirty/unpushed (§1); a 26-commit cluster at 16:00 on day 2 (still not a single final dump). |
| **Can someone else understand it?** (one README) | 10 | **9–10** | README states what/who/how-to-run (Node **and** Docker, with env vars) + known issues + a **real Mermaid architecture diagram** (`README.md:109-119`, not just a text tree). Deep `docs/` (ADRs 0001-0008, decision-basis, verification-status) with **high doc-vs-code fidelity** (AI timeouts/token budgets/model families match code). **Dings:** docs are dense with superseded numbers; branding mid-transition can confuse. |
| **Does it hold up?** (tried to break it) | 5 | **5** | Overwhelming evidence: 202 adversarial tests (AI-output mutation, SSRF/injection/traversal/concurrency/timing), an isolated Postman API suite, SonarQube gate + coverage gate + `verify:ai`, and cross-consistent evidence artifacts. |
| **TOTAL** | **100** | **≈ 84–95** | Realistic landing **high-80s to low-90s.** |

*Per the rubric note, the AI category is not a blocker and here is a genuine strength; no single missing feature is treated as disqualifying.*

---

## 3. Submission checklist (item | status | evidence)

| Item | Status | Evidence / note |
|---|---|---|
| Repo accessible / link works from another account | ❓ Can't verify from repo | Remote is an org repo; can't test cross-account visibility from here. Verify manually. |
| README: what / who / how-to-run (with env vars) | ✅ Pass | `README.md:27-76` (what/who), `:37-68` (Node+Docker+`.env`), `.env.example`. |
| Someone outside the team ran it | ❌ Not done — **disclosed** | `README.md:76` + `verification-status.md`: "A fresh setup on a teammate's machine … remain unverified." Honest, but the item is unmet. |
| Backup demo recording exists | ✅ Pass | `docs/evidence/demo-2026-09-21/demo.webm` (4.3 MB, 115 s, `video-metadata.json`). |
| Main flow works on a phone (not just laptop) | ⚠️ Partial | Responsive CSS to 320px + 390px mobile screenshots (`08-mobile-parent-390px.png`, `15-mobile-ai-plan-390px.png`). Real-device use unverified; and loopback hosting means a phone can't reach the laptop server without extra setup. |
| Architecture diagram in repo (text tree ≠ diagram) | ✅ Pass | **Mermaid** flowchart `README.md:109-119`. (The `overview.md:3-25` text tree alone would NOT count — but the Mermaid diagram satisfies it.) |
| Known issues written down | ✅ Pass | `README.md:70-76`, `docs/development/verification-status.md`, `release-2026-09-21.md`. |
| Everyone can explain the whole project | ❓ Can't verify from repo | Team knowledge; not assessable from files. |
| Everything pushed (working tree clean, matches remote) | ❌ **Fail (now)** | `HEAD==origin/main`, but working tree dirty with untracked files (see §1). This is the most urgent fix. |

---

## 4. Git history findings (feeds the "how did you build it" 4-pt sub-criterion)

- **Volume/spread:** 81 commits (62 non-merge + 19 merge) across **two build days** — Sep 20 (~34 commits, 18:00–01:00) and Sep 21 (spread 09:00–22:00 with a 26-commit cluster at 16:00). This **is not a single final dump**; both days show iterative work. The 16:00 cluster is worth a neutral mention (possibly a rebase/batch of merges) but does not undermine the sub-criterion.
- **Authors:** 3 distinct humans — Filip Jordanoski (two identities), Mile Stanislavov, Andrej Velichkovski/Velickovski. Genuine multi-contributor history.
- **Process:** **37 merged PRs** (`#1`–`#37`) via feature branches (`feat/*`, `fix/*`, `refactor/*`, `test/*`, `chore/*`) with a `nedelko-pr-workflow` skill — a real branch/PR/merge cadence and a **trace of review** (self-review within a small team).
- **Messages:** Conventional-commit style, descriptive of *what changed* (e.g. `fix(domain): guard decimal durations and incomplete display context`). **Bug→fix pairs** are visible throughout.
- **Honesty about AI:** Explicitly disclosed (`README.md:19-25`). ✔ for that sub-criterion.
- **Proves:** genuine incremental, reviewed, multi-author development. **Does not prove:** anything about the *uncommitted* WIP (§1), which is the one blemish on an otherwise strong history.

---

## 5. Environment & verification I ran myself

- **Runtime present:** Node **v24.15.0**, npm **11.12.1**.
- **`npm run test:coverage`:** **202 tests, 202 pass, 0 fail** in ~3.7 s. Coverage: **backend 97.99% lines (5078/5182)**, **frontend/src 94.88% lines (4056/4275)** — both clear the self-imposed **91%** gate; all-files 96.58% lines / 89.56% branch / 93.61% funcs. (Ran against the *working-tree* state.)
- **Not run by me:** `npm run test:api` (needs `npm --prefix api-tests ci` first), `npm run gate`/`sonar` (needs Docker + SonarQube + `SONAR_TOKEN`), `npm run verify:ai` (paid live call). The team's committed evidence for these is internally consistent (§9). **Verify `test:api` and `gate` yourself before the deadline** — I could not.
- **Secret scan:** No secrets in tracked files. `.env` is **not** tracked (correctly gitignored); the only key-pattern hits are **tests asserting secrets do NOT leak** (`backend/tests/api.test.js:328`, Postman collection) — a positive. Committed evidence JSON contains no secrets.

---

## 6. Backend — Security & Services (`http/`, `services/`, `storage/`, `config/`, `server.js`)

*Independently verified by me on `auth.js`, `security.js`, `app.js`, `ai.js`, `database.js`; breadth by sub-reviewer. Agreement.*

**Best Practices** — Clean separation (routing / security primitives / auth / provider I/O / persistence / config). Uniform error model: `invalid(code,status)` / `authError` funnel through one top-level catch → `sendRequestError` (`app.js:650-652,899-906`) emitting only codes. Empty `catch {}` blocks are all intentional and commented. **Smells:** substantial **dead/unwired code** in `services/ai.js:62-137` (`extractSchedule`, `suggestWeeklyThemes`, `noticeTone`, `validateTone`, `localEcoThemes`, plus a second, dead provider-error mapper `aiFailureMessage` vs the live `ai-errors.js`) — reachable only from tests; unused import `pairSchema` in `services/parent-notes.js:1`; redundant `Promise.resolve(holidayProvider(...))` (`app.js:600`). (To the team's credit, the dead AI exports are **disclosed** in `release-2026-09-21.md:57`.)

**Security** — Strong and verified:
- **Secrets:** `OPENAI_API_KEY` only in the `Authorization: Bearer` header (`ai.js:23`); `/api/config` exposes only `{configured:boolean, model}` (`ai.js:4`, `app.js:990-1002`). PULSE creds only Base64'd for `*.pulse.eco`. Provider errors sanitized to an allowlist `{httpStatus,code,type,requestId}` with a regex-gated request id (`services/ai-errors.js:24-59`); raw provider text never reaches the client.
- **AuthN:** scrypt `N=32768,r=8,p=1,maxmem=64MB`, 128-bit salt, `timingSafeEqual`, constant-work dummy-salt path for unknown users (`auth.js:5-7,42-53`). 256-bit session tokens stored **only** as SHA-256 (`auth.js:80-81`); cookie `HttpOnly; SameSite=Strict; Max-Age=7d`; rotated on login (`auth.js:79`), revoked on logout (`app.js:214-215`). *No `Secure` flag — correct/necessary for loopback HTTP.*
- **AuthZ:** `user` derives solely from `store.session(tokenHash(cookie))` (`app.js:623-624`); no body field sets the account id; every real read/write keyed by `user.id` and a **server-computed** week start (`app.js:589-590`). `mode` derived server-side. Demo IDs only ever key an in-memory map, never real tables.
- **SQL:** fully parameterized everywhere (`storage/database.js`, `storage/parent-notes.js`); the only dynamic fragment is `date(?, '-6 days')` with a bound arg (`database.js:71`).
- **Path traversal:** layered defense (`serveFrontend`, `app.js:881-897`) — dir allowlist regex + `decodeURIComponent` + `resolve` with `startsWith(FRONTEND+sep)` + extension allowlist. `.env`, `*.sqlite`, backend `.js` all unreachable; encoded traversal defeated.
- **SSRF:** uniform on all 3 outbound clients — scheme/host allowlists + `redirect:'error'` + timeouts + size caps; the holiday scraper additionally pins origin/path and rejects creds/hash/query (`conditions.js:33-56`, `holidays.js:49-64,186-202`, `ai.js:21-27`).
- **CSRF/DoS:** POSTs require `application/json` + Origin/`Sec-Fetch-Site` check + SameSite=Strict; Host pinned to `127.0.0.1`/`localhost` (DNS-rebinding guard); strict CSP no `unsafe-inline` (`security.js:5-8`, `app.js:610,617-622`). Rate limits applied **before** expensive work everywhere (auth 12/15min, AI-week 6/hr/owner, holidays 30/hr, etc.).
- **AI/LLM boundary (best part):** model output schema-constrained *and* independently re-validated; the model **cannot** override safety — outdoor eligibility/AQI/closures are recomputed server-side, and the model's `outdoorOrder` only *ranks among already-eligible days* (`domain/week.js:294-313`). Prompts label input as untrusted; output scanned for injection/air-safety markers.

**Stability** — Per-account fail-fast `withLock` (`app.js:71-79`) layered on optimistic SQLite revisions (`database.js:77-101`); timeouts at every boundary; `cachedFetch` de-dups concurrent identical requests; all caches size-bounded; no unguarded async reaches the top level.

**Validation** — JSON body capped at 128 KB + object-shape check; real runtime checks on `scenario`, `year` (2024–2100), `locationId`, `revision`, parent token (`^[a-f0-9]{64}$`), and parent-note body; credentials validated/normalized (`auth.js:17-26`).

**Notable Risks/Bugs** (most severe first):
1. **AI generation can hold the per-account lock ~220 s** — `services/curriculum.js:57` sets `timeoutMs:220000` inside `withLock` (`app.js:356`); `server.requestTimeout` doesn't bound handler runtime. During a slow generation, every other action for that account returns `409 operation_pending` for up to ~3.5 min. *(Stability, moderate.)*
2. **`GET /api/dashboard` performs writes** (clears approval, persists adapted plan — `app.js:341,348`) and GETs skip the Origin check; safe today only via SameSite+auth, but a state-mutating GET is fragile. *(Best-practice, low.)*
3. **Doc/impl mismatch on body caps** — the "1 MB provider body" claim holds for OpenAI only; env fetch caps at **8 MB** (`conditions.js:15`), holidays at **1.5 MB**. Tighten the env cap or correct the docs. *(Low.)*
4. **Dead code + duplicate error mapper** invite future drift (one hardened, one not). *(Low.)*
5. **Default `OPENAI_MODEL='gpt-6-astra'` is a non-standard id** (`ai.js:4`); if relied on and unavailable, requests 404 and silently fall back to library — resilient, but the AI value-prop is off with no loud signal. Document a known-good model id. *(Low.)*
6. Coarse rate-limit keying on loopback (`::1` vs `127.0.0.1` split buckets); signup enumeration via `email_taken` 409 (inherent). *(Informational.)*

**Doc-claim verification:** 7/8 **TRUE** (scrypt params, token/cookie handling, rate limits, secrets-server-side, output re-validation, revisioned writes+lock, static-file lockdown); #5 **PARTIAL** (1 MB is AI-only).

---

## 7. Backend — Domain logic (`backend/domain/*`)

**Best Practices** — Almost entirely pure/deterministic (time via DST-safe `skopjeParts`; no I/O). **Purity leak:** `qc.js:11,66` default `now = Date.now()` — a caller that forgets to thread `now` gets non-deterministic *air-safety* output (callers currently pass it). No TODOs/commented cruft; comments are rationale.

**Correctness / Stability** — Verified strong:
- **AQI/PM2.5 (`aqi.js`)** matches the **2024 EPA breakpoint revision** (Good/Moderate cut at 9.0/9.1, 35.4/35.5), contiguous 0.1 steps (no gaps/overlaps), exact boundaries, documented above-scale extrapolation. **NowCast** correct (12-h window, ≥2-of-3-recent gate, `max(0.5,·)` weight, decay through nulls). `category(null)→'unknown'` — correct fail-safe.
- **QC (`qc.js`)** treats missing/stale(>60min)/future/extreme(≥500)/stuck/sudden-rise/disagreement/insufficient(<2 sensors) as **unknown, not clean**; screens with the **max** valid NowCast, not a blend. Resolves to `unknown_air` at the boundary.
- **Dates/DST** robust (`Intl` + noon-UTC anchoring in `planner.js:5-7`); year-boundary + Friday→Monday prep lookahead handled.
- **"Earlier days empty when midweek"**, elapsed-row retention, decimal-duration guard (`schedule-timing.js:122`), and gap-filler timeline construction (no dropped/dup/overlapping rows) all verified.

**Validation** — Model curriculum/sessions and manual edits all get real runtime re-validation (`curriculum.js:280-328`, `session-plan.js:34-51`, `day-edit.js`, `manual-day-edit.js`). **Comfort-preference bounds are a single source of truth** (`preferences.js`; `settings.js` and `constraints.js` delegate). Individual parent notes can never mutate the group plan (`domain/parent-notes.js`).

**Notable Risks/Bugs:**
1. **Divergent duplicate schedule/theme validation in `constraints.js` vs `settings.js`** — `constraints.js:104-107` allows day 06:00–20:00, duration 10–90 (any int) and uses a different materials/theme shape, while authoritative `settings.js:93-95` enforces 06:00–19:00, 15–60 in steps of 15. Contained because `validateSettings` is the gate before a week is built, and `constraints.js` is only consumed by the (dead) `services/ai.js` onboarding suggester + tests — but it's a real second source of truth ripe for drift. *(Drift, low-moderate.)*
2. **Stuck-at-zero sensor not flagged** — `isStuckSensor` (`qc.js:102-108`) requires `value>0`, so a sensor frozen at exactly 0.0 reads as clean. Mitigated by the ≥2-sensor + disagreement rules unless *all* local sensors are stuck at 0. *(Low-moderate.)*
3. `qc.js` `now` default (above); `compactTimeline` "same"-branch has no 60-min cap (cosmetic filler-row only); dead exports `MATERIAL_CATALOG`/`DEFAULT_TEXT` (`constraints.js:4,17`); silent `catch {}` in `localExtract`. *(Low/cosmetic.)*

**Doc-claim verification:** all 6 **TRUE** (planner.js trimmed; `createWeek` re-validates; model order filtered through evidence; unknown-not-clean; editable weather prefs + single-source bounds; `parent-view` allowlist).

---

## 8. Frontend (`frontend/src/*`)

**Best Practices** — One-component-per-file, consistent HTM/Preact, no `console`/`TODO` noise, errors surfaced (not swallowed). **Smell:** `app.js` is a **793-line god-module** with heavy prop-drilling (`renderPage`, `renderApplicationShell`). Self-documented dead code: `lib/time-range.js` `parseTimeRange` is test-only.

**Security** — **XSS clean:** no `dangerouslySetInnerHTML`/`innerHTML`/`eval` in app code; every untrusted surface (parent notes, AI lesson/proposal text, occasion names) rendered as **escaped text** (e.g. `ParentNotes.js:109`, `DayPlan.js:414-431`). The one Preact-unsafe sink (`href`) is guarded by `safeHref` (`ui.js:27-35`) at every dynamic use (`AirCard.js:38`, `ParentShare.js:38-41`). **No client-side secrets.** Parent token lives in the **URL fragment**, validated to 64 hex, kept out of progress state and logs; external links carry `rel="noreferrer"`. `credentials:'same-origin'` + `401`→local teardown confirm the server is authoritative.

**Stability** — `crypto.randomUUID` correctly guarded with a 3-tier fallback (`ui.js:8-26`) — cannot crash on insecure origins. `fetch` has per-path deadlines + full non-OK/JSON-error handling (`lib/api.js`). Background polling is non-blocking and preserves the focused field / unsaved draft / demo scenario. **Minor UX bugs:** (a) background polls share the operation lock, so a slow poll can make a user action fail with `operation_pending`; (b) `refreshDashboard` nulls approval on every poll → "Approved" pill flicker; (c) a transient blip during a *silent* poll pops a visible error banner (`app.js:100`); (d) `ScheduleEditor` remounts on start-time change during a poll, dropping an in-progress time edit; (e) `accept()` assumes a well-formed response; (f) `AbortSignal.timeout` assumed present.

**Validation** — **Weakest area: client↔server validation duplication → drift risk.** `plan-form.js:8-76`, `Auth.js:49-110`, `SettingsForm.js:31` hard-code structural bounds (outdoorDays 0–5, day 06:00–19:00/≥180 min, password 10–128, name lengths) in up to three places; only weather `preferenceBounds` are fetched from server config and shared. **Mitigated** because the server re-validates everything (a genuine build-step-free tradeoff), so it's a UX-consistency risk, not a security hole.

**Doc-claim verification:** all 4 **TRUE** (token in fragment; polling preserves focus/draft/scenario + non-blocking; `randomUUID` guarded; no client secrets).

---

## 9. Tests / Coverage, Infra, Tooling, Docs

**Tests/Coverage** — Genuinely strong and **adversarial**, not tautological. Highlights: whole-week AI output is **mutation-tested** (drop key / remap to protected slot / past-date / wrong type / dup title / short desc) and each must fall back to `library` with `ai_invalid_output` (`curriculum.test.js:174-220`); 11-case provider-error taxonomy asserting `requests===1` (no retry loop) and no raw provider text; EPA breakpoint boundaries with hand-computed expectations (`domain.test.js:17-33`); a real **write-lock concurrency** test (`features.test.js:121-163`); parent-view **allowlist diff** (`features.test.js:251`). **Isolation is proper via dependency injection** — injected `fetch`/`clock`, `scripts/test.js` refuses to load `.env`, `verify:ai` fully separated; no live-network or wall-clock dependence. The **Postman suite is genuinely isolated** (in-memory app, ephemeral port, provider throws for non-demo) and exercises the full lifecycle with global security-header assertions. **Gaps:** `noticeTone` untested; ~7 of 11 `ai.test.js` tests exercise **unwired** functions; no test for session-rotation-on-login, the `verifyPassword` dummy-salt branch, or the `rateLimiter` GC branch; the two mega DOM tests are the main flake risk. Per-file coverage outside the 9 "critical" modules is uneven (`services/parent-notes.js` **59.46%**), allowed by policy but a real depth gap.

**Infra** — Textbook hardening: `package.json` **zero runtime deps**; Dockerfile pins `node:24.21.0-bookworm-slim`, runs **non-root** (`USER node`), `read_only`, `cap_drop:[ALL]`, `no-new-privileges`, publishes **loopback-only**, and does **no `npm install`** (no `node_modules` in the image). `.dockerignore` is deny-all-then-allowlist. Sonar DB password is **mandatory with no default** (`${SONAR_DB_PASSWORD:?}`); scanner rejects non-loopback host and mounts source read-only. **License attribution accurate** (Preact→MIT, HTM→Apache-2.0, full texts in `docs/reference/licenses/`, sizes verified).

**Quality gate** — Genuinely **fails closed** on missing Sonar token, test failure, insufficient coverage, failed Sonar verdict (`sonar.qualitygate.wait=true`), **dirty tree**, and ref≠HEAD, with re-checks bracketing the scan (`scripts/gate.js`, `lib/push.js`). Coverage anti-gaming works (mandatory source-inventory → "omitted source files" throw). Bypassability (`--no-verify`) is honestly disclosed. **Latent hole:** the critical-file floor doesn't assert all 9 paths are present, so a rename could silently drop a file's 90% floor (`scripts/lib/coverage.js:31,36`). `docker` is PATH-resolved in the gate while `git` is hardened.

**Architecture / Docs vs code** — **High fidelity.** AI timeouts (220 s / 30k tokens), reasoning-effort model families, single-day 90 s/3k, and default model all match code exactly. Real Mermaid diagram present. **Evidence integrity is honest/conservative:** coverage (97.99%/94.88%), 202-test count, and the live-AI JSON all cross-tie across `coverage-2026-09-21.json`, `final-verification-2026-09-21.txt`, and `verification-status.md`; a *second* demo AI run themed the same day with different text (corroborates authenticity vs a fixed fixture); hedging is careful ("verifies live generation, not live providers/deployment/teaching outcomes"). **Minor:** `verification-status.md` is dense with superseded intermediate numbers; the `nedelko-pr-workflow` skill is an in-repo tooling artifact not mentioned in the ADRs; vendored blob versions are attributed but not byte-verified against upstream.

---

## 10. Prioritized fix list (ordered by point-value-at-risk)

1. **[Everything-pushed / Build ≈ up to ~5 pts + submission validity] Commit & push the rebrand.** Finish or stash the Nedelko rebrand WIP, `git add -A` (capture untracked `nedelko.postman_collection.json` and `nedelko-pr-workflow/`), `npm run verify`, commit, push. The pre-push gate **requires a clean tree**, so this is blocking. *(§1)*
2. **[Demo / Holds-up] Independently verify the paths I couldn't:** run `npm --prefix api-tests ci && npm run test:api`, and `npm run gate` (Docker+Sonar). Confirm the **live UI demo** end-to-end on a fresh checkout, and confirm **remote accessibility** and an **outside-teammate run** (both currently unverified checklist items). *(§5, §3)*
3. **[Usefulness clarity] Sharpen the README's one-line "who + why now."** The air-quality angle for Skopje teachers is the strongest usefulness argument — lead with it; keep the honest limits but make the recurring weekly value unmissable. *(§2 Usefulness)*
4. **[Stability, moderate] Decouple AI week-generation from the per-account mutation lock** (or shorten the 220 s cap) so a slow generation can't 409 all other actions for that account for minutes. *(§6 #1)*
5. **[AI robustness] Set a known-good default `OPENAI_MODEL` and surface fallback loudly.** Avoid a silent 404→library when the AI value-prop is the point of demoing. *(§6 #5)*
6. **[Correctness, low-moderate] Flag stuck-at-zero sensors** and **require `now`** in `qc.js` (drop the `Date.now()` default) to remove the last determinism hazard in air-safety math. *(§7 #2/#3)*
7. **[Drift] Collapse the duplicate schedule/theme rules in `constraints.js` onto `settings.js`/`preferences.js`, and delete the dead AI onboarding code** (`extractSchedule`/`suggestWeeklyThemes`/`noticeTone` + `aiFailureMessage`, `MATERIAL_CATALOG`, `DEFAULT_TEXT`) — or wire it in. Removes a whole class of future drift. *(§6, §7 #1)*
8. **[Robustness, low] Make `GET /api/dashboard` side-effect-free** (move the approval reset to a POST) or gate its write behind the origin check. *(§6 #2)*
9. **[Docs precision] Fix the "1 MB provider body" wording** (env=8 MB, holidays=1.5 MB) or tighten the env cap; add a `assert critical files == 9` guard in the coverage gate; consider trimming `verification-status.md` so the current entry is unmistakable. *(§6 #3, §9)*
10. **[Frontend UX, low] Don't let background polls hold the operation lock / flicker approval / raise banners on silent-poll blips; guard `AbortSignal.timeout`.** *(§8)*

---

### Bottom line
Across all six rubric categories this project is strong-to-exceptional; the AI is real and safely bounded, the security and testing are well beyond typical hackathon quality, and the documentation/honesty are model-grade. The single highest-leverage action before the deadline is **operational, not code**: get the working tree committed and pushed so the polished state is the state that gets judged.
