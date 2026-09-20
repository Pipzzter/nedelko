import test from 'node:test';
import assert from 'node:assert/strict';
import { parseHTML } from 'linkedom';
import { beginRequest, requestProgress, watchRequests } from '../src/lib/request-progress.js';
import { api } from '../src/lib/api.js';

test('all AI and apply requests report progress without retaining private input, and failures release it', async t => {
  let resolve; const snapshots = []; const unsubscribe = watchRequests(value => snapshots.push(value)); t.after(unsubscribe);
  t.mock.method(globalThis, 'fetch', async () => new Promise(done => { resolve = done; }));
  for (const path of ['/week/generate', '/week/change/suggest', '/week/day/suggest', '/parent-notes/suggest', '/week/change/apply', '/parent-notes/apply']) {
    const pending = api(path, { instruction: 'PRIVATE-TEXT', token: 'PRIVATE-TOKEN' });
    assert.ok(requestProgress().foreground); assert.equal(requestProgress().count, 1);
    resolve(Response.json({ ok: true })); await pending; assert.equal(requestProgress().count, 0);
  }
  const failure = api('/week/generate', {});
  resolve(Response.json({ error: 'ai_retry_failed' }, { status: 503 }));
  await assert.rejects(failure, { code: 'ai_retry_failed' }); assert.equal(requestProgress().foreground, null);
  assert.doesNotMatch(JSON.stringify(snapshots), /PRIVATE/);
});

test('full-screen AI waiting preserves the form, uses real elapsed time and restores interaction', async t => {
  const { window } = parseHTML('<html lang="en"><body><div id="root"></div></body></html>');
  globalThis.window = window; globalThis.document = window.document;
  globalThis.requestAnimationFrame = fn => setTimeout(fn, 0); globalThis.cancelAnimationFrame = clearTimeout;
  const { html, render } = await import('../src/lib/ui.js');
  const { RequestProgress } = await import('../src/components/RequestProgress.js');
  const root = document.getElementById('root');
  render(html`<div id="app-screen"><input value="Keep my draft"/></div><${RequestProgress}/>`, root);
  t.after(() => render(null, root));
  const wait = async predicate => { for (let attempt = 0; attempt < 100; attempt++) { if (predicate()) return; await new Promise(resolve => setTimeout(resolve, 10)); } throw new Error('Progress DOM timed out'); };
  let now = 1000; t.mock.method(performance, 'now', () => now);
  t.mock.timers.enable({ apis: ['setInterval'] });
  const finish = beginRequest('/week/generate');
  await wait(() => document.getElementById('app-screen').hasAttribute('inert'));
  assert.ok(document.querySelector('.ai-loading-screen'));
  assert.equal(document.querySelector('.ai-progress-track').getAttribute('aria-valuenow'), null, 'completion percentage is unknown');
  assert.equal(document.querySelector('input').value, 'Keep my draft');
  now += 65000; t.mock.timers.tick(1000);
  await wait(() => document.querySelector('.elapsed-time time').textContent === '1:05');
  assert.match(document.querySelector('.loading-patience').textContent, /Still waiting/);
  finish(); await wait(() => !document.getElementById('app-screen').hasAttribute('inert'));
  assert.equal(document.querySelector('.ai-loading-screen'), null);
  assert.equal(document.querySelector('input').value, 'Keep my draft');
  const endBackground = beginRequest('/dashboard');
  await wait(() => document.querySelector('.network-progress'));
  assert.equal(document.getElementById('app-screen').hasAttribute('inert'), false, 'background refresh does not blank the page');
  endBackground(); await wait(() => !document.querySelector('.network-progress'));
});
