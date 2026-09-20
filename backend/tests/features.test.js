import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createApp } from '../http/app.js';
import { openStore } from '../storage/database.js';
import { createCurriculum, createDayCurriculum } from '../services/curriculum.js';
import { demoConditions } from '../services/conditions.js';
import { startAutoRefresh } from '../services/auto-refresh.js';
import { DEFAULT_SETTINGS as EMPTY_SETTINGS, validateSettings } from '../domain/settings.js';
import { calendarSnapshot } from '../domain/holidays.js';
import { createWeek, adaptWeek, replaceDayTheme } from '../domain/week.js';
import { localCurriculum } from '../domain/curriculum.js';
import { planningWeekDates } from '../domain/planner.js';
import { LOCATIONS } from '../config/index.js';
import { demoWeekById } from '../config/demo.js';

const account = { username: 'feature.teacher', displayName: 'Test teacher', password: 'TestsOnlyPassword42' };

const DEFAULT_SETTINGS = { ...EMPTY_SETTINGS, gradinka: { name: 'Test kindergarten', locationId: 'centar' }, groupName: 'Test group', teacherPrompt: 'Explore nature through music, movement and reused materials.' };

async function fixture(t, overrides = {}) {
  const store = openStore(':memory:');
  const server = createApp({ store,
    conditionsProvider: async ({ locationId = 'centar', scenario = 'normal', mode, demoWeek } = {}) => demoConditions(LOCATIONS.find(l => l.id === locationId), scenario, Date.now(), mode === 'demo' ? demoWeekById(demoWeek) : null),
    curriculumProvider: (dates, settings, options) => createCurriculum(dates, settings, { ...options, useAI: false }),
    holidayProvider: async year => calendarSnapshot(year), ...overrides });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
  const base = `http://127.0.0.1:${server.address().port}`;
  const client = () => {
    let cookie = '';
    return async (path, body, method = body === undefined ? 'GET' : 'POST') => {
      const response = await fetch(base + path, { method, headers: { Cookie: cookie, 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
      if (response.headers.get('set-cookie')) cookie = response.headers.get('set-cookie').split(';')[0];
      return { status: response.status, body: await response.json() };
    };
  };
  return { store, client };
}

test('kindergarten and teaching brief validate and keep one canonical location', () => {
  const settings = validateSettings({ ...DEFAULT_SETTINGS, locationId: 'bitola', gradinka: { name: 'Our kindergarten', locationId: 'centar' }, teacherPrompt: 'Autumn\nwith music' });
  assert.deepEqual(settings.gradinka, { name: 'Our kindergarten', locationId: 'bitola' });
  assert.equal(settings.teacherPrompt, 'Autumn\nwith music');
  for (const teacherPrompt of [123, '<script>', 'x'.repeat(2001)]) assert.throws(() => validateSettings({ ...DEFAULT_SETTINGS, teacherPrompt }), { code: 'invalid_instruction' });
});

test('parent link gives a bounded read-only projection; rotation, revocation and ownership are enforced', async t => {
  const { client, store } = await fixture(t);
  const teacher = client(); const other = client(); const parent = client();
  const user = (await teacher('/api/auth/register', account)).body.user;
  await other('/api/auth/register', { ...account, username: 'other.teacher' });
  const settings = { ...DEFAULT_SETTINGS, gradinka: { name: 'Sun Garden' }, groupName: 'Sunflowers', teacherPrompt: 'PRIVATE-TEACHER-BRIEF' };
  let week = (await teacher('/api/week/generate', { settings })).body.week;
  assert.equal(store.profile(user.id).gradinka.name, 'Sun Garden');
  assert.equal((await parent('/api/week/share', { action: 'enable', revision: week.revision })).status, 401);
  assert.equal((await other('/api/week/share', { action: 'enable', revision: week.revision })).status, 404);
  const share = (await teacher('/api/week/share', { action: 'enable', revision: week.revision })).body.share;
  const token = share.path.split('/').at(-1);
  assert.match(token, /^[a-f0-9]{64}$/);
  const page = await parent(`/api/parents/${token}`);
  assert.equal(page.status, 200); assert.equal(page.body.days.length, 5);
  assert.equal(page.body.kindergarten, 'Sun Garden'); assert.equal(page.body.groupName, 'Sunflowers');
  assert.doesNotMatch(JSON.stringify(page.body), /PRIVATE-TEACHER-BRIEF|teacherPrompt|password|userId|generationError|outdoorOrder|token/);
  assert.equal((await parent(`/api/parents/${token}`, {})).status, 405);
  assert.equal((await parent('/api/week/edit', { revision: week.revision, settings, days: week.days, token })).status, 401);
  assert.equal((await parent(`/api/parents/${'f'.repeat(64)}`)).status, 404);
  const rotated = (await teacher('/api/week/share', { action: 'rotate', revision: week.revision })).body.share;
  assert.notEqual(rotated.path, share.path);
  assert.equal((await parent(`/api/parents/${token}`)).status, 404);
  assert.equal((await parent(`/api/parents/${rotated.path.split('/').at(-1)}`)).status, 200);
  await teacher('/api/week/share', { action: 'revoke', revision: week.revision });
  assert.equal((await parent(`/api/parents/${rotated.path.split('/').at(-1)}`)).status, 404);
  const renewed = (await teacher('/api/week/share', { action: 'enable', revision: week.revision })).body.share;
  await teacher('/api/week/delete', { revision: week.revision });
  assert.equal((await parent(`/api/parents/${renewed.path.split('/').at(-1)}`)).status, 404);
  assert.equal(store.profile(user.id).groupName, 'Sunflowers', 'profile survives deleting a week');
});

test('demo links are isolated and immediately show adapted pollution messages', async t => {
  const { client, store } = await fixture(t); const teacher = client(); const parent = client();
  const demo = (await teacher('/api/demo', {})).body;
  assert.equal(demo.share, null, 'demo sharing starts disabled, like a new account week');
  const share = (await teacher('/api/week/share', { demoId: demo.demoId, revision: demo.week.revision, action: 'enable' })).body.share;
  const endpoint = `/api/parents/${share.path.split('/').at(-1)}`;
  assert.equal((await parent(endpoint)).body.days[0].mode, 'outside');
  await teacher(`/api/dashboard?demoId=${demo.demoId}&scenario=polluted&fresh=1`);
  const polluted = (await parent(endpoint)).body;
  assert.equal(polluted.days[0].mode, 'inside');
  assert.match(polluted.days[0].message.en, /elevated PM2.5 readings/);
  assert.equal(polluted.mode, 'demo');
  assert.equal(store.db.prepare('SELECT count(*) AS n FROM parent_links').get().n, 0);
  assert.equal(store.db.prepare('SELECT count(*) AS n FROM weeks').get().n, 0);
});

test('demo and account parent pages share a read-only contract; retired classroom routes cannot mutate either plan', async t => {
  const { client, store } = await fixture(t);
  const teacher = client(); const parent = client();
  const user = (await teacher('/api/auth/register', account)).body.user;
  const real = (await teacher('/api/week/generate', { settings: DEFAULT_SETTINGS })).body;
  const realShare = (await teacher('/api/week/share', { revision: real.week.revision, action: 'enable' })).body.share;
  const realPath = `/api/parents/${realShare.path.split('/').at(-1)}`;
  const realView = (await parent(realPath)).body;
  const saved = store.week(user.id, real.week.weekStart);
  const demo = (await teacher('/api/demo', {})).body;
  assert.equal(demo.demoClassroom, undefined);
  const share = (await teacher('/api/week/share', { demoId: demo.demoId, revision: demo.week.revision, action: 'enable' })).body.share;
  const path = `/api/parents/${share.path.split('/').at(-1)}`;
  const view = (await parent(path)).body;
  assert.deepEqual(Object.keys(view).sort(), Object.keys(realView).sort());
  assert.deepEqual(Object.keys(view.days[0]).sort(), Object.keys(realView.days[0]).sort());
  assert.equal(view.days.length, 5);
  assert.doesNotMatch(JSON.stringify(view), /"(?:demoFamily|children|classroomRevision|teacherPrompt|generationError)":/);
  for (const target of [path, realPath]) {
    assert.equal((await parent(target, { action: 'message', content: 'Test' })).status, 405);
    assert.equal((await parent(`${target}/demo`, { action: 'message', content: 'Test' })).status, 405);
  }
  assert.equal((await teacher(`/api/demo/classroom?demoId=${demo.demoId}`)).status, 404);
  assert.equal((await teacher('/api/demo/classroom', { demoId: demo.demoId, action: 'check-in-expected' })).status, 404);
  assert.deepEqual(store.week(user.id, real.week.weekStart), saved);
  const adapted = (await teacher(`/api/dashboard?demoId=${demo.demoId}&scenario=polluted`)).body;
  assert.equal((await parent(path)).body.days[0].mode, 'inside');
  assert.deepEqual(store.week(user.id, real.week.weekStart), saved);
  await teacher('/api/week/share', { demoId: demo.demoId, revision: adapted.week.revision, action: 'revoke' });
  assert.equal((await parent(path)).status, 404);
  assert.equal((await parent(realPath)).status, 200);
});

test('refreshing a week preserves newer group preferences and an empty dashboard restores their location', async t => {
  const { client, store } = await fixture(t); const teacher = client();
  const user = (await teacher('/api/auth/register', account)).body.user;
  const week = (await teacher('/api/week/generate', { settings: DEFAULT_SETTINGS })).body.week;
  const latest = validateSettings({ ...DEFAULT_SETTINGS, locationId: 'bitola', gradinka: { name: 'Latest kindergarten' } });
  store.saveProfile(user.id, latest);
  const refreshed = (await teacher('/api/dashboard')).body;
  assert.deepEqual(store.profile(user.id), latest, 'a refresh cannot replace the latest profile with older week settings');
  await teacher('/api/week/delete', { revision: refreshed.week.revision });
  const empty = (await teacher('/api/dashboard')).body;
  assert.equal(empty.week, null); assert.equal(empty.environment.location.id, 'bitola');
  assert.equal(empty.profile.gradinka.name, 'Latest kindergarten');
});

test('single-day suggestions require a separate apply and cannot overwrite other days or cross accounts', async t => {
  const { client, store } = await fixture(t, { dayCurriculumProvider: async (day, settings) => ({
    source: 'ai', theme: { ...day.theme, title: { mk: 'Музичка градина', en: 'A musical garden' },
      inside: { mk: 'Со воспитувачот создаваме ритам со раце и движења.', en: 'With the teacher, create a rhythm using claps and movement.' }, materials: settings.materials.slice(0, 1) },
  }) });
  const teacher = client(); const other = client();
  const user = (await teacher('/api/auth/register', account)).body.user;
  await other('/api/auth/register', { ...account, username: 'other.teacher' });
  const week = (await teacher('/api/week/generate', { settings: DEFAULT_SETTINGS })).body.week;
  const date = week.days.at(-1).date;
  const proposal = await teacher('/api/week/day/suggest', { date, instruction: 'More music', revision: week.revision });
  assert.equal(proposal.status, 200); assert.equal(proposal.body.theme.title.en, 'A musical garden');
  assert.deepEqual(store.week(user.id, week.weekStart), week, 'a preview never mutates the plan');
  assert.equal((await other('/api/week/day/apply', { proposalId: proposal.body.proposalId, revision: week.revision })).status, 404);
  const applied = await teacher('/api/week/day/apply', { proposalId: proposal.body.proposalId, revision: week.revision });
  assert.equal(applied.status, 200);
  assert.equal(applied.body.week.days.at(-1).theme.title.en, 'A musical garden');
  assert.equal(applied.body.week.days.at(-1).source, 'ai');
  assert.deepEqual(applied.body.week.days.slice(0, 4).map(day => day.theme), week.days.slice(0, 4).map(day => day.theme));
  assert.deepEqual(applied.body.week.days.at(-1).timeline.map(row => [row.id, row.start, row.end, row.kind]), week.days.at(-1).timeline.map(row => [row.id, row.start, row.end, row.kind]));
  assert.equal(applied.body.week.approval, null);
  assert.equal((await teacher('/api/week/day/apply', { proposalId: proposal.body.proposalId, revision: applied.body.week.revision })).status, 409);
});

test('failed AI day generation and stale previews preserve the existing plan', async t => {
  let failed = true;
  const { client, store } = await fixture(t, { dayCurriculumProvider: async day => failed ? { theme: null, generationIssue: 'ai_quota' } : { theme: day.theme, source: 'ai' } });
  const teacher = client(); const user = (await teacher('/api/auth/register', account)).body.user;
  const week = (await teacher('/api/week/generate', { settings: DEFAULT_SETTINGS })).body.week;
  const request = { date: week.days.at(-1).date, instruction: 'Use music', revision: week.revision };
  const failure = await teacher('/api/week/day/suggest', request);
  assert.equal(failure.status, 503); assert.equal(failure.body.generationIssue, 'ai_quota');
  assert.deepEqual(store.week(user.id, week.weekStart), week);
  failed = false;
  const proposal = (await teacher('/api/week/day/suggest', request)).body;
  const edited = await teacher('/api/week/edit', { settings: week.settings, days: week.days, revision: week.revision });
  assert.equal((await teacher('/api/week/day/apply', { proposalId: proposal.proposalId, revision: edited.body.week.revision })).status, 409);
});

test('automatic refresh adapts an active week and messages without a browser or model call', async t => {
  const profile = demoWeekById('independence');
  const normal = demoConditions(LOCATIONS[0], 'normal', Date.now(), profile);
  const dates = planningWeekDates(normal.clock);
  let week = createWeek(DEFAULT_SETTINGS, { themes: localCurriculum(dates, DEFAULT_SETTINGS), source: 'library' }, normal);
  let refreshCount = 0;
  const worker = startAutoRefresh({ intervalMs: 3600000, now: () => Date.parse(normal.clock),
    store: { weeksToRefresh: () => [{ userId: 'teacher', weekStart: week.weekStart }] },
    refreshWeek: async () => { refreshCount++; week = adaptWeek(week, demoConditions(LOCATIONS[0], 'polluted', Date.now(), profile)); },
  });
  t.after(() => worker.stop());
  await worker.tick();
  assert.equal(refreshCount, 1); assert.equal(week.days[0].mode, 'inside');
  assert.match(week.messages.daily[dates[0]].en, /elevated PM2.5/);
  worker.stop(); await worker.tick(); assert.equal(refreshCount, 1);
});

test('day replacement preserves custom rows and refuses elapsed eco lessons', () => {
  const c = demoConditions(LOCATIONS[0], 'normal');
  const dates = planningWeekDates(c.clock);
  const week = createWeek(DEFAULT_SETTINGS, { themes: localCurriculum(dates, DEFAULT_SETTINGS), source: 'library' }, c);
  const day = week.days.at(-1);
  day.timeline[0] = { ...day.timeline[0], customized: true, label: { mk: 'Наша игра', en: 'Our own game' } };
  const changed = replaceDayTheme(week, day.date, week.days[1].theme, 'ai', c);
  assert.deepEqual(changed.days.at(-1).timeline[0], day.timeline[0]);
  const elapsed = { ...c, clock: `${dates[0]}T15:00:00Z` };
  assert.throws(() => replaceDayTheme(week, dates[0], day.theme, 'ai', elapsed), { code: 'activity_finished' });
});

test('day AI receives teaching preferences but not kindergarten or group identity; incomplete output stays explicit', async t => {
  const previous = process.env.OPENAI_API_KEY; process.env.OPENAI_API_KEY = 'test-only';
  t.after(() => { if (previous === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = previous; });
  const c = demoConditions(LOCATIONS[0], 'normal'); const dates = planningWeekDates(c.clock);
  const settings = { ...DEFAULT_SETTINGS, groupName: 'PRIVATE-GROUP', gradinka: { name: 'PRIVATE-KINDERGARTEN' }, teacherPrompt: 'Autumn with music' };
  const day = createWeek(settings, { themes: localCurriculum(dates, settings), source: 'library' }, c).days.at(-1);
  let sent;
  let responseBody = { status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify({ theme: day.theme }) }] }] };
  t.mock.method(globalThis, 'fetch', async (_url, options) => {
    sent = JSON.parse(options.body); return Response.json(responseBody);
  });
  assert.equal((await createDayCurriculum(day, settings, { instruction: 'More movement' })).source, 'ai');
  assert.match(sent.input, /Autumn with music|More movement/); assert.doesNotMatch(sent.input, /PRIVATE-GROUP|PRIVATE-KINDERGARTEN/);
  assert.equal(sent.text.format.strict, true); assert.equal(sent.store, false);
  responseBody = { status: 'incomplete', incomplete_details: { reason: 'max_output_tokens' }, output: [] };
  const result = await createDayCurriculum(day, settings, { instruction: 'Music' });
  assert.equal(result.theme, null); assert.equal(result.generationIssue, 'ai_incomplete');
  for (const [content, expected] of [
    [[{ type: 'refusal', refusal: 'Test refusal' }], 'ai_refused'],
    [[{ type: 'output_text', text: 'null' }], 'ai_invalid_output'],
    [[{ type: 'output_text', text: '{"theme":null}' }], 'ai_invalid_output'],
    [[{ type: 'output_text', text: '{invalid' }], 'ai_invalid_output'],
  ]) {
    responseBody = { status: 'completed', output: [{ type: 'message', content }] };
    const rejected = await createDayCurriculum(day, settings, { instruction: 'Music' });
    assert.equal(rejected.theme, null); assert.equal(rejected.generationIssue, expected);
  }
});

