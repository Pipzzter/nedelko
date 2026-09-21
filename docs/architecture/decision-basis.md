# Decision basis

Parent-link creation is an idempotent access-setting operation scoped to the authenticated owner (or isolated demo). It does not require a plan revision and does not compete with background refresh locks, because it changes no lesson or timetable. Repeated creation, plan edits, refreshes, regeneration of the same week and renewal after expiry retain the URL. Rotation is rejected. Explicit disabling or deleting the week revokes access. The parent URL authorizes only the bounded read-only projection, never a teacher mutation.

These are transparent prototype rules, not medical certification, official kindergarten policy or proof that outdoor conditions are safe.

## Observations

`services/conditions.js` fetches the selected city’s pulse.eco sensor catalog, current PM2.5 observations and recent hourly history. `domain/qc.js` screens up to five active sensors within 5 km of the selected city/neighbourhood centre. This is not the kindergarten’s precise position.

- Measurement age must be at most 60 minutes. Fetch time cannot renew a measurement.
- Timestamps and numbers must be valid; future, negative or malformed observations fail.
- NowCast requires at least two of the most recent three hourly buckets and retains missing-hour positions in its weighting.
- Values at or above 500 µg/m³, a rise over 35 µg/m³ and more than twice the preceding reading, and a nonzero signal stuck for six hours require review. These are conservative prototype QC policies, not EPA certification of the sensors.
- At least two sensors must pass. A spread above 25 µg/m³ and a greater-than-twofold ratio makes the result unknown.
- Use the highest valid nearby sensor NowCast, not an invented average monitor. EPA May 2024 PM2.5 AQI breakpoints apply.

Missing, stale, conflicting or failed-refresh evidence makes the current outdoor decision unavailable. Historical data may be displayed but cannot produce a fresh positive recommendation. A current PM2.5 AQI above 100 switches today’s eco activity indoors.

## Weather and air forecasts

Open-Meteo provides hourly temperature, apparent temperature, precipitation probability/amount, wind and WMO weather code. CAMS Europe via Open-Meteo provides a regional PM2.5 forecast at approximately 11 km resolution. A requested seven-day response does not mean that seven days contain usable air forecasts; null hours remain unknown. A forecast is not a future NowCast or a local observation.

For the eco slot, all touched hours need usable weather data. Default teacher logistics preferences are apparent temperature 3–32 °C, precipitation probability at most 55%, precipitation at most 0.5 mm/hour and wind at most 30 km/h. The teacher can edit the exposed temperature, precipitation probability/amount and wind preferences. These are organizational choices, not health thresholds. Forecast thunderstorms and freezing precipitation also block that slot.

Every touched hour of a future eco slot needs a finite, nonnegative PM2.5 forecast and an available forecast source. Any value above 35.4 µg/m³ blocks the slot. Missing or partial future air forecasts produce `air_forecast_unavailable`: the lesson stays indoors and provisional, and the day cannot satisfy the outdoor target or replace another outdoor day. Neither a model ranking nor an explicit Outside preference bypasses this rule. Today's gate still requires valid local observations and complete weather; with those checks satisfied, missing regional air forecasts may retain a weather-only status. Neither regional forecasts nor a previous approval can override fresh local concerns.

The shared `domain/preferences.js` validator owns the logistics bounds below. `/api/config` exposes the same values to the browser, so form constraints and both server entry points agree. Values must be finite numbers and the minimum apparent temperature must be less than the maximum.

| Preference | Default | Editable range |
| --- | --- | --- |
| Minimum apparent temperature (`minApparentC`) | 3 °C | −10 to 20 °C |
| Maximum apparent temperature (`maxApparentC`) | 32 °C | 20 to 38 °C |
| Precipitation probability (`maxPrecipProbability`) | 55% | 0 to 90% |
| Precipitation amount (`maxPrecipitationMm`) | 0.5 mm/hour | 0 to 5 mm/hour |
| Wind (`maxWindKmh`) | 30 km/h | 0 to 50 km/h |

Requests have timeouts and bounded response sizes. Successful environmental responses cache their original `fetchedAt`. Forecasts older than 12 hours or returned after a failed refresh are not used for a favourable decision.

## Timetable and adaptation

