# Local operation

## Start and stop

Use Node 24+ and `npm.cmd start` from the repository. The app is at http://127.0.0.1:4173. No build or frontend CDN is needed. Stop a foreground server with Ctrl+C. For the hidden development server started by Codex, the process ID is in `.local/server.pid`; verify its command line before stopping that specific process. Do not kill all Node processes.

While changing backend code, use `npm run dev` (`npm.cmd run dev` on Windows). It restarts the server when imported backend modules change. `npm start` loads backend modules only once, but frontend files are read from disk on each request. Leaving an older process running after adding an endpoint can therefore show new controls whose requests return `404 {"error":"not_found"}`. Stop that app process and restart it from the current checkout, then reload the page. A page reload alone cannot update the server. Saved account plans and sessions remain in SQLite; in-memory demos expire on restart.

After changing API routes, run `npm --prefix api-tests run test:local` against the app the browser actually uses. The [Postman suite](../development/api-tests.md) checks direct content editing, drag/arrow reorder requests, explicit time boundaries and persistence after refresh. Tests against an isolated server do not establish that an already-running process has loaded the same code.

`.env` is read only at process startup. Keep the existing key server-side and restart after changes. Node's inherited process environment takes precedence over the env file, so check for an existing `OPENAI_API_KEY` environment variable if the file appears to be ignored. Never print the key. `OPENAI_MODEL` must name a model available to that API project. The current example selects `gpt-5.6-sol` with `OPENAI_SERVICE_TIER=fast`. All weekly, daily and parent-note AI requests pass this tier through the shared Responses API client. `fast` has premium pricing; `priority` is an equivalent request value for supported models. Use `default` for standard processing or `auto` to follow the API project setting. An absent/blank setting resolves to `auto` for existing deployments. `/api/config` reports the requested tier as `ai.serviceTier`, not the tier actually served.

The shared client's `processing` result records model, requested tier, returned `service_tier` and elapsed milliseconds without prompts or credentials. A Fast request can return `priority` or be served as `default`; missing tier metadata remains null. These diagnostics are internal provider-call results, not new fields on stored weeks. Do not infer a measured speedup from configuration alone. The separate `ultrafast` tier is access-controlled for Sol and is not enabled by this configuration. Unsupported/access-denied tier requests use the existing error handling; there is no silent retry or downgrade by the app. See [Fast mode](https://developers.openai.com/api/docs/guides/fast-mode) and the [Responses API](https://developers.openai.com/api/reference/cli/resources/responses/methods/create).

Home omits the saved generation-warning banner. Library or mixed-source information is available inside Manage week. Failed new requests still show their actionable error. Bounded diagnostics remain available in `week.generationError` in an authenticated response: HTTP status, recognized provider code and request ID, without raw provider text. Restarting does not retry or replace a saved plan.

