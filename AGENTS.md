# ЕкоЧувар

## Run and verify
- Node 24+, no server runtime dependencies, no build step. Preact + HTM are pinned local browser assets.
- `npm.cmd start` on Windows; `npm start` elsewhere. http://127.0.0.1:4173
- `npm.cmd test` runs deterministic domain/API tests; `npm.cmd run check` checks JavaScript syntax.
- `npm run verify` checks syntax, documentation links and >=91% line coverage separately for backend and frontend. All authored application JS files must appear in coverage. See docs/development/quality-gates.md.
- Install the required local pre-push gate with `npm run hooks:install`. It fails on missing Sonar setup, test/coverage failure or a failed Sonar quality gate. Never skip analysis silently.
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
- Kindergarten email/password accounts and SQLite persistence are explicitly requested. Registration captures the kindergarten name, teacher name, age group and location; the kindergarten name doubles as the group name. Use built-in node:sqlite and crypto; native startup binds loopback. Docker binds the container interface and publishes only on host loopback. No bundler.
- Private plans belong to the authenticated account. Demo data is isolated and must never overwrite real plans.
- Keep the entire UI and generated parent messages in Macedonian and English. Do not use em dashes in parent messages.
- Keep the Monday–Friday week visible; generating midweek leaves earlier days empty. Refreshes must invalidate notice approval.
- Put project documentation in docs/; keep README.md and scoped AGENTS.md at their conventional entry points.
- Update the decision-basis documentation with material changes. Run meaningful tests for decision logic and security boundaries.
- ADRs live in docs/architecture/adrs/; decision rules in docs/architecture/decision-basis.md. Do not rewrite historical records as current verification evidence.

## Team workflow skill

- For requests to continue/reopen PRs or complete the branch, push, PR, merge and pull cycle, read [ekocuvar-pr-workflow](docs/development/skills/ekocuvar-pr-workflow/SKILL.md). Follow its scope and authorization rules; merely loading the skill does not authorize publishing.