Weekly AI generation authors a full bilingual timeline for each Monday-Friday date. The default routine (opening/closing hours, blocks and duration) is an editable starting point. The teacher brief determines each day's times, order and content, including changed or omitted meals/rest, additional rows and long activities. A supplied empty timeline is intentional. Only absent timelines or AI-off generation use the deterministic grid. The provider has a bounded 30,000-token allowance and 220-second deadline. Model output remains untrusted: the server checks IDs, HH:MM times, positive intervals, bilingual content, allowed kinds and a maximum of 40 rows per day. See [ADR-0010](adrs/0010-teacher-authored-timetables.md).

Explicit “one day …” / “еден ден …” requests are preserved as individual topic assignments, in order, across the remaining weekdays. Generation sends the original multiline brief and the assignments together. Both lesson alternatives must visibly contain each assigned topic in the brief's language; the other language must express the same lesson. This deterministic text check does not assess teaching quality. A failed AI result for an explicit daily-topic brief is reported instead of saving an unrelated library week. Assigned lessons are pinned against automatic seasonal replacement. Earlier weekdays remain empty when generating midweek.

`domain/week.js` starts with five weekdays. Weekend generation prepares the next Monday. New midweek plans leave prior dates empty; regeneration preserves previously saved elapsed rows. For the deterministic fallback only, 15-minute-stepped free eco slots are screened against the weather/air gates and ranked by suitability, with a 0.015-point penalty per minute away from a 10:30 midpoint. If none is eligible, the indoor lesson uses the nearest available slot; if no slot exists, no eco row is required. Remaining free time receives library activities, normally 30-90 minutes. Default blocks can overlap or extend outside default hours; later overlaps are shifted while retaining duration. Authored timelines bypass this grid and its filler activities.

On saved-plan reads, only legacy/library generated play blocks may be consolidated. Authored timelines retain every row, label, note, gap and duration across adaptation. No row is protected because it is a meal, rest, routine or occasion. Days may have zero or several eco rows. Started rows remain immutable in proposals, direct edits and regeneration. Home displays selectable descriptions and a pencil editor.

Timetable rows identify activities and eco lessons in green, meals in amber and sleep/rest in purple; other routines remain neutral. Only rows with server-owned occasion context use red, including their selected detail panel and collapsed editor preview. Calendar tiles, day cards and date notes retain their ordinary backgrounds. An unrelated eco lesson does not turn red merely because its day has a holiday. Text labels remain visible, with distinct selected/current indicators. Home activities are selectable and show their short description in the interface language; eco selections retain both lesson variants, goals and materials. These presentation changes do not alter closures, evidence quality or approval gates.

For each day, inspect the eco slot against the weather preferences, available air forecast and, for today, current local observations. Before a model request, the server creates a bounded planning summary with date, whether any slot passed the deterministic gates, its best timetable window and ordinary weather values. Raw sensor readings, AQI and PM2.5 values are excluded. A successful model must return every supplied date exactly once, ranked by how much the generated activity benefits from the yard or nature and by the supplied forecast. Dates that failed the server gate must be ranked last.

The server then filters that model order through current evidence and chooses up to the teacher’s requested outdoor-day count. The model cannot make an ineligible day eligible. If AI generation is unavailable, eligible days are ranked deterministically by apparent temperature near 20 °C, lower rain probability/wind and lower available forecast PM2.5. Missing future air forecasts make a date ineligible; the uncertainty score for weather-only evidence applies only when today's separate observation gate permits that status. The requested count is a planning target, not a quota that overrides evidence. Home shows the selected day's recorded reason and, when another day was preferred, the outdoor-day target. Daily maximum temperature alone does not rank days; a warmer Friday can remain indoors when other eligible activities were preferred.

Each upcoming day has an Inside / Outside / Automatic choice on the day card. The schedule assistant is prompt-only; explicit location instructions become a validated preference. Outside takes priority over the weekly target only when every remaining eco interval has sufficient environmental evidence. All hours of long and multiple eco slots are checked. Missing eco slots mean no outdoor allocation. Explicit location controls hold other days at their existing choices. Morning checks, forecast/observation distinctions and notice invalidation remain independent of timetable authoring.