`credit_balance_exhausted` means OpenAI reported an empty prepaid balance for the organization used by that request. If credits are available, verify that the `.env` key belongs to that funded organization and project. `insufficient_quota` alone is broader; spending limits and rate limits are reported separately. Do not repeatedly retry billing failures. See the [OpenAI error reference](https://developers.openai.com/api/docs/guides/error-codes). Existing saved plans and explicit library demos remain available. A new real-account plan requires successful AI generation; a failed first attempt leaves the account without a plan, while retaining the form input.

Weekly generation allows OpenAI up to 220 seconds and 30,000 output tokens, and the browser waits up to 270 seconds including environmental/calendar requests. The weekly request uses medium reasoning effort for the verified GPT-5.6 Sol/Terra/Luna and GPT-6 Astra families, keeping the configured model and the same validated output. Other model families receive no added reasoning setting. A timeout does not establish that credits are exhausted. There are no automatic retries that could duplicate model charges.

Day/schedule model calls have a 90-second deadline and note assessment has 45 seconds. A parent-note suggestion can involve more than one call. Browser deadlines are 120 seconds for day/schedule suggestions, 190 seconds for note suggestions and 60 seconds for other requests; these are distinct from the server's request-body and header timeouts. A disconnected HTTP response cancels its model request and prevents a late provider result from being saved. Cancellation cannot guarantee reversal of provider charges already incurred.

Authenticated weekly generation is limited to six attempts per account per hour, before provider work. Demo generation is exempt. Holiday reads allow 30 requests per account or demo per hour. These process-memory counters reset on restart; a shared network address does not merge separate owners' limits. A `429` response preserves the saved plan.

The opt-in `npm run verify:ai` command makes a paid live model request and requires server-side provider configuration. It uses an isolated in-memory account, fixed synthetic conditions and the bundled holiday snapshot, and rejects library fallback. It writes only a bounded, privacy-checked evidence projection under [docs/evidence](../evidence/README.md). Normal tests and push gates do not run it.

On Home, select an activity and choose **Change activity**. Submitting replaces only that item. **Change schedule** applies the validated timetable after the teacher submits the request. Parent-note suggestions retain a separate review and Apply action. If generation times out, refresh to check whether a result was saved before retrying.

On Home, select the day and choose **Inside**, **Outside** or **Adapt to conditions** under **Activity location**. The choice saves immediately. Eligible explicit Outside choices take priority over the weekly target; the server still enforces observation and weather gates. Blocked choices remain saved for later checks.

New AI requests include community holidays as lesson context without library title seeds. Existing saved plans receive a missing bilingual holiday discussion in an existing upcoming activity slot on refresh, without replacing teacher text or making a model call. Holiday dates stay separate from preparation dates: an upcoming Monday occasion can inspire Friday's discussion. Only the related lesson is red. On Home, select any activity to read its description in Macedonian or English.

## Persistence

Real accounts, password hashes, session hashes, weekly plans, group profiles and expiring parent links use SQLite, with WAL/SHM files while running. New installations use `.local/nedelko.sqlite`. If that file is absent and `.local` contains one existing `.sqlite` file, the app reuses it without copying, renaming or resetting data. If there are multiple candidates, startup fails rather than guessing; set `NEDELKO_DATABASE_PATH` to the intended file, using an absolute path or a path relative to the repository root. Stop the server before making a simple file backup, and keep backup copies outside `.local`. Do not delete `.local` when restarting. No accounts are pre-created. Demo data is held in memory for at most an hour and disappears after restart. Environmental snapshots live under `.cache/` and retain original timestamps.

The session cookie is `nedelko_session`, and browser preferences use `nedelko-language` and `nedelko-visited`. After upgrading an existing installation, sign in again and reselect the language if needed. Account data and parent-link tokens are unchanged. See [ADR-0009](../architecture/adrs/0009-nedelko-product-identity.md).

## Local scope

The responsive app has recorded desktop and 390-pixel browser checks; a physical-phone run is not established by that evidence. Native startup binds to loopback and permits only localhost/127.0.0.1 Host headers. In [Docker](docker.md), the process binds the container interface while Compose publishes only on host loopback; the same HTTP Host/origin checks still apply. The default local start command does not expose the app to other devices on the network.

A public deployment is separate work: HTTPS and Secure cookies, a configured origin instead of the loopback host rule, password/account recovery, operational monitoring, data-retention policy and hosting/backups need concrete deployment choices. No accounts or plans are synchronized to a cloud service in this version.

## Updating activities and routines

Default recurring routines live in `backend/domain/settings.js`; educational dates and the lesson library live in `backend/domain/curriculum.js`. Confirm routine times during setup. Teachers can edit bilingual content, reorder upcoming activities or change times, including meals, rest and holiday lessons. Only already-started rows are locked. Overlaps shift subsequent rows while preserving duration; gaps and explicit extensions beyond default hours are allowed. The model returns both languages. Holiday context alone does not establish a closure.

Generation creates this week’s remaining weekdays, or next Monday–Friday when used on a weekend. There is no arbitrary future-week picker. Plans adapt when the app loads, refreshes, saves an edit, changes location or performs a recheck. While Home remains visible, it refreshes every minute without a waiting modal or disabling a focused editor. Unsaved draft text and the selected demo scenario are retained. The running server also checks active weeks every minute without an open browser. The parent page refreshes every minute while visible. Parents do not receive automatic notifications. A sleeping/stopped computer cannot refresh plans.

## Ready-to-show examples

Choose **Explore a sample week** from the sign-in page, or turn on Demo in an account, then use **Example week**. Demo and account modes have the same planning features and parent page. Switching examples creates a fresh isolated demo and resets its air scenario. Your real plan is retained when you turn Demo off. All weather, sensor readings and schedules in these examples are synthetic, including the past dates; no historical measurements or teacher use are claimed.

| Example | Fixed Monday, Skopje time | What to show |
| --- | --- | --- |
| Independence Day, default | 7 September 2026, 08:45 | Prepare an eco lesson about Macedonia on Monday; 8 September is marked closed in the example. Mixed sun, rain and wind; polluted Monday moves outdoors to a later eligible day. |
| Easter | 6 April 2026, 08:45 | Spring conditions, Easter reuse decorations, Thursday preparation and a preset Good Friday closure for this example group. |
| Halloween | 26 October 2026, 08:45 | Friday preparation for Saturday 31 October, reuse activities and an explicitly optional classroom-occasion label. |
| Winter | 12 January 2026, 08:45 | Cold conditions, Wednesday snow learning and an indoor alternative. |
| Autumn afternoon | 5 October 2026, 14:30 | Elapsed morning activities and the remaining afternoon timetable; show how edits preserve past activities. |
| Spring garden | 11 May 2026, 08:45 | Mild weather, plant discovery and the morning timetable. |

Use the same end-to-end flow as an account: review the sample week, change an editable activity, then choose **Create parent link** and **Preview as a parent** on Home. Keep the parent page in another tab and change the demo air scenario to show an updated indoor/outdoor plan. Parent pages refresh every minute while visible, or immediately after reloading. Neither mode includes child rosters, attendance records, family chat or packing acknowledgements. Demo sessions expire after an hour or a server restart and never call AI.

All six air scenarios are available for every example. Refreshing, changing location, editing, regenerating or rechecking retains the demo's selected date. Profiles live in `backend/config/demo.js`; preset closures and preparation lessons live in `backend/domain/demo-week.js`. They do not change real-account closure rules.

## Development

`npm.cmd ci` installs only test tooling. Run `npm run hooks:install` once per clone to activate the required push gate; see [quality gates](../development/quality-gates.md). `npm.cmd test` tests backend and rendered component behaviour. `npm.cmd run check` checks all JavaScript files. The app itself runs without installing packages. Never commit `.env`, `.local`, `.cache`, `node_modules` or private schedule snapshots.


## Parent links and daily changes

On Home, choose **Create parent link**, then **Copy link only**. Both weekly and daily message copying include the selected-language notice and its enabled link, so a pollution change can be shared with context. **Disable link** revokes future access. Links expire after fourteen days; a demo link expires with its one-hour example and on restart. Revocation cannot erase information a recipient already copied.

Both account and demo links open the same read-only weekly activity view. Parent pages have no login, registration or teacher-navigation controls; open the teacher and parent views in separate tabs for the showcase. The page is accessible to anyone holding the URL, so share it only with the intended group. Do not put child-specific or private staff information in shared activity descriptions. An HTTPS hosted deployment and family-specific revocable links are separate work; the current localhost links work only on this computer.

Registration captures kindergarten name, teacher name, location and age range. The kindergarten name supplies the group name. Plan generation requires a teaching brief and selected materials; recurring meals and rest are editable and may be omitted. Confirm the daily rhythm before generation. The server validates these essentials. The brief is limited to 2,000 characters, sent to the configured AI provider and omitted from parent responses. Explicit daily-topic requests are assigned across remaining weekdays and checked for visible coverage.

Schedule proposals expire after ten minutes or any change to the saved revision. Dashboard reads keep that edit revision stable, but clear approval and invalidate pending day/schedule proposals when refreshing conditions. An error preserves the saved plan. Condition-based indoor switching uses the existing alternate lesson without a new model call. Parent notices still require their same-morning recheck and teacher approval.

## Planning navigation

Home contains setup, the calendar, selected-day editing, messages and sharing. **Manage week** contains **Regenerate week** and **Delete week**. Cancelling or failed regeneration preserves the saved plan. Deletion requires confirmation and retains settings. Older weekly-plan URLs open Home; create URLs open the inline setup state.

Parent notes are stored in the `parent_notes` table in the same account database. An owner can read their inbox across saved weeks; anonymous parent links can only submit a note to their linked week. Notes are limited to 1,200 characters, 30 submissions per link per hour and 250 notes per week. A note submission ID makes retries idempotent. Parent links remain read-only for all plan changes. Demo notes disappear on restart. Include `parent_notes` when deliberately resetting local application data; restarting normally must retain it.
