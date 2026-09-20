# ЕкоЧувар · EkoCuvar

A Macedonian and English kindergarten week planner. Teachers set meals and rest once, generate daily eco activities and parent notes, and adapt outdoor days to weather and local PM2.5 readings.

## Run

Node.js **24+**. No build step or server runtime packages.

```powershell
npm.cmd start
```

Open **[http://127.0.0.1:4173](http://127.0.0.1:4173)**. Use `npm start` on macOS/Linux.

- Choose **Explore a sample week**. Demo and real accounts use the same planning, editing and parent-sharing screens. Demo data is synthetic and isolated; scenario controls let you try changing conditions without modifying a real plan or calling AI.
- The initial example is Monday, **7 September 2026 at 08:45**. Try **October · A day of little discoveries** for a 14:30 example with elapsed morning activities.
- Or create a teacher username/password account. Real calendars start empty. Parents only need the shared URL; there is no parent login.
- **Home** is the single teacher workspace. New accounts start with **Create kindergarten**. Setup collects the group, learning ideas and daily rhythm, including meals and rest. Confirm the timetable before generating; your kindergarten profile is reusable.
- Select an activity on Home, then **Change activity** to replace just that item. **Change schedule** accepts changes to activities and times, previews the complete day, and requires confirmation. Meals, sleep, holidays and started activities are locked. Demo suggestions are labelled library examples. Each main lesson keeps an indoor backup.
- **Manage week > Regenerate week** opens saved settings and explains replacement. Cancelling or failed generation preserves the saved week.
- **Create parent link**, then **Preview as a parent** opens the read-only family page. The URL stays the same through edits, refreshes and regeneration of the same week. **Disable link** revokes access; links expire after 14 days (demo: one hour), and renewal retains the URL until revoked. Parents cannot edit the plan. Localhost links work only on this computer.
- The running server checks active weeks every minute, even with the teacher browser closed. Newly detected pollution or uncertain evidence selects the indoor version. Home and the parent page show an indoor-day alert and an eligible provisional replacement when available. No email, SMS or push is sent.
- **Manage week > Delete week** asks for confirmation, removes the plan and retains your settings on Home.
- Meals and rest stay fixed. Story, movement, creative play and reflection vary by day. When AI generation succeeds, the model ranks the eligible outdoor days using the activities and forecast. Server-side air, weather and timetable gates remain authoritative and move a blocked day to its indoor backup. Manual edits stay intact.
- The **Demo** switch isolates sample data. **Example week** offers six dated examples: Independence Day, Easter, Halloween, winter snow, an autumn afternoon and a spring garden. Clocks stay fixed for repeatable walkthroughs. **Monday air conditions** includes normal, polluted, stale, offline, disagreement and sensor-spike examples. Try **Polluted morning** in the September example to move Monday’s outdoor slot to another eligible day.

The browser uses locally vendored **Preact 10.29.8 + HTM 3.1.1**. The backend uses native Node HTTP, crypto and SQLite. Accounts and real plans survive restarts in `.local/ekocuvar.sqlite`. The server binds only to this computer.

## Optional AI

If `.env` does not exist, copy `.env.example`, add `OPENAI_API_KEY` and a model your project can access, then restart. Do not overwrite an existing `.env`. The key stays on the backend. Home identifies generation failures and library fallback. Explicit daily-topic requests fail visibly if AI cannot cover them, preserving any saved week. Whole-week generation sends all timetable slots together and validates distinct per-slot activities.

On 2026-09-20, live full-week generation and single-day revision succeeded with the configured API key. These were synthetic teaching requests, not a production reliability benchmark. Earlier provider credit errors are shown separately from timeouts, refusals, incomplete responses and invalid content. Live environmental requests succeeded for Skopje, Bitola and Ohrid; service availability can change.

## Verify

```powershell
npm.cmd ci
npm.cmd test
npm.cmd run check
```

`linkedom` is a development-only DOM test dependency. Starting the app does not require `npm install`.

[Architecture](docs/ARCHITECTURE.md) · [Decision rules](docs/DECISION_BASIS.md) · [Checks and limitations](docs/BREAKING.md) · [Sources](docs/SOURCES.md) · [Local operation](docs/OPERATIONS.md) · [Product research and roadmap](docs/PRODUCT_RESEARCH.md) · [Original feature branches](docs/FEATURE_BRANCHES.md) ? [Planner fix branches](docs/PLANNER_FIX_BRANCHES.md)

No teacher study, endorsement, measured environmental impact or real parent delivery is claimed. Weekly plans are provisional. This is a PM2.5 screening tool, not a full air-quality or medical assessment.
