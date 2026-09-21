# ADR-0009: Nedelko as the sole product identity

**Status:** Accepted

**Date:** 2026-09-21

## Context

The product owner requires the project to use only Nedelko (Неделко). Earlier branding remained in developer tooling, storage defaults, browser identifiers and documentation. A text replacement that selects a new empty database or analysis stack would disconnect existing accounts and verification history.

## Decision drivers

- Use one product identity throughout versioned files and paths.
- Preserve account-owned plans, database files, Docker volumes and Sonar history.
- Keep historical verification claims accurate.
- Retain deterministic decision and security boundaries.

## Options considered

1. Rename only visible copy, leaving inconsistent source and tooling names.
2. Rename versioned identifiers and defaults, while retaining existing persistent resources through explicit compatibility settings.
3. Recreate all databases and infrastructure under new names, discarding existing state.

## Decision

Adopt option 2. Use Nedelko in documentation, startup output, provider identification, Postman assets, the repository workflow skill and Sonar configuration. Compose defaults and the Sonar project key are `nedelko`; the quality gate is `Nedelko`. Use `nedelko_session`, `nedelko-language` and `nedelko-visited` for client identity and preferences.

New application installations use `.local/nedelko.sqlite`. If that file is absent, reuse a single existing `.local/*.sqlite` file in place. Multiple candidates fail with a configuration error; `NEDELKO_DATABASE_PATH` explicitly selects a file, relative to the repository root or absolute. Do not copy a live database, rename WAL/SHM files or silently initialize a replacement account store during the branding change.

Existing Compose deployments retain their current project identifier through the standard private `COMPOSE_PROJECT_NAME` setting to preserve volumes. Rename the existing Sonar project key and quality gate in place rather than resetting analysis history or thresholds. New installs use Nedelko defaults.

Remove retired product identifiers from versioned historical documentation and explicitly redact them in the old command transcript. Preserve timestamps, outcomes and original records in Git history; the edited transcript is not evidence of a new branding verification run.

## Consequences

Existing users sign in again and may need to reselect their browser language. Accounts, plans, profiles, parent-link tokens and evidence timestamps remain unchanged. Private persistent resource identifiers may retain installation-specific names; these are compatibility settings, not a second product identity. The repository name remains an administrative choice.

The branding change does not alter air-quality arithmetic, forecast completeness, scheduling, recommendation gates or parent-notice approval. Storage tests verify reuse, account isolation and refusal to guess between database files.

## Related

- [SQLite persistence](0006-sqlite-application-database.md)
- [Local persistence and upgrade behavior](../../operations/local-development.md)
- [Docker persistence](../../operations/docker.md)
- [Sonar setup and history](../../development/quality-gates.md)
