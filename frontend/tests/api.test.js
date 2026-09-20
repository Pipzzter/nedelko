import test from 'node:test';
import assert from 'node:assert/strict';
import { api } from '../src/lib/api.js';

function delayedFetch(t, responseAt) {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  t.mock.method(AbortSignal, 'timeout', ms => {
    const controller = new AbortController();
    setTimeout(() => controller.abort(new DOMException('Timed out', 'TimeoutError')), ms);
    return controller.signal;
  });
  t.mock.method(globalThis, 'fetch', (_url, { signal }) => new Promise((resolve, reject) => {
    signal.addEventListener('abort', () => reject(signal.reason), { once: true });
    if (responseAt) setTimeout(() => resolve(Response.json({ source: 'ai' })), responseAt);
  }));
}

test('the browser accepts generation past the old one-minute limit including environmental request time', async t => {
  delayedFetch(t, 210000);
  const pending = api('/week/generate', { settings: {} });
  t.mock.timers.tick(210000);
  assert.deepEqual(await pending, { source: 'ai' });
});

test('generation still expires and tells the caller to check the saved plan before retrying', async t => {
  delayedFetch(t);
  const pending = api('/week/generate', { settings: {} });
  t.mock.timers.tick(240001);
  await assert.rejects(pending, { code: 'generation_timeout' });
});

test('ordinary requests keep their shorter deadline', async t => {
  delayedFetch(t, 70000);
  const pending = api('/dashboard');
  t.mock.timers.tick(60001);
  await assert.rejects(pending, { code: 'network_error' });
});
