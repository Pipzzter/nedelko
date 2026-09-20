# Local operation

## Start and stop

Use Node 24+ and `npm.cmd start` from the repository. The app is at http://127.0.0.1:4173. No build or frontend CDN is needed. Stop a foreground server with Ctrl+C. For the hidden development server started by Codex, the process ID is in `.local/server.pid`; verify its command line before stopping that specific process. Do not kill all Node processes.

`.env` is read only at process startup. Keep the existing key server-side and restart after changes. Node's inherited process environment takes precedence over the env file, so check for an existing `OPENAI_API_KEY` environment variable if the file appears to be ignored. Never print the key. `OPENAI_MODEL` must name a model available to that API project.

For a failed generation, expand **Week settings**, then **AI error details** in Edit week, or inspect `week.generationError` in the response. It preserves the HTTP status, recognized provider code and request ID, without raw provider text. These are results from the saved attempt; restarting does not retry or replace an existing library plan. Older saved plans may have only the less precise `generationIssue` field.

`credit_balance_exhausted` means OpenAI reported an empty prepaid balance for the organization used by that request. If credits are available, verify that the `.env` key belongs to that funded organization and project. `insufficient_quota` alone is broader; spending limits and rate limits are reported separately. Do not repeatedly retry billing failures. See the [OpenAI error reference](https://developers.openai.com/api/docs/guides/error-codes). The app remains usable with explicitly labeled library activities.

Generation allows OpenAI up to 180 seconds, and the browser waits up to 240 seconds including environmental/calendar requests. The weekly request uses low reasoning effort for the verified GPT-5.6 Sol/Terra/Luna and GPT-6 Astra families, keeping the configured model and the same validated output. Other model families receive no added reasoning setting. A timeout does not establish that credits are exhausted. There are no automatic retries that could duplicate model charges.

Edit week offers a review-and-apply AI request for one upcoming day. Activity times are fixed; edit the lesson text or replace a removed activity in the resulting gap. If generation times out, refresh to check whether the server saved a result before trying again.

To change a day's location, open **Edit week**, expand the day, choose **Inside**, **Outside** or **Adapt to conditions** under **Eco activity location**, then **Save changes**. An eligible explicit Outside choice takes priority over the weekly day target. The server checks conditions and updates the lesson variant and parent drafts. If that choice is blocked, Home shows the reason while retaining the preference for later checks. Closed days, missing eco slots and elapsed activities cannot use this control.

New AI requests include community holidays as lesson context without library title seeds. Existing saved plans receive a missing bilingual holiday discussion in an existing upcoming activity slot on refresh, without replacing teacher text or making a model call. Holiday dates stay separate from preparation dates: an upcoming Monday occasion can inspire Friday's discussion. Only the related lesson is red. On Home, select any activity to read its description in Macedonian or English.

## Persistence

Real accounts, password hashes, session hashes, weekly plans, group profiles and expiring parent links are in `.local/ekocuvar.sqlite`, with SQLite WAL/SHM files while running. Stop the server before making a simple file backup. Do not delete `.local` when restarting. No accounts are pre-created. Demo data is held in memory for at most an hour and disappears after restart. Environmental snapshots live under `.cache/` and retain original timestamps.

## Local scope

The app binds to loopback and permits only localhost/127.0.0.1 Host headers. Its responsive layout can be viewed in a desktop browser’s mobile viewport. It is not currently exposed to other phones/computers on the network.

A public deployment is separate work: HTTPS and Secure cookies, a configured origin instead of the loopback host rule, password/account recovery, operational monitoring, data-retention policy and hosting/backups need concrete deployment choices. No accounts or plans are synchronized to a cloud service in this version.

## Updating activities and routines

Default recurring routines: `backend/domain/settings.js`. Lesson library and educational dates: `backend/domain/curriculum.js`. Actual groups must adjust these examples. Holidays are educational themes; mark closed days explicitly in Edit week. Use both language fields when editing so parent notes stay bilingual.

Generation creates this week’s remaining weekdays, or next Monday–Friday when used on a weekend. There is no arbitrary future-week picker. Plans adapt when the app loads, refreshes, saves an edit, changes location or performs a recheck. While Home remains visible, it refreshes every five minutes. The running server also checks active weeks every five minutes without an open browser. The parent page refreshes every minute while visible. Parents do not receive automatic notifications. A sleeping/stopped computer cannot refresh plans.

## Ready-to-show examples

Choose **Explore as teacher / Explore as parent** from the sign-in page, or turn on Demo in an account, then use **Example week**. Switching examples creates a fresh isolated demo and resets its air scenario. Your real plan is retained when you turn Demo off. All weather, sensor readings and schedules in these examples are synthetic, including the past dates; no historical measurements or teacher use are claimed.

| Example | Fixed Monday, Skopje time | What to show |
| --- | --- | --- |
| Independence Day, default | 7 September 2026, 08:45 | Prepare an eco lesson about Macedonia on Monday; 8 September is marked closed in the example. Mixed sun, rain and wind; polluted Monday moves outdoors to a later eligible day. |
| Easter | 6 April 2026, 08:45 | Spring conditions, Easter reuse decorations, Thursday preparation and a preset Good Friday closure for this example group. |
| Halloween | 26 October 2026, 08:45 | Friday preparation for Saturday 31 October, reuse activities and an explicitly optional classroom-occasion label. |
| Winter | 12 January 2026, 08:45 | Cold conditions, Wednesday snow learning and an indoor alternative. |
| Autumn afternoon | 5 October 2026, 14:30 | Twenty-eight present, two absent. Completed meals, rest and individual learning observations; edit a record and view it as the parent. |
| Spring garden | 11 May 2026, 08:45 | Mild weather, plant discovery and arrival-time workflows. |

The teacher has a searchable roster of 30 fictional children. Ana Petrovska sees only her twins Mila and Luka in the same group. In morning examples, 26 children are present, two expected and two absent. Report Luka absent from the parent view, return to the teacher tab to see updated counts, or cancel the absence and check him in. Lunch/rest recording stays disabled until the corresponding time; use the afternoon example to try those controls. Record learning observations, exchange demo messages, check packing items and acknowledge a changed plan. Records synchronize while the views are visible, normally within ten seconds, and survive reloads until the example expires. These controls simulate the product, without sending external messages, saving real child data or calling AI. Typed notes/messages retain the language in which they were entered.

All six air scenarios are available for every example. Refreshing, changing location, editing, regenerating or rechecking retains the demo's selected date. Profiles live in `backend/config/demo.js`; preset closures and preparation lessons live in `backend/domain/demo-week.js`. They do not change real-account closure rules.

## Development

`npm.cmd ci` installs only test tooling. `npm.cmd test` tests backend and rendered component behaviour. `npm.cmd run check` checks all JavaScript files. The app itself runs without installing packages. Never commit `.env`, `.local`, `.cache`, `node_modules` or private schedule snapshots.


## Parent links and daily changes

On Home, choose **Create parent link**, then **Copy link only**. Weekly message copying also uses only the URL once sharing is enabled. Daily copying includes the selected-language notice and its link, so a pollution change can be shared with context. **Disable link** revokes future access. Links expire after fourteen days; a demo link expires with its one-hour example and on restart. Revocation cannot erase information a recipient already copied.

For real accounts, the link opens a weekly activity view with no editing controls. Fictional demo links additionally expose the connected family simulation. Parent pages have no login, registration or teacher-navigation controls; open the teacher and parent views in separate tabs for the showcase. It is accessible to anyone holding the URL, so share it only with the intended group. Do not put child-specific or private staff information in shared activity descriptions. An HTTPS hosted deployment and family-specific revocable links are separate work; the current localhost links work only on this computer.

In Create plan, complete the three guided sections. Kindergarten name, location, group, age range, teaching brief, at least one material and a valid day/routine schedule are required. Confirm the suggested opening hours, meals and rest; changing their times or names resets that confirmation. Validation runs before generation and the server independently requires the essential details. Existing saved plans remain editable even when older profiles lack the new fields. The brief is limited to 2,000 characters and sent to the configured AI provider during generation. It is omitted from parent responses. Library fallback is visibly identified and does not interpret the brief.

In Edit week, save manual changes before requesting a fresh idea for one day. Review the bilingual indoor/outdoor lesson preview, then apply it. Previews expire after ten minutes or when the saved week revision changes. An error preserves the existing lesson. Conditions-based indoor switching is automatic and uses the existing alternate lesson without a new AI charge. Review and share the newly composed parent notice yourself.
