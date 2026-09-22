# ADR-0014: Configurable OpenAI Fast mode

- Status: Accepted
- Date: 2026-09-22

## Context and drivers

The product owner requested lower AI latency, explicitly choosing GPT-5.6 Sol with Fast mode. Every model operation already uses one shared Responses API client. Processing tier and model choice must remain distinct from generation correctness and deterministic environmental rules.

## Alternatives

Keep project-default processing; configure Fast mode only in the external API project; or send an explicit application-owned setting on every model call. The access-controlled Ultrafast tier is a separate option requiring provider access, not an assumed entitlement.

## Decision

Use `gpt-5.6-sol` as the model fallback and example configuration. Add `OPENAI_SERVICE_TIER=fast` to the example environment, forward it through Docker and pass it as `service_tier` in every shared-client request. Existing environments without a tier continue to request `auto`. Preserve all schema checks, teacher instructions, reasoning levels, output budgets, deadlines and cancellation behavior.

Return internal processing metadata with requested model/tier, actual provider tier (or null) and elapsed milliseconds. The public configuration reports the requested setting only. Do not retry or silently select a slower tier when a request fails.

## Consequences

Fast mode incurs premium per-token pricing. Requesting it is not proof of a speedup or the tier ultimately used: a response may report `priority` or `default`. Diagnostics do not include raw prompts or credentials and are not added to stored plans. Model availability and processing access remain provider/account-dependent. Tests use mocked providers; any live verification is separately identified.

## References

- [OpenAI Fast mode](https://developers.openai.com/api/docs/guides/fast-mode)
- [Responses API service tier](https://developers.openai.com/api/reference/cli/resources/responses/methods/create)
- [Local configuration](../../operations/local-development.md)
