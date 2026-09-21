import test from 'node:test';
import assert from 'node:assert/strict';
import { pm25Aqi, nowCast, category } from '../domain/aqi.js';
import { assessSensors, checkSensor, distanceKm } from '../domain/qc.js';
import { demoConditions } from '../services/conditions.js';
import { LOCATIONS, skopjeParts } from '../config/index.js';
import { minutes, timeLabel } from '../domain/constraints.js';
import { findOpenActivityWindow, planningWeekDates } from '../domain/planner.js';
import { DEFAULT_SETTINGS, validateSettings } from '../domain/settings.js';
import { PREFERENCE_BOUNDS } from '../domain/preferences.js';

const now = Date.parse('2026-09-19T06:45:00Z');
const conditions = (scenario = 'normal') => demoConditions(LOCATIONS[0], scenario, now);
const sensor = (base = 15) => ({ id: 'test', name: 'Synthetic test monitor', distance: 1,
  samples: Array.from({ length: 12 }, (_, index) => ({ stamp: new Date(now - index * 3600000 - 5 * 60000).toISOString(), value: base + index % 3 })) });

test('EPA PM2.5 breakpoints, decimal truncation, and above-scale extrapolation', () => {
  for (const [input, expected] of [[0, 0], [9, 50], [9.09, 50], [9.1, 51], [35.4, 100], [35.49, 100], [35.5, 101], [55.4, 150], [55.5, 151], [125.4, 200], [125.5, 201], [225.4, 300], [225.5, 301], [325.4, 500]]) assert.equal(pm25Aqi(input), expected, String(input));
  assert.equal(pm25Aqi(400), 649);
  for (const value of [null, undefined, NaN, Infinity, -1, '9']) assert.equal(pm25Aqi(value), null);
  assert.equal(category(301).key, 'hazardous');
});
test('NowCast has zero handling and needs two valid hours among the latest three', () => {
  assert.equal(nowCast([0, 0, null, 0]), 0);
  assert.equal(nowCast([20, null, null, 20, 20]), null);
  assert.equal(nowCast([null, 20, 20]), 20);
  assert.equal(nowCast([20, 20, 20]), 20);
});
test('NowCast weights missing hours by their real age, not compressed array position', () => {
  // weight .5: (40 + 0*.5 + 10*.125) / (1 + .5 + .125) = 25.3846.
  assert.equal(nowCast([40, 0, null, 10]), 25.3);
  assert.equal(nowCast([100, 10, 10]), 61.4);
});
test('location distance and Skopje winter/summer time are explicit', () => {
  assert.equal(distanceKm(LOCATIONS[0], LOCATIONS[0]), 0);
  assert.ok(distanceKm(LOCATIONS[0], LOCATIONS[1]) > 2);
  assert.equal(skopjeParts(new Date('2026-01-15T07:00:00Z')).minutes, 480);
  assert.equal(skopjeParts(new Date('2026-07-15T06:00:00Z')).minutes, 480);
});
test('a fresh plausible sensor with enough history passes', () => {
  const result = checkSensor(sensor(), now);
  assert.equal(result.valid, true); assert.equal(result.ageMinutes, 5);
  assert.ok(result.aqi > 50 && result.aqi < 100);
});
test('staleness is based on measurement time, including the 60-minute boundary', () => {
  const data = sensor();
  data.samples = data.samples.map((s, i) => ({ ...s, stamp: new Date(now - 60 * 60000 - i * 3600000).toISOString() }));
  assert.equal(checkSensor(data, now).flags.includes('stale'), false);
  assert.equal(checkSensor(data, now + 1).flags.includes('stale'), true);
});

