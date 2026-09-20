# Architecture

```text
frontend/
  index.html                  browser entry point
  src/app.js                  session, routing and application state
  src/pages/                  sign-in, create plan, edit week, parent week
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

1. Register or sign in with a username/password. The account starts with no week.
2. Create a week with editable recurring routines, materials, age and weather preferences.
3. The server obtains environmental data and bilingual lesson suggestions. It fills a Monday–Friday timetable; days before today remain empty.
4. For a successful AI generation, the model ranks all five dates for outdoor learning using each generated activity and a sanitized forecast summary. The deterministic scheduler selects from that order only when its air, weather and timetable gates allow the day. Library plans use the deterministic weather score. The remaining eco lessons use their indoor versions.
5. Home refreshes while visible every five minutes. A server worker also refreshes active stored weeks every five minutes without a browser. Refresh, location changes and saved edits recompute the plan and parent drafts. There is no message-delivery service.
6. A separate same-day recheck enables daily message approval for 15 minutes. Rechecking clears the old approval before requesting upstream data, including on failure. Approval is a stored acknowledgement, not a sent message.

`domain/week.js` is the active full-week planner. `domain/planner.js` contains tested low-level window and date helpers as well as the earlier decision primitives. Legacy free-form schedule endpoints and UI are removed.

`domain/day-activities.js` supplies distinct arrival, story, movement, making, quiet-play, collaboration and reflection choices. Four session titles per day may come from validated AI output. An indoor learning block changes for rain, wind, heat, cold or snow, using the selected city's forecast. This library never grants outdoor permission. Rows keep server-owned roles and customization flags so refreshes preserve teacher edits and elapsed sessions. `domain/timeline.js` combines adjacent matching play rows and can consolidate upcoming uncustomized generated play up to 60 minutes. Fixed routines, eco slots, edited rows and elapsed rows are preserved. New generation fills free intervals with longer blocks instead of splitting at every activity-role boundary.

`domain/holidays.js` maps validated events to lesson dates; `config/holiday-snapshot.js` holds a sourced 2026 fallback. `services/holidays.js` discovers and validates official HTML announcements with an injectable fetch, clock and disk cache. The authenticated `GET /api/holidays?year=2026` endpoint shares this importer; an explicit valid demo ID returns only the dated snapshot. Generation and dashboard loading use cached calendar data. New AI requests include public, community and classroom occasions with their actual date, lesson date and scope. Refreshes preserve saved eco lessons. `domain/occasion-activities.js` marks curated/AI lessons covering an occasion and adds a bilingual discussion for uncovered events within an existing upcoming activity slot. It retains actual dates and scope, labels preparation, preserves teacher text and never adds time or closes a day. Server-owned `occasionIds` color only the relevant lesson rows and detail panel.

All real week reads/writes are scoped to the cookie-authenticated account. SQLite writes use revisions; an in-process lock prevents parallel modifications to one account/week. Stale browser revisions receive 409 rather than silently overwriting another edit. Demo records are separate, expiring in-memory examples accessed through opaque IDs. They never write to the real-week table or invoke OpenAI.

`POST /api/week/delete` removes the authenticated account's current week, its notices and approval. SQLite retains only a revision tombstone, preventing old tabs from modifying a newly regenerated week. Demo deletion clears only the isolated example and retains its fixed profile/clock. The frontend confirms deletion, holds the settings in memory, and opens Create plan. It does not delete an existing plan merely by opening the editor.

`pages/EditWeek.js` shows a readable timeline with fixed time labels. `components/InlineText.js` edits titles and lesson paragraphs in the selected language. Enter applies a single-line edit, Escape cancels it, and Save includes any active edit. Day headings toggle their content. Adding an activity requires an unused 30-minute gap and never borrows time. The server rejects changed existing times/kinds and still validates bounds and overlaps. The other language is preserved after a manual edit. `components/DayPlan.js` uses accessible selection buttons to show the chosen activity description in the current language, with full eco lesson details where applicable.

Day location controls submit only `outdoorPreference: auto | inside | outside` through the existing revision-checked edit endpoint. The backend validates the preference, rejects location changes after the eco slot ends, and recomputes the actual `mode`, activity variant and notices. Eligible explicit outdoor choices take priority; automatic days fill the weekly target remaining after elapsed and explicit slots. The preference persists when evidence blocks it, but client-supplied modes or reasons cannot override server checks. Every save clears the morning check and notice approval.

## Authentication and secrets

New usernames require at least eight characters after normalization and trimming. There is no character whitelist or thirty-character cap. Sign-in still accepts existing shorter usernames; passwords retain their separate policy. Usernames are stored with prepared statements and rendered as escaped text.

Passwords use asynchronous scrypt with independent 128-bit salts, N=32768, r=8, p=1, and timing-safe comparison. Random 256-bit session tokens are stored only as SHA-256 hashes. Cookies are HttpOnly, SameSite=Strict, expire after seven days, rotate on sign-in and are revoked on sign-out. Login attempts are rate limited. No password, token or private schedule is logged.

This is a loopback HTTP app. It is not a production HTTPS deployment; see OPERATIONS.md before exposing it. SQLite is a local unencrypted file protected by the computer’s filesystem permissions. The server serves only approved extensions beneath `frontend/`; project files, keys and the database are inaccessible over HTTP.

## AI boundary

The weekly model request has a 180-second deadline and a 10,000-token output budget. It requests low reasoning effort for the verified GPT-5.6 Sol/Terra/Luna and GPT-6 Astra model families; the configured model is retained. The client refuses redirects, bounds the provider body to 1 MB, and still rejects incomplete or invalid output. The browser gives `/api/week/generate` 240 seconds including upstream preparation; day suggestions have a 120-second browser deadline; other browser requests keep their 60-second deadline. Node's `requestTimeout` bounds receipt of the incoming request, not model processing, and stays at 60 seconds. See the [official reasoning guidance](https://developers.openai.com/api/docs/guides/reasoning) and [GPT-5.6 Terra model reference](https://developers.openai.com/api/docs/models/gpt-5.6-terra).

Home and Edit week show AI/library provenance and a visible failure reason. Mixed weeks identify AI revisions to individual days. Provider diagnostics remain under Week settings. The existing authenticated, revision-checked generation route still supports `requireAI: true` and returns `ai_retry_failed` before replacing a saved plan if generation falls back. A successful replacement still requires a new same-day recheck.

`services/curriculum.js` uses the existing Responses API client with strict JSON Schema and `store:false`. Input contains dates, a variation seed, age range, material IDs, season, the teacher brief, all supplied occasions and a sanitized per-day forecast summary. No library titles or sample lessons are supplied. Account IDs, kindergarten/group names, raw sensor readings, AQI and PM2.5 values are excluded. Teachers are asked to omit child names and private details from the free-text brief; the application does not claim automatic anonymization of that text. The server first supplies a `serverEligible` result from deterministic gates and the best available timetable window. Output must contain exactly five bilingual educational goals, indoor/outdoor variants, habits, four distinct indoor session titles per day and every supplied date exactly once in `outdoorOrder`. The schema constrains string lengths and selected material IDs to match domain limits. The server independently validates text lengths, language pairs, material IDs and the exact date permutation and rejects selected markup/instruction/air-safety patterns. It also requires the first occasion's name in the title and every occasion's name in both activity variants, in both languages. This checks visible coverage, not educational quality; lessons remain editable for the teacher. Other model calls retain their 25-second API deadline. The request uses the existing configured model. The structured-output request follows the [official OpenAI Responses API](https://developers.openai.com/api/reference/cli/resources/responses/methods/create).

The model chooses a preferred outdoor-date order from the server-approved candidates. It does not read raw sensor data, determine closures, calculate AQI, relax a weather limit or write the factual weather/air portions of notices. `domain/week.js` filters the model order through current evidence, so an ineligible date is indoors even when ranked first. When evidence changes, the next eligible ranked date receives the outdoor slot. Parent drafts are composed deterministically from the accepted plan. Without a successful model request, the source is explicitly `library`, the deterministic score chooses among eligible days and the app remains usable.

A failed generation carries a bounded public reason. `services/ai-errors.js` distinguishes exhausted credits, quota restrictions, spending limits, rate limits, authentication, access, model availability and timeouts. Only the explicit provider code `credit_balance_exhausted` becomes `ai_credits`; the broader `insufficient_quota` does not prove that the balance is empty. `generationError` retains the HTTP status, allowlisted provider code/type and a bounded request ID. Raw provider messages, credentials and private input are never returned. These details belong to the account's saved week and can be expanded in Edit week. They describe the generation attempt, not a current billing balance. No automatic retries occur on billing failures.

Library regeneration varies available lesson/session choices using a server-generated seed; it is still labeled as library content. The AI rank is stored with the generated week. Refreshes and city changes do not spend tokens on another generation call; they reapply current deterministic gates to that order and skip blocked dates. Equivalent conditions can correctly retain the same plan.


## Kindergarten profile, single-day proposals and parent access

`settings.gradinka` contains a name and canonical location ID, linked to the existing `groupName`. `group_profiles` stores one reusable settings profile per account. Generation, manual edits and location changes update it; background refreshes of older weeks cannot overwrite it. Deleting a week retains it. Real accounts have no roster or multi-group administration; the synthetic demo has a separate classroom simulation.

`POST /api/week/day/suggest` validates the account/demo, current revision, upcoming open day and a 1–2,000-character instruction. The model receives educational context and the previous lesson, not identifiers or environmental measurements. A 90-second, 3,000-token strict schema request returns a bilingual single-day preview. Short, complete session titles are requested explicitly to avoid descriptions cut at the schema limit. The preview is held in a bounded in-memory map for ten minutes and limited to twelve requests per owner per hour. It never writes the week. `POST /api/week/day/apply` checks owner, expiry and revision, fetches current conditions, preserves fixed times/custom rows and replaces only the chosen lesson. Past or started eco lessons cannot be replaced. Changes rebuild notices and clear approval. A process restart discards previews. Failures leave the saved day intact.

`POST /api/week/share` enables, rotates or revokes the current week's random 256-bit bearer link. Links are scoped to an account/week and expire after fourteen days. The token is stored in the local database so the teacher can retrieve the same URL; treat that database as private. Deleting a week revokes its link. Demo links live only in the isolated one-hour demo record. Public `GET /api/parents/:token` uses `domain/parent-view.js` to return an explicit allowlist of family-facing fields. No teacher brief, account ID, provider diagnostic, credentials or edit permission is returned. The response is uncached and marked noindex. The URL fragment keeps the token out of the initial HTML request; the subsequent same-origin API request necessarily contains it.

`ParentWeek` is a separate read-only route with day navigation, bilingual notices and printing. It polls every minute while visible; expired/unavailable access clears the previous display. A parent read refreshes current-week conditions when the last check is older than five minutes. This is bearer access, not verified parent identity. Loopback hosting still prevents access from other devices.

`services/auto-refresh.js` starts with the HTTP server, scans active weeks on a five-minute interval, skips overlapping ticks and stops on close. Refreshes use the existing per-account lock/revision safeguards. They invalidate approval before upstream work and use deterministic indoor alternatives, with no model calls or outbound notifications. Restarting the server resumes checks of persisted weeks. A stale editor/proposal receives a conflict after a newer save or background revision; no silent merge or overwrite occurs.


## Connected classroom demo

`domain/demo-classroom.js` owns a pure, versioned classroom fixture: 30 fictional children, one lead teacher and assistant, and a family with two children. Teacher views include the roster, age at the simulated date, arrival/pickup, learning interests/goals, family instructions and daily records. Family views are explicitly projected to two child IDs and omit the other 28 children. Seeded copy is bilingual; typed notes/messages are retained verbatim. Ages, attendance counts and meal/rest availability derive from the fixed example clock rather than decorative metrics.

`GET/POST /api/demo/classroom` reads or edits the demo identified by its opaque ID. Teacher actions include attendance, check-in of expected children, daily records and messages. `POST /api/parents/:token/demo` requires a current demo parent token, accepts only that family's permitted absence/checklist/acknowledgement/message actions, and rejects real-account tokens. Classroom revisions are separate from week revisions, preventing lost updates without invalidating curriculum previews. Origin, body-size and revision checks apply to both mutation routes. Acknowledgements bind to today's date, mode and reason, so changed conditions need a fresh acknowledgement. Neither messages nor acknowledgements imply external delivery.

All demo state is in memory, expires after one hour and disappears on restart. It never touches real-account tables or sends child records to AI. The teacher demo links to the synthetic family page. The parent page contains no teacher switch or login; possession of the family URL grants access to that projection. Deep links survive reloads during the session, including the selected environmental scenario. Visible teacher and parent views poll classroom state every ten seconds. The six examples include five mornings and a 14:30 autumn afternoon with completed records.

## Guided teacher setup

Create plan validates three sections locally and exposes linked error summaries, required labels and a timetable confirmation. Generation independently checks the required kindergarten, group and brief on the server, while saved-plan editing remains compatible with older settings. Parents open an expiring URL with no login controls or teacher-route links.
