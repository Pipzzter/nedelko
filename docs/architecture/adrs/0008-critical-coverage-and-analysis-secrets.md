# ADR-0008: Critical coverage floors and private analysis setup

**Status:** Accepted

**Date:** 2026-09-21

## Context

The existing local gate requires at least 91% line coverage independently for backend and frontend, complete authored-source inventory and a passing SonarQube analysis before source pushes. An aggregate percentage can hide weak coverage in an individual authentication, HTTP or decision module. The analysis Compose stack also previously supplied a default database password.

## Decision drivers

- Critical security and evidence modules need an explicit coverage floor.
- Existing aggregate coverage and source-inventory guarantees must remain intact.
- Local analysis must fail clearly when required private configuration is absent.
- Existing Sonar history and database volumes must remain usable.

## Options considered

1. Keep only aggregate floors and the default database password. Setup is shorter, but individual critical gaps and an unchanged shared credential remain easy to miss.
2. Add selected per-file floors and require a private database password before analysis starts, while preserving existing aggregate gates and volumes.
3. Require the same floor for every tooling and application file. This broadens the policy beyond the identified critical modules and would need a separate review of coverage semantics and test value.

## Decision

Adopt option 2. Require at least 90% native V8 line coverage in each of nine backend files: `services/auth.js`, `http/app.js`, `http/security.js`, and domain `week.js`, `settings.js`, `constraints.js`, `preferences.js`, `qc.js` and `aqi.js`. The backend/frontend aggregate floors remain 91%, with all authored application JavaScript represented. Missing or below-floor critical files fail verification and appear in the coverage summary.

Require `SONAR_DB_PASSWORD` in the private `static-analysis/.env` before starting the analysis stack. Compose has no default password. New installations choose it before initializing PostgreSQL; existing installations retain the password matching their volumes. Editing the environment does not rotate an initialized database role password.

The required local hook still runs tests, coverage and Sonar without a silent skip. The hostile-PATH regression uses a platform-appropriate command shim on Windows. Tooling fixtures isolate inherited Git environment variables so pre-push tests cannot modify the invoking repository's configuration.

## Consequences

Maintainers must supply private analysis configuration before startup and review individual critical-file failures as well as aggregate results. A coverage percentage measures executed lines, not assertion quality or proof of security. Meaningful boundary tests and Sonar issue review remain necessary. The nine-file list is deliberate policy; additions require review rather than automatic exclusion of difficult code.

Local hooks remain bypassable through Git configuration, so centrally mandatory enforcement still needs a remote policy. This change does not claim a production secret-management system or a fresh-machine setup result.

## Related

- [Original local quality-gate decision](0005-local-quality-gates.md)
- [Current gate policy and setup](../../development/quality-gates.md)
- [Docker operation and persistence](../../operations/docker.md)
- [Verification record](../../development/verification-status.md)
