# ADR-0012: Make teacher instructions the planning specification

Status: Accepted, 2026-09-22

## Context

The create form transported its brief correctly, but it appeared only in the model input after extensive generic activity and mandatory holiday instructions. Real first-time generation could save a library fallback that did not interpret the brief. Numbered topics were assigned by textual order rather than their requested weekday.

## Decision

Place the complete quoted brief first in top-level model instructions. Share the planning precedence with daily edits; a latest change overrides the older brief. Teacher content, activities, weekdays and timing override editable routine defaults and optional seasonal/holiday ideas. Supply weekday names next to server-owned dates. Retain explicit Day 1–5 positions and keep unnamed topics distributable across remaining days.

Validate clear single-day duration and clock-time requirements against the timeline after collision resolution. Preserve requested durations beyond default hours and meal/rest blocks. Do not interpret ambiguous, revised or relative timing as an exact constraint. Always pass the complete prose to the model; these deterministic checks are a limited additional guard, not a natural-language compiler or semantic fidelity score.

Reject failed real generation before saving, including the first attempt. Keep library plans in the explicit demo and retain the form and existing real plan on failure. No extra confirmation step or duration cap is added. Ownership, elapsed rows, schema, selected materials and environmental evidence remain application boundaries.

## Verification

Regression tests cover brief transport and retention in the DOM/HTTP flow, ordinary-prose fallback rejection, numbered-day mapping, English/Cyrillic/Latin-Macedonian duration extraction, shifted exact times, and a five-hour Monday row through calendar assembly. Live model evidence is separate from deterministic tests and uses isolated accounts and synthetic conditions.

## Consequences

Real planning requires a working configured AI provider. Holidays no longer hijack teacher-requested content. Natural-language interpretation still depends on the model; passing structure and timing checks does not establish perfect semantic compliance. Medium reasoning uses more provider computation than the former low setting. No provider retry loop is introduced.
