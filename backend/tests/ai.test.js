import test from 'node:test';
import assert from 'node:assert/strict';
import { structuredResponse, aiStatus } from '../services/ai.js';
import { aiFailure } from '../services/ai-errors.js';

function key(t) { const original = process.env.OPENAI_API_KEY; process.env.OPENAI_API_KEY = 'test-key-not-real'; t.after(() => { if (original === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = original; }); }
function setting(t, name, value) {
  const previous = process.env[name];
  if (value === undefined) delete process.env[name]; else process.env[name] = value;
  t.after(() => { if (previous === undefined) delete process.env[name]; else process.env[name] = previous; });
}
test('Fast mode is requested centrally and reports the actual provider tier without assuming a speedup', async t => {
  key(t); setting(t, 'OPENAI_MODEL', 'gpt-5.6-sol'); setting(t, 'OPENAI_SERVICE_TIER', 'fast');
  assert.deepEqual(aiStatus(), { configured: true, model: 'gpt-5.6-sol', serviceTier: 'fast' });
  for (const servedTier of ['priority', 'default', undefined]) {
    const result = await structuredResponse({ schema: {}, name: 'fast_test', input: 'fixture', reasoningEffort: 'medium',
      fetcher: async (_url, options) => {
        const body = JSON.parse(options.body);
        assert.equal(body.service_tier, 'fast'); assert.equal(body.model, 'gpt-5.6-sol');
        assert.deepEqual(body.reasoning, { effort: 'medium' });
        return Response.json({ status: 'completed', service_tier: servedTier,
          usage: { input_tokens: 20, output_tokens: 5 },
          output: [{ type: 'message', content: [{ type: 'output_text', text: '{"ok":true}' }] }] });
      } });
    assert.equal(result.processing.requestedServiceTier, 'fast');
    assert.equal(result.processing.serviceTier, servedTier ?? null);
    assert.equal(result.processing.model, 'gpt-5.6-sol');
    assert.ok(Number.isInteger(result.processing.durationMs) && result.processing.durationMs >= 0);
    assert.deepEqual(result.usage, { input: 20, output: 5 });
  }
});
test('tier overrides preserve the configured model and an unset tier follows project settings', async t => {
  key(t); setting(t, 'OPENAI_MODEL', undefined); setting(t, 'OPENAI_SERVICE_TIER', undefined);
  assert.equal(aiStatus().model, 'gpt-5.6-sol');
  for (const configured of [undefined, '', '  ', 'default', 'priority', 'ultrafast', 'flex']) {
    if (configured === undefined) delete process.env.OPENAI_SERVICE_TIER;
    else process.env.OPENAI_SERVICE_TIER = configured;
    await structuredResponse({ schema: {}, name: 'tier_test', input: 'fixture', fetcher: async (_url, options) => {
      assert.equal(JSON.parse(options.body).service_tier, configured?.trim() || 'auto');
      return Response.json({ status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: '{"ok":true}' }] }] });
    } });
  }
});
test('a rejected service tier fails once instead of silently retrying a different tier', async t => {
  key(t); setting(t, 'OPENAI_SERVICE_TIER', 'fast'); let calls = 0;
  await assert.rejects(structuredResponse({ schema: {}, name: 'tier_test', input: 'fixture', fetcher: async () => {
    calls++;
    return Response.json({ error: { type: 'invalid_request_error' } }, { status: 400 });
  } }), error => error.providerStatus === 400);
  assert.equal(calls, 1);
});
test('low reasoning preserves the configured model and is omitted for other model families', async t => {
  key(t); const previous = process.env.OPENAI_MODEL;
  t.after(() => { if (previous === undefined) delete process.env.OPENAI_MODEL; else process.env.OPENAI_MODEL = previous; });
  for (const model of ['gpt-5.6-terra', 'gpt-5.6-sol', 'gpt-5.6-luna', 'gpt-6-astra', 'gpt-4.1']) {
    process.env.OPENAI_MODEL = model;
    await structuredResponse({ schema: {}, name: 'test', input: 'x', reasoningEffort: 'low', fetcher: async (_url, options) => {
      const body = JSON.parse(options.body);
      assert.equal(body.model, model);
      assert.deepEqual(body.reasoning, model === 'gpt-4.1' ? undefined : { effort: 'low' });
      assert.equal(options.redirect, 'error');
      return Response.json({ status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: '{"ok":true}' }] }] });
    } });
  }
});
test('oversized provider responses are cancelled before parsing', async t => {
  key(t); let cancelled = false;
  await assert.rejects(structuredResponse({ schema: {}, name: 'test', input: 'x', fetcher: async () => new Response(new ReadableStream({
    start(controller) { controller.enqueue(new Uint8Array(600000)); controller.enqueue(new Uint8Array(600000)); },
    cancel() { cancelled = true; },
  })) }), /response-too-large/);
  assert.equal(cancelled, true);
});
test('Responses API uses strict JSON schema, store:false, and keeps credentials in the header', async (t) => {
  key(t);
  const result = await structuredResponse({ instructions: 'extract a schedule', input: 'untrusted text', schema: { type: 'object' }, name: 'test_schema', fetcher: async (url, options) => {
    assert.equal(url, 'https://api.openai.com/v1/responses');
    const body = JSON.parse(options.body); assert.equal(body.store, false); assert.equal(body.text.format.strict, true);
    assert.equal(body.input, 'untrusted text'); assert.equal(body.text.format.type, 'json_schema');
    assert.doesNotMatch(options.body, /test-key-not-real/);
    return Response.json({ status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: '{"ok":true}' }] }] });
  } });
  assert.deepEqual(result.value, { ok: true });
});
test('incomplete and refusal responses are never accepted as structured output', async (t) => {
  key(t);
  for (const result of [{ status: 'incomplete' }, { status: 'completed', output: [{ type: 'message', content: [{ type: 'refusal', refusal: 'No' }] }] }]) {
    await assert.rejects(structuredResponse({ schema: {}, name: 'test', input: 'x', fetcher: async () => Response.json(result) }));
  }
});
test('provider authentication failure is reported without exposing provider text or credentials', async (t) => {
  key(t);
  let error;
  try {
    await structuredResponse({ schema: {}, name: 'test', input: 'x', fetcher: async () => Response.json({
      error: { code: 'invalid_api_key', message: 'secret provider detail' },
    }, { status: 401 }) });
  } catch (caught) { error = caught; }
  assert.equal(error.providerStatus, 401); assert.equal(error.providerCode, 'invalid_api_key');
  assert.equal(aiFailure(error).issue, 'ai_auth');
  assert.doesNotMatch(JSON.stringify(aiFailure(error)), /secret|test-key-not-real/);
});
