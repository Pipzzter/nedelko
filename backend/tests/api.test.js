import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createApp } from '../http/app.js';
import { calendarSnapshot } from '../domain/holidays.js';
import { openStore } from '../storage/database.js';
import { demoConditions } from '../services/conditions.js';
import { LOCATIONS } from '../config/index.js';
import { DEFAULT_SETTINGS as EMPTY_SETTINGS } from '../domain/settings.js';
import { createCurriculum } from '../services/curriculum.js';
import { demoWeekById } from '../config/demo.js';

const DEFAULT_SETTINGS = { ...EMPTY_SETTINGS, gradinka: { name: 'Test kindergarten', locationId: 'centar' }, groupName: 'Test group', teacherPrompt: 'Explore nature through music, movement and reused materials.' };

async function app(t, options = {}) {
  const store = openStore(':memory:');
  const server = createApp({ store, conditionsProvider: async ({ locationId = 'centar', scenario = 'normal', mode, demoWeek } = {}) => demoConditions(LOCATIONS.find(l => l.id === locationId) || LOCATIONS[0], scenario, Date.now(), mode === 'demo' ? demoWeekById(demoWeek) : null),
    curriculumProvider: (dates, settings, options) => createCurriculum(dates, settings, { ...options, useAI: false }), holidayProvider: async year => calendarSnapshot(year), ...options });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
  const base = `http://127.0.0.1:${server.address().port}`;
  const client = () => { let cookie = ''; return async (path, body, headers = {}) => {
    const response = await fetch(base + path, { method: body === undefined ? 'GET' : 'POST', headers: { 'Content-Type': 'application/json', Cookie: cookie, ...headers }, body: body === undefined ? undefined : JSON.stringify(body) });
    if (response.headers.get('set-cookie')) cookie = response.headers.get('set-cookie').split(';')[0];
    return { status: response.status, headers: response.headers, body: await response.json() };
  }; };
  return { store, base, client };
}
const account = { email: 'teacher@test.mk', displayName: 'Test teacher', password: 'OnlyForAutomatedTests23', kindergarten: 'Test kindergarten', ageGroup: '4-5', locationId: 'centar' };
const demoBody = result => ({ demoId: result.demoId, revision: result.week.revision });

