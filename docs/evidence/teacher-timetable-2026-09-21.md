# Teacher-authored timetable verification, 21 September 2026

Application source: `ec953bf`, following the scheduling changes in `8efe32e`. These checks concern this change; earlier release evidence remains historical.

## Deterministic and interface checks

`npm.cmd run gate` passed against this application source before it was committed: JavaScript syntax, documentation links, 206 tests, every authored application's coverage requirement, critical-file coverage floors and the live SonarQube quality gate.

- Backend line coverage: **97.80%** (4879/4989).
- Frontend line coverage: **95.32%** (3851/4040).
- Tests cover the five-hour Monday and Tuesday breakfast through authenticated generation, schedule proposals and application; overlap resolution; empty and multiple-eco days; evidence for extended intervals; elapsed-row integrity; notice approval; and parent-note ownership, revision and single-use boundaries.
- Rendered DOM checks cover prompt-only submission, editing an empty day, compact material controls with custom additions, and nonblocking background request progress.

No browser connection was available during this run. DOM checks do not establish visual layout quality on a real desktop or mobile browser.

## Live model and HTTP checks

The [recorded responses](teacher-timetable-2026-09-21.json) use the configured `gpt-5.6-terra` model through the real authenticated HTTP handlers. Storage was isolated in-memory SQLite; environmental conditions were synthetic; holidays came from the bundled calendar snapshot. No real account plan was opened or replaced.

1. The brief `Monday: no breakfast, run outside 09:00-14:00. Tuesday: move breakfast to 08:45.` produced a Monday row labelled **Running outside**, from **09:00 to 14:00**, without breakfast. Tuesday breakfast began at **08:45**. Subsequent overlapping meals/rest moved later with their durations retained.
2. A Tuesday day prompt removed breakfast and replaced rest with a **12:00-14:00** indoor building activity. Both suggestion and application returned HTTP 200.
3. A parent note requested Wednesday breakfast at **09:15 for 45 minutes**. The note produced a schedule proposal; teacher application returned HTTP 200 and saved breakfast at **09:15-10:00**. The note was marked applied.

An earlier live attempt kept the five-hour interval but replaced running with a quiet-path activity. The prompt was corrected to preserve the identity of explicit teacher activities ahead of seasonal/occasion ideas, and the recorded rerun passed. This sample verifies these requests, not universal model faithfulness, deployment, live environmental providers or teacher use. Provider token usage is not exposed by the services.

Publication also requires the installed pre-push gate to validate the exact clean commit being pushed; no gate bypass is used.
