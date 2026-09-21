# ADR-0003: SQLite ownership, opaque sessions and parent links

**Status:** Accepted

**Date:** 2026-09-21 (retrospective record)

## Context

Kindergarten email/password accounts and persistence are required. Plans and private text must remain isolated from other accounts, demos and family responses.

## Decision drivers

- Built-in `node:sqlite` and `crypto`, with local persistence.
- Enforced ownership and protection from stale edits.
- Revocable family access without claiming identity verification.

## Options considered

1. Opaque cookie sessions, account-scoped rows and bearer sharing links: fits the local product and supports revocation.
2. JWT roles and Parent/Teacher accounts: adds an invitation and identity model not currently implemented.

## Decision

Use salted asynchronous scrypt passwords and random session tokens stored as hashes. Scope real plans and notes to the authenticated account, use revisions and locks, and isolate demos in memory. Parents use expiring, revocable links to a projected view and can submit notes. They cannot edit plans or approve notices. There is no RBAC role field or permission matrix.

## Consequences

Test account isolation, cross-origin writes, stale revisions, expiry, revocation and private-field projection. A copied parent URL is bearer access, not verified identity. Production HTTPS, recovery, delivery and multi-role membership require separate decisions.

## Related

[Architecture overview](../overview.md), [local operation](../../operations/local-development.md), [Docker persistence](0004-containerized-local-stack.md), [SQLite database choice](0006-sqlite-application-database.md).