test('generation rejects missing required teacher details before contacting providers or changing a plan',async t=>{
  let calls=0;
  const {client,store}=await fixture(t,{curriculumProvider:(dates,settings)=>{calls++;return createCurriculum(dates,settings,{useAI:false});}});
  const teacher=client();const user=(await teacher('/api/auth/register',account)).body.user;
  for(const [settings,error] of [
    [{...DEFAULT_SETTINGS,gradinka:{name:'  '}},'kindergarten_required'],
    [{...DEFAULT_SETTINGS,groupName:''},'group_required'],
    [{...DEFAULT_SETTINGS,teacherPrompt:'\n '},'brief_required'],
    [{...DEFAULT_SETTINGS,materials:[]},'invalid_materials'],
  ]) {const result=await teacher('/api/week/generate',{settings});assert.equal(result.status,400);assert.equal(result.body.error,error);}
  assert.equal(calls,0);assert.equal(store.db.prepare('SELECT COUNT(*) AS n FROM weeks WHERE user_id = ?').get(user.id).n,0);
  const generated=await teacher('/api/week/generate',{settings:DEFAULT_SETTINGS});assert.equal(generated.status,201);assert.equal(calls,1);
});

test('explicit daily topics cannot silently save an unrelated library fallback', async t => {
  const { client, store } = await fixture(t);
  const teacher = client(); const user = (await teacher('/api/auth/register', account)).body.user;
  const previous = (await teacher('/api/week/generate', { settings: DEFAULT_SETTINGS })).body.week;
  const result = await teacher('/api/week/generate', { revision: previous.revision,
    settings: { ...DEFAULT_SETTINGS, teacherPrompt: 'one day about healthy food\none day about saving electricity' } });
  assert.equal(result.status, 503);
  assert.deepEqual(store.week(user.id, previous.weekStart), previous);
});
