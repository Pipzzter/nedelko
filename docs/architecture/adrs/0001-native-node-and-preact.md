# ADR-0001: Native Node and local Preact without a build step

**Status:** Accepted

**Date:** 2026-09-21 (retrospective record)

## Context

The local planner separates browser UI, HTTP transport, deterministic domain logic, provider services and persistence. It must remain easy to inspect and start.

## Decision drivers

- Node 24+ and zero server runtime dependencies.
- Macedonian and English UI with accessible native controls.
- No bundler, runtime CDN or separate frontend server.

## Options considered

1. Native Node HTTP and vendored Preact/HTM: small runtime and direct debugging; HTTP/security responsibilities remain with the project.
2. A framework backend and bundled SPA: more conventions but additional dependencies, build steps and migration work.

## Decision

Keep `backend/` and `frontend/` separate. Node serves only frontend assets and the same-origin API. Browser modules use pinned Preact 10.29.8 and HTM 3.1.1. Domain functions remain independently testable; `linkedom` is development-only.

## Consequences

`npm start` works without dependency installation. Vendored licenses stay in the repository. Framework defaults cannot be assumed: origin checks, request limits, sessions and static-file restrictions need explicit tests. Docker packages the same files without a build/install stage.

## Related

[Architecture overview](../overview.md), [third-party notices](../../reference/third-party.md), [Docker decision](0004-containerized-local-stack.md).