Weekly AI generation allows up to 220 seconds and requests low reasoning effort on the supported configured model families. These latency settings do not relax curriculum validation or the environmental gates. The browser's total deadline is 270 seconds for weekly generation, 120 seconds for day/schedule changes, 190 seconds for parent-note suggestions and 60 seconds for other requests. An explicit retry of a saved library week replaces it only after successful AI generation; failure preserves the saved plan. A successful replacement clears approval and needs its own same-day recheck. Timeout errors remain distinct from provider credit/quota errors.

When an outdoor day becomes unsuitable, keep its timetable and learning goal but use its indoor variant. For an AI week, reallocate the allowance to the next eligible date in the saved model order. For a library week, use the best remaining deterministic score. Show the change, or state that no replacement is currently available. Past and elapsed planned outdoor slots retain their history, which is not proof the activity actually happened. The algorithm does not shift meals or rest and does not automatically move teacher-edited timetable times.

Forecast snow selects a snow-learning theme with indoor and outdoor versions when no dated occasion already supplies the lesson. Outdoor wording explicitly requires actual snow on the ground and adult supervision. A snow forecast does not establish snow cover or suitability of the yard.

Each day always retains both indoor and outdoor lesson versions; the indoor backup is visible on outdoor days at Home and in the schedule preview. Uncustomized future learning blocks respond to forecast rain, wind at least 22 km/h, maximum temperature at least 28 °C or below 13 °C, and forecast snow. These thresholds select educational topics, not health limits. Missing temperatures produce an unknown learning context. Weather changes cannot turn those supporting classroom games into extra outdoor sessions.

A location change fetches the selected city's conditions and reapplies the gates, saved AI order or deterministic fallback, and parent-message rules. It does not call the model again, randomly reshuffle identical forecasts, move saved times, overwrite manually edited text or rewrite elapsed sessions. If a date no longer passes for the new city, it is skipped. An automatically selected snow theme can revert to the base lesson when conditions change before its slot; an explicitly edited lesson remains the teacher's choice. Older saved weeks without an AI order retain deterministic allocation until the teacher regenerates them.

## Holiday and classroom context

`services/holidays.js` scrapes the official Ministry of Economy and Labour announcements index and known Easter article entry points. Requests allow only the ministry's specific HTML paths, reject redirects, use a nine-second overall deadline and limit each response to 1.5 MB. Article dates must match their stated weekday and requested year. Ambiguous dates, unknown event names, incompatible scopes and changed HTML fail validation. No model output supplies a holiday date.

The complete 2026 programme is a manually verified, dated snapshot in `config/holiday-snapshot.js`, with a separately sourced official correction for Republic Day. The importer updates supported announcements found on the current index; it is not a full historical archive crawler or general PDF parser. Live imports persist under `.cache/holidays/`, with 24-hour caching and 15-minute failure backoff. Failed refreshes retain original successful fetch timestamps and verified event dates. The editor discloses the annual snapshot, latest announcement import and partial/unavailable sources. Other years are incomplete until supported official announcements or a verified annual snapshot exist; 2026 dates are never rolled into another year.

`domain/holidays.js` assigns dated occasions to their weekday, or the preceding Friday for an upcoming weekend/Monday occasion. It includes optional Halloween and environmental learning days, clearly distinct from public and community-specific holidays. New AI requests receive all those occasions, including community holidays, with their actual date, lesson date and scope. For example, the 28 September 2026 Bosniak holiday is supplied to the Friday 25 September lesson as advance preparation. This does not move the holiday or close the kindergarten.

AI requests no longer contain suggested titles from the library. The model must propose lessons and related session titles from the supplied context. The first occasion's supplied name must appear in that day's title in both languages, and every occasion's name must appear in both indoor/outdoor descriptions in each language. Missing coverage rejects the model result; name matching verifies visible coverage, not educational quality. The prompt requires a concrete connection to the activity, inclusive treatment without assumptions about a child's background, and no invented customs or historical facts. Teachers still review the content. A dated AI lesson is preserved when snow would otherwise substitute a seasonal library lesson.

