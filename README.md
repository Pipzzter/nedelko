# ЕкоЧувар · EkoCuvar

A Macedonian and English kindergarten week planner. Teachers set meals and rest once, generate daily eco activities and parent notes, and adapt outdoor days to weather and local PM2.5 readings.

## Run

Node.js **24+**. No build step or server runtime packages.

```powershell
npm.cmd start
```

Open **[http://127.0.0.1:4173](http://127.0.0.1:4173)**. Use `npm start` on macOS/Linux.

- Choose **Explore as teacher** or **Explore as parent**. The connected, fictional Sunflowers class has 30 children; parent Ana sees her twins Mila and Luka. The teacher banner opens the parent link; keep it in another tab to compare both views. Attendance, family absence reports, meal/rest records, observations, messages and packing checklists work within the demo. No real families are contacted.
- The initial example is Monday, **7 September 2026 at 08:45**. Try **October · A day of little discoveries** for a 14:30 example with completed meals, rest and learning observations.
- Or create a teacher username/password account. Real calendars start empty. Parents only need the shared URL; there is no parent login.
- **Create plan** guides first-time teachers through three sections: group details, learning ideas and daily rhythm. Kindergarten name, group, location, age range, a teaching brief, materials and a valid timetable are required. Review the suggested meal/rest times and confirm them before generating. Inline errors link to the missing field; padded material cards and routine rows are clickable. Your kindergarten and group become a reusable profile.
- **Edit week** shows fixed timetable times and editable activity text. Use **A fresh idea for this day** to describe a change, review an AI preview, then apply it to that day. Other days retain their lessons. Demo previews use the library and do not interpret the request. Each eco lesson keeps an indoor backup.
- **Create parent link** opens a separate, read-only weekly page. **Copy link only** gives you the URL to share. Links can be disabled, expire after 14 days (demo: one hour), and expose only the family view. Anyone holding the link can read it; these are not verified parent accounts. The richer child records and two-way controls are limited to fictional demos; real-account family links remain read-only weekly plans.
- The running server checks active weeks every five minutes, even with the teacher browser closed. Poor or unknown air conditions select the indoor version and rebuild the daily parent draft. The parent page refreshes while visible. No email, SMS or push is sent.
- **Delete week → Delete and start again** clears that plan and opens generation with your settings. Existing weeks keep their saved content until you regenerate.
- Meals and rest stay fixed. Story, movement, creative play and reflection vary by day. When AI generation succeeds, the model ranks the eligible outdoor days using the activities and forecast. Server-side air, weather and timetable gates remain authoritative and move a blocked day to its indoor backup. Manual edits stay intact.
- The **Demo** switch isolates sample data. **Example week** offers six dated examples: Independence Day, Easter, Halloween, winter snow, an autumn afternoon and a spring garden. Clocks stay fixed for repeatable walkthroughs. **Monday air conditions** includes normal, polluted, stale, offline, disagreement and sensor-spike examples. Try **Polluted morning** in the September example to move Monday’s outdoor slot to another eligible day.

The browser uses locally vendored **Preact 10.29.8 + HTM 3.1.1**. The backend uses native Node HTTP, crypto and SQLite. Accounts and real plans survive restarts in `.local/ekocuvar.sqlite`. The server binds only to this computer.

## Optional AI

If `.env` does not exist, copy `.env.example`, add `OPENAI_API_KEY` and a model your project can access, then restart. Do not overwrite an existing `.env`. The key stays on the backend. Generation falls back to editable local examples when the request fails; the editor identifies their source.

On 2026-09-20, live full-week generation and single-day revision succeeded with the configured API key. These were synthetic teaching requests, not a production reliability benchmark. Earlier provider credit errors are shown separately from timeouts, refusals, incomplete responses and invalid content. Live environmental requests succeeded for Skopje, Bitola and Ohrid; service availability can change.

## Verify

```powershell
npm.cmd ci
npm.cmd test
npm.cmd run check
```

`linkedom` is a development-only DOM test dependency. Starting the app does not require `npm install`.

[Architecture](docs/ARCHITECTURE.md) · [Decision rules](docs/DECISION_BASIS.md) · [Checks and limitations](docs/BREAKING.md) · [Sources](docs/SOURCES.md) · [Local operation](docs/OPERATIONS.md) · [Product research and roadmap](docs/PRODUCT_RESEARCH.md) · [Feature branches and merge guide](docs/FEATURE_BRANCHES.md)

No teacher study, endorsement, measured environmental impact or real parent delivery is claimed. Weekly plans are provisional. This is a PM2.5 screening tool, not a full air-quality or medical assessment.
