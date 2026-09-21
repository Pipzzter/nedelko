# ADR-0004: Containerized application and local SonarQube

**Status:** Accepted

**Date:** 2026-09-21

## Context

The requested stack starts the app and SonarQube through one Compose file. The reference project keeps Sonar outside Compose; that choice does not meet this project’s explicit requirement.

## Decision drivers

- Keep the native no-build, dependency-free runtime.
- Preserve data and exclude secrets from images and scanner mounts.
- Retain local-only access with Docker port forwarding.

## Options considered

1. App, Sonar and PostgreSQL in one file, with a one-shot scanner profile: consistent setup and separate analysis/runtime lifecycles.
2. A manually managed external Sonar: lighter app startup, but fragmented setup.
3. Gate app startup on analysis: makes the app unavailable when analysis fails and mixes lifecycles.

## Decision

Use a non-root Node 24 image with a read-only filesystem, writable SQLite/cache volumes and no copied credentials or tests. Native startup defaults to `127.0.0.1`; Docker uses `BIND_HOST=0.0.0.0` inside its namespace and publishes only `127.0.0.1:4173`. Existing Host/origin validation remains active.

SonarQube Community Build uses its own PostgreSQL and named volumes on a separate network, with host access only through loopback. The scanner mounts selected source and coverage read-only and waits for a quality-gate verdict. The app can start alone. Versioned image tags make upgrades explicit; they are not immutable digest pins.

## Consequences

Sonar needs memory and Linux Elasticsearch prerequisites. First-time admin password/token setup is required. Native and Docker SQLite stores are separate. `docker compose down` retains data. Static validation is not proof of a healthy stack; integration execution requires Docker access.

## Related

[Docker operation](../../operations/docker.md), [quality gates](0005-local-quality-gates.md), [verification status](../../development/verification-status.md).
