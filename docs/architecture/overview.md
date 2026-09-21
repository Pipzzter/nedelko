# Architecture

```text
frontend/
  index.html                  browser entry point
  src/app.js                  session, routing and application state
  src/pages/                  sign-in, create plan, parent week
  src/components/             calendar, air card, timetable, messages, forms
  src/lib/                    same-origin API and date/render helpers
  src/locales/                Macedonian and English interface copy
  styles/                     responsive CSS, desktop through 320px mobile
  assets/                     original SVG illustrations and favicon
  vendor/                     pinned Preact, hooks and HTM ES modules
  tests/                      DOM integration tests
backend/
  server.js                   loopback process entry point
  http/                       routes, origin checks, rate/body limits
  config/                     source allowlists, city centres, QC policy
  domain/                     pure AQI, QC, scheduling, lessons and notices
  services/                   environmental requests, holiday scraper, OpenAI and authentication
  storage/                    SQLite accounts, sessions, weeks, profiles and parent links
  tests/                      domain, API, authentication and model-boundary tests
docs/                         methodology, sources, operation and verification
scripts/check.js              syntax checks, no build required
```

## Flow and ownership

The application database choice, schema boundaries and operational limits are recorded in [ADR-0006: SQLite](adrs/0006-sqlite-application-database.md).

1. Register or sign in with an email/password. The account starts with no week.
2. Create a week with editable recurring routines, materials, age and weather preferences.
3. The server obtains environmental data and bilingual lesson suggestions. It fills a Monday–Friday timetable; days before today remain empty.
4. For a successful AI generation, the model ranks all five dates for outdoor learning using each generated activity and a sanitized forecast summary. The deterministic scheduler selects from that order only when its air, weather and timetable gates allow the day. Library plans use the deterministic weather score. The remaining eco lessons use their indoor versions.
5. Home refreshes while visible every minute. A server worker also refreshes active stored weeks every minute without a browser. Refresh, location changes and saved edits recompute the plan and parent drafts. There is no message-delivery service.
6. A separate same-day recheck enables daily message approval for 15 minutes. Rechecking clears the old approval before requesting upstream data, including on failure. Approval is a stored acknowledgement, not a sent message.

`domain/week.js` is the active full-week planner. `domain/planner.js` now contains only `planningWeekDates` and `findOpenActivityWindow`; the unreachable parallel day/week planner and its divergent rules have been removed. Legacy free-form schedule endpoints and UI remain removed.

`domain/day-activities.js` supplies distinct arrival, story, movement, making, quiet-play, collaboration and reflection choices. Four session titles per day may come from validated AI output. An indoor learning block changes for rain, wind, heat, cold or snow, using the selected city's forecast. This library never grants outdoor permission. Rows keep server-owned roles and customization flags so refreshes preserve teacher edits and elapsed sessions. `domain/timeline.js` combines adjacent matching play rows and can consolidate upcoming uncustomized generated play up to 60 minutes. Fixed routines, eco slots, edited rows and elapsed rows are preserved. New generation fills free intervals with longer blocks instead of splitting at every activity-role boundary.

`domain/holidays.js` maps validated events to lesson dates; `config/holiday-snapshot.js` holds a sourced 2026 fallback. `services/holidays.js` discovers and validates official HTML announcements with an injectable fetch, clock and disk cache. The authenticated `GET /api/holidays?year=2026` endpoint shares this importer; an explicit valid demo ID returns only the dated snapshot. Generation and dashboard loading use cached calendar data. New AI requests include public, community and classroom occasions with their actual date, lesson date and scope. Refreshes preserve saved eco lessons. `domain/occasion-activities.js` marks curated/AI lessons covering an occasion and adds a bilingual discussion for uncovered events within an existing upcoming activity slot. It retains actual dates and scope, labels preparation, preserves teacher text and never adds time or closes a day. Server-owned `occasionIds` color only the relevant lesson rows and detail panel.

Account dashboard refreshes persist adapted evidence and clear approval without increasing the edit revision, preventing ordinary polls from causing an edit-revision conflict in an open editor. Background browser refreshes also preserve its focused field, unsaved draft and selected demo scenario without entering the modal mutation state. Approval is cleared durably before provider work, so provider failure cannot leave an old approval usable. Refreshes also discard pending model proposals. Owner saves and worker refreshes still advance revisions where specified; this is not an automatic merge of conflicting edits.

