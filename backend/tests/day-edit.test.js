import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_SETTINGS, pair, validateGenerationSettings } from '../domain/settings.js';
import { localCurriculum } from '../domain/curriculum.js';
import { planningWeekDates } from '../domain/planner.js';
import { createWeek, applyDayChange, editWeek } from '../domain/week.js';
import { validateDayChange, protectedActivity, rowContent } from '../domain/day-edit.js';
import { demoConditions } from '../services/conditions.js';
import { suggestDayPlan } from '../services/day-plan.js';
import { LOCATIONS } from '../config/index.js';
import { demoWeekById } from '../config/demo.js';

function fixture() {
  const conditions = demoConditions(LOCATIONS[0], 'normal', Date.now(), demoWeekById('spring-garden'));
  const dates = planningWeekDates(conditions.clock);
  const week = createWeek(DEFAULT_SETTINGS, { themes: localCurriculum(dates, DEFAULT_SETTINGS), source: 'library' }, conditions);
  return { conditions, week, day: week.days[3] };
}
function movedSchedule(day) {
  const timeline = day.timeline.map(rowContent);
  const pairIndex = timeline.findIndex((row, i) => i && !protectedActivity(day.timeline[i - 1]) && !protectedActivity(day.timeline[i]) &&
    row.kind === 'activity' && timeline[i - 1].kind === 'activity' && row.end >= '15:45');
  assert.ok(pairIndex > 0);
  timeline[pairIndex - 1].end = '15:00'; timeline[pairIndex].start = '15:00';
  return { timeline, theme: day.theme };
}

test('one activity changes without rewriting other rows, lesson, days or times', () => {
  const { day, week, conditions } = fixture();
  const row = day.timeline.find(item => item.kind === 'activity' && !protectedActivity(item));
  const proposal = { scope: 'activity', rowId: row.id, date: day.date, source: 'ai',
    change: { label: pair('Музички круг', 'A music circle'), note: pair('Со воспитувачот создаваме ритам.', 'With the teacher, create a rhythm.') } };
  const changed = applyDayChange(week, proposal, conditions);
  const result = changed.days.find(item => item.date === day.date);
  assert.equal(result.timeline.find(item => item.id === row.id).label.en, 'A music circle');
  assert.deepEqual(result.timeline.filter(item => item.id !== row.id), day.timeline.filter(item => item.id !== row.id));
  assert.deepEqual(result.theme, day.theme);
  assert.deepEqual(changed.days.filter(item => item.date !== day.date), week.days.filter(item => item.date !== day.date));
  assert.equal(changed.approval, null); assert.equal(changed.checkedAt, null);
});

test('schedules can replace routines, omit meals, contain gaps and extend beyond defaults', () => {
  const { day, week, conditions } = fixture();
  const change = { theme: day.theme, timeline: [
    { id: 'run', start: '09:00', end: '14:00', kind: 'eco', label: pair('Run', 'Run') },
    { id: 'rest-new', start: '15:00', end: '18:00', kind: 'rest', label: pair('Rest', 'Rest') }
  ] };
  const next = validateDayChange(day, week.settings, { scope: 'schedule' }, change, conditions.clock);
  assert.deepEqual(next.timeline.map(({ start, end }) => [start, end]), [['09:00', '14:00'], ['15:00', '18:00']]);
  assert.equal(next.timeline.some(row => row.kind === 'meal'), false);
  const overlap = structuredClone(change); overlap.timeline[1].start = '12:00'; overlap.timeline[1].end = '13:30';
  const resolved = validateDayChange(day, week.settings, { scope: 'schedule' }, overlap, conditions.clock);
  assert.deepEqual(resolved.timeline.map(({ start, end }) => [start, end]), [['09:00', '14:00'], ['14:00', '15:30']]);
  for (const kind of ['meal', 'rest', 'routine']) assert.equal(protectedActivity({ kind }), false);
});

test('a selected main lesson changes both variants but leaves all supporting sessions intact', () => {
  const { day, week, conditions } = fixture();
  const theme = structuredClone(day.theme); theme.title = pair('Градина од хартија', 'A paper garden');
  theme.inside = pair('Со воспитувачот правиме градина од хартија.', 'With the teacher, make a paper garden.');
  theme.outside = pair('Со воспитувачот ја изложуваме градината во дворот.', 'With the teacher, display our garden in the yard.');
  theme.dayActivities.circle = pair('Не треба да се примени', 'Must not be applied');
  const result = applyDayChange(week, { date: day.date, scope: 'activity', rowId: 'eco', source: 'ai', change: { theme } }, conditions).days[3];
  assert.equal(result.theme.title.en, 'A paper garden');
  assert.deepEqual(result.timeline.filter(row => row.kind !== 'eco'), day.timeline.filter(row => row.kind !== 'eco'));
  assert.deepEqual(result.theme.dayActivities, day.theme.dayActivities);
});

