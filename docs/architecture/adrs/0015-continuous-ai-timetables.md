# ADR-0015: Continuous AI timetables

- Status: Accepted
- Date: 2026-09-22
- Supersedes: the AI gap-permitting policy in [ADR-0010](0010-teacher-authored-timetables.md)

## Context and drivers

The model prompt explicitly allowed gaps, and authored timelines bypassed the library's gap-filling grid. A generated day could therefore contain meals and a main lesson while leaving substantial classroom time unplanned. The product owner requires complete schedules with no gaps.

## Alternatives

Change the prompt alone; fill missing time with deterministic library activities; or require complete model-authored schedules in both the prompt and the acceptance checks. Prompt-only enforcement cannot reject malformed output. Library filling can introduce activities unrelated to the teacher's instructions.

## Decision

Require weekly AI timelines and full-day AI edits to cover every minute from configured opening to closing, including any earlier or later requested activities. Breaks, free play, transitions and arrival must be explicit bilingual rows. Preserve teacher-requested content and durations and plan useful activities around them. Validate coverage after overlap resolution. Reject missing, empty or incomplete upcoming model timelines as invalid output through the existing generation-error path; never silently substitute a library plan or stretch a requested activity.

During current-day regeneration, use a server-owned editable boundary at the next local-clock minute. Keep started rows immutable and require coverage of all remaining time. Earlier weekdays remain empty when creating a midweek plan. Reading or refreshing a saved plan must not invent historical activities to repair an old gap. Direct manual edits and activity-only changes retain their existing behavior.

## Consequences

Model requests may now fail instead of saving sparse timetables. Existing plans are not retroactively rewritten; future days can be regenerated. Configured opening/closing hours define the minimum planning window, while explicit requests may extend it. Continuity validation does not assess educational quality or change environmental permissions, ownership or notice approval.

Regression tests reproduce the reported sparse schedule, check opening/internal/closing gaps down to one minute, preserve five-hour requests and locked history, and exercise both weekly and daily model boundaries using synthetic responses.