Weekly generation is limited to six requests per authenticated owner per hour; isolated demos are exempt from that paid-generation limit. Calendar reads are limited to thirty requests per account or demo per hour. Limits are process-local, reset on restart and run before the expensive provider work. A shared IP does not combine separate owners' generation quotas.

All real week reads/writes are scoped to the cookie-authenticated account. SQLite writes use revisions; an in-process lock prevents parallel modifications to one account/week. Stale browser revisions receive 409 rather than silently overwriting another edit. Demo records are separate, expiring in-memory examples accessed through opaque IDs. They never write to the real-week table or invoke OpenAI.

`POST /api/week/delete` removes the authenticated account's current week, its notices and approval. SQLite retains only a revision tombstone, preventing old tabs from modifying a newly regenerated week. Demo deletion clears only the isolated example and retains its fixed profile/clock. The frontend confirms deletion, holds the settings in memory, and returns Home to its setup entry. It does not delete an existing plan merely by opening the editor.

Home is the only teacher workspace. `components/DayPlan.js` presents selectable activities and bilingual descriptions; `components/ChangeAssistant.js` handles selected-activity replacements and confirmed schedule proposals. The legacy weekly editor page has been removed.

Day location controls submit only `outdoorPreference: auto | inside | outside` through the existing revision-checked edit endpoint. The backend validates the preference, rejects location changes after the eco slot ends, and recomputes the actual `mode`, activity variant and notices. Eligible explicit outdoor choices take priority; automatic days fill the weekly target remaining after elapsed and explicit slots. The preference persists when evidence blocks it, but client-supplied modes or reasons cannot override server checks. Every save clears the morning check and notice approval.

## Authentication and secrets

Registration validates and normalizes an email address and captures the kindergarten profile. Sign-in also accepts legacy usernames. All accounts have the same teacher capabilities; parent access uses revocable bearer links, not parent accounts or an RBAC role field.

Passwords use asynchronous scrypt with independent 128-bit salts, N=32768, r=8, p=1, and timing-safe comparison. Random 256-bit session tokens are stored only as SHA-256 hashes. Cookies are HttpOnly, SameSite=Strict, expire after seven days, rotate on sign-in and are revoked on sign-out. Login attempts are rate limited. No password, token or private schedule is logged.

This is a loopback HTTP app. It is not a production HTTPS deployment; see [local operation](../operations/local-development.md) before exposing it. SQLite is a local unencrypted file protected by the computer’s filesystem permissions. The server serves only approved extensions beneath `frontend/`; project files, keys and the database are inaccessible over HTTP.

## AI boundary

The active whole-week model request has a 220-second deadline and a 30,000-token output budget. It requests low reasoning effort for the verified GPT-5.6 Sol/Terra/Luna and GPT-6 Astra model families; the configured model is retained. The client refuses redirects, bounds the provider body to 1 MB, and still rejects incomplete or invalid output. The browser gives `/api/week/generate` 270 seconds including upstream preparation; day/change suggestions have a 120-second browser deadline, parent-note suggestions have 190 seconds, and remaining browser requests have 60 seconds. Node's `requestTimeout` bounds receipt of the incoming request, not model processing, and stays at 60 seconds. `headersTimeout` is 15 seconds. See the [official reasoning guidance](https://developers.openai.com/api/docs/guides/reasoning) and [GPT-5.6 Terra model reference](https://developers.openai.com/api/docs/models/gpt-5.6-terra).

Home omits saved generation failure and unapplied-library-brief banners. Library or mixed-source information appears inside the collapsed Manage week section; successful AI provenance banners remain omitted. Failed new requests still show their error, and account-scoped diagnostics remain in the saved response. Explicit AI retries and daily-topic requests cannot replace a saved plan with fallback. Successful replacement clears approval.

