# ADR-0010: Teacher-authored per-day timetables

Status: Accepted, 2026-09-21

## Context

The fixed-grid generator and protected meal/rest policy rejected ordinary teacher requests and prevented parent-note suggestions from changing routines. The product owner requested full per-day schedule authorship and selected automatic overlap resolution.

## Decision

Each generated day carries a complete bilingual timeline. The teacher brief overrides default hours, routine blocks and duration. Meals and rest are optional; long activities, gaps, empty days and multiple eco rows are valid. Explicit changes can extend the default day. Overlaps move subsequent rows later in authored order while retaining their duration. All times remain valid HH:MM values on the same date.

The server validates integrity, ownership and revision. It rejects invalid intervals, duplicate IDs, unknown kinds, oversized row arrays and changes to already-started rows. Started content and times are immutable in direct edits, model proposals and regeneration. The deterministic grid is a fallback when AI is off or a day has no supplied timeline.

Day prompts and parent-note changes use the same day generator and validator. Day prompt submission applies the validated change; parent notes still require teacher review and confirmation. Neither path authorizes a parent or model to provide environmental evidence.

Environmental adaptation checks every remaining eco interval, including all hours of long activities. Authored rows survive refresh unchanged. Missing evidence remains unknown, future outdoor plans remain provisional, and refresh or edits invalidate notice approval.

## Alternatives

- Keeping protected routines contradicts the requested scheduling control.
- Rendering literal overlaps was proposed initially; the product owner selected automatic resolution instead.
- Shortening activities to fit defaults changes the teacher's requested duration and was rejected.

## Consequences

Timetables may be impractical; this is not grounds for normalizing an ordinary request. Shifting overlaps can extend the day. A request that cannot remain within a single calendar date fails time integrity validation. Timetable authorship does not imply medical or environmental clearance.

This supersedes fixed-grid and protected-routine descriptions in earlier scheduling documentation. Historical ADRs and verification evidence remain historical. Current rules are in the [decision basis](../decision-basis.md).
