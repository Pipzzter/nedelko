import test from 'node:test';
import assert from 'node:assert/strict';
import { assertTimelineCoverage, resolveTimelineOverlaps } from '../domain/timeline.js';
import { DEFAULT_SETTINGS, pair } from '../domain/settings.js';
import { dailyPlanningContext } from '../domain/week.js';

const row = (id, start, end, kind = 'activity') => ({ id, start, end, kind, label: pair(id, id) });

test('opening, internal and closing gaps, including one missing minute, are rejected', () => {
  const cases = [[], [row('late', '07:31', '16:00')], [row('early', '07:30', '15:59')],
    [row('before', '07:30', '09:00'), row('after', '09:01', '16:00')],
    [row('breakfast', '08:30', '09:00', 'meal'), row('fruit', '10:00', '10:15', 'meal'),
      row('running', '10:30', '11:15'), row('lunch', '11:30', '12:00', 'meal'),
      row('nap', '12:30', '14:00', 'rest'), row('snack', '14:00', '14:15', 'meal'),
      row('workshop', '14:15', '16:00')]];
  for (const rows of cases) assert.throws(() => assertTimelineCoverage(rows, DEFAULT_SETTINGS), { code: 'timeline_gap' });
});

test('explicit breaks and free play fill time around a five-hour activity without changing it', () => {
  const rows = [row('arrival', '07:30', '08:30', 'routine'), row('play', '08:30', '09:00', 'free'),
    row('run', '09:00', '14:00'), row('break', '14:00', '14:30', 'rest'), row('afternoon', '14:30', '16:00')];
  const original = structuredClone(rows);
  assert.doesNotThrow(() => assertTimelineCoverage(rows, DEFAULT_SETTINGS));
  assert.deepEqual(rows, original, 'coverage validation must never stretch, shorten or insert activities');
});

test('extended days and overlap resolution must remain continuous', () => {
  const rows = [row('early', '06:00', '08:00'), row('middle', '07:30', '15:30'), row('late', '16:00', '18:00')];
  assert.doesNotThrow(() => assertTimelineCoverage(rows, DEFAULT_SETTINGS));
  assert.deepEqual(resolveTimelineOverlaps(rows).map(({ start, end }) => [start, end]), [['06:00', '08:00'], ['08:00', '16:00'], ['16:00', '18:00']]);
  rows[2].start = '16:01';
  assert.throws(() => assertTimelineCoverage(rows, DEFAULT_SETTINGS), { code: 'timeline_gap' });
});

test('regeneration preserves elapsed history while requiring every remaining minute', () => {
  const lockedRows = [row('breakfast', '08:30', '09:00', 'meal'), row('lesson', '10:00', '11:00')];
  const context = { from: '10:31', lockedRows };
  const rows = [...lockedRows, row('remaining', '11:00', '16:00')];
  const original = structuredClone(rows);
  assert.doesNotThrow(() => assertTimelineCoverage(rows, DEFAULT_SETTINGS, context));
  assert.deepEqual(rows, original);
  rows[2].start = '11:01';
  assert.throws(() => assertTimelineCoverage(rows, DEFAULT_SETTINGS, context), { code: 'timeline_gap' });
  assert.doesNotThrow(() => assertTimelineCoverage(lockedRows, DEFAULT_SETTINGS, { from: '16:01', lockedRows }));
  assert.throws(() => assertTimelineCoverage([row('late', '08:00', '16:00')], DEFAULT_SETTINGS, { from: '06:00' }), { code: 'timeline_gap' });
});

test('weekly model context exempts elapsed time only when regenerating a saved current day', () => {
  const dates = ['2026-09-21', '2026-09-22', '2026-09-23'];
  const conditions = { clock: '2026-09-22T08:30:00Z' };
  const previous = { days: [{ date: dates[1], timeline: [row('breakfast', '08:30', '09:00', 'meal')] }] };
  assert.equal(dailyPlanningContext(dates, DEFAULT_SETTINGS, conditions)[1].editableFrom, null);
  const context = dailyPlanningContext(dates, DEFAULT_SETTINGS, conditions, previous);
  assert.deepEqual(context.map(day => day.editableFrom), [null, '10:31', null]);
  assert.deepEqual(context[1].lockedRows.map(item => item.id), ['breakfast']);
});
