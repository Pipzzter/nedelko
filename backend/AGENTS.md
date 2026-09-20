# Backend

- Built-in Node HTTP, fetch, filesystem, crypto, node:sqlite, and node:test. Passwords use async salted scrypt. Sessions use random opaque cookies and hashed storage.
- Bind to loopback. Serve only frontend/ static files; never project-root files.
- Reject oversized/invalid bodies, cross-origin mutations, and unrecognised location/scenario values.
- Keep domain functions pure and injectable clocks/fetch for tests.
- Never accept a verdict, AQI, source URL, or sensor values from the client/model as trusted evidence.
- Recompute decisions on the server. Approval records reference a server-generated plan; rechecks invalidate approval.
- Upstream requests use allowlisted hosts, deadlines, bounded bodies, cache timestamps, and stale fallbacks.
- AQI breakpoints use EPA May 2024 PM2.5 ranges. NowCast uses hourly history and needs at least two of the latest three hourly buckets.
- Keep weekly forecast drafts separate from same-day decisions. A future forecast alone cannot create an approved parent notice.
- Screen hourly apparent temperature, precipitation, rain probability, and wind against validated teacher preferences in deterministic code.
- Demo fixtures must contain explicit provenance. Document the conservative prototype policies separately from EPA rules.
- Split HTTP, domain, services, config and storage. All stored-week reads and writes must be scoped to the authenticated account. Use revision checks and request locks to avoid lost updates.
- Never trust client verdicts, forecast values, message facts, approval records, account IDs or generated plan dates.
