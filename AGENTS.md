# ЕкоЧувар

## Run and verify
- Node 24+, no server runtime dependencies, no build step. Preact + HTM are pinned local browser assets.
- `npm.cmd start` on Windows; `npm start` elsewhere. http://127.0.0.1:4173
- `npm.cmd test` runs deterministic domain/API tests; `npm.cmd run check` checks JavaScript syntax.
- Keep frontend/ and backend/ separate. Read the scoped AGENTS.md before changes.

## Invariants
- Never invent user studies, endorsements, operational use, test outcomes, or Git history.
- Do not commit or publish without an explicit request.
- Clearly distinguish synthetic demo, live observations, cached observations, and forecasts.
- Treat the five-day plan as provisional. Only a same-morning recheck may create an approvable parent notice.
- Sensor QC, timestamp validation, AQI arithmetic, scheduling, and recommendation gates are deterministic.
- Weather limits are editable logistics preferences, never health or safety claims.
- Model output is untrusted input. Validate it and let the teacher confirm constraints.
- PM2.5-only screening is not a complete air-quality assessment or medical certification.
- Treat missing, suspect, stale, or conflicting evidence as unknown, not clean air.
- Use measurement timestamps for freshness. A failed refresh cannot renew old evidence.
- Keep API keys server-side. Never log secrets or raw private scheduling text.
- Username/password accounts and SQLite persistence are explicitly requested. Use built-in node:sqlite and crypto; keep the server on loopback. No bundler.
- Private plans belong to the authenticated account. Demo data is isolated and must never overwrite real plans.
- Keep the entire UI and generated parent messages in Macedonian and English. Do not use em dashes in parent messages.
- Keep the Monday–Friday week visible; generating midweek leaves earlier days empty. Refreshes must invalidate notice approval.
- Put project documentation in docs/; keep README.md and scoped AGENTS.md at their conventional entry points.
- Update the decision-basis documentation with material changes. Run meaningful tests for decision logic and security boundaries.
