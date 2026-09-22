import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createCachedFetch, getConditions, demoConditions } from '../services/conditions.js';
import { calendarWeather, weatherSummary, dashboard, createWeek, adaptWeek } from '../domain/week.js';
import { parentView } from '../domain/parent-view.js';
import { planningWeekDates } from '../domain/planner.js';
import { DEFAULT_SETTINGS } from '../domain/settings.js';
import { localCurriculum } from '../domain/curriculum.js';
import { LOCATIONS } from '../config/index.js';

// Model the provider's UTC-relative date range, including local/UTC midnight differences.
function weatherData(source, now) {
  const query = new URL(source).searchParams;
  const past = Number(query.get('past_days') || 0);
  const days = past + Number(query.get('forecast_days') || 7);
  const midnight = Math.floor(now / 86400000) * 86400000;
  const time = Array.from({ length: days * 24 }, (_, i) => new Date(midnight - past * 86400000 + i * 3600000).toISOString().slice(0, 16));
  return { hourly: { time, temperature_2m: time.map((_, i) => 10 + i % 24), apparent_temperature: time.map(() => 20),
    precipitation_probability: time.map(() => 5), precipitation: time.map(() => 0), weather_code: time.map(() => 1), wind_speed_10m: time.map(() => 5) } };
}
function provider(now) {
  return async source => ({ data: source.includes('api.open-meteo.com/v1/forecast') ? weatherData(source, now) : [],
    fetchedAt: new Date(now).toISOString(), cached: false, failedRefresh: false });
}

test('all five dates retain temperatures midweek, after month rollover and at the UTC weekend boundary', async () => {
  for (const clock of ['2026-09-22T08:00:00Z', '2026-09-25T22:15:00Z', '2026-09-27T22:15:00Z', '2026-10-01T07:00:00Z', '2026-10-25T00:30:00Z']) {
    const now = Date.parse(clock);
    const conditions = await getConditions({ mode: 'live' }, { now: () => now, fetchConditions: provider(now) });
    const calendar = dashboard(null, conditions).calendar;
    assert.equal(calendar.length, 5);
    for (const day of calendar) {
      assert.ok(Number.isFinite(day.weatherDisplay.min), `${clock}: missing minimum on ${day.date}`);
      assert.ok(Number.isFinite(day.weatherDisplay.max), `${clock}: missing maximum on ${day.date}`);
    }
    if (clock.startsWith('2026-09-22')) assert.equal(calendar[0].weatherDisplay.status, 'historical');
    if (clock.startsWith('2026-09-25')) assert.equal(calendar[4].weatherDisplay.status, 'forecast');
  }
});

test('sub-hour activities include the overlapping hourly temperature and handle zero or negative values', () => {
  const clock = Date.parse('2026-09-21T05:00:00Z');
  const conditions = demoConditions(LOCATIONS[0], 'normal', clock);
  const date = planningWeekDates(conditions.clock)[0];
  for (const temperature of [0, -5]) {
    conditions.weather = [{ local: { date, minutes: 9 * 60 }, temperature, weatherCode: 1 }];
    conditions.forecast = [{ local: { date, minutes: 9 * 60 }, pm25: 10 }];
    const summary = weatherSummary(conditions, date, { dayStart: '09:15', dayEnd: '09:45' });
    assert.equal(summary.min, temperature); assert.equal(summary.max, temperature); assert.equal(summary.pm25, 10);
    assert.equal(calendarWeather(conditions, date, { dayStart: '09:15', dayEnd: '09:45' }).status, 'demo');
    assert.equal(calendarWeather(conditions, date, { dayStart: '10:00', dayEnd: '10:15' }).status, 'unavailable');
  }
});

test('a failed refresh retains recent saved temperatures after restart without granting outdoor eligibility', async t => {
  const cacheDir = await mkdtemp(join(tmpdir(), 'nedelko-weather-test-'));
  t.after(() => rm(cacheDir, { recursive: true, force: true }));
  let now = Date.parse('2026-09-22T05:00:00Z'); let fail = false;
  const fetcher = async source => {
    if (fail) throw new Error('synthetic outage');
    return Response.json((await provider(now)(source)).data);
  };
  let cached = createCachedFetch({ cacheDir, fetcher, now: () => now });
  const first = await getConditions({ mode: 'live' }, { now: () => now, fetchConditions: cached });
  const firstCalendar = dashboard(null, first).calendar;
  now += 3600000; fail = true;
  cached = createCachedFetch({ cacheDir, fetcher, now: () => now });
  const failed = await getConditions({ mode: 'live', fresh: true }, { now: () => now, fetchConditions: cached });
  assert.equal(failed.weatherAvailable, false); assert.equal(failed.weatherDisplayAvailable, true);
  assert.equal(failed.weatherFetchedAt, first.weatherFetchedAt, 'failed refresh must not renew the timestamp');
  const calendar = dashboard(null, failed).calendar;
  for (const [index, day] of calendar.entries()) {
    assert.equal(day.weatherDisplay.max, firstCalendar[index].weatherDisplay.max);
    assert.equal(day.weatherDisplay.status, 'cached');
    assert.equal(day.summary.max, null, 'planning and clothing advice cannot use display-only weather');
  }
  const dates = planningWeekDates(failed.clock);
  const week = createWeek(DEFAULT_SETTINGS, { source: 'library', themes: localCurriculum(dates, DEFAULT_SETTINGS) }, failed);
  assert.ok(week.days.every(day => day.mode !== 'outside'));
  const parents = parentView(week, now + 10000, failed);
  assert.deepEqual(parents.days[1].weatherDisplay, week.days[1].weatherDisplay);
  assert.equal(parents.days[1].summary.max, null);
  const recovered = { ...first, clock: failed.clock };
  assert.equal(adaptWeek(week, recovered).days[1].weatherDisplay.status, 'forecast');
  now += 13 * 3600000;
  const expired = await getConditions({ mode: 'live', fresh: true }, { now: () => now, fetchConditions: cached });
  assert.equal(expired.weatherDisplayAvailable, false);
  assert.ok(dashboard(null, expired).calendar.every(day => day.weatherDisplay.max === null && day.weatherDisplay.status === 'unavailable'));
});

test('missing data and future fetch timestamps cannot become saved display temperatures', async () => {
  const now = Date.parse('2026-09-22T05:00:00Z');
  for (const future of [false, true]) {
    const conditions = await getConditions({ mode: 'live' }, { now: () => now, fetchConditions: async source => ({
      ...await provider(now)(source), ...(future ? { fetchedAt: new Date(now + 3600000).toISOString() } : { data: null, fetchedAt: null, failedRefresh: true })
    }) });
    assert.equal(conditions.weatherDisplayAvailable, false);
    assert.ok(dashboard(null, conditions).calendar.every(day => day.weatherDisplay.status === 'unavailable'));
  }
});


test('freshly fetched weather is evaluated at request completion, not against the earlier request start', async () => {
  const started = Date.parse('2026-09-22T05:00:00Z');
  let now = started;
  const conditions = await getConditions({ mode: 'live', fresh: true }, { now: () => now, fetchConditions: async source => {
    now += 50;
    return provider(now)(source);
  } });
  assert.ok(Date.parse(conditions.weatherFetchedAt) > started);
  assert.equal(conditions.clock, new Date(now).toISOString());
  assert.equal(conditions.weatherAvailable, true);
  assert.equal(conditions.weatherDisplayAvailable, true);
  assert.ok(dashboard(null, conditions).calendar.every(day => Number.isFinite(day.weatherDisplay.max)));
});
