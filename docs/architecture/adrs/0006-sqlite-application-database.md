# ADR-0006: SQLite as the application database

**Status:** Accepted

**Date:** 2026-09-21 (retrospective record)

## Context

Kindergarten accounts, profiles, plans and parent notes must survive application restarts. The application currently runs as one local Node process, either natively or in Docker. The project explicitly requires SQLite through built-in `node:sqlite`, without server runtime packages.

This record documents the existing database choice and its limits. It complements [ADR-0003](0003-account-ownership-and-parent-links.md), which covers authentication and ownership; it does not introduce a database migration or claim a measured capacity benchmark. SonarQube's PostgreSQL database is separate analysis infrastructure, not the application's datastore.

## Decision drivers

- Persistent relational data without a separate application database service, driver package or ORM.
- The same storage implementation for native startup, Docker and automated tests.
- Account ownership, referential integrity and detection of stale plan writes.
- Straightforward local backup and inspection, with explicit concurrency and operational limits.

## Options considered

| Option | Benefits | Costs and fit |
| --- | --- | --- |
| SQLite through `node:sqlite` | Embedded storage, SQL constraints and no extra runtime package or database service | Synchronous access and serialized writes require bounded work; fits the current local process |
| PostgreSQL for application data | A separately managed database suitable for a future shared service | Adds a driver, service lifecycle, credentials and deployment requirements; conflicts with the present runtime constraints |
| JSON files or browser storage | Simple for disposable examples | Application code would need to implement consistency, ownership queries and coordinated updates; unsuitable for the requested account persistence |

## Decision

Use `DatabaseSync` from `node:sqlite` behind the storage functions in `backend/storage/`. Keep SQL out of browser and domain modules. The current schema is:

| Table | Stored data |
| --- | --- |
| `users` | Account identifier, normalized login, teacher display name and password hash |
| `sessions` | Hashed session token, account reference and expiry |
| `group_profiles` | Reusable kindergarten settings as JSON text |
| `weeks` | Account/week key, validated plan as JSON text and revision number |
| `parent_links` | Expiring, revocable sharing tokens tied to an account/week |
| `parent_notes` | Account/week-scoped notes, submission nonce, status and optional advice |

The native database is `.local/ekocuvar.sqlite`. Docker stores it at `/app/.local/ekocuvar.sqlite` in the `app_data` named volume. These are independent stores; container startup does not import native accounts. Demo plans remain in memory and provider responses use a separate cache.

The store requests `journal_mode=WAL`, enables `foreign_keys=ON` and sets `busy_timeout=5000`. Queries bind values through prepared statements. Ownership is enforced through authenticated account IDs and scoped queries, not through database users or an RBAC system.

Plan updates compare the expected revision in the SQL write. Deletion retains a revision tombstone so an old browser tab cannot overwrite a regenerated week. In-process request locks coordinate application operations; they are not locks shared between server replicas. Existing multi-statement operations are not documented as one atomic transaction: changes requiring all-or-nothing behavior across statements need an explicit transaction and regression tests.

The current initializer uses `CREATE TABLE/INDEX IF NOT EXISTS`; there is no versioned migration runner. Existing databases are not upgraded merely by changing a create statement. Introduce ordered, tested migrations before an incompatible schema change, and retain a recoverable backup.

## Consequences

- The app starts without a database daemon or package installation. Tests can use the same SQLite engine with in-memory or temporary on-disk databases.
- Database calls execute synchronously in the server process. Keep queries and writes small; a lock wait or expensive query can delay other requests. This decision does not establish a throughput or latency guarantee.
- WAL permits readers alongside a writer but still allows only one writer at a time. Its shared-memory coordination requires the same host; do not place this database on a network filesystem. See the [SQLite WAL documentation](https://sqlite.org/wal.html).
- The database is not encrypted by this application. Protect database files, volumes and backups with filesystem access controls; hashed passwords and sessions do not encrypt plan or note content.
- Stop the app before a simple file backup and copy its data directory using the [documented backup procedure](../../operations/docker.md#persistence-and-backups). Copying only the main database while it is active can omit committed changes still in the WAL. See [SQLite's WAL file guidance](https://sqlite.org/wal.html#the_wal_file).
- JSON plan snapshots keep a whole validated plan together, but deep reporting and schema evolution need application validation or deliberate normalization. SQL constraints do not validate every field inside those JSON payloads.

Revisit this choice before running multiple app instances against shared data, requiring remote database access or high availability, or when measured write contention and event-loop delays exceed the application's needs. A move to PostgreSQL would require a new ADR and a tested data migration, not just a Compose service change.

## Verification

The [storage regression test](../../../backend/tests/storage.test.js) closes and reopens a temporary SQLite file and checks persistence, account isolation and session expiry. API tests exercise ownership and revision behavior. This ADR adds documentation only; it does not claim that the full suite, Docker persistence or a backup restore has been verified in this session. See [verification status](../../development/verification-status.md).

## Related

[Storage implementation](../../../backend/storage/database.js), [parent-note storage](../../../backend/storage/parent-notes.js), [ADR-0003: account ownership](0003-account-ownership-and-parent-links.md), [ADR-0004: Docker persistence](0004-containerized-local-stack.md), [local operation](../../operations/local-development.md).