test('even a one-millisecond future observation makes the local assessment unknown', () => {
  for (const offset of [1, 60000, 5 * 60000]) {
    const data = sensor(); data.samples[0].stamp = new Date(now + offset).toISOString();
    assert.ok(checkSensor(data, now).flags.includes('future'));
    const result = assessSensors([data, sensor(), sensor()], now);
    assert.equal(result.valid, false); assert.equal(result.aqi, null);
    assert.ok(result.reasons.includes('suspect'));
  }
});
test('999 and 2000 readings block a positive decision even with two low neighbors', () => {
  for (const value of [999, 2000]) {
    const high = sensor(); high.samples[0].value = value;
    const result = assessSensors([high, sensor(), sensor()], now);
    assert.equal(result.valid, false); assert.equal(result.aqi, null);
    assert.ok(result.reasons.includes('suspect'));
  }
});
test('an extreme historical value cannot be silently discarded from NowCast', () => {
  const data = sensor(); data.samples[3].value = 2000;
  assert.ok(checkSensor(data, now).flags.includes('extreme-review'));
});
test('malformed newest data cannot expose a previous low reading as current', () => {
  for (const value of [NaN, null, undefined, 'clean']) {
    const data = sensor(); data.samples[0].value = value;
    assert.equal(assessSensors([data, sensor(), sensor()], now).valid, false);
  }
});
test('negative readings, future timestamps, stuck signals, and thin history are rejected', () => {
  const negative = sensor(); negative.samples[0].value = -2;
  assert.ok(checkSensor(negative, now).flags.includes('negative'));
  const future = sensor(); future.samples[0].stamp = new Date(now + 10 * 60000).toISOString();
  assert.ok(checkSensor(future, now).flags.includes('future'));
  const stuck = sensor(); stuck.samples.forEach((s) => { s.value = 12; });
  assert.ok(checkSensor(stuck, now).flags.includes('stuck'));
  const thin = sensor(); thin.samples = thin.samples.slice(0, 1);
  assert.ok(checkSensor(thin, now).flags.includes('history'));
});
test('sudden rise is treated as uncertain evidence, never simply removed as a glitch', () => {
  const data = sensor(); data.samples[0].value = 180;
  assert.ok(checkSensor(data, now).flags.includes('sudden-rise'));
  assert.equal(assessSensors([data, sensor(), sensor()], now).valid, false);
});
test('disagreeing neighbors and missing coverage prevent an outside plan', () => {
  const a = assessSensors([sensor(10), sensor(12), sensor(80)], now);
  assert.ok(a.reasons.includes('disagreement')); assert.equal(a.aqi, null);
  assert.equal(assessSensors([sensor()], now).valid, false);
  assert.equal(assessSensors([], now).valid, false);
});
test('settings enforce canonical comfort bounds and strict numeric types', () => {
  const validateBoth = preferences => [
    () => validateSettings({ ...DEFAULT_SETTINGS, preferences })
  ];
  const invalid = { status: 400, code: 'invalid_preferences', message: 'invalid_preferences' };
  for (const [key, { min, max }] of Object.entries(PREFERENCE_BOUNDS)) {
    for (const n of [min - 0.1, max + 0.1, NaN, Infinity, null, String(min)]) {
      for (const validate of validateBoth({ ...DEFAULT_SETTINGS.preferences, [key]: n })) assert.throws(validate, invalid);
    }
    for (const n of [min, max]) {
      const preferences = { ...DEFAULT_SETTINGS.preferences, [key]: n };
      for (const validate of validateBoth(preferences)) assert.deepEqual(validate().preferences, preferences);
    }
  }
  for (const preferences of [null, [], {}, 'comfortable', { ...DEFAULT_SETTINGS.preferences, minApparentC: 20, maxApparentC: 20 }]) {
    for (const validate of validateBoth(preferences)) assert.throws(validate, invalid);
  }
});
test('planning week starts on Monday and contains five workdays', () => {
  assert.deepEqual(planningWeekDates('2026-09-19T06:45:00Z'), ['2026-09-21', '2026-09-22', '2026-09-23', '2026-09-24', '2026-09-25']);
  assert.deepEqual(planningWeekDates('2026-09-20T06:45:00Z'), ['2026-09-21', '2026-09-22', '2026-09-23', '2026-09-24', '2026-09-25']);
  assert.deepEqual(planningWeekDates('2026-09-23T06:45:00Z'), ['2026-09-21', '2026-09-22', '2026-09-23', '2026-09-24', '2026-09-25']);
  assert.deepEqual(planningWeekDates('2027-01-01T06:45:00Z'), ['2026-12-28', '2026-12-29', '2026-12-30', '2026-12-31', '2027-01-01']);
});

test('open activity windows respect current time, future dates and fully occupied days', () => {
  const c = conditions(); c.clock = '2026-09-21T10:01:00Z';
  const schedule = { ...DEFAULT_SETTINGS, dayStart: '08:00', duration: 30, blocks: [] };
  assert.equal(findOpenActivityWindow(schedule, c).start, '12:15');
  assert.equal(findOpenActivityWindow(schedule, c, { date: '2026-09-22' }).start, '10:15');
  assert.equal(findOpenActivityWindow(schedule, c, { useCurrentTime: false }).start, '10:15');
  assert.equal(findOpenActivityWindow({ ...schedule, blocks: [{ start: '08:00', end: '16:00' }] }, c), null);
  c.clock = '2026-09-21T15:00:00Z';
  assert.equal(findOpenActivityWindow(schedule, c), null);
});
test('indoor activity time is deterministic and never overlaps the fixed rhythm', () => {
  const schedule = structuredClone(DEFAULT_SETTINGS);
  const window = findOpenActivityWindow(schedule, conditions(), { date: '2026-09-21', useCurrentTime: false });
  assert.ok(window);
  const start = Number(window.start.slice(0, 2)) * 60 + Number(window.start.slice(3));
  const end = Number(window.end.slice(0, 2)) * 60 + Number(window.end.slice(3));
  for (const block of schedule.blocks) {
    const blockStart = Number(block.start.slice(0, 2)) * 60 + Number(block.start.slice(3));
    const blockEnd = Number(block.end.slice(0, 2)) * 60 + Number(block.end.slice(3));
    assert.ok(!(start < blockEnd && end > blockStart));
  }
});

test('shared time arithmetic rejects malformed hours and formats day boundaries', () => {
  for (const value of [null, '', '24:00', '09:60', '9:00']) assert.equal(minutes(value), null);
  assert.equal(minutes('00:00'), 0); assert.equal(minutes('23:59'), 1439);
  assert.equal(timeLabel(0), '00:00'); assert.equal(timeLabel(1439), '23:59');
});