test('holiday endpoint needs a session or valid isolated demo, and cannot accept source URLs', async t => {
  const { client } = await app(t); const request = client();
  assert.equal((await request('/api/holidays?year=2026')).status, 401);
  assert.equal((await request('/api/holidays?year=2026&demoId=fake')).status, 404);
  const demo = (await request('/api/demo', {})).body;
  const result = await request(`/api/holidays?year=2026&demoId=${demo.demoId}&source=http://127.0.0.1`);
  assert.equal(result.status, 200); assert.equal(result.body.calendar.events.length, 27);
  assert.match(result.body.calendar.sourceUrl, /^https:\/\/www\.economy\.gov\.mk\//);
  assert.equal((await request(`/api/holidays?year=-1&demoId=${demo.demoId}`)).status, 400);
});

test('registration normalizes the kindergarten email, hashes passwords, stores the profile and manages sessions', async t => {
  const { client, store } = await app(t); const request = client();
  assert.equal((await request('/api/dashboard')).status, 401);
  const signup = await request('/api/auth/register', { ...account, email: 'Teacher@Test.MK' });
  assert.equal(signup.status, 200); assert.equal(signup.body.user.email, 'teacher@test.mk');
  assert.match(signup.headers.get('set-cookie'), /HttpOnly; SameSite=Strict/);
  assert.doesNotMatch(JSON.stringify(signup.body), /password|scrypt|token/);
  const stored = store.userByName('teacher@test.mk'); assert.match(stored.password_hash, /^scrypt-v1:/); assert.ok(!stored.password_hash.includes(account.password));
  const profile = store.profile(signup.body.user.id);
  assert.equal(profile.gradinka.name, 'Test kindergarten'); assert.equal(profile.groupName, 'Test kindergarten');
  assert.equal(profile.ageGroup, '4-5'); assert.equal(profile.locationId, 'centar');
  const session = store.db.prepare('SELECT token_hash FROM sessions').get(); assert.ok(!signup.headers.get('set-cookie').includes(session.token_hash));
  assert.equal((await request('/api/auth/me')).body.user.email, 'teacher@test.mk');
  await request('/api/auth/logout', {}); assert.equal((await request('/api/auth/me')).body.user, null);
  assert.equal((await request('/api/auth/login', { ...account, password: 'bad' })).status, 401);
  assert.equal((await request('/api/auth/login', account)).status, 200);
  assert.equal((await request('/api/auth/register', account)).status, 409);
});

test('weak passwords, invalid emails, incomplete kindergarten details and cross-origin writes are rejected', async t => {
  const { client } = await app(t); const request = client();
  assert.equal((await request('/api/auth/register', { ...account, password: '12345' })).status, 400);
  assert.equal((await request('/api/auth/register', { ...account, email: 'not-an-email' })).status, 400);
  assert.equal((await request('/api/auth/register', { ...account, kindergarten: '' })).status, 400);
  assert.equal((await request('/api/auth/register', { ...account, kindergarten: '<script>' })).status, 400);
  assert.equal((await request('/api/auth/register', { ...account, ageGroup: 'toddlers' })).status, 400);
  assert.equal((await request('/api/auth/register', { ...account, locationId: 'nowhere' })).status, 400);
  assert.equal((await request('/api/auth/register', account, { Origin: 'https://evil.example' })).status, 403);
  assert.equal((await request('/api/demo', {}, { 'Sec-Fetch-Site': 'cross-site' })).status, 403);
  assert.equal((await request('/api/demo', {}, { 'Content-Type': 'text/plain' })).status, 415);
  assert.equal((await request('/api/demo', { huge: 'x'.repeat(128001) })).status, 413);
});

test('legacy username accounts can still sign in through the email field', async t => {
  const { client, store } = await app(t); const request = client();
  const signup = await request('/api/auth/register', account);
  assert.equal(signup.status, 200);
  store.addUser({ id: 'legacy-account', username: 'ana', displayName: 'Legacy test fixture', hash: store.userByName(account.email).password_hash });
  await request('/api/auth/logout', {});
  assert.equal((await request('/api/auth/login', { email: 'ana', password: account.password })).status, 200);
  assert.equal((await request('/api/auth/me')).body.user.email, 'ana');
});

test('new accounts start empty; one-click generation persists only to the owner', async t => {
  const { client, store } = await app(t); const alice = client(); const bob = client();
  const auth = await alice('/api/auth/register', account);
  await bob('/api/auth/register', { ...account, email: 'second.teacher@test.mk' });
  assert.equal((await alice('/api/dashboard')).body.week, null);
  const generated = await alice('/api/week/generate', { settings: DEFAULT_SETTINGS });
  assert.equal(generated.status, 201); assert.equal(generated.body.week.days.length, 5);
  assert.ok(generated.body.week.messages.weekly.mk); assert.ok(generated.body.week.messages.weekly.en);
  assert.equal((await bob('/api/dashboard')).body.week, null);
  assert.equal((await bob('/api/week/edit', { userId: auth.body.user.id, settings: DEFAULT_SETTINGS, days: generated.body.week.days, revision: 1 })).status, 404);
  assert.equal(store.week(auth.body.user.id, generated.body.week.weekStart).revision, 1);
});

test('AI retry preserves the saved week on failure and replaces it only after successful validated generation', async t => {
  let succeed = false;
  const { client, store } = await app(t, { curriculumProvider: async (dates, settings, options) => {
    const library = await createCurriculum(dates, settings, { ...options, useAI: false });
    return succeed ? { ...library, source: 'ai', outdoorOrder: dates, outdoorDecisionSource: 'ai' } : { ...library, generationIssue: 'ai_timeout' };
  } });
  const request = client(); const anon = client(); const other = client();
  const auth = (await request('/api/auth/register', account)).body;
  await other('/api/auth/register', { ...account, email: 'other.teacher@test.mk' });
  const original = (await request('/api/week/generate', { settings: DEFAULT_SETTINGS })).body.week;
  const retry = { settings: { ...DEFAULT_SETTINGS, locationId: 'bitola' }, revision: original.revision, requireAI: true };
  assert.equal((await anon('/api/week/generate', retry)).status, 401);
  assert.equal((await other('/api/week/generate', retry)).status, 409);
  const failed = await request('/api/week/generate', retry);
  assert.equal(failed.status, 503); assert.equal(failed.body.error, 'ai_retry_failed');
  assert.equal(failed.body.generationIssue, 'ai_timeout');
  assert.deepEqual(store.week(auth.user.id, original.weekStart), original);
  succeed = true;
  const accepted = await request('/api/week/generate', retry);
  assert.equal(accepted.status, 201); assert.equal(accepted.body.week.source, 'ai');
  assert.equal(accepted.body.week.settings.locationId, 'bitola');
  assert.ok(accepted.body.week.revision > original.revision);
  assert.ok(accepted.body.week.messages.weekly.mk && accepted.body.week.messages.weekly.en);
  assert.equal((await request('/api/week/generate', retry)).status, 409);
});

test('demo is isolated, editable and cannot bypass fresh recheck before approving', async t => {
  const { client, store } = await app(t); const request = client();
  const demo = (await request('/api/demo', {})).body;
  assert.equal(demo.mode, 'demo'); assert.equal(demo.week.approval, null);
  assert.equal(demo.today, '2026-09-07'); assert.equal(demo.week.days[1].date, '2026-09-08');
  assert.equal(demo.week.days[1].closed, true); assert.match(demo.week.days[0].theme.title.en, /8 September/);
  assert.match(demo.week.messages.weekly.en, /No kindergarten: 8\.9/);
  assert.equal((await request('/api/week/approve', demoBody(demo))).status, 409);
  const checked = (await request('/api/week/recheck', demoBody(demo))).body;
  const approved = await request('/api/week/approve', { ...demoBody(checked), messages: { en: 'AIR IS CLEAN', mk: 'Clean' }, aqi: 0 });
  assert.equal(approved.status, 200); assert.match(approved.body.week.approval.messages.en, /DEMO EXAMPLE/);
  assert.doesNotMatch(approved.body.week.approval.messages.en, /AIR IS CLEAN/);
  const changed = (await request(`/api/dashboard?demoId=${demo.demoId}&scenario=polluted&fresh=1`)).body;
  assert.equal(changed.week.days[0].mode, 'inside'); assert.equal(changed.week.approval, null);
  assert.equal(changed.week.weekStart, '2026-09-07'); assert.equal(changed.week.days[1].mode, 'closed');
  assert.ok(changed.week.changes.some(c => c.from === demo.week.days[0].date && c.to));
  assert.equal((await request('/api/week/approve', demoBody(checked))).status, 409);
  assert.equal(store.db.prepare('SELECT COUNT(*) AS n FROM weeks').get().n, 0);
});

test('core dated demo weeks and six air scenarios keep fixed dates, closures and account isolation', async t => {
  const { client, store } = await app(t); const request = client();
  const configuration = (await request('/api/config')).body;
  assert.equal(configuration.demoWeeks.length, 6); assert.equal(configuration.demoScenarios.length, 6);
  for (const id of ['independence', 'easter', 'halloween', 'winter']) {
    let state = (await request('/api/demo', { demoWeek: id })).body;
    const monday = state.week.weekStart;
    assert.equal(state.week.demoWeek, id); assert.equal(state.week.days.length, 5);
    assert.ok(state.week.days.every(day => day.theme));
    if (id === 'easter') { assert.equal(state.week.days[4].closed, true); assert.match(state.week.days[3].theme.title.en, /Easter/); }
    if (id === 'halloween') { assert.match(state.week.days[4].theme.title.en, /Halloween/); assert.equal(state.week.days[4].closed, false); assert.equal(state.week.days[4].occasions[0].kind, 'classroom'); }
    if (id === 'winter') { assert.equal(state.week.days[2].summary.kind, 'snow'); assert.equal(state.week.days[2].mode, 'inside'); assert.match(state.week.days[2].theme.title.en, /snow/); }
    for (const scenario of configuration.demoScenarios) {
      const result = await request(`/api/dashboard?demoId=${state.demoId}&scenario=${scenario}&demoWeek=ignored`);
      assert.equal(result.status, 200); state = result.body;
      assert.equal(state.week.weekStart, monday); assert.equal(state.week.demoWeek, id);
      assert.ok(state.week.days.filter(day => day.closed).every(day => day.mode === 'closed'));
      if (scenario !== 'normal') assert.equal(state.week.days[0].mode, 'inside');
      assert.ok(state.week.days.filter(day => day.date > state.today).every(day => day.provisional));
    }
    const recheck = await request('/api/week/recheck', demoBody(state));
    assert.equal(recheck.status, 200); assert.equal(recheck.body.week.weekStart, monday);
    const regenerated = await request('/api/week/generate', { ...demoBody(recheck.body), settings: state.week.settings });
    assert.equal(regenerated.status, 201); assert.equal(regenerated.body.week.weekStart, monday); assert.equal(regenerated.body.week.demoWeek, id);
  }
  assert.equal((await request('/api/demo', { demoWeek: 'arbitrary-date' })).status, 400);
  const demo = (await request('/api/demo', {})).body;
  assert.equal((await request(`/api/dashboard?demoId=${demo.demoId}&scenario=not-real`)).status, 400);
  assert.equal(store.db.prepare('SELECT COUNT(*) AS n FROM weeks').get().n, 0);
});

test('failed recheck invalidates a previously approved notice', async t => {
  let fail = false;
  const { client } = await app(t, { conditionsProvider: async ({ demoWeek }) => { if (fail) throw new Error('unavailable'); return demoConditions(LOCATIONS[0], 'normal', Date.now(), demoWeekById(demoWeek)); } });
  const request = client(); let state = (await request('/api/demo', {})).body;
  state = (await request('/api/week/recheck', demoBody(state))).body;
  const approved = (await request('/api/week/approve', demoBody(state))).body;
  fail = true;
  const failed = await request('/api/week/recheck', { demoId: state.demoId, revision: approved.week.revision }); assert.equal(failed.status, 500);
  assert.equal((await request('/api/week/approve', { demoId: state.demoId, revision: approved.week.revision })).status, 409);
  fail = false;
  const after = (await request(`/api/dashboard?demoId=${state.demoId}`)).body; assert.equal(after.week.approval, null); assert.equal(after.week.checkedAt, null);
});

test('overlapping edits fail without corrupting the saved plan; stale revisions cannot overwrite', async t => {
  const { client } = await app(t); const request = client(); const state = (await request('/api/demo', {})).body;
  const days = structuredClone(state.week.days); days[0].timeline[1].start = days[0].timeline[0].start;
  const edit = await request('/api/week/edit', { ...demoBody(state), settings: state.week.settings, days });
  assert.equal(edit.status, 400); assert.equal(edit.body.error, 'overlapping_times');
  const moved = structuredClone(state.week.days); moved[0].timeline[0].end = '08:15';
  const fixed = await request('/api/week/edit', { ...demoBody(state), settings: state.week.settings, days: moved });
  assert.equal(fixed.status, 400); assert.equal(fixed.body.error, 'fixed_times');
  const holidayEdit = structuredClone(state.week.days); holidayEdit[0].theme.title = { mk: 'Нова еко-приказна', en: 'A new eco story' };
  const locked = await request('/api/week/edit', { ...demoBody(state), settings: state.week.settings, days: holidayEdit });
  assert.equal(locked.status, 400); assert.equal(locked.body.error, 'protected_activity');
  const valid = structuredClone(state.week.days); valid[2].theme.title = { mk: 'Нова еко-приказна', en: 'A new eco story' };
  const saved = await request('/api/week/edit', { ...demoBody(state), settings: state.week.settings, days: valid });
  assert.equal(saved.status, 200); assert.equal(saved.body.week.days[2].theme.title.en, 'A new eco story');
  assert.match(saved.body.week.messages.daily[valid[2].date].en, /A new eco story/);
  assert.equal((await request('/api/week/edit', { ...demoBody(state), settings: state.week.settings, days: valid })).status, 409);
});

test('saved day location choices update notices, invalidate approval and cannot override server observations', async t => {
  const { client } = await app(t); const request = client();
  let state = (await request('/api/demo', {})).body;
  state = (await request('/api/week/recheck', demoBody(state))).body;
  state.week = (await request('/api/week/approve', demoBody(state))).body.week;
  assert.ok(state.week.approval);
  const settings = { ...state.week.settings, outdoorDays: 0 };
  const days = structuredClone(state.week.days); days[0].outdoorPreference = 'outside';
  const saved = await request('/api/week/edit', { ...demoBody(state), settings, days });
  assert.equal(saved.status, 200); state = saved.body;
  assert.equal(state.week.days[0].mode, 'outside'); assert.equal(state.week.approval, null);
  assert.equal(state.week.checkedAt, null); assert.match(state.week.messages.daily[state.today].en, /\(outside\)/);
  assert.equal((await request('/api/week/approve', demoBody(state))).status, 409);
  const forged = structuredClone(state.week.days); forged[0].mode = 'outside'; forged[0].reason = 'forecast';
  const blocked = await request('/api/week/edit', { ...demoBody(state), scenario: 'polluted', settings, days: forged });
  assert.equal(blocked.status, 200); state = blocked.body;
  assert.equal(state.week.days[0].outdoorPreference, 'outside'); assert.equal(state.week.days[0].mode, 'inside');
  assert.equal(state.week.days[0].reason, 'pollution');
  assert.match(state.week.messages.daily[state.today].en, /\(indoors\)/);
  const refreshed = (await request(`/api/dashboard?demoId=${state.demoId}&scenario=normal`)).body;
  assert.equal(refreshed.week.days[0].outdoorPreference, 'outside'); assert.equal(refreshed.week.days[0].mode, 'outside');
});

test('auth rate limits block repeated password attempts', async t => {
  const { client } = await app(t); const request = client();
  for (let i = 0; i < 12; i++) await request('/api/auth/login', { email: 'bad@user.example', password: 'bad' });
  assert.equal((await request('/api/auth/login', account)).status, 429);
});

test('only frontend files are served and configuration never leaks secrets', async t => {
  const { client, base } = await app(t); const request = client();
  for (const path of ['/.env', '/backend/server.js', '/%2e%2e%5cbackend%5cserver.js', '/AGENTS.md', '/.local/ekocuvar.sqlite', '/tests/app.test.js']) assert.equal((await request(path)).status, 404);
  const config = await request('/api/config'); assert.equal(config.status, 200); assert.equal(config.body.locations.length, 24);
  assert.doesNotMatch(JSON.stringify(config.body), /OPENAI|sk-proj-|password_hash/);
  const page = await fetch(base); assert.equal(page.status, 200); assert.match(page.headers.get('content-security-policy'), /frame-ancestors 'none'/); assert.doesNotMatch(page.headers.get('content-security-policy'), /unsafe/);
  assert.match(await page.text(), /\/src\/app.js/);
  for (const path of ['/src/app.js', '/vendor/preact.js', '/vendor/hooks.js', '/styles/app.css', '/assets/little-gardeners.svg']) assert.equal((await fetch(base + path)).status, 200);
});

test('deleting and regenerating a week is authenticated, revision checked, isolated and resistant to stale tabs', async t => {
  const { client } = await app(t); const alice = client(); const bob = client(); const anon = client();
  await alice('/api/auth/register', account); await bob('/api/auth/register', { ...account, email: 'other.teacher@test.mk' });
  let original = (await alice('/api/week/generate', { settings: DEFAULT_SETTINGS })).body;
  const revision = original.week.revision;
  assert.equal((await anon('/api/week/delete', { revision })).status, 401);
  assert.equal((await bob('/api/week/delete', { revision })).status, 404);
  assert.equal((await alice('/api/week/delete', { revision: revision + 1 })).status, 409);
  assert.equal((await alice('/api/week/delete', { revision }, { Origin: 'https://evil.example' })).status, 403);
  const deleted = await alice('/api/week/delete', { revision });
  assert.equal(deleted.status, 200); assert.equal(deleted.body.week, null);
  assert.deepEqual(deleted.body.settings, original.week.settings);
  assert.equal((await alice('/api/dashboard')).body.week, null);
  assert.equal((await alice('/api/week/generate', { settings: DEFAULT_SETTINGS, revision })).status, 409);
  const regenerated = await alice('/api/week/generate', { settings: DEFAULT_SETTINGS });
  assert.equal(regenerated.status, 201); assert.ok(regenerated.body.week.revision > revision);
  assert.equal((await alice('/api/week/delete', { revision })).status, 409);
  assert.equal((await alice('/api/week/edit', { settings: DEFAULT_SETTINGS, days: original.week.days, revision })).status, 409);
  assert.equal((await bob('/api/dashboard')).body.week, null);
  const demo = (await alice('/api/demo', { demoWeek: 'winter' })).body;
  assert.equal((await alice('/api/week/delete', demoBody(demo))).status, 200);
  assert.equal((await alice(`/api/dashboard?demoId=${demo.demoId}`)).body.week, null);
  const demoAgain = await alice('/api/week/generate', { demoId: demo.demoId, settings: DEFAULT_SETTINGS });
  assert.equal(demoAgain.status, 201); assert.equal(demoAgain.body.week.weekStart, '2026-01-12');
  assert.ok(demoAgain.body.week.revision > demo.week.revision);
  assert.equal((await alice('/api/dashboard')).body.week.weekStart, regenerated.body.week.weekStart);
});

test('changing city fetches that city and adapts learning choices and outdoor days without regenerating', async t => {
  const requested = [];
  const { client } = await app(t, { conditionsProvider: async ({ locationId = 'centar', demoWeek }) => {
    requested.push(locationId);
    const c = demoConditions(LOCATIONS.find(l => l.id === locationId), 'normal', Date.now(), demoWeekById(demoWeek));
    c.weather.forEach(row => Object.assign(row, { weatherCode: locationId === 'bitola' ? 61 : 1, precipitationProbability: locationId === 'bitola' ? 95 : 5, windSpeed: 5 }));
    return c;
  } });
  const request = client(); const initial = (await request('/api/demo', {})).body;
  const changed = await request('/api/week/location', { ...demoBody(initial), locationId: 'bitola' });
  assert.equal(changed.status, 200); assert.equal(requested.at(-1), 'bitola');
  assert.equal(changed.body.environment.location.id, 'bitola');
  assert.equal(changed.body.week.days.filter(day => day.mode === 'outside').length, 0);
  assert.equal(changed.body.week.days[2].learningWeather, 'rain');
  assert.notDeepEqual(changed.body.week.days[2].timeline, initial.week.days[2].timeline);
  assert.deepEqual(changed.body.week.settings.blocks, initial.week.settings.blocks);
  assert.equal(changed.body.week.approval, null);
});
