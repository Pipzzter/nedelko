# ADR-0007: Conservative forecast and refresh boundaries

**Status:** Accepted

**Date:** 2026-09-21

## Context

A future eco lesson previously could remain a weather-only outdoor draft when regional air forecasts did not cover its full window. Missing evidence must remain unknown. Separately, dashboard reads used the ordinary save path, advancing edit revisions and causing conflicts during passive polling. Removing those conflicts must not preserve notice approval after evidence changes.

## Decision drivers

- Future outdoor drafts need complete evidence for their whole eco slot.
- Models and teacher preferences cannot make missing evidence favourable.
- Passive reads should avoid unnecessary edit conflicts while durably invalidating approval.
- Public parent views must remain available during an owner write without implying a fresh check.

## Options considered

1. Retain weather-only future drafts and revision-changing reads. This preserves earlier behavior but leaves incomplete future evidence eligible and turns ordinary polling into edit conflicts.
2. Require complete future air forecasts and separate persisted refreshes from teacher edit revisions, retaining explicit approval invalidation and conservative parent projections.

## Decision

Adopt option 2. Every touched hour of a future eco slot must have a finite, nonnegative PM2.5 forecast from an available source. Missing or partial coverage produces `air_forecast_unavailable`, an indoor provisional lesson, and no outdoor-target or replacement eligibility. Today's existing observation gate remains separate: complete weather and valid local observations can support its weather-only status without a regional forecast.

Dashboard refreshes persist adaptation without advancing the edit revision. They clear approval and check state and invalidate pending proposals before upstream work. A failed provider refresh cannot leave an old approval valid. Explicit saves and worker refreshes retain their revision behavior.

A parent read skips a due refresh while an owner write is active. It screens the stored plan against available conditions, retains the stored evidence-check timestamp, and rechecks link authorization after asynchronous work. This is a conservative projection, not a newly persisted morning check.

The shared preference validator supplies server bounds and `/api/config` exposes them for browser controls. These values remain editable logistics preferences, not health thresholds. `createWeek` also validates supplied sessions at its own domain boundary, independently of the model-service caller.

## Consequences

Incomplete future air coverage can reduce the requested outdoor-day count. The UI explains the unavailable forecast instead of treating it as clean air. Teacher edits still conflict after a real newer save; revision stability is not a general merge policy. Passive reads still invalidate approval and proposals as required by the evidence rules.

Regression tests cover partial and missing future forecasts, the same-day exception, both preference validation entry points, session validation at `createWeek`, stable dashboard revisions, durable approval invalidation and parent reads during owner writes. Passing tests do not certify environmental suitability or actual teacher use.

## Related

- [Current decision basis](../decision-basis.md)
- [Deterministic evidence boundary](0002-deterministic-evidence-boundaries.md)
- [Account ownership and parent links](0003-account-ownership-and-parent-links.md)
- [Verification record](../../development/verification-status.md)