test('only started rows are immutable through proposals and direct week edits', () => {
  const { day, week, conditions } = fixture();
  const eco = day.timeline.find(row => row.kind === 'eco'); eco.occasionIds = ['verified-holiday'];
  assert.doesNotThrow(() => validateDayChange(day, week.settings, { scope: 'activity', rowId: eco.id }, { theme: day.theme }, conditions.clock));
  const draft = structuredClone(week); draft.days[3].timeline = [];
  assert.equal(editWeek(week, draft, conditions).days[3].timeline.length, 0);
  const row = day.timeline[0];
  const clock = `${day.date}T07:00:00Z`;
  assert.throws(() => validateDayChange(day, week.settings, { scope: 'activity', rowId: row.id }, {}, clock), { code: 'activity_finished' });
  const change = { theme: day.theme, timeline: day.timeline.map(rowContent) };
  for (const mutation of [
    rows => rows.filter(item => item.id !== row.id),
    rows => rows.map(item => item.id === row.id ? { ...item, label: pair('Changed', 'Changed') } : item),
    rows => [...rows, { id: 'past', start: '06:00', end: '06:30', kind: 'free', label: pair('Past', 'Past') }]
  ]) assert.throws(() => validateDayChange(day, week.settings, { scope: 'schedule' }, { ...change, timeline: mutation(change.timeline) }, clock), { code: 'activity_finished' });
  assert.doesNotThrow(() => validateDayChange(day, week.settings, { scope: 'schedule' }, change, clock));
});

test('week edits accept zero or several eco rows without dropping a day', () => {
  const { day, week, conditions } = fixture();
  for (const rows of [[], day.timeline.filter(row => row.kind !== 'eco'), [
    { id: 'eco-a', start: '08:00', end: '09:30', kind: 'eco', label: pair('First', 'First') },
    { id: 'eco-b', start: '15:00', end: '17:00', kind: 'eco', label: pair('Second', 'Second') }
  ]]) {
    const input = structuredClone(week); input.days[3].timeline = rows;
    const changed = editWeek(week, input, conditions);
    assert.equal(changed.days.length, 5); assert.equal(changed.days[3].timeline.length, rows.length);
    assert.ok(changed.messages.daily[day.date].en);
  }
});

test('AI schedule proposals unlock upcoming routines without exposing identity', async t => {
  const old = process.env.OPENAI_API_KEY; process.env.OPENAI_API_KEY = 'test-only';
  t.after(() => { if (old === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = old; });
  const { day, week, conditions } = fixture(); let sent; let change = movedSchedule(day);
  t.mock.method(globalThis, 'fetch', async (_url, options) => {
    sent = JSON.parse(options.body);
    if (sent.text.format.name === 'kindergarten_schedule_intent') return Response.json({ status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify({ targets: [] }) }] }] });
    return Response.json({ status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify(change) }] }] });
  });
  const settings = { ...week.settings, gradinka: { name: 'PRIVATE-NAME' }, groupName: 'PRIVATE-GROUP' };
  const options = { scope: 'schedule', instruction: 'Move the boundary to 15:00', clock: conditions.clock, weekDays: week.days };
  assert.equal((await suggestDayPlan(day, settings, options)).source, 'ai');
  assert.doesNotMatch(sent.input, /PRIVATE-NAME|PRIVATE-GROUP/);
  assert.ok(JSON.parse(sent.input).timeline.filter(row => ['meal', 'rest'].includes(row.kind)).every(row => !row.locked));
  change.timeline.find(row => row.kind === 'meal').label.en = 'Changed lunch';
  assert.equal((await suggestDayPlan(day, settings, options)).change.timeline.find(row => row.kind === 'meal').label.en, 'Changed lunch');
});

test('default routines are optional at generation', () => {
  const settings = { ...DEFAULT_SETTINGS, gradinka: { name: 'Garden' }, groupName: 'Group', teacherPrompt: 'Nature' };
  for (const kind of ['meal', 'rest']) assert.doesNotThrow(() => validateGenerationSettings({ ...settings, blocks: settings.blocks.filter(row => row.kind !== kind) }));
});
