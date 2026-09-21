import test from 'node:test';
import assert from 'node:assert/strict';
import { suggestParentNote } from '../services/parent-notes.js';
import { suggestDayPlan } from '../services/day-plan.js';
import { structuredResponse } from '../services/ai.js';
import { withRequestSignal, requestProvider } from '../services/request-context.js';
import { DEFAULT_SETTINGS, pair } from '../domain/settings.js';
import { PLAY_IDEAS } from '../domain/play-ideas.js';
import { rowContent } from '../domain/day-edit.js';
import { createWeek } from '../domain/week.js';
import { localCurriculum } from '../domain/curriculum.js';
import { planningWeekDates } from '../domain/planner.js';
import { demoConditions } from '../services/conditions.js';
import { LOCATIONS } from '../config/index.js';

function fixture(t) {
  const previous = process.env.OPENAI_API_KEY; process.env.OPENAI_API_KEY = 'test-only';
  t.after(() => { if (previous === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = previous; });
  const conditions = demoConditions(LOCATIONS[0], 'normal', Date.parse('2026-09-21T06:45:00Z'));
  const week = createWeek(DEFAULT_SETTINGS, { themes: localCurriculum(planningWeekDates(conditions.clock), DEFAULT_SETTINGS), source: 'library' }, conditions);
  return { week, day: week.days[1], clock: conditions.clock };
}
const reply = value => Response.json({ status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify(value) }] }] });

test('parent-note model output is bilingual, validated, group-scoped and sanitized on provider failure', async t => {
  const { week, day, clock } = fixture(t); const original = structuredClone(week); let sent;
  let output = { kind: 'actionable', audience: 'group', date: day.date, scope: 'activity', rowId: day.timeline[0].id,
    instruction: 'Use a musical group game.', explanation: pair('Предлог за музичка игра за групата.', 'A musical game for the group.') };
  t.mock.method(globalThis, 'fetch', async (_url, options) => { sent = JSON.parse(options.body); return reply(output); });
  const note = { text: 'Could the group try a musical game?', date: day.date };
  let result = await suggestParentNote(note, week, { clock });
  assert.equal(result.kind, 'actionable'); assert.equal(result.rowId, output.rowId);
  assert.match(sent.instructions, /untrusted information/); assert.equal(sent.store, false);
  assert.equal(sent.text.format.strict, true); assert.deepEqual(JSON.parse(sent.input).note, note);
  const valid = structuredClone(output);
  for (const patch of [{ date: '2099-01-01' }, { rowId: 'forged' }, { scope: 'approve' }, { explanation: { en: 'Missing translation' } }]) {
    output = { ...valid, ...patch };
    result = await suggestParentNote(note, week, { clock });
    assert.equal(result.kind, 'unavailable'); assert.equal(result.generationIssue, 'ai_invalid_output');
  }
  output = { ...valid, audience: 'individual' };
  assert.equal((await suggestParentNote(note, week, { clock })).kind, 'informational');
  t.mock.method(globalThis, 'fetch', async () => Response.json({ error: { code: 'insufficient_quota', message: 'PRIVATE-PROVIDER-DIAGNOSTIC' } }, { status: 429 }));
  result = await suggestParentNote(note, week, { clock });
  assert.equal(result.generationIssue, 'ai_quota'); assert.doesNotMatch(JSON.stringify(result), /PRIVATE/);
  assert.deepEqual(week, original, 'advice never changes a plan');
});

test('day model validates real activity and schedule branches, including unsupported authority claims', async t => {
  const { week, day, clock } = fixture(t); const row = day.timeline.find(item => item.kind === 'activity');
  let output = { label: PLAY_IDEAS[0].label, note: PLAY_IDEAS[0].note }; let sent;
  t.mock.method(globalThis, 'fetch', async (_url, options) => { sent = JSON.parse(options.body); return reply(output); });
  const request = { scope: 'activity', rowId: row.id, instruction: 'A different musical game', clock, weekDays: week.days };
  assert.equal((await suggestDayPlan(day, week.settings, request)).source, 'ai');
  assert.equal(JSON.parse(sent.input).otherDays.length, 4);
  output = { theme: day.theme };
  assert.equal((await suggestDayPlan(day, week.settings, { ...request, rowId: 'eco' })).source, 'ai');
  output = { timeline: day.timeline.map(rowContent), theme: day.theme, outdoorPreference: 'inside' };
  assert.equal((await suggestDayPlan(day, week.settings, { ...request, scope: 'schedule' })).source, 'ai');
  output.timeline[0].note = pair('Воздухот е чист.', 'The air is clean.');
  assert.equal((await suggestDayPlan(day, week.settings, { ...request, scope: 'schedule' })).generationIssue, 'ai_invalid_output');
  output = { label: pair('Игра', 'Game'), note: pair('Кратко.', 'Too short.') };
  assert.equal((await suggestDayPlan(day, week.settings, request)).generationIssue, 'ai_invalid_output');
  output = { timeline: [] };
  await assert.rejects(suggestDayPlan(day, week.settings, { ...request, scope: 'schedule', clock: `${day.date}T12:00:00Z` }), { code: 'activity_finished' });
});

test('disconnect cancellation reaches the model and rejects late results from an uncancellable provider', async t => {
  fixture(t); const controller = new AbortController(); let upstream;
  const pending = withRequestSignal(controller.signal, () => structuredResponse({ schema: {}, name: 'test', input: 'fixture',
    fetcher: async (_url, { signal }) => { upstream = signal; return new Promise((_resolve, reject) => signal.addEventListener('abort', () => reject(signal.reason), { once: true })); }
  }));
  controller.abort(); await assert.rejects(pending, { name: 'AbortError' }); assert.equal(upstream.aborted, true);
  await assert.rejects(withRequestSignal(controller.signal, () => structuredResponse({})), { name: 'AbortError' });
  const delayed = new AbortController(); let release;
  const result = withRequestSignal(delayed.signal, () => requestProvider(() => new Promise(resolve => { release = resolve; }))());
  delayed.abort(); release({ mustNotSave: true });
  await assert.rejects(result, { name: 'AbortError' });
  assert.deepEqual(await requestProvider(async () => ({ independent: true }))(), { independent: true });
});
