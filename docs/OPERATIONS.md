# Local operation

## Start and stop

Use Node 24+ and `npm.cmd start` from the repository. The app is at http://127.0.0.1:4173. No build or frontend CDN is needed. Stop a foreground server with Ctrl+C. For the hidden development server started by Codex, the process ID is in `.local/server.pid`; verify its command line before stopping that specific process. Do not kill all Node processes.

`.env` is read only at process startup. Keep the existing key server-side and restart after changes. Node's inherited process environment takes precedence over the env file, so check for an existing `OPENAI_API_KEY` environment variable if the file appears to be ignored. Never print the key. `OPENAI_MODEL` must name a model available to that API project.

For a failed generation, expand **Week settings**, then **AI error details** in Edit week, or inspect `week.generationError` in the response. It preserves the HTTP status, recognized provider code and request ID, without raw provider text. These are results from the saved attempt; restarting does not retry or replace an existing library plan. Older saved plans may have only the less precise `generationIssue` field.

`credit_balance_exhausted` means OpenAI reported an empty prepaid balance for the organization used by that request. If credits are available, verify that the `.env` key belongs to that funded organization and project. `insufficient_quota` alone is broader; spending limits and rate limits are reported separately. Do not repeatedly retry billing failures. See the [OpenAI error reference](https://developers.openai.com/api/docs/guides/error-codes). The app remains usable with explicitly labeled library activities.

Generation allows OpenAI up to 180 seconds, and the browser waits up to 240 seconds including environmental/calendar requests. The weekly request uses low reasoning effort for the verified GPT-5.6 Sol/Terra/Luna and GPT-6 Astra families, keeping the configured model and the same validated output. Other model families receive no added reasoning setting. A timeout does not establish that credits are exhausted. There are no automatic retries that could duplicate model charges.

Edit week no longer displays introductory help or an AI regeneration button. Activity times are fixed; edit the lesson text or replace a removed activity in the resulting gap. If generation times out, refresh to check whether the server saved a result before trying again.

To change a day's location, open **Edit week**, expand the day, choose **Inside**, **Outside** or **Adapt to conditions** under **Eco activity location**, then **Save changes**. An eligible explicit Outside choice takes priority over the weekly day target. The server checks conditions and updates the lesson variant and parent drafts. If that choice is blocked, Home shows the reason while retaining the preference for later checks. Closed days, missing eco slots and elapsed activities cannot use this control.

New AI requests include community holidays as lesson context without library title seeds. Existing saved plans receive a missing bilingual holiday discussion in an existing upcoming activity slot on refresh, without replacing teacher text or making a model call. Holiday dates stay separate from preparation dates: an upcoming Monday occasion can inspire Friday's discussion. Only the related lesson is red. On Home, select any activity to read its description in Macedonian or English.

## Persistence

Real accounts, password hashes, session hashes and weekly plans are in `.local/ekocuvar.sqlite`, with SQLite WAL/SHM files while running. Stop the server before making a simple file backup. Do not delete `.local` when restarting. No accounts are pre-created. Demo data is held in memory for at most an hour and disappears after restart. Environmental snapshots live under `.cache/` and retain original timestamps.

## Local scope

The app binds to loopback and permits only localhost/127.0.0.1 Host headers. Its responsive layout can be viewed in a desktop browser’s mobile viewport. It is not currently exposed to other phones/computers on the network.

A public deployment is separate work: HTTPS and Secure cookies, a configured origin instead of the loopback host rule, password/account recovery, operational monitoring, data-retention policy and hosting/backups need concrete deployment choices. No accounts or plans are synchronized to a cloud service in this version.

## Updating activities and routines

Default recurring routines: `backend/domain/settings.js`. Lesson library and educational dates: `backend/domain/curriculum.js`. Actual groups must adjust these examples. Holidays are educational themes; mark closed days explicitly in Edit week. Use both language fields when editing so parent notes stay bilingual.

Generation creates this week’s remaining weekdays, or next Monday–Friday when used on a weekend. There is no arbitrary future-week picker. Plans adapt when the app loads, refreshes, saves an edit, changes location or performs a recheck. While Home remains visible, it refreshes every five minutes. Parents do not receive automatic notifications.

## Ready-to-show examples

Turn on Demo, then use **Example week**. Switching examples creates a fresh isolated demo and resets its air scenario. Your real plan is retained when you turn Demo off. All weather, sensor readings and schedules in these examples are synthetic, including the past dates; no historical measurements or teacher use are claimed.

| Example | Fixed Monday, 08:45 Skopje | What to show |
| --- | --- | --- |
| Independence Day, default | 7 September 2026 | Prepare an eco lesson about Macedonia on Monday; 8 September is marked closed in the example. Mixed sun, rain and wind; polluted Monday moves outdoors to a later eligible day. |
| Easter | 6 April 2026 | Spring conditions, Easter reuse decorations, Thursday preparation and a preset Good Friday closure for this example group. |
| Halloween | 26 October 2026 | Friday preparation for Saturday 31 October, reuse activities and an explicitly optional classroom-occasion label. |
| Winter | 12 January 2026 | Cold conditions, Wednesday snow learning and an indoor alternative. |

All six air scenarios are available for every example. Refreshing, changing location, editing, regenerating or rechecking retains the demo's selected date. Profiles live in `backend/config/demo.js`; preset closures and preparation lessons live in `backend/domain/demo-week.js`. They do not change real-account closure rules.

## Development

`npm.cmd ci` installs only test tooling. `npm.cmd test` tests backend and rendered component behaviour. `npm.cmd run check` checks all JavaScript files. The app itself runs without installing packages. Never commit `.env`, `.local`, `.cache`, `node_modules` or private schedule snapshots.
