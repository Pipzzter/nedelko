import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { parseHTML } from 'linkedom';
import { createApp } from '../../backend/http/app.js';
import { openStore } from '../../backend/storage/database.js';
import { demoConditions } from '../../backend/services/conditions.js';
import { createCurriculum } from '../../backend/services/curriculum.js';
import { LOCATIONS } from '../../backend/config/index.js';
import { demoWeekById } from '../../backend/config/demo.js';

test('demo uses the planner and shared parent page; links, languages and isolated deep links work', async t => {
  const server = createApp({ store: openStore(':memory:'),
    conditionsProvider: async ({ locationId = 'centar', scenario = 'normal', demoWeek }) => demoConditions(LOCATIONS.find(l => l.id === locationId), scenario, Date.now(), demoWeekById(demoWeek)),
    curriculumProvider: (dates, settings, options) => { assert.equal(options.useAI, false); return createCurriculum(dates, settings, options); } });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;
  const nativeFetch = globalThis.fetch;
  const { window } = parseHTML('<html><body><div id="app"></div></body></html>');
  window.location = { hash: '#home', href: base + '/#home', hostname: '127.0.0.1' };
  window.history = { pushState: (_a, _b, hash) => { window.location.hash = hash; } }; window.scrollTo = () => {};
  globalThis.window = window; globalThis.document = window.document;
  const languages = new Map([['eko-language', 'en']]);
  globalThis.localStorage = { getItem: key => languages.get(key), setItem: (key, value) => languages.set(key, value) };
  globalThis.requestAnimationFrame = fn => setTimeout(fn, 0); globalThis.cancelAnimationFrame = clearTimeout;
  globalThis.fetch = (path, opts) => nativeFetch(typeof path === 'string' && path.startsWith('/') ? base + path : path, opts);
  t.after(async () => {
    const { render } = await import('../../frontend/vendor/preact.js'); render(null, document.getElementById('app'));
    globalThis.fetch = nativeFetch;
    await new Promise(resolve => { server.close(resolve); server.closeAllConnections(); });
  });
  const wait = async predicate => {
    const until = Date.now() + 4000;
    while (!predicate()) { if (Date.now() > until) throw new Error('DOM timeout: ' + document.body.textContent.slice(-1000)); await new Promise(resolve => setTimeout(resolve, 10)); }
  };
  const click = label => {
    const node = [...document.querySelectorAll('button,a')].find(n => n.textContent.trim() === label);
    assert.ok(node, `control ${label}`); node.dispatchEvent(new window.Event('click', { bubbles: true }));
  };
  const route = hash => { window.location.hash = hash; window.dispatchEvent(new window.Event('hashchange')); };
  await import('../../frontend/src/app.js');
  await wait(() => document.querySelector('.auth-card'));
  click('Explore a sample week'); await wait(() => document.querySelector('.day-plan'));
  const teacherPath = window.location.hash;
  assert.equal(document.querySelectorAll('.calendar-day').length, 5);
  assert.deepEqual([...document.querySelectorAll('.sidebar nav a')].map(link => link.textContent.trim()), ['Home']);
  click('Regenerate week'); await wait(() => document.querySelector('.planning-replace'));
  assert.equal(window.location.hash, teacherPath);
  assert.match(document.querySelector('.planning-replace').textContent, /replaces this week’s activities/);
  const confirmation = document.querySelector('#plan-rhythmConfirmed');
  confirmation.checked = true; confirmation.dispatchEvent(new window.Event('change', { bubbles: true }));
  await new Promise(resolve => setTimeout(resolve, 0));
  document.querySelector('.plan-builder').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
  await wait(() => document.querySelector('.day-plan'));
  assert.equal(window.location.hash, teacherPath);
  assert.equal(document.querySelector('.sidebar nav [aria-current="page"]').textContent.trim(), 'Home');
  assert.equal(document.querySelector('.calendar-day').getAttribute('data-date'), '2026-09-07');
  click('Home'); await wait(() => document.querySelector('.day-plan'));
  assert.equal(document.querySelector('.share-url'), null);
  click('Create parent link'); await wait(() => document.querySelector('.share-url'));
  const parentPath = new URL(document.querySelector('.share-url').value).hash;
  route(parentPath); await wait(() => document.querySelector('.parent-day-detail'));
  assert.equal(document.querySelectorAll('.parent-day-tile').length, 5);
  assert.equal(document.querySelector('.sidebar, form, textarea, input'), null, 'parents use the same read-only weekly page');
  assert.match(document.querySelector('.demo-banner').textContent, /DEMO/);
  assert.match(document.querySelector('.parent-access-note').textContent, /Parents don’t need an account/);
  click('МК'); await wait(() => document.documentElement.lang === 'mk');
  assert.match(document.querySelector('.parent-week-note').textContent, /Почитувани родители/);
  click('EN'); await wait(() => document.documentElement.lang === 'en');
  route(teacherPath.replace(/home$/, 'classroom')); await wait(() => document.querySelector('.day-plan'));
  assert.equal(document.querySelector('.sidebar nav a[aria-current="page"]').textContent.trim(), 'Home');
  click('Disable link'); await wait(() => !document.querySelector('.share-url'));
  route(parentPath); await wait(() => document.querySelector('.parent-empty'));
  assert.equal(document.querySelector('.parent-day-detail'), null);
  const alternate = await (await nativeFetch(base + '/api/demo', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ demoWeek: 'autumn-afternoon' }) })).json();
  route(`#demo/${alternate.demoId}/home`); await wait(() => document.querySelector('.calendar-day[data-date="2026-10-05"]'));
  route(teacherPath); await wait(() => document.querySelector('.calendar-day[data-date="2026-09-07"]'));
  assert.equal(document.querySelector('.share-url'), null, 'another demo never restores a revoked link');
});
