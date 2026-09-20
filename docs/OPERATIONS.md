# Local operation

## Start and stop

Use Node 24+ and `npm.cmd start` from the repository. The app is at http://127.0.0.1:4173. No build or frontend CDN is needed. Stop a foreground server with Ctrl+C. For the hidden development server started by Codex, the process ID is in `.local/server.pid`; verify its command line before stopping that specific process. Do not kill all Node processes.

`.env` is read only at process startup. Keep the existing key server-side and restart after changes. Node's inherited process environment takes precedence over the env file, so check for an existing `OPENAI_API_KEY` environment variable if the file appears to be ignored. Never print the key. `OPENAI_MODEL` must name a model available to that API project.

Home shows the public failure reason. Bounded diagnostics remain available in `week.generationError` in an authenticated response: HTTP status, recognized provider code and request ID, without raw provider text. Restarting does not retry or replace a saved plan.

`credit_balance_exhausted` means OpenAI reported an empty prepaid balance for the organization used by that request. If credits are available, verify that the `.env` key belongs to that funded organization and project. `insufficient_quota` alone is broader; spending limits and rate limits are reported separately. Do not repeatedly retry billing failures. See the [OpenAI error reference](https://developers.openai.com/api/docs/guides/error-codes). The app remains usable with explicitly labeled library activities.

Generation allows OpenAI up to 180 seconds, and the browser waits up to 240 seconds including environmental/calendar requests. The weekly request uses low reasoning effort for the verified GPT-5.6 Sol/Terra/Luna and GPT-6 Astra families, keeping the configured model and the same validated output. Other model families receive no added reasoning setting. A timeout does not establish that credits are exhausted. There are no automatic retries that could duplicate model charges.

On Home, select an activity and choose **Change activity**. Submitting replaces only that item. **Change schedule** accepts activity and time changes, displays a complete proposal and requires confirmation. If generation times out, refresh to check whether a result was saved before retrying.

On Home, select the day and choose **Inside**, **Outside** or **Adapt to conditions** under **Activity location**. The choice saves immediately. Eligible explicit Outside choices take priority over the weekly target; the server still enforces observation and weather gates. Blocked choices remain saved for later checks.

New AI requests include community holidays as lesson context without library title seeds. Existing saved plans receive a missing bilingual holiday discussion in an existing upcoming activity slot on refresh, without replacing teacher text or making a model call. Holiday dates stay separate from preparation dates: an upcoming Monday occasion can inspire Friday's discussion. Only the related lesson is red. On Home, select any activity to read its description in Macedonian or English.

## Persistence

Real accounts, password hashes, session hashes, weekly plans, group profiles and expiring parent links are in `.local/ekocuvar.sqlite`, with SQLite WAL/SHM files while running. Stop the server before making a simple file backup. Do not delete `.local` when restarting. No accounts are pre-created. Demo data is held in memory for at most an hour and disappears after restart. Environmental snapshots live under `.cache/` and retain original timestamps.

## Local scope

The app binds to loopback and permits only localhost/127.0.0.1 Host headers. Its responsive layout can be viewed in a desktop browser’s mobile viewport. It is not currently exposed to other phones/computers on the network.

A public deployment is separate work: HTTPS and Secure cookies, a configured origin instead of the loopback host rule, password/account recovery, operational monitoring, data-retention policy and hosting/backups need concrete deployment choices. No accounts or plans are synchronized to a cloud service in this version.

## Updating activities and routines

Default recurring routines live in `backend/domain/settings.js`; educational dates and the lesson library live in `backend/domain/curriculum.js`. Confirm routine times during setup. Meal, sleep and holiday content stays protected during day edits. The model returns both language versions. Holiday context alone does not establish a closure.

Generation creates this week’s remaining weekdays, or next Monday–Friday when used on a weekend. There is no arbitrary future-week picker. Plans adapt when the app loads, refreshes, saves an edit, changes location or performs a recheck. While Home remains visible, it refreshes every minute. The running server also checks active weeks every minute without an open browser. The parent page refreshes every minute while visible. Parents do not receive automatic notifications. A sleeping/stopped computer cannot refresh plans.

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

`npm.cmd ci` installs only test tooling. `npm.cmd test` tests backend and rendered component behaviour. `npm.cmd run check` checks all JavaScript files. The app itself runs without installing packages. Never commit `.env`, `.local`, `.cache`, `node_modules` or private schedule snapshots.


## Parent links and daily changes

On Home, choose **Create parent link**, then **Copy link only**. Weekly message copying also uses only the URL once sharing is enabled. Daily copying includes the selected-language notice and its link, so a pollution change can be shared with context. **Disable link** revokes future access. Links expire after fourteen days; a demo link expires with its one-hour example and on restart. Revocation cannot erase information a recipient already copied.

Both account and demo links open the same read-only weekly activity view. Parent pages have no login, registration or teacher-navigation controls; open the teacher and parent views in separate tabs for the showcase. The page is accessible to anyone holding the URL, so share it only with the intended group. Do not put child-specific or private staff information in shared activity descriptions. An HTTPS hosted deployment and family-specific revocable links are separate work; the current localhost links work only on this computer.

Home starts with **Create kindergarten**. Kindergarten name, location, group, age range, teaching brief, materials, daily meals and rest are required. Confirm routine times before generation. The server validates the same essentials. The brief is limited to 2,000 characters, sent to the configured AI provider and omitted from parent responses. Explicit daily-topic requests are assigned across remaining weekdays and checked for visible coverage.

Schedule proposals expire after ten minutes or any change to the saved revision. An error preserves the saved plan. Condition-based indoor switching uses the existing alternate lesson without a new model call. Parent notices still require their same-morning recheck and teacher approval.

## Planning navigation

Home contains setup, the calendar, selected-day editing, messages and sharing. **Manage week** contains **Regenerate week** and **Delete week**. Cancelling or failed regeneration preserves the saved plan. Deletion requires confirmation and retains settings. Older weekly-plan URLs open Home; create URLs open the inline setup state.
