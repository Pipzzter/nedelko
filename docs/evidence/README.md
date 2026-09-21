# Verification evidence

[Teacher-authored timetable checks, 21 September 2026](teacher-timetable-2026-09-21.md) record the scheduling update, current deterministic checks, and real model generation, day editing and parent-note editing with synthetic environmental inputs.

<!-- live-ai:start -->
Generated live by the configured OpenAI model on 2026-09-21; validated by the server before storage.

Model: **gpt-5.6-terra**. Elapsed: 129875 ms. Source: **ai**. Provider token usage is not exposed by this service.

[Validated bilingual lessons and sessions](live-ai-2026-09-21.json) came from a real authenticated request with an isolated temporary account and in-memory database. Air and weather were explicitly synthetic; holidays came from the bundled snapshot. This verifies live model generation, not live environmental providers, deployment, or teacher use. Account details, cookies and provider request identifiers are excluded.

- 2026-09-21: Јом Кипур: Тивок град на хартија / Yom Kippur: A Quiet Paper Town
- 2026-09-22: Картонски мостови за есента / Cardboard Bridges for Autumn
- 2026-09-23: Поправна работилница за играчки / Pretend Toy Repair Workshop
<!-- live-ai:end -->

Run `npm run verify:ai` deliberately: each run makes one paid generation. Normal tests never run this command.

## Release checks

[Watch the backup demo](demo-2026-09-21/demo.webm) (1:54.76, WebM). It shows the offline demo, parent sharing, one real authenticated AI generation, deterministic indoor switching under synthetic pollution and 390-pixel views. [Recording details and assertions](demo-2026-09-21/smoke-summary.json) identify the exact source commit and synthetic inputs.

The [21 September release record](release-2026-09-21.md) contains the scope, observed checks, submission checklist and remaining human checks. All four final verification commands passed on main at `e44f64c36662a52b48ec22a77d741768f05a1b4f`: 202 tests, backend 97.99% line coverage, frontend 94.88%, all nine critical-file floors and a live Sonar quality-gate pass.

- [Full verification command output](final-verification-2026-09-21.txt)
- [Exact coverage summary](coverage-2026-09-21.json)
- [Browser polling and focus report](browser-polling-2026-09-21/smoke.json), with screenshots in the same directory
- [Final English/Macedonian parent rendering check](parent-render-2026-09-21/parent-render-summary.json) and [390-pixel screenshot](parent-render-2026-09-21/parent-390px.png) after the cosmetic label correction

The fresh AI replay and recording ran at main commit `a07fdd83ec018b5dea7d4aef6e57d8048b73cdaf`; the only later application change is a one-line cosmetic occasion-label correction. The backend and AI verification script are unchanged between those commits. Temporary accounts and SQLite databases were in memory. The original checkout's private plans were not opened by these checks.