`services/curriculum.js` uses the existing Responses API client with strict JSON Schema and `store:false`. Input contains dates, a variation seed, age range, material IDs, season, the teacher brief, all supplied occasions and a sanitized per-day forecast summary. No library titles or sample lessons are supplied. Account IDs, kindergarten/group names, raw sensor readings, AQI and PM2.5 values are excluded. Teachers are asked to omit child names and private details from the free-text brief; the application does not claim automatic anonymization of that text. The server first supplies a `serverEligible` result from deterministic gates and the best available timetable window. Output must contain exactly five bilingual educational goals, indoor/outdoor variants, habits, four distinct indoor session titles per day and every supplied date exactly once in `outdoorOrder`. The schema constrains string lengths and selected material IDs to match domain limits. The server independently validates text lengths, language pairs, material IDs and the exact date permutation and rejects selected markup/instruction/air-safety patterns. It also requires the first occasion's name in the title and every occasion's name in both activity variants, in both languages. This checks visible coverage, not educational quality; lessons remain editable for the teacher. Single-day lesson and activity/schedule proposals use 90-second provider deadlines. Parent-note assessment uses 45 seconds; a resulting plan proposal may need another model call. Schedule-intent extraction uses 25 seconds. These are per-call limits, not guarantees for the combined workflow. The request uses the existing configured model. The structured-output request follows the [official OpenAI Responses API](https://developers.openai.com/api/reference/cli/resources/responses/methods/create).

A [recorded authenticated run](../evidence/live-ai-2026-09-21.json) on 21 September 2026 returned validated `source: ai` content from `gpt-5.6-terra`. `npm run verify:ai` isolates its account and in-memory database, forces AI success, uses fixed synthetic conditions and the bundled holiday snapshot, and writes an allowlisted evidence projection. It is an opt-in paid check outside the normal test suite. This verifies live generation, not live environmental inputs, production availability or teaching outcomes.

The model chooses a preferred outdoor-date order from the server-approved candidates. It does not read raw sensor data, determine closures, calculate AQI, relax a weather limit or write the factual weather/air portions of notices. `domain/week.js` filters the model order through current evidence, so an ineligible date is indoors even when ranked first. When evidence changes, the next eligible ranked date receives the outdoor slot. Parent drafts are composed deterministically from the accepted plan. Without a successful model request, the source is explicitly `library`, the deterministic score chooses among eligible days and the app remains usable.

A failed generation carries a bounded public reason. `services/ai-errors.js` distinguishes exhausted credits, quota restrictions, spending limits, rate limits, authentication, access, model availability and timeouts. Only the explicit provider code `credit_balance_exhausted` becomes `ai_credits`; the broader `insufficient_quota` does not prove that the balance is empty. `generationError` retains the HTTP status, allowlisted provider code/type and a bounded request ID. Raw provider messages, credentials and private input are never returned. These details belong to the authenticated account response. They describe the generation attempt, not a current billing balance. No automatic retries occur on billing failures.

Library regeneration varies available lesson/session choices using a server-generated seed; it is still labeled as library content. The AI rank is stored with the generated week. Refreshes and city changes do not spend tokens on another generation call; they reapply current deterministic gates to that order and skip blocked dates. Equivalent conditions can correctly retain the same plan.


## Kindergarten profile, single-day proposals and parent access

`POST /api/week/change/suggest` serves Home's selected-activity and full-day schedule controls. It includes the whole selected timetable, locks routines/holidays/started rows, and uses a strict bilingual schema. `domain/day-edit.js` validates exact protected rows, bounds, gaps, overlaps, activity uniqueness and the existing eco slot. `POST /api/week/change/apply` revalidates owner, revision, expiry and current time before saving. A selected activity is applied on submission; a schedule needs teacher confirmation of the preview. Both invalidate approval and recheck environmental gates. The older `/week/day/*` routes remain for compatibility and enforce holiday locks.

Whole-week generation supplies all five Monday–Friday dates, with timetable slots only for upcoming dates, plus explicit daily-topic assignments from the brief. Earlier weekdays have empty slot lists. Sessions must cover exactly those slots. `createWeek` repeats the session language, length, content and slot checks at the domain boundary even when a caller already validated the output. Assigned lessons survive seasonal adaptation; per-slot AI descriptions survive refreshes. The model still cannot choose eligibility or trusted evidence.

`settings.gradinka` contains a name and canonical location ID, linked to the existing `groupName`. `group_profiles` stores one reusable settings profile per account. Generation, manual edits and location changes update it; background refreshes of older weeks cannot overwrite it. Deleting a week retains it. Neither real accounts nor demos have child rosters or multi-group administration.

`POST /api/week/day/suggest` validates the account/demo, current revision, upcoming open day and a 1–2,000-character instruction. The model receives educational context and the previous lesson, not identifiers or environmental measurements. A 90-second, 3,000-token strict schema request returns a bilingual single-day preview. Short, complete session titles are requested explicitly to avoid descriptions cut at the schema limit. The preview is held in a bounded in-memory map for ten minutes and limited to twelve requests per owner per hour. It never writes the week. `POST /api/week/day/apply` checks owner, expiry and revision, fetches current conditions, preserves fixed times/custom rows and replaces only the chosen lesson. Past or started eco lessons cannot be replaced. Changes rebuild notices and clear approval. A process restart discards previews. Failures leave the saved day intact.

`POST /api/week/share` idempotently enables or revokes the current week's random 256-bit bearer link. Links are scoped to an account/week and expire after fourteen days. The token is stored in the local database so the teacher can retrieve the same URL; treat that database as private. Deleting a week revokes its link. Demo links live only in the isolated one-hour demo record. Public `GET /api/parents/:token` uses `domain/parent-view.js` to return an explicit allowlist of family-facing fields. No teacher brief, account ID, provider diagnostic, credentials or edit permission is returned. The response is uncached and marked noindex. The URL fragment keeps the token out of the initial HTML request; the subsequent same-origin API request necessarily contains it.

`ParentWeek` is a separate read-only route with day navigation, bilingual notices and printing. It polls every minute while visible; expired/unavailable access clears the previous display. A parent read refreshes current-week conditions when the last check is older than one minute and no owner write is active. During a write it returns the last stored plan screened against available conditions without waiting for the write lock or advancing the stored evidence timestamp. It rechecks revocation after awaited provider work. This is bearer access, not verified parent identity. Loopback hosting still prevents access from other devices.

`services/auto-refresh.js` starts with the HTTP server, scans active weeks on a one-minute interval, skips overlapping ticks and stops on close. Refreshes use the existing per-account lock/revision safeguards. They invalidate approval before upstream work and use deterministic indoor alternatives, with no model calls or outbound notifications. Restarting the server resumes checks of persisted weeks. A stale editor/proposal receives a conflict after a newer save or background revision; no silent merge or overwrite occurs.


## Demo and account feature parity

Demo and authenticated accounts render the same Home dashboard, inline plan builder and change controls, parent-sharing controls and read-only `ParentWeek`. Both use `domain/parent-view.js` for the parent response. Sharing starts disabled and requires the same explicit enable action. Parent reads refresh every minute while visible in both modes.

The demo-only classroom, attendance, daily records, family chat, packing and acknowledgement components and APIs have been removed. Plan reads accept only GET in both modes; the bounded `POST /api/parents/:token/notes` route can submit a private note without editing a plan. Retired classroom/messages demo URLs fall back to the same demo's Home screen, preserving isolation.

Demo data remains synthetic: dated scenarios, fixed clocks, library-generated activities, visible demo labels and scenario controls. Demo state is in memory, expires after one hour and disappears on restart. It never touches real-account tables or calls AI. Deep links survive reloads during the session, including the selected environmental scenario. The six examples include five mornings and a 14:30 autumn afternoon to demonstrate elapsed activities. Real accounts retain private SQLite persistence and live-data/AI integrations.

## Guided teacher setup

Home is the single teacher destination. `CreatePlan` opens inline for first kindergarten setup or regeneration. Successful generation returns to Home. Legacy `#plan` and `#edit` bookmarks open Home; creation bookmarks open setup. The separate `EditWeek` page has been removed.

Opening or cancelling regeneration never modifies the saved week. Failed AI regeneration preserves it. Deletion requires confirmation and retains profile settings on Home.

The creation form validates three sections locally and exposes linked error summaries, required labels and a timetable confirmation. Generation independently checks the required kindergarten, group and brief on the server, while saved-plan editing remains compatible with older settings. Parents open an expiring URL with no login controls or teacher-route links.
