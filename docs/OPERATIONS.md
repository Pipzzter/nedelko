# Local operation

## Start and stop

Use Node 24+ and `npm.cmd start` from the repository. The app is at http://127.0.0.1:4173. No build or frontend CDN is needed. Stop a foreground server with Ctrl+C. For the hidden development server started by Codex, the process ID is in `.local/server.pid`; verify its command line before stopping that specific process. Do not kill all Node processes.

`.env` is read only at process startup. Keep the existing key server-side and restart after changes. Node's inherited process environment takes precedence over the env file, so check for an existing `OPENAI_API_KEY` environment variable if the file appears to be ignored. Never print the key. `OPENAI_MODEL` must name a model available to that API project.

For a failed generation, expand **Week settings**, then **AI error details** in Weekly plan, or inspect `week.generationError` in the response. It preserves the HTTP status, recognized provider code and request ID, without raw provider text. These are results from the saved attempt; restarting does not retry or replace an existing library plan. Older saved plans may have only the less precise `generationIssue` field.

`credit_balance_exhausted` means OpenAI reported an empty prepaid balance for the organization used by that request. If credits are available, verify that the `.env` key belongs to that funded organization and project. `insufficient_quota` alone is broader; spending limits and rate limits are reported separately. Do not repeatedly retry billing failures. See the [OpenAI error reference](https://developers.openai.com/api/docs/guides/error-codes). The app remains usable with explicitly labeled library activities.

Generation allows OpenAI up to 180 seconds, and the browser waits up to 240 seconds including environmental/calendar requests. The weekly request uses low reasoning effort for the verified GPT-5.6 Sol/Terra/Luna and GPT-6 Astra families, keeping the configured model and the same validated output. Other model families receive no added reasoning setting. A timeout does not establish that credits are exhausted. There are no automatic retries that could duplicate model charges.

Weekly plan offers a review-and-apply AI request for one upcoming day. Activity times are fixed; edit the lesson text or replace a removed activity in the resulting gap. If generation times out, refresh to check whether the server saved a result before trying again.

To change a day's location, open **Weekly plan**, expand the day, choose **Inside**, **Outside** or **Adapt to conditions** under **Eco activity location**, then **Save changes**. An eligible explicit Outside choice takes priority over the weekly day target. The server checks conditions and updates the lesson variant and parent drafts. If that choice is blocked, Home shows the reason while retaining the preference for later checks. Closed days, missing eco slots and elapsed activities cannot use this control.

New AI requests include community holidays as lesson context without library title seeds. Existing saved plans receive a missing bilingual holiday discussion in an existing upcoming activity slot on refresh, without replacing teacher text or making a model call. Holiday dates stay separate from preparation dates: an upcoming Monday occasion can inspire Friday's discussion. Only the related lesson is red. On Home, select any activity to read its description in Macedonian or English.

## Persistence

Real accounts, password hashes, session hashes, weekly plans, group profiles and expiring parent links are in `.local/ekocuvar.sqlite`, with SQLite WAL/SHM files while running. Stop the server before making a simple file backup. Do not delete `.local` when restarting. No accounts are pre-created. Demo data is held in memory for at most an hour and disappears after restart. Environmental snapshots live under `.cache/` and retain original timestamps.

## Local scope

The app binds to loopback and permits only localhost/127.0.0.1 Host headers. Its responsive layout can be viewed in a desktop browser’s mobile viewport. It is not currently exposed to other phones/computers on the network.

A public deployment is separate work: HTTPS and Secure cookies, a configured origin instead of the loopback host rule, password/account recovery, operational monitoring, data-retention policy and hosting/backups need concrete deployment choices. No accounts or plans are synchronized to a cloud service in this version.

## Updating activities and routines

Default recurring routines: `backend/domain/settings.js`. Lesson library and educational dates: `backend/domain/curriculum.js`. Actual groups must adjust these examples. Holidays are educational themes; mark closed days explicitly in Weekly plan. Use both language fields when editing so parent notes stay bilingual.

Generation creates this week’s remaining weekdays, or next Monday–Friday when used on a weekend. There is no arbitrary future-week picker. Plans adapt when the app loads, refreshes, saves an edit, changes location or performs a recheck. While Home remains visible, it refreshes every five minutes. The running server also checks active weeks every five minutes without an open browser. The parent page refreshes every minute while visible. Parents do not receive automatic notifications. A sleeping/stopped computer cannot refresh plans.

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

Use the same end-to-end flow as an account: review the sample week, edit an activity, save, then choose **Create parent link** and **Open parent view** on Home. Keep the parent page in another tab and change the demo air scenario to show an updated indoor/outdoor plan. Parent pages refresh every minute while visible, or immediately after reloading. Neither mode includes child rosters, attendance records, family chat or packing acknowledgements. Demo sessions expire after an hour or a server restart and never call AI.

All six air scenarios are available for every example. Refreshing, changing location, editing, regenerating or rechecking retains the demo's selected date. Profiles live in `backend/config/demo.js`; preset closures and preparation lessons live in `backend/domain/demo-week.js`. They do not change real-account closure rules.

## Development

`npm.cmd ci` installs only test tooling. `npm.cmd test` tests backend and rendered component behaviour. `npm.cmd run check` checks all JavaScript files. The app itself runs without installing packages. Never commit `.env`, `.local`, `.cache`, `node_modules` or private schedule snapshots.


## Parent links and daily changes

On Home, choose **Create parent link**, then **Copy link only**. Weekly message copying also uses only the URL once sharing is enabled. Daily copying includes the selected-language notice and its link, so a pollution change can be shared with context. **Disable link** revokes future access. Links expire after fourteen days; a demo link expires with its one-hour example and on restart. Revocation cannot erase information a recipient already copied.

Both account and demo links open the same read-only weekly activity view. Parent pages have no login, registration or teacher-navigation controls; open the teacher and parent views in separate tabs for the showcase. The page is accessible to anyone holding the URL, so share it only with the intended group. Do not put child-specific or private staff information in shared activity descriptions. An HTTPS hosted deployment and family-specific revocable links are separate work; the current localhost links work only on this computer.

In Weekly plan, an empty week opens the three guided setup sections. Kindergarten name, location, group, age range, teaching brief, at least one material and a valid day/routine schedule are required. Confirm the suggested opening hours, meals and rest; changing their times or names resets that confirmation. Validation runs before generation and the server independently requires the essential details. Existing saved plans remain editable even when older profiles lack the new fields. The brief is limited to 2,000 characters and sent to the configured AI provider during generation. It is omitted from parent responses. Library fallback is visibly identified and does not interpret the brief.

In Weekly plan, save manual changes before requesting a fresh idea for one day. Review the bilingual indoor/outdoor lesson preview, then apply it. Previews expire after ten minutes or when the saved week revision changes. An error preserves the existing lesson. Conditions-based indoor switching is automatic and uses the existing alternate lesson without a new AI charge. Review and share the newly composed parent notice yourself.

## Planning navigation

Use **Home** for the dashboard and **Weekly plan** for creation or editing. The empty Home calendar also opens Weekly plan. After generation, review the week in the editor. **Regenerate week** opens the existing settings with a replacement explanation; save pending edits first. Cancelling returns to the editor, and a failed generation keeps the saved plan. **Delete week** still requires confirmation and returns Weekly plan to setup while retaining settings. Old create/edit bookmarks remain usable in both account and demo modes.
