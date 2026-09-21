# ADR-0002: Deterministic evidence and scheduling boundaries

**Status:** Accepted

**Date:** 2026-09-21 (retrospective record)

## Context

The planner combines observations, cached responses, forecasts and synthetic demos. Educational suggestions may come from a model; those sources have different authority and freshness.

## Decision drivers

- Missing, suspect, stale or conflicting evidence remains unknown.
- A provisional five-day plan needs a separate same-morning notice check.
- Model output cannot set air-quality facts, closures or permissions.

## Options considered

1. Deterministic domain gates with separately validated model content: reproducible behavior and explicit source authority, at the cost of more validation code.
2. Model-generated decisions and safety claims: flexible language without a reliable arithmetic, timestamp or permission boundary.

## Decision

Keep QC, measurement timestamps, AQI arithmetic, scheduling and recommendation gates in domain code. Failed refreshes cannot renew evidence. Forecast plans remain provisional; notice approval requires a same-morning recheck and is invalidated by refreshes and edits. Weather limits are logistics preferences. Model output is validated and teachers confirm applicable constraints.

## Consequences

Use deterministic clocks and synthetic provider fixtures, including failure and stale-cache paths. PM2.5 screening cannot certify complete air quality or individual health. Docker and quality tooling do not change the evidence policy.

## Related

[Decision basis](../decision-basis.md), [sources](../../reference/sources.md), [test strategy](0005-local-quality-gates.md).