The fallback library has concrete Independence Day, Easter, Halloween, literacy and environmental-day activities. `domain/occasion-activities.js` also gives uncovered occasions, including community holidays, a bilingual discussion within an existing upcoming slot. It prefers an uncustomized circle/activity block; if only edited activities remain, it appends discussion context without replacing the teacher's text. The discussion uses the verified name, actual date and scope, labels advance preparation, and invites inclusive conversation without invented customs or assumptions about children's backgrounds. Curated or validated AI eco lessons already covering the occasion are marked directly. Multiple occasions are covered without adding time or duplicating an elapsed discussion. Available curated suggestions still require an explicit Apply action to replace the eco lesson. Daily routines remain teacher-confirmed schedule content. Authored AI timelines retain their own rows during occasion adaptation; library fallback is identified when generation fails. Provenance does not imply that legacy routines were model-generated.

For a paragraph without a year, the importer may infer it only from that same article's official publication badge, provided the holiday falls within the following 45 days and the weekday agrees. The event records the inference and publication date. Two dates are accepted only for an explicit `односно` Sunday-to-next-Monday substitute for an all-citizen holiday; unrelated or ambiguous pairs remain rejected. The separately sourced Republic Day announcement now resolves the annual PDF typo in both live imports and the offline fallback.

The demo's six server-owned profiles have fixed Monday clocks (five at 08:45 and one at 14:30) and synthetic environmental inputs. Independence Day and Easter examples include preset closure choices and preceding-day preparation activities; these are clearly labeled examples, not inferred real-account closures. The active profile is stored with its isolated in-memory week and survives edits, location changes and rechecks. Client-supplied dates cannot move the simulation into a different week. Weather preferences and PM2.5 gates remain the same across all profiles and all six air scenarios.

Calendar refreshes preserve saved eco lessons and teacher edits while adding missing discussion context to the remaining timetable. Dates and curated alternatives update without another model call or automatic closure. Single-day AI changes require a separate preview and Apply action; the existing weekly generation API retains its validated replacement and failure-preservation behavior. Saved edits and refreshes rebuild parent drafts and invalidate approval as usual.

## Messages and approval

Generation creates both Macedonian and English weekly/daily drafts in one operation. `domain/messages.js` builds them from deterministic templates, embedding validated curriculum text where relevant; no runtime model writes their decision or approval wording. The weekly note opens with the week's date range, then the grouped clothing advice with any exceptional days, then the week's activity titles, and a homework line drawn from the days' home habits. Weekly clothing advice groups common conditions and calls out exceptional days. Daily content follows the current indoor/outdoor version and states the day's place. A day moved indoors by air pollution names the pollution plainly while keeping the PM2.5 wording, and points to the replacement outdoor day when one is available. No em dashes are used. Closed days are marked by the teacher, never inferred from a model’s knowledge of holidays.

The parent-message panel displays only the selected interface language. When a parent link exists, both daily and weekly previews and Copy include the notice followed by that link. The dedicated Copy link only control always copies just the URL. Without an enabled link, message copying retains the visible text. Both translations remain stored so switching languages does not need a new model request or discard the other version.

Weekly and future-day messages are drafts. Approval applies only to the current day after its explicit recheck, expires after 15 minutes, and is invalidated by refreshes or saved changes. The backend constructs and stores the exact approved message; client-supplied claims are ignored. The app does not send anything to parents.

## Scope

PM2.5-only screening omits other pollutants, pollen, UV, indoor air, individual health needs and actual yard/ground conditions. Forecast weather is imperfect. EPA school guidance supplies a decision reference, not a Macedonian regulatory endorsement. WHO’s 24-hour PM2.5 guideline is not a threshold for a half-hour play session. No environmental savings or real-world adoption are claimed.


## Automatic adaptation and AI edits

A dashboard read persists current adaptation and clears notice approval without advancing the teacher's edit revision. It clears check/approval state and invalidates pending day/schedule proposals before waiting for upstream data, so a failed refresh cannot retain an earlier approval. Explicit saves and worker refreshes still advance revisions. This separates passive read conflicts from the evidence boundary; see [ADR-0007](adrs/0007-conservative-forecast-and-refresh-boundaries.md).

A parent read may trigger a due refresh when its owner's write lock is free. While an owner write is active, it returns the stored plan screened against currently available conditions without waiting for that write or claiming a fresh persisted check. The stored `conditionsCheckedAt` is retained. Link authorization and revocation are checked again after asynchronous work before exposing a projection.

