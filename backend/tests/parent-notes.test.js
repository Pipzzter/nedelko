import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import { createApp } from '../http/app.js';
import { openStore } from '../storage/database.js';
import { createCurriculum } from '../services/curriculum.js';
import { demoConditions } from '../services/conditions.js';
import { DEFAULT_SETTINGS, pair } from '../domain/settings.js';
import { LOCATIONS } from '../config/index.js';
import { calendarSnapshot } from '../domain/holidays.js';
import { demoWeekById } from '../config/demo.js';
import { PLAY_IDEAS } from '../domain/play-ideas.js';
import { validateNoteAdvice, informationalNote } from '../domain/parent-notes.js';

async function fixture(t, extra = {}) {
  t.mock.timers.enable({ apis: ['Date'], now: Date.parse('2026-09-21T05:00:00Z') });
  const store = openStore(':memory:');
  const server = createApp({ store, conditionsProvider: async ({ locationId = 'centar', scenario = 'normal', mode, demoWeek }) => demoConditions(LOCATIONS.find(item => item.id === locationId), scenario, Date.now(), mode === 'demo' ? demoWeekById(demoWeek) : null),
    curriculumProvider: (dates, settings, options) => createCurriculum(dates, settings, { ...options, useAI: false }), holidayProvider: async year => calendarSnapshot(year), ...extra });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
  const base = `http://127.0.0.1:${server.address().port}`;
  const client = () => {
    let cookie = '';
    return async (path, body, headers = {}) => {
      const response = await fetch(base + path, { method: body === undefined ? 'GET' : 'POST', headers: { Cookie: cookie, 'Content-Type': 'application/json', ...headers }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
      if (response.headers.get('set-cookie')) cookie = response.headers.get('set-cookie').split(';')[0];
      return { status: response.status, body: await response.json() };
    };
  };
  const teacher = client(); const other = client(); const parent = client();
  const account = { email: 'notes.teacher@test.mk', password: 'OnlyForTests123', displayName: 'Test teacher', kindergarten: 'Notes kindergarten', ageGroup: '4-5', locationId: 'centar' };
  await teacher('/api/auth/register', account); await other('/api/auth/register', { ...account, email: 'notes.other@test.mk' });
  const settings = { ...DEFAULT_SETTINGS, gradinka: { name: 'Test garden' }, groupName: 'Test group', teacherPrompt: 'Music, movement and building games' };
  const data = (await teacher('/api/week/generate', { settings })).body;
  const share = (await teacher('/api/week/share', { action: 'enable' })).body.share;
  const path = `/api/parents/${share.path.split('/').at(-1)}`;
  return { teacher, other, parent, client, data, path, store };
}

test('parent notes arrive unread, are private to the owner and never authorize plan edits', async t => {
  const { teacher, other, parent, data, path } = await fixture(t);
  const note = { text: 'PRIVATE-NOTE: Could Tuesday include more building?', date: data.week.days[1].date, nonce: randomUUID() };
  assert.equal((await parent(path + '/notes', note)).status, 201);
  assert.equal((await parent(path + '/notes', note)).status, 201, 'retry is idempotent');
  const inbox = (await teacher('/api/parent-notes')).body;
  assert.equal(inbox.notes.length, 1); assert.equal(inbox.unread, 1); assert.equal(inbox.notes[0].text, note.text);
  assert.equal((await teacher('/api/week/share', { action: 'enable' })).body.week.revision, data.week.revision);
  assert.deepEqual((await other('/api/parent-notes')).body, { notes: [], unread: 0 });
  assert.equal((await parent('/api/parent-notes')).status, 401);
  assert.equal((await parent(path + '/notes')).status, 404);
  assert.doesNotMatch(JSON.stringify((await parent(path)).body), /PRIVATE-NOTE|parent_notes|readAt/);
  assert.equal((await parent('/api/parent-notes/read', { noteId: inbox.notes[0].id })).status, 401);
  assert.equal((await other('/api/parent-notes/read', { noteId: inbox.notes[0].id })).status, 404);
  const read = (await teacher('/api/parent-notes/read', { noteId: inbox.notes[0].id })).body;
  assert.equal(read.unread, 0); assert.ok(read.notes[0].readAt);
  assert.equal((await parent('/api/week/change/apply', { proposalId: inbox.notes[0].id })).status, 401);
  assert.equal((await parent(path + '/notes', { ...note, nonce: randomUUID() }, { Origin: 'https://elsewhere.example' })).status, 403);
  for (const patch of [{ text: '<script>' }, { text: 'x'.repeat(1201) }, { date: '1999-01-01' }, { nonce: 'forged' }]) assert.equal((await parent(path + '/notes', { ...note, nonce: randomUUID(), ...patch })).status, 400);
  await teacher('/api/week/share', { action: 'revoke' });
  assert.equal((await parent(path + '/notes', { ...note, nonce: randomUUID() })).status, 404);
});

test('informational care notes bypass AI and cannot acquire an apply action', async t => {
  let calls = 0;
  const { teacher, parent, data, path } = await fixture(t, { noteAdviceProvider: async () => { calls++; throw new Error('must not run'); } });
  const original = data.week;
  for (const text of ['My kid does not eat that.', 'On Tuesday my child should not go outside.', 'Моето дете има алергија.']) {
    await parent(path + '/notes', { text, date: data.week.days[1].date, nonce: randomUUID() });
    const note = (await teacher('/api/parent-notes')).body.notes.find(note => note.text === text);
    const result = await teacher('/api/parent-notes/suggest', { noteId: note.id, revision: original.revision });
    assert.equal(result.status, 200); assert.equal(result.body.advice.kind, 'informational'); assert.equal(result.body.proposal, null);
  }
  assert.equal(calls, 0);
  assert.deepEqual((await teacher('/api/week/share', { action: 'enable' })).body.week, original);
  assert.equal(informationalNote('Could the group build a tower on Tuesday?'), null);
  assert.equal(validateNoteAdvice({ kind: 'actionable', audience: 'individual', explanation: pair('Информација за грижа.', 'Care information.') }, original).kind, 'informational');
});

test('a note suggestion applies only after owner confirmation and rejects stale or reused proposals', async t => {
  const { teacher, other, parent, data, path } = await fixture(t, {
    noteAdviceProvider: async (note, week) => ({ kind: 'actionable', date: note.date, scope: 'activity', rowId: week.days[1].timeline.find(row => row.kind === 'activity' && !row.occasionIds?.length).id,
      instruction: 'Use a building challenge.', explanation: pair('Предложена е игра за градење.', 'A building challenge is proposed.') }),
    dayPlanProvider: async () => ({ source: 'ai', change: { label: pair('Нова тимска градба', 'A new team build'), note: PLAY_IDEAS[0].note } }),
  });
  await parent(path + '/notes', { text: 'Can Tuesday have more building games?', date: data.week.days[1].date, nonce: randomUUID() });
  const noteId = (await teacher('/api/parent-notes')).body.notes[0].id;
  const request = { noteId, revision: data.week.revision };
  let suggestion = (await teacher('/api/parent-notes/suggest', request)).body;
  assert.ok(suggestion.proposal.proposalId);
  assert.deepEqual((await teacher('/api/week/share', { action: 'enable' })).body.week, data.week);
  assert.equal((await other('/api/parent-notes/apply', { proposalId: suggestion.proposal.proposalId, revision: data.week.revision })).status, 404);
  const newer = (await teacher('/api/dashboard')).body.week;
  assert.equal((await teacher('/api/parent-notes/apply', { proposalId: suggestion.proposal.proposalId, revision: newer.revision })).status, 409);
  suggestion = (await teacher('/api/parent-notes/suggest', { noteId, revision: newer.revision })).body;
  const applied = await teacher('/api/parent-notes/apply', { proposalId: suggestion.proposal.proposalId, revision: newer.revision });
  assert.equal(applied.status, 200); assert.equal(applied.body.week.approval, null);
  assert.ok(applied.body.week.days[1].timeline.some(row => row.label.en === 'A new team build'));
  assert.deepEqual(applied.body.week.days.filter(day => day.date !== data.week.days[1].date), newer.days.filter(day => day.date !== data.week.days[1].date));
  assert.equal((await teacher('/api/parent-notes')).body.notes[0].status, 'applied');
  assert.equal((await teacher('/api/parent-notes/apply', { proposalId: suggestion.proposal.proposalId, revision: applied.body.week.revision })).status, 409);
});

test('a parent note can move a whole group day outside without flipping any other day', async t => {
  const { teacher, parent, data, path } = await fixture(t, {
    noteAdviceProvider: async note => ({ kind: 'actionable', date: note.date, scope: 'outside', rowId: null,
      instruction: 'The group would enjoy an outdoor day.', explanation: pair('Предлог за ден надвор.', 'A suggestion for an outdoor day.') }),
  });
  const day = data.week.days[1].date;
  const priorOutside = data.week.days.filter(item => item.mode === 'outside').map(item => item.date);
  await parent(path + '/notes', { text: 'Could Tuesday be an outdoor day for everyone?', date: day, nonce: randomUUID() });
  const noteId = (await teacher('/api/parent-notes')).body.notes[0].id;
  const suggestion = (await teacher('/api/parent-notes/suggest', { noteId, revision: data.week.revision })).body;
  assert.equal(suggestion.proposal.scope, 'outside');
  const applied = await teacher('/api/parent-notes/apply', { proposalId: suggestion.proposal.proposalId, revision: data.week.revision });
  assert.equal(applied.status, 200);
  assert.equal(applied.body.week.days.find(item => item.date === day).outdoorPreference, 'outside');
  assert.ok(priorOutside.every(date => applied.body.week.days.find(item => item.date === date).mode === 'outside'), 'previously outdoor days stay outside');
  assert.equal((await teacher('/api/parent-notes')).body.notes[0].status, 'applied');
});

test('demo notes stay in memory and deleting a plan clears its notes', async t => {
  const { teacher, parent, store, data } = await fixture(t);
  const demo = (await teacher('/api/demo', {})).body;
  const share = (await teacher('/api/week/share', { demoId: demo.demoId, action: 'enable' })).body.share;
  const path = `/api/parents/${share.path.split('/').at(-1)}/notes`;
  await parent(path, { text: 'A synthetic demo note.', date: demo.week.days[1].date, nonce: randomUUID() });
  assert.equal((await teacher(`/api/parent-notes?demoId=${demo.demoId}`)).body.unread, 1);
  assert.equal(store.db.prepare('SELECT count(*) AS n FROM parent_notes').get().n, 0);
  assert.equal((await teacher('/api/parent-notes')).body.unread, 0);
  await teacher('/api/week/delete', { demoId: demo.demoId, revision: demo.week.revision });
  assert.equal((await parent(path, { text: 'This must not arrive.', nonce: randomUUID() })).status, 404);
  const realShare = (await teacher('/api/week/share', { action: 'enable' })).body.share;
  await parent(`/api/parents/${realShare.path.split('/').at(-1)}/notes`, { text: 'Another synthetic note.', nonce: randomUUID() });
  await teacher('/api/week/delete', { revision: data.week.revision });
  assert.equal(store.db.prepare('SELECT count(*) AS n FROM parent_notes').get().n, 0);
});

test('the sidebar retains older notes and meal changes use the same schedule proposal path', async t => {
  const { teacher, parent, data, path, store } = await fixture(t, {
    noteAdviceProvider: async note => ({ kind: 'actionable', date: note.date, scope: 'schedule', rowId: null, instruction: 'Move lunch to 14:00', explanation: pair('Предлог.', 'Suggestion.') }),
    dayPlanProvider: async (day, _settings, request) => {
      assert.equal(request.scope, 'schedule');
      return { source: 'ai', change: { theme: day.theme, timeline: [{ id: 'lunch', kind: 'meal', start: '14:00', end: '14:30', label: pair('Lunch', 'Lunch') }] } };
    },
  });
  const userId = store.db.prepare('SELECT id FROM users WHERE username = ?').get('notes.teacher@test.mk').id;
  const oldId = store.addParentNote(userId, '2026-09-14', { date: '2026-09-15', text: 'A note from the previous week.', nonce: randomUUID() });
  assert.ok((await teacher('/api/parent-notes')).body.notes.some(note => note.id === oldId));
  const previous = await teacher('/api/parent-notes/suggest', { noteId: oldId, revision: data.week.revision });
  assert.equal(previous.body.advice.kind, 'informational'); assert.equal(previous.body.proposal, null);
  await parent(path + '/notes', { text: 'Please change a routine.', date: data.week.days[1].date, nonce: randomUUID() });
  const noteId = (await teacher('/api/parent-notes')).body.notes.find(note => note.id !== oldId).id;
  const suggested = await teacher('/api/parent-notes/suggest', { noteId, revision: data.week.revision });
  assert.equal(suggested.status, 200);
  assert.deepEqual((await teacher('/api/week/share', { action: 'enable' })).body.week, data.week);
  const applied = await teacher('/api/parent-notes/apply', { proposalId: suggested.body.proposal.proposalId, revision: data.week.revision });
  assert.equal(applied.status, 200);
  assert.equal(applied.body.week.days[1].timeline[0].start, '14:00');
  assert.equal(applied.body.week.approval, null);
  assert.equal((await teacher('/api/parent-notes')).body.notes.find(note => note.id === noteId).status, 'applied');
});
