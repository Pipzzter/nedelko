import test from 'node:test';
import assert from 'node:assert/strict';
import { parseHTML } from 'linkedom';
import { beginRequest, requestProgress, watchRequests, blockingCount, backgroundActive } from '../src/lib/request-progress.js';
import { api } from '../src/lib/api.js';

test('all AI and apply requests report progress without retaining private input, and failures release it', async t => {
  let resolve; const snapshots = []; const unsubscribe = watchRequests(value => snapshots.push(value)); t.after(unsubscribe);
  t.mock.method(globalThis, 'fetch', async () => new Promise(done => { resolve = done; }));
  for (const path of ['/week/generate', '/week/change/suggest', '/week/day/suggest', '/parent-notes/suggest', '/week/day/apply', '/week/change/apply', '/parent-notes/apply']) {
    const pending = api(path, { instruction: 'PRIVATE-TEXT', token: 'PRIVATE-TOKEN' });
    assert.ok(requestProgress().foreground); assert.equal(requestProgress().count, 1);
    assert.equal(blockingCount(), 1); assert.equal(backgroundActive(), false);
    assert.equal(requestProgress().foreground.background, false);
    resolve(Response.json({ ok: true })); await pending; assert.equal(requestProgress().count, 0);
  }
  const failure = api('/week/generate', {});
  resolve(Response.json({ error: 'ai_retry_failed' }, { status: 503 }));
  await assert.rejects(failure, { code: 'ai_retry_failed' }); assert.equal(requestProgress().foreground, null);
  assert.doesNotMatch(JSON.stringify(snapshots), /PRIVATE/);
});

test('bodyless, non-JSON and empty JSON errors retain HTTP status for expired-session handling', async t => {
  for (const response of [new Response(null, { status: 401 }), new Response('Authentication required', { status: 401 }), Response.json(null, { status: 401 }), Response.json({}, { status: 503 })]) {
    t.mock.method(globalThis, 'fetch', async () => response);
    await assert.rejects(api('/dashboard'), { code: 'unexpected_error', status: response.status });
    assert.equal(requestProgress().count, 0);
  }
});

test('explicit background requests cannot acquire the waiting dialog even when their path has an AI phase', async t => {
  let finish;
  t.mock.method(globalThis, 'fetch', () => new Promise(resolve => { finish = resolve; }));
  const pending = api('/week/change/suggest', {}, { background: true });
  assert.equal(blockingCount(), 0);
  assert.equal(requestProgress().foreground, null);
  assert.equal(backgroundActive(), true);
  finish(Response.json({ ok: true })); await pending;
  assert.equal(requestProgress().count, 0);
});

test('modal request progress preserves the form, uses real elapsed time and restores interaction', async t => {
  const { window } = parseHTML('<html lang="en"><body><div id="root"></div></body></html>');
  globalThis.window = window; globalThis.document = window.document;
  globalThis.requestAnimationFrame = fn => setTimeout(fn, 0); globalThis.cancelAnimationFrame = clearTimeout;
  const { html, render } = await import('../src/lib/ui.js');
  const { RequestProgress } = await import('../src/components/RequestProgress.js');
  const root = document.getElementById('root');
  let focusedElement = document.body;
  Object.defineProperty(document, 'activeElement', { configurable: true, get: () => focusedElement });
  const focus = t.mock.method(window.HTMLElement.prototype, 'focus', function () { focusedElement = this; });
  render(html`<div id="app-screen"><input value="Keep my draft"/></div><${RequestProgress}/>`, root);
  t.after(() => render(null, root));
  const wait = async predicate => { for (let attempt = 0; attempt < 100; attempt++) { if (predicate()) return; await new Promise(resolve => setTimeout(resolve, 10)); } throw new Error('Progress DOM timed out'); };
  let now = 1000; t.mock.method(performance, 'now', () => now);
  t.mock.timers.enable({ apis: ['setInterval'] });
  const field = document.querySelector('input'); field.focus();
  for (const path of ['/config', '/dashboard?locationId=centar', '/parent-notes', '/parent-notes?demoId=PRIVATE-DEMO', '/parents/PRIVATE-TOKEN']) {
    const calls = focus.mock.callCount();
    const finishBackground = beginRequest(path); t.after(finishBackground);
    await wait(() => document.querySelector('.network-progress'));
    assert.equal(blockingCount(), 0); assert.equal(backgroundActive(), true);
    assert.equal(requestProgress().foreground, null);
    assert.equal(document.querySelector('[role="dialog"]'), null);
    assert.equal(document.getElementById('app-screen').hasAttribute('inert'), false);
    assert.equal(document.getElementById('app-screen').hasAttribute('aria-hidden'), false);
    assert.equal(document.body.classList.contains('ai-waiting'), false);
    assert.equal(document.querySelector('.network-progress').getAttribute('aria-hidden'), 'true');
    assert.equal(document.activeElement, field); assert.equal(focus.mock.callCount(), calls);
    const tab = new window.Event('keydown', { bubbles: true, cancelable: true }); tab.key = 'Tab';
    field.dispatchEvent(tab); assert.equal(tab.defaultPrevented, false);
    finishBackground(); await wait(() => !document.querySelector('.network-progress'));
  }
  const endBackground = beginRequest('/dashboard'); t.after(endBackground);
  await wait(() => document.querySelector('.network-progress'));
  const finish = beginRequest('/week/generate');
  t.after(finish);
  await wait(() => document.getElementById('app-screen').hasAttribute('inert'));
  assert.ok(document.querySelector('.ai-loading-screen'));
  assert.equal(document.querySelector('.network-progress'), null);
  assert.equal(document.getElementById('app-screen').getAttribute('aria-hidden'), 'true');
  assert.equal(document.activeElement, document.querySelector('[role="dialog"]'));
  assert.equal(document.body.classList.contains('ai-waiting'), true);
  const tab = new window.Event('keydown', { bubbles: true, cancelable: true }); tab.key = 'Tab';
  document.activeElement.dispatchEvent(tab); assert.equal(tab.defaultPrevented, true);
  assert.equal(document.querySelector('.ai-progress-track').getAttribute('aria-valuenow'), null, 'completion percentage is unknown');
  assert.equal(document.querySelector('input').value, 'Keep my draft');
  now += 65000; t.mock.timers.tick(1000);
  await wait(() => document.querySelector('.elapsed-time time').textContent === '1:05');
  assert.match(document.querySelector('.loading-patience').textContent, /Still waiting/);
  finish(); await wait(() => !document.getElementById('app-screen').hasAttribute('inert'));
  assert.equal(document.querySelector('.ai-loading-screen'), null);
  assert.equal(document.activeElement, field);
  assert.ok(document.querySelector('.network-progress'), 'an overlapping background poll continues without the dialog');
  assert.equal(document.querySelector('input').value, 'Keep my draft');
  endBackground(); await wait(() => !document.querySelector('.network-progress'));
});