The running server revisits active weeks every minute, independent of a teacher browser. Home checks every minute while visible and when returning to the tab; a current parent-page read can also trigger a due refresh. A detected concern switches the ongoing/upcoming lesson indoors immediately within that check. This is polling, not continuous monitoring between checks. The same timestamp/QC and weather gates apply: unknown readings never mean clean air. A switch selects the saved indoor lesson and composes a new factual daily draft. Home and parent pages show a current indoor-day alert with the reason and an eligible future replacement, explicitly provisional and awaiting its morning check. Each refresh revalidates that replacement; closures, unavailable forecasts and blocked days cannot be suggested. Alerts persist while relevant and clear on recovery, closure or elapsed dates. This automation neither calls the model nor delivers an external message. It cannot run while the host is asleep or the process is stopped.

Home's Change activity sends the selected row and surrounding day to AI, validates the replacement and applies it on submission. Only that activity changes. Meals, rest, routines and occasion activities are editable until their start. Multiple eco rows keep individual labels, notes and targeted lesson edits; changing one does not overwrite the others.

Change schedule sends the selected day and the teacher's prompt in one model request. Meals, rest and routines are editable. Gaps, empty timetables, extended days and any number of eco rows are accepted. Overlaps are automatically resolved in authored order by shifting later rows forward while preserving durations, as requested by the product owner. Times must remain within the same calendar date. Only already-started rows are locked; attempts to remove, rewrite or backdate them return `activity_finished`. The prompt submission applies a server-validated proposal without a separate time-editor or review panel. Proposals remain account/demo scoped, revision bound, single-use and expire after ten minutes. Applying rechecks evidence and clears notice approval. Demo text actions remain labelled library examples, never claimed as interpretation of a brief.

Family links present the provisional plan, not a claim that activities happened or that the morning notice was approved. Public responses contain only the explicitly projected family view. Bearer access is limited by expiry/revocation; there is no parent-identity verification. A production parent invitation and delivery system is outside this local prototype.


## Shared demo and account workflows

The demo demonstrates the feature set available to real accounts: plan creation, editing, deterministic condition changes, morning rechecks and read-only parent sharing. Classroom rosters, attendance, child records, family chat, packing acknowledgements and their mutation APIs have been removed. Both modes use the same parent projection and require the teacher to enable sharing explicitly. This keeps the demonstration aligned with the implemented product.

Parity applies to features, not evidence provenance. Demo forecasts, sensor inputs and clocks remain explicitly synthetic, library suggestions are labelled and no demo operation calls AI or changes an account plan. Existing week revisions, notice-approval invalidation and account ownership remain enforced. The afternoon sample represents an elapsed timetable, not proof that an activity, meal or rest took place.

The first visit from a browser opens the demo automatically and shows a dialog that names it as the demo and points to the Demo switch at the top for turning it off and registering a kindergarten. A local flag records that the visit happened, so returning visitors and anyone who signs out see the sign-in page instead. The auto-started demo uses the same isolated demo record and never creates or reads an account.

## Required first-plan details

Generation requires kindergarten name, group name, location, age band, teaching brief and at least one available material. The teacher reviews the default routine, which may contain no meal or rest. The brief can override those defaults per day. Compact material selections include an add field for custom tools; bounded custom IDs and bilingual labels persist with the account plan, enter the model material allowlist and appear in the public material projection. A teacher-entered custom name is retained in both language fields. Parent access remains URL-based.

Accounts register a kindergarten, not an individual profile: the email and password identify the kindergarten, and registration captures its name, teacher name, age band and location once. The kindergarten name doubles as the group name, so plan creation asks only for learning ideas and the daily rhythm. The location is fixed at registration and shown, not editable, above the workspace; existing weeks keep the location they were generated with. Registration validation reuses the same settings checks as generation, and legacy username accounts continue to sign in through the same field without a format requirement.

## Planning navigation

Home is the single teacher workspace in both modes. A new account first shows Create kindergarten. Setup opens in place and requires confirmation of the daily rhythm. Successful generation returns to the Home calendar and selected day's activities. Manage week contains regeneration and deletion; cancellation or failed regeneration preserves the saved plan. Older weekly-plan bookmarks open Home. Successful AI provenance and saved-change banners, and the former Home slogan, are omitted. Saved generation-warning and unapplied-library-brief banners are also omitted; library or mixed-source information is available inside the collapsed Manage week section. Failed new requests still show their error and saved diagnostics remain account-scoped. Parents retain their separate read-only view. Navigation never approves a parent notice.

