# ADR-0011: Consistent activity instructions and conservative refresh display

**Status:** Accepted

**Date:** 2026-09-22

## Context

The repository audit reproduced contradictory indoor notices, stale AQI display, fallback timetable collisions and an inbox response race. Verification also contained obsolete timetable expectations and incomplete quality-policy checks.

## Decision

Use mode-specific bilingual instructions for every eco activity. New model timelines can supply individual `variants.inside` and `variants.outside`; existing records fall back to their accepted lesson. Generic notes cannot override the selected location. Timing-only edits retain server-owned metadata.

Resolve default routine overlaps before selecting free slots. Reject any future observation timestamp. Publish the freshness interval with environmental responses so the browser expires live readings without renewing timestamps; failed refreshes show unknown evidence. Sequence inbox responses around writes and account/demo changes.

Bind paid model work to the HTTP request's abort signal and reject late results before saving. Shared environmental caches keep their independent deadlines because other readers may share the request.

Require every named critical coverage file and both 91% Sonar coverage conditions, plus all inherited Sonar way conditions. Keep historical verification immutable and record new execution separately.

## Consequences

Old plans remain readable. Distinct authored eco activities retain their own variants, while plans without those variants use their existing lesson alternative. Model text still requires teacher review; schemas do not certify educational meaning. Phone/desktop readiness does not change the default loopback hosting boundary.

See the [decision basis](../decision-basis.md) and [current verification](../../development/verification-status.md).
