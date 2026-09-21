# ADR-0005: Complete coverage reports and required local push gates

**Status:** Accepted

**Date:** 2026-09-21

## Context

Existing tests have no enforced coverage minimum. The requested workflow needs above-90% coverage, local analysis and tests before every push. The reference project demonstrates layered tests and quality-gate waiting; its missing-token skip is unsuitable here.

## Decision drivers

- Domain, API, SQLite and DOM tests without live providers.
- Cover all authored application modules, including ones never imported by tests.
- Unavailable or failed analysis blocks source pushes.
- Tested source matches the pushed ref.

## Options considered

1. Native `node:test` V8 coverage, explicit source inventory and LCOV: no new coverage dependency; direct Sonar integration.
2. Report only imported modules: simple, but hides untested files.
3. Optional scans or remote-only CI: does not implement the requested local gate.

## Decision

Require **at least 91% native V8 line coverage independently for backend and frontend**. Include every authored JS module under `backend/` and `frontend/src/`, including startup, configuration, UI and translations; exclude tests and third-party vendor code. Fail if any source file is absent from LCOV. Report functions/branches without claiming the same threshold for those metrics. Tooling has regression tests and Sonar analysis, outside application coverage.

`npm run verify` checks syntax, documentation links, tests and coverage. The versioned `pre-push` hook also runs Docker SonarScanner and waits for a passing server gate. The Sonar gate inherits Sonar way and requires overall line coverage and new-code coverage of at least 91%. Its combined new-code coverage metric can be stricter than native line coverage.

Install the hook once per clone; preserve existing custom hook paths. Missing tokens, Docker/Sonar failures, failing tests and inadequate coverage fail closed. Source refs must resolve to clean checked-out HEAD; push other tips separately. Check HEAD and the tree before/after analysis. Deletion-only pushes have no code to test. `npm run gate` permits uncommitted development verification, which does not certify a later push.

## Consequences

V8 line accounting does not prove behavior or replace assertions. Sonar can identify existing issues after tests pass. Configuring a minimum is not proof that the suite achieves it. Local hooks are bypassable; remote enforcement needs a separate CI/server policy. Dirty-tree checks are conservative and cannot prevent every concurrent edit race.

## Related

[Quality gate guide](../../development/quality-gates.md), [verification status](../../development/verification-status.md), [Docker stack](0004-containerized-local-stack.md).
