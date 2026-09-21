import test from 'node:test';
import assert from 'node:assert/strict';
import { explicitDurations, validateTimingIntent, enforceTiming } from '../domain/schedule-timing.js';
import { DEFAULT_SETTINGS, pair, minutes } from '../domain/settings.js';
import { localCurriculum } from '../domain/curriculum.js';
import { planningWeekDates } from '../domain/planner.js';
import { createWeek, applyDayChange } from '../domain/week.js';
import { rowContent } from '../domain/day-edit.js';
import { demoConditions } from '../services/conditions.js';
import { suggestDayPlan } from '../services/day-plan.js';
import { LOCATIONS } from '../config/index.js';
import { demoWeekById } from '../config/demo.js';

function fixture(dayEnd = '16:00') {
  const conditions = demoConditions(LOCATIONS[0], 'normal', Date.now(), demoWeekById('spring-garden'));
  const settings = { ...DEFAULT_SETTINGS, dayEnd };
  const week = createWeek(settings, { themes: localCurriculum(planningWeekDates(conditions.clock), settings), source: 'library' }, conditions);
  const day = week.days[3]; const row = day.timeline.find(row => row.kind === 'activity' && row.start === '09:00');
  row.label = pair('Кратка приказна за гепардот', 'Short documentary about the cheetah');
  return { conditions, week, day, row };
}
const target = row => ({ rowId: row.id, durationMinutes: 120, position: 'end', start: null, end: null });

test('English and Macedonian duration requests keep their exact minute value', () => {
  for (const text of ['2 hours', 'two hours', '2 часа', 'два часа']) assert.deepEqual(explicitDurations(text), [120]);
  assert.deepEqual(explicitDurations('1 hour and 30 minutes'), [90]);
  assert.deepEqual(explicitDurations('1,5 часа'), [90]);
  assert.deepEqual(explicitDurations('Move it to 15:00'), []);
});
test('duration parsing separates unrelated quantities and handles long text without a matching unit', () => {
  for (const [instruction, expected] of [
    ['half an hour', []],
    ['half hour and 15 minutes', [45]],
    ['1 час и 30 минути, потоа 20 минути игра', [90, 20]],
    ['1 hour of drawing, then 30 minutes outside', [60, 30]],
    ['2 hours and 5 minutes; 1,5 часа', [125, 90]],
    ['1 hour and 1.5 minutes', [60, 5]],
    ['15:30, 2 groups, 6 books, 45 min', [45]],
    ['9'.repeat(2000) + ' children', []],
    ['1 hour' + ' '.repeat(2000) + 'later', [60]]
  ]) assert.deepEqual(explicitDurations(instruction), expected, instruction.slice(0, 80));
});
test('two hours at closing explains the 105-minute limit instead of returning 45 minutes', () => {
  const { day, row, week, conditions } = fixture();
  assert.throws(() => validateTimingIntent([target(row)], day, week.settings, 'put the cheetas at the end for 2 hours', conditions.clock), error => {
    assert.equal(error.code, 'timing_conflict');
    assert.deepEqual(error.timing, { requestedMinutes: 120, availableMinutes: 105 }); return true;
  });
  assert.throws(() => validateTimingIntent([], day, week.settings, 'Make the cheetah film two hours', conditions.clock), { code: 'timing_not_satisfied' });
  assert.throws(() => enforceTiming([target(row)], day.timeline, week.settings), { code: 'timing_not_satisfied' });
});
test('a feasible two-hour move is validated in preview and apply; a shorter answer is rejected', async t => {
  const beforeKey = process.env.OPENAI_API_KEY; process.env.OPENAI_API_KEY = 'test-only';
  t.after(() => { if (beforeKey === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = beforeKey; });
  const { day, row, week, conditions } = fixture('17:00');
  const timingTargets = [target(row)];
  let change = { theme: day.theme, timeline: day.timeline.filter(item => item.start < '15:00' && item.id !== row.id).map(item => ({ ...rowContent(item), end: item.end > '15:00' ? '15:00' : item.end })) };
  change.timeline.push({ ...rowContent(row), id: 'replacement-game', label: pair('Игра со насоки', 'A directions game') }, { ...rowContent(row), start: '15:00', end: '17:00' });
  t.mock.method(globalThis, 'fetch', async (_url, options) => {
    const request = JSON.parse(options.body);
    const value = request.text.format.name === 'kindergarten_schedule_intent' ? { targets: timingTargets } : change;
    if (request.text.format.name !== 'kindergarten_schedule_intent') assert.deepEqual(JSON.parse(request.input).timingTargets, timingTargets);
    return Response.json({ status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify(value) }] }] });
  });
  const options = { scope: 'schedule', instruction: 'Move the cheetah documentary to the end and make it two hours', clock: conditions.clock };
  const proposal = await suggestDayPlan(day, week.settings, options);
  assert.equal(proposal.source, 'ai');
  const next = applyDayChange(week, { ...proposal, scope: 'schedule', date: day.date }, conditions);
  const changed = next.days[3].timeline.find(item => item.id === row.id);
  assert.equal(changed.end, '17:00'); assert.equal(minutes(changed.end) - minutes(changed.start), 120);
  const shortened = structuredClone(proposal); shortened.change.timeline.find(item => item.id === row.id).start = '16:15';
  assert.throws(() => applyDayChange(week, { ...shortened, scope: 'schedule', date: day.date }, conditions), { code: 'timing_not_satisfied' });
  change = shortened.change;
  await assert.rejects(suggestDayPlan(day, week.settings, options), { code: 'timing_not_satisfied' });
});
