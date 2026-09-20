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

test('schedule changes can resize activity times while protected routines remain exact', () => {
  const { day, week, conditions } = fixture(); const change = movedSchedule(day);
  const result = validateDayChange(day, week.settings, { scope: 'schedule' }, change, conditions.clock);
  assert.ok(result.timeline.some(row => row.start === '15:00'));
  assert.deepEqual(result.timeline.filter(protectedActivity), day.timeline.filter(protectedActivity));
  for (const kind of ['meal', 'rest']) {
    const invalid = structuredClone(change); const row = invalid.timeline.find(item => item.kind === kind);
    row.label.en = 'Tampered';
    assert.throws(() => validateDayChange(day, week.settings, { scope: 'schedule' }, invalid, conditions.clock), { code: 'protected_activity' });
    assert.throws(() => validateDayChange(day, week.settings, { scope: 'activity', rowId: row.id }, {}, conditions.clock), { code: 'protected_activity' });
  }
  const gap = structuredClone(change); gap.timeline[0].start = '07:45';
  assert.throws(() => validateDayChange(day, week.settings, { scope: 'schedule' }, gap, conditions.clock), { code: 'schedule_gaps' });
  const overlap = structuredClone(change); overlap.timeline[1].start = overlap.timeline[0].start;
  assert.throws(() => validateDayChange(day, week.settings, { scope: 'schedule' }, overlap, conditions.clock), { code: 'overlapping_times' });
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

test('holiday lessons, started rows and the legacy edit endpoint cannot bypass locks', () => {
  const { day, week, conditions } = fixture();
  const eco = day.timeline.find(row => row.kind === 'eco'); eco.occasionIds = ['verified-holiday'];
  assert.throws(() => validateDayChange(day, week.settings, { scope: 'activity', rowId: eco.id }, { theme: day.theme }, conditions.clock), { code: 'protected_activity' });
  const draft = structuredClone(week); const changed = draft.days.find(item => item.date === day.date);
  changed.timeline = changed.timeline.filter(row => row.kind !== 'rest');
  assert.throws(() => editWeek(week, draft, conditions), { code: 'protected_activity' });
  const row = day.timeline.find(item => item.kind === 'activity');
  assert.throws(() => validateDayChange(day, week.settings, { scope: 'activity', rowId: row.id }, {}, `${day.date}T14:00:00Z`), { code: 'activity_finished' });
});

test('AI schedule proposals receive locked context and reject tampering without exposing identity', async t => {
  const old = process.env.OPENAI_API_KEY; process.env.OPENAI_API_KEY = 'test-only';
  t.after(() => { if (old === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = old; });
  const { day, week, conditions } = fixture(); let sent; let change = movedSchedule(day);
  t.mock.method(globalThis, 'fetch', async (_url, options) => {
    sent = JSON.parse(options.body);
    return Response.json({ status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify(change) }] }] });
  });
  const settings = { ...week.settings, gradinka: { name: 'PRIVATE-NAME' }, groupName: 'PRIVATE-GROUP' };
  const options = { scope: 'schedule', instruction: 'Move the boundary to 15:00', clock: conditions.clock, weekDays: week.days };
  assert.equal((await suggestDayPlan(day, settings, options)).source, 'ai');
  assert.doesNotMatch(sent.input, /PRIVATE-NAME|PRIVATE-GROUP/);
  assert.ok(JSON.parse(sent.input).timeline.filter(row => ['meal', 'rest'].includes(row.kind)).every(row => row.locked));
  change.timeline.find(row => row.kind === 'meal').label.en = 'Changed lunch';
  const failed = await suggestDayPlan(day, settings, options);
  assert.equal(failed.change, null); assert.equal(failed.generationIssue, 'ai_invalid_output');
});

test('new kindergarten generation requires daily meals and rest', () => {
  const settings = { ...DEFAULT_SETTINGS, gradinka: { name: 'Garden' }, groupName: 'Group', teacherPrompt: 'Nature' };
  for (const kind of ['meal', 'rest']) assert.throws(() => validateGenerationSettings({ ...settings, blocks: settings.blocks.filter(row => row.kind !== kind) }), { code: 'daily_routines_required' });
});
