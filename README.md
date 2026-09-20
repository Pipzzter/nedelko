# ЕкоЧувар · EkoCuvar

A Macedonian and English kindergarten week planner. Teachers set meals and rest once, generate daily eco activities and parent notes, and adapt outdoor days to weather and local PM2.5 readings.

## Run

Node.js **24+**. No build step or server runtime packages.

```powershell
npm.cmd start
```

Open **[http://127.0.0.1:4173](http://127.0.0.1:4173)**. Use `npm start` on macOS/Linux.

- Choose **Explore a sample week / Разгледај пример-недела** for Monday, **7 September 2026 at 08:45**. Monday prepares an Independence Day eco lesson; Tuesday, 8 September, is closed in the example.
- Or create a username/password account. Real calendars start empty.
- **Generate plan** creates the timetable, bilingual activities and parent messages together.
- **Edit week** shows a readable timeline. Click a title or time, type a range such as `7:30 - 8:30`, then save. Text editing uses the selected language. Each eco lesson keeps an indoor backup.
- **Delete week → Delete and start again** clears that plan and opens generation with your settings. Existing weeks keep their saved content until you regenerate.
- Meals and rest stay fixed. Story, movement, creative play and reflection vary by day. When AI generation succeeds, the model ranks the eligible outdoor days using the activities and forecast. Server-side air, weather and timetable gates remain authoritative and move a blocked day to its indoor backup. Manual edits stay intact.
- The **Demo** switch isolates sample data. **Example week** offers Independence Day, Easter, Halloween and winter snow. Each starts on its own fixed Monday at 08:45. **Monday air conditions** includes normal, polluted, stale, offline, disagreement and sensor-spike examples. Try **Polluted morning** in the September example to move Monday’s outdoor slot to another eligible day.

The browser uses locally vendored **Preact 10.29.8 + HTM 3.1.1**. The backend uses native Node HTTP, crypto and SQLite. Accounts and real plans survive restarts in `.local/ekocuvar.sqlite`. The server binds only to this computer.

## Optional AI

If `.env` does not exist, copy `.env.example`, add `OPENAI_API_KEY` and a model your project can access, then restart. Do not overwrite an existing `.env`. The key stays on the backend. Generation falls back to editable local examples when the request fails; the editor identifies their source.

On 2026-09-20 the configured API project returned **429 `credit_balance_exhausted`**. Successful live AI generation has not been verified. Live environmental requests succeeded for Skopje, Bitola and Ohrid; service availability can change.

## Verify

```powershell
npm.cmd ci
npm.cmd test
npm.cmd run check
```

`linkedom` is a development-only DOM test dependency. Starting the app does not require `npm install`.

[Architecture](docs/ARCHITECTURE.md) · [Decision rules](docs/DECISION_BASIS.md) · [Checks and limitations](docs/BREAKING.md) · [Sources](docs/SOURCES.md) · [Local operation](docs/OPERATIONS.md)

No teacher study, endorsement, measured environmental impact or real parent delivery is claimed. Weekly plans are provisional. This is a PM2.5 screening tool, not a full air-quality or medical assessment.
