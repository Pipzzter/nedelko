import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createCachedFetch, getConditions } from '../services/conditions.js';
import { LOCATIONS } from '../config/index.js';

const instant = Date.parse('2026-09-21T06:45:00Z');
const url = 'https://skopje.pulse.eco/rest/current';
async function directory(t) {
  const path = await mkdtemp(join(tmpdir(), 'eko-conditions-test-'));
  t.after(() => rm(path, { recursive: true, force: true }));
  return path;
}

test('cache deduplicates concurrent cold requests, persists responses and never renews failed evidence', async t => {
  const cacheDir = await directory(t); let now = instant; let calls = 0; let fail = false;
  const fetcher = async (_url, options) => {
    calls++; assert.equal(options.redirect, 'error'); assert.ok(options.signal);
    await new Promise(resolve => setTimeout(resolve, 15));
    if (fail) throw new Error('offline');
    return Response.json([{ stamp: '2026-09-21T06:38:00Z', value: 12 }]);
  };
  const cached = createCachedFetch({ cacheDir, fetcher, now: () => now });
  const [first, second] = await Promise.all([cached(url), cached(url)]);
  assert.equal(calls, 1); assert.deepEqual(first, second); assert.equal(first.cached, false);
  const hit = await cached(url); assert.equal(hit.cached, true); assert.equal(calls, 1);
  now += 180000; fail = true;
  const stale = await cached(url); assert.equal(stale.failedRefresh, true); assert.equal(stale.fetchedAt, first.fetchedAt);
  assert.equal(stale.data[0].stamp, first.data[0].stamp);
  const restarted = createCachedFetch({ cacheDir, fetcher, now: () => now });
  assert.deepEqual(await restarted(url, { fresh: true }), stale);
});

test('allowlists, status errors, invalid JSON and oversized bodies fail without clean-air data', async () => {
  let calls = 0;
  const cached = createCachedFetch({ cacheDir: null, fetcher: async () => { calls++; return Response.json({}); } });
  for (const source of ['http://skopje.pulse.eco/rest/current', 'https://evil.invalid/data']) await assert.rejects(cached(source), /not-allowed/);
  assert.equal(calls, 0);
  for (const response of [new Response('unavailable', { status: 503 }), new Response('invalid JSON'), new Response('x'.repeat(8_000_001))]) {
    const read = createCachedFetch({ cacheDir: null, fetcher: async () => response });
    assert.deepEqual(await read(url), { data: null, fetchedAt: null, cached: false, failedRefresh: true });
  }
});

test('unwritable cache does not discard a live response and expired memory entries refetch', async () => {
  let now = instant; let calls = 0;
  const read = createCachedFetch({ cacheDir: new URL(import.meta.url).pathname, now: () => now,
    fetcher: async () => { calls++; return Response.json({ fixture: true }); } });
  assert.equal((await read(url)).failedRefresh, false);
  now += 120001; await read(url); assert.equal(calls, 2);
});

function liveFixture({ failed = false, stale = false, missing = false, invalidValues = false } = {}) {
  const place = LOCATIONS.find(location => location.id === 'centar');
  const stamp = new Date(instant - 7 * 60000).toISOString();
  const sensors = ['one', 'two', 'banned'].map((sensorId, index) => ({ sensorId, position: `${place.lat + index * .001},${place.lon}`, type: index ? '1' : '0', status: index === 2 ? 'BANNED' : 'ACTIVE', description: 'Synthetic sensor' }));
  const current = sensors.map(sensor => ({ sensorId: sensor.sensorId, stamp, type: 'pm25', value: 12 }));
  return async source => {
    let data;
    if (source.endsWith('/sensor')) data = sensors;
    else if (source.endsWith('/current')) data = current;
    else if (source.includes('/dataRaw')) data = Array.from({ length: 12 }, (_, hour) => ({ type: 'pm25', stamp: new Date(instant - hour * 3600000 - 7 * 60000).toISOString(), value: 12 + hour % 3 }));
    else if (source.includes('air-quality')) data = { hourly: { time: ['2026-09-21T07:00'], pm2_5: [invalidValues ? -1 : 14], pm10: [22] } };
    else data = { hourly: { time: ['2026-09-21T07:00'], temperature_2m: [18], apparent_temperature: [17], precipitation_probability: [invalidValues ? -2 : 5], precipitation: [0], weather_code: [1], wind_speed_10m: [10] } };
    return { data: missing ? null : data, fetchedAt: new Date(instant - (stale ? 13 * 3600000 : 1000)).toISOString(), cached: stale, failedRefresh: failed };
  };
}

test('live projection uses validated nearby sensors and separates observations from forecasts', async () => {
  const result = await getConditions({ mode: 'live', fresh: true }, { now: () => instant, fetchConditions: liveFixture() });
  assert.equal(result.mode, 'live'); assert.equal(result.assessment.valid, true);
  assert.equal(result.forecastAvailable, true); assert.equal(result.weatherAvailable, true);
  assert.equal(result.forecast[0].pm25, 14); assert.equal(result.weather[0].apparentTemperature, 17);
  assert.equal(result.clock, new Date(instant).toISOString()); assert.equal(result.failedRefresh, false);
  const invalid = await getConditions({ mode: 'live' }, { now: () => instant, fetchConditions: liveFixture({ invalidValues: true }) });
  assert.equal(invalid.forecast[0].pm25, null); assert.equal(invalid.weather[0].precipitationProbability, null);
});

test('failed refresh, stale forecasts and missing responses never become clean-air approval', async () => {
  const failed = await getConditions({ mode: 'live' }, { now: () => instant, fetchConditions: liveFixture({ failed: true }) });
  assert.equal(failed.assessment.valid, false); assert.equal(failed.assessment.aqi, null);
  assert.ok(failed.assessment.reasons.includes('refresh-failed'));
  assert.equal(failed.forecastAvailable, false); assert.equal(failed.weatherAvailable, false);
  const stale = await getConditions({ mode: 'live' }, { now: () => instant, fetchConditions: liveFixture({ stale: true }) });
  assert.equal(stale.forecastAvailable, false); assert.equal(stale.weatherAvailable, false); assert.equal(stale.cached, true);
  const missing = await getConditions({ mode: 'live' }, { now: () => instant, fetchConditions: liveFixture({ missing: true }) });
  assert.equal(missing.assessment.valid, false); assert.deepEqual(missing.forecast, []); assert.deepEqual(missing.weather, []);
});

test('demo never fetches upstream and validates location, mode and scenario before access', async () => {
  const dependencies = { now: () => instant, fetchConditions: () => assert.fail('demo contacted upstream') };
  assert.equal((await getConditions({}, dependencies)).mode, 'demo');
  for (const input of [{ locationId: 'unknown' }, { mode: 'unknown' }, { scenario: 'unknown' }]) await assert.rejects(getConditions(input, dependencies), { status: 400 });
});
