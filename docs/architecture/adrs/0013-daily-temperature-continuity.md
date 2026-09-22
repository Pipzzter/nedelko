# ADR-0013: Preserve daily temperatures across refreshes

Status: Accepted, 2026-09-22

## Context

A live Tuesday request reproduced an empty Monday temperature because the forecast began today. Short activity windows between hourly samples could also yield no temperature. A cold live request exposed a freshness race: response fetch timestamps followed the request-start time used for age validation, causing valid new forecasts to be classified as future data.

## Decision

Request seven past days and eight forecast days, retaining UTC hourly parsing and Skopje date mapping. The extra forecast day covers the next Friday when local Saturday begins while the provider is still on UTC Friday. Include overlapping hourly samples when summarizing a partial hour. Evaluate freshness with the completion clock, while preserving actual fetch and observation timestamps.

Separate calendar weather presentation from decision evidence. A failed refresh may display recent saved temperatures with explicit provenance and the original fetch timestamp, within the existing 12-hour maximum forecast age. Both teacher and parent calendars use this projection. Unavailable data are labelled instead of appearing to load indefinitely. No temperatures are invented, interpolated or obtained from the model.

## Consequences

An upstream outage does not erase recent available temperature values, but saved display data cannot authorize outdoor scheduling or enter fresh-weather clothing advice. A provider outage without usable cached data, or data beyond the age limit, remains explicitly unavailable. External data availability cannot be guaranteed.

## Verification

Regression cases cover delayed fetch timestamps, midweek and month changes, the local/UTC weekend boundary and daylight-saving transition, sub-hour schedules, zero and negative temperatures, persisted cache recovery, cache expiry, future timestamps, parent projection and bilingual calendar provenance. Live verification uses the actual weather provider separately from synthetic tests.