## Shared parent dashboard

The parent link uses the same calendar, current-air card, selectable timetable, complete activity details as Home, without teacher navigation or the message distribution card. The public API explicitly projects learning content and public environmental evidence; teacher briefs, account identifiers, edit revisions and AI diagnostics remain private. Parent requests cannot edit plans, approve notices, change activity locations or alter sharing settings. Conditions retain measurement timestamps and source labels. Demo sharing remains isolated and visibly synthetic.

## Activity detail and variety

Legacy supporting-session maps and individual non-eco activity replacements require at least three sentences and 160-1200 characters in each language. Full timetable rows accept optional bilingual notes of up to 1200 characters without imposing a minimum activity length. The model receives a shared brief asking for a concrete challenge, steps/roles, a child-led choice or test, and a finale, scaled to the scheduled time. Main lesson descriptions allow 1200 characters; older saved lessons remain readable. These are content checks, not a claim that creativity or educational quality can be certified automatically. The local activity library now includes practical building, storytelling, pretend-play, rhythm and movement games. New optional classroom supplies are teacher-selected; model material IDs remain allowlisted. Regeneration is required to replace existing saved activities; existing plans are not silently rewritten by this release.

Every generated day carries its own timeline rather than an object keyed by fixed server slots. Each row has an ID, start/end, kind, bilingual label and optional bilingual note. Learning guidance asks for useful descriptions scaled to the requested duration. Legacy stored session maps remain readable and independently validated; they no longer constrain new model generation.

The deterministic fallback divides default free time into blocks of at most 90 minutes and looks for an eco slot when space exists. A fully occupied day remains valid without one. Those defaults never resize an authored model timeline. Legacy outdoor lessons display optional ten-minute transitions inside their event; authored timetables receive no inserted transitions or shortened activities.

## Exact timing in AI schedule edits

The full-day model response supplies timing directly. There is no separate feasibility model, protected-routine window calculation or exactly-one-eco rule. The server validates timeline integrity and resolves overlaps deterministically without shortening requested activities. Default hours and the default eco duration do not clamp an explicit teacher request.

A five-hour activity is preserved as five hours, even when it crosses default meal/rest times or extends the default day. Subsequent overlapping rows move later, retaining duration; a requested skipped row stays absent. A request to rewrite a row that has already started is rejected. Regeneration sends existing started rows as locked context, preserves elapsed fallback rows, and validates any authored replacement before storage. A new midweek plan still leaves earlier weekdays empty.

## Parent notes and teacher-confirmed suggestions

An active parent link can submit a bounded, idempotent private note, but cannot read the inbox or edit any plan. Notes persist in SQLite under the owning account, with read timestamps and suggestion/applied status. Demo notes remain in their in-memory demo record. The teacher's separate Parent notes page polls every ten seconds while mounted and on returning to the page; unread counts reflect stored read timestamps, and older-week notes remain visible. Deleting a week also deletes its notes. Link revocation and expiry stop further submissions; existing notes remain in the teacher's inbox.

From a clear group request, a parent-note suggestion can change any upcoming part of the day's timetable, including meals and rest, through the same day-plan generator and integrity validator. Indoor/outdoor choices are preferences subject to the unchanged evidence checks. The teacher reviews and applies the note proposal. Individual-child diet, attendance and medical/outdoor permissions stay informational.

AI assessment runs only when the teacher requests a note-based change. Note assessment no longer marks meal/rest/holiday rows as locked; its context identifies started rows. Only the authenticated owner or isolated demo capability can apply an unexpired, unused proposal at the current plan revision. The same elapsed-time guard runs at preview and apply. Changes invalidate approval. Raw note text stays out of parent projections and logs; account identity and teacher briefs stay out of the note-assessment request. A shared link does not establish the sender's identity.

## Loading feedback

Weekly generation, model suggestions and proposal application share a compact modal waiting view over the current screen. The form stays mounted so errors never discard teacher input. A moving, indeterminate bar and elapsed time from the browser's monotonic clock show that a request is pending; no completion percentage or provider stage is invented. Demo generation is labelled as a library example. Background content is inert while those modal requests run. Passive reads, polling, rechecks and scenario refreshes use non-modal progress; they do not open the waiting dialog or mark the editor busy. Dashboard polling preserves the selected demo scenario, focused field and unsaved draft. Polling call sites explicitly mark requests as background, independently of URL-based phase classification; the 60-second dashboard/parent refresh and 10-second inbox poll cannot open the waiting dialog. Request progress contains no URL tokens, prompts or note text; every success, failure and timeout clears its entry. Reduced-motion and keyboard focus are supported.


## Engineering gates and repeatable provider tests

The local development contract now requires at least 91% native V8 line coverage independently for all authored backend and frontend JavaScript, complete source inventory, at least 90% line coverage in each of nine critical backend modules, and a passing SonarQube analysis before source pushes. This is an engineering gate, not an environmental, medical or educational certification. See [ADR-0005](adrs/0005-local-quality-gates.md) for the metric definition and limitations, and [ADR-0008](adrs/0008-critical-coverage-and-analysis-secrets.md) for the critical-file floors and private analysis setup. Coverage claims require an actual successful full run.

Provider-cache tests use an injected clock, fetch function and isolated temporary directory; no synthetic test response is written into the application's real cache. The cache coalesces concurrent cold reads after disk loading as well as while a network request is pending. Successful measurement timestamps and fetch timestamps remain unchanged on refresh failure. This fixes a duplicate-fetch race without relaxing any evidence gate.

The optional [Postman API suite](../development/api-tests.md) runs HTTP workflows against an in-memory app or an existing loopback app. Planning uses explicit synthetic demos, including server-generated revisions and recheck/approval gates. It does not validate live observations or model output quality. No test fixture can be interpreted as current environmental evidence; account-owned persistence remains covered by the backend tests.

Native startup remains on loopback. Docker binds only within the container and publishes on host loopback, with the same Host/origin restrictions. SQLite and demo ownership rules remain unchanged. [ADR-0004](adrs/0004-containerized-local-stack.md) records the container boundary.


## Direct teacher editing and Nedelko navigation

Nedelko's brand mark is a hand-drawn smiling calendar mascot with a waving hand, stick limbs and red shoes. It replaces the branding leaf in headers, onboarding, loading states and the favicon. The [asset and generation prompt](../product/nedelko-mascot.md) describe its provenance. Adjacent bilingual text provides its accessible name; environmental activity icons retain their functional meaning.

The product is branded `Неделко` / `nedelko`, with “Вашата недела во градинка, испланирана.” / “Your kindergarten week, planned.” Teacher navigation has Home and a separate Parent notes page. Shared parent pages have no navigation or teacher message-copy/approval card; parents can still submit a private note for teacher review. A note never edits the plan automatically.

Nedelko is the sole product identity across source, tooling and documentation. New databases use `nedelko.sqlite`; existing private databases are selected without moving or resetting account data. The cookie and browser preference names use the `nedelko` prefix, so existing sessions require a fresh sign-in. Existing Docker volumes and Sonar history are preserved during the naming transition. These identity changes do not alter environmental gates, scheduling, ownership or notice approval. See [ADR-0009](adrs/0009-nedelko-product-identity.md).

Teachers can edit bilingual details of meal, rest, routine, occasion and learning activities with the pencil or a prompt. Both time and content become immutable when a row starts. Occasion identity remains server-owned. Edits survive environmental refresh and invalidate notice approval.

Dragging or using arrow controls reorders events while retaining identities, content and duration. It is not required to fill the default day. Started rows cannot move. Change schedule contains only the text prompt and submit action; the location buttons, boundary-time fields and separate proposal review were removed from that panel.

The server validates unique identities, bilingual content, selected materials, valid positive time intervals, row count, elapsed-time integrity, revision and ownership. It does not enforce meal/rest policy, a single eco slot, maximum activity duration, gapless coverage or default opening hours. Client/model content cannot supply environmental evidence or approval.

Both daily and weekly teacher message previews and clipboard text append the currently enabled parent URL. Revocation removes the URL immediately from newly displayed/copied text. The public URL is presentation metadata, not trusted decision evidence; stored notice approval still refers to server-generated facts. Public parent pages omit this teacher distribution card.

Weekly generation, model suggestions and proposal application display an indeterminate modal with real elapsed time over the retained screen. Passive refreshes and inbox polls use non-modal progress. Progress state holds no URL, token, prompt or parent-note text.
