import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assessSensors, distanceKm } from '../domain/qc.js';
import { locationById, LOCATIONS, POLICY, SCENARIOS, skopjeParts } from '../config/index.js';
import { demoWeekById } from '../config/demo.js';

const CACHE_DIR = fileURLToPath(new URL('../../.cache/', import.meta.url));
const ALLOWED_HOSTS = new Set([
  ...LOCATIONS.map((l) => `${l.pulseCity}.pulse.eco`),
  'air-quality-api.open-meteo.com',
  'api.open-meteo.com'
]);
async function boundedJson(response, maxBytes = 8_000_000) {
  if (!response.ok) throw new Error(`upstream-${response.status}`);
  let size = 0;
  const chunks = [];
  for await (const chunk of response.body) {
    size += chunk.length;
    if (size > maxBytes) throw new Error('upstream-too-large');
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}
export function createCachedFetch({
  cacheDir = CACHE_DIR,
  fetcher = (...args) => fetch(...args),
  now = Date.now
} = {}) {
  const memory = new Map();
  const pending = new Map();
  return async function cachedFetch(url, { ttl = 120000, fresh = false } = {}) {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' || !ALLOWED_HOSTS.has(parsed.hostname)) throw new Error('upstream-not-allowed');
    const key = createHash('sha256').update(url).digest('hex');
    if (pending.has(key)) return pending.get(key);
    let saved = memory.get(key);
    if (!saved && cacheDir) {
      try {
        saved = JSON.parse(await readFile(resolve(cacheDir, `${key}.json`), 'utf8'));
      } catch {
        /* Empty cache is normal. */
      }
    }
    // Another cold request may have started while the disk read was pending.
    if (pending.has(key)) return pending.get(key);
    if (!fresh && saved && now() - Date.parse(saved.fetchedAt) < ttl)
      return { ...saved, cached: true, failedRefresh: false };
    const request = (async () => {
      try {
        const headers = { Accept: 'application/json', 'User-Agent': 'Nedelko-LocalPlanner/1.0' };
        if (parsed.hostname.endsWith('.pulse.eco') && process.env.PULSE_USERNAME && process.env.PULSE_PASSWORD) {
          headers.Authorization = `Basic ${Buffer.from('' + process.env.PULSE_USERNAME + ':' + process.env.PULSE_PASSWORD).toString('base64')}`;
        }
        const response = await fetcher(url, { headers, signal: AbortSignal.timeout(9000), redirect: 'error' });
        const entry = { data: await boundedJson(response), fetchedAt: new Date(now()).toISOString() };
        memory.set(key, entry);
        if (memory.size > 100) memory.delete(memory.keys().next().value);
        if (cacheDir)
          try {
            await mkdir(cacheDir, { recursive: true });
            await writeFile(resolve(cacheDir, `${key}.json`), JSON.stringify(entry));
          } catch {
            /* A read-only disk must not break live data. */
          }
        return { ...entry, cached: false, failedRefresh: false };
      } catch {
        if (saved) return { ...saved, cached: true, failedRefresh: true };
        return { data: null, fetchedAt: null, cached: false, failedRefresh: true };
      } finally {
        pending.delete(key);
      }
    })();
    pending.set(key, request);
    return request;
  };
}
export const cachedFetch = createCachedFetch();
function forecastRows(data) {
  const h = data?.hourly;
  if (!Array.isArray(h?.time) || !Array.isArray(h.pm2_5)) return [];
  return h.time.map((stamp, index) => ({
    stamp: `${stamp}:00Z`,
    local: skopjeParts(new Date(`${stamp}:00Z`)),
    pm25: Number.isFinite(h.pm2_5[index]) && h.pm2_5[index] >= 0 ? h.pm2_5[index] : null,
    pm10: Number.isFinite(h.pm10?.[index]) ? h.pm10[index] : null
  }));
}
function weatherRows(data) {
  const h = data?.hourly;
  if (!Array.isArray(h?.time) || !Array.isArray(h.temperature_2m)) return [];
  const valid = (value, minimum = -Infinity) => (Number.isFinite(value) && value >= minimum ? value : null);
  return h.time.map((stamp, index) => ({
    stamp: `${stamp}:00Z`,
    local: skopjeParts(new Date(`${stamp}:00Z`)),
    temperature: valid(h.temperature_2m[index], -100),
    apparentTemperature: valid(h.apparent_temperature?.[index], -100),
    precipitationProbability: valid(h.precipitation_probability?.[index], 0),
    precipitation: valid(h.precipitation?.[index], 0),
    weatherCode: valid(h.weather_code?.[index], 0),
    windSpeed: valid(h.wind_speed_10m?.[index], 0)
  }));
}
function nextDemoMorning(realNow) {
  const parts = skopjeParts(new Date(realNow));
  const weekday = new Date(`${parts.date}T12:00:00Z`).getUTCDay();
  // A demo always starts on Monday so the whole five-day story is visible.
  let addDays;
  if (weekday === 6) {
    addDays = 2;
  } else if (weekday === 0) {
      addDays = 1;
    } else {
      addDays = 1 - weekday;
    }
  let value = realNow + addDays * 86400000 + (8 * 60 + 45 - parts.minutes) * 60000;
  // Correct the local hour if the generated week crosses a daylight-saving boundary.
  value += (8 * 60 + 45 - skopjeParts(new Date(value)).minutes) * 60000;
  return value;
}
export function demoConditions(location, scenario = 'normal', realNow = Date.now(), profile = null) {
  const demoNow = profile ? Date.parse(profile.clock) : nextDemoMorning(realNow);
  const base = scenario === 'polluted' ? 82 : 18.4;
  const sensors = [0, 1, 2].map((index) => ({
    id: `demo-${index}`,
    name: ['Демо · Централна станица', 'Демо · Парк', 'Демо · Населба'][index],
    type: 'synthetic',
    lat: location.lat + index * 0.003,
    lon: location.lon + index * 0.002,
    distance: [0.3, 0.7, 1.1][index],
    samples: Array.from({ length: 12 }, (_, hour) => ({
      stamp: new Date(demoNow - hour * 3600000 - (scenario === 'stale' ? 105 : 7 + index * 2) * 60000).toISOString(),
      value: Math.round((base + index * 0.8 + Math.sin(hour * 0.8) * 1.7) * 10) / 10
    }))
  }));
  if (scenario === 'offline')
    sensors.forEach((s) => {
      s.samples = [];
    });
  if (scenario === 'disagreement')
    sensors[2].samples.forEach((s) => {
      s.value += 65;
    });
  if (scenario === 'spike') sensors[0].samples[0].value = 185;
  const levels = [31, 25, 12.8, 18.4, 22, 24, 28, 35, 43, 49, 54];
  const dailyAirOffset = [0, 5, 45, 2, 8, 4, 12];
  const forecast = [];
  const weather = [];
  for (let day = 0; day < 7; day++) {
    const dayClock = demoNow + day * 86400000;
    const date = skopjeParts(new Date(dayClock)).date;
    for (let index = 0; index < levels.length; index++) {
      addDemoHour({ index, levels, dailyAirOffset, day, scenario, forecast, dayClock, date, profile, weather });
    }
  }
  return {
    mode: 'demo',
    scenario,
    location,
    clock: new Date(demoNow).toISOString(),
    fetchedAt: new Date(realNow).toISOString(),
    forecastFetchedAt: new Date(realNow).toISOString(),
    weatherFetchedAt: new Date(realNow).toISOString(),
    historical: scenario === 'stale',
    failedRefresh: false,
    weatherFailedRefresh: false,
    forecastAvailable: true,
    weatherAvailable: true,
    assessment: assessSensors(sensors, demoNow),
    forecast,
    weather,
    provenance: 'Синтетички пример · примерен час 08:45 · не е мерење во живо.',
    policyVersion: POLICY.version
  };
}
export async function getConditions(
  { locationId = 'centar', mode = 'demo', scenario = 'normal', fresh = false, demoWeek } = {},
  { fetchConditions = cachedFetch, now: clock = Date.now } = {}
) {
  const location = locationById(locationId);
  if (!['demo', 'live'].includes(mode) || !SCENARIOS.includes(scenario))
    throw Object.assign(new Error('Непознат режим или сценарио.'), { status: 400 });
  if (mode === 'demo') return demoConditions(location, scenario, clock(), demoWeekById(demoWeek));
  const now = clock();
  const forecastUrl = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${location.lat}&longitude=${location.lon}&hourly=pm2_5,pm10&timezone=GMT&forecast_days=7&domains=cams_europe`;
  const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${location.lat}&longitude=${location.lon}&hourly=temperature_2m,apparent_temperature,precipitation_probability,precipitation,weather_code,wind_speed_10m&timezone=GMT&forecast_days=7`;
  const pulseBase = `https://${location.pulseCity}.pulse.eco/rest`;
  const [metadata, current, prediction, weatherPrediction] = await Promise.all([
    fetchConditions(`${pulseBase}/sensor`, { ttl: 3600000, fresh }),
    fetchConditions(`${pulseBase}/current`, { fresh }),
    fetchConditions(forecastUrl, { ttl: 1800000, fresh }),
    fetchConditions(weatherUrl, { ttl: 1800000, fresh })
  ]);
  const catalog = new Map((Array.isArray(metadata.data) ? metadata.data : []).map((s) => [String(s.sensorId), s]));
  const currentRows = (Array.isArray(current.data) ? current.data : []).filter((r) => r.type === 'pm25');
  const candidates = currentRows
    .map((row) => {
      const meta = catalog.get(String(row.sensorId)) ?? {};
      const [lat, lon] = String(row.position ?? meta.position)
        .split(',')
        .map(Number);
      return {
        id: String(row.sensorId),
        name: String(meta.description ?? row.sensorId).slice(0, 100),
        lat,
        lon,
        type: meta.type === '0' ? 'reference' : 'community',
        status: meta.status,
        distance: distanceKm(location, { lat, lon }),
        row
      };
    })
    .filter(
      (s) =>
        Number.isFinite(s.distance) &&
        s.distance <= POLICY.radiusKm &&
        !['BANNED', 'INACTIVE', 'REQUESTED'].includes(s.status)
    )
    .sort((a, b) => a.distance - b.distance)
    .slice(0, 5);
  // Fixed hourly bounds permit cache reuse across local requests.
  const start = new Date(Math.floor(now / 3600000) * 3600000 - 12 * 3600000).toISOString();
  const end = new Date(Math.ceil(now / 3600000) * 3600000).toISOString();
  const history = await Promise.all(
    candidates.map((s) =>
      fetchConditions(
        `${pulseBase}/dataRaw?sensorId=${encodeURIComponent(s.id)}&type=pm25&from=${encodeURIComponent(start)}&to=${encodeURIComponent(end)}`,
        { fresh }
      )
    )
  );
  const sensors = candidates.map((sensor, index) => {
    const rows = Array.isArray(history[index].data) ? history[index].data : [];
    const dedup = new Map(
      [...rows, sensor.row]
        .filter((r) => r.type === 'pm25')
        .map((r) => [
          r.stamp,
          {
            stamp: r.stamp,
            value: r.value === null || r.value === undefined || String(r.value).trim() === '' ? Number.NaN : Number(r.value)
          }
        ])
    );
    return { ...sensor, samples: [...dedup.values()] };
  });
  const assessment = assessSensors(sensors, now);
  const failedRefresh = metadata.failedRefresh || current.failedRefresh || history.some((h) => h.failedRefresh);
  if (failedRefresh) {
    assessment.valid = false;
    assessment.aqi = null;
    assessment.reasons.push('refresh-failed');
    assessment.category = { key: 'unknown', label: 'Нема свежа проверка', color: '#89948f' };
  }
  const forecastAge = (now - Date.parse(prediction.fetchedAt)) / 3600000;
  const forecastAvailable = !!prediction.data && !prediction.failedRefresh && forecastAge <= POLICY.maxForecastAgeHours;
  const weatherAge = (now - Date.parse(weatherPrediction.fetchedAt)) / 3600000;
  const weatherAvailable =
    !!weatherPrediction.data && !weatherPrediction.failedRefresh && weatherAge <= POLICY.maxForecastAgeHours;
  return {
    mode,
    scenario,
    location,
    clock: new Date(now).toISOString(),
    fetchedAt: current.fetchedAt,
    forecastFetchedAt: prediction.fetchedAt,
    weatherFetchedAt: weatherPrediction.fetchedAt,
    historical: failedRefresh || !assessment.valid,
    cached: current.cached,
    failedRefresh,
    weatherFailedRefresh: weatherPrediction.failedRefresh,
    forecastAvailable,
    weatherAvailable,
    assessment,
    forecast: forecastRows(prediction.data),
    weather: weatherRows(weatherPrediction.data),
    provenance: current.cached
      ? 'Зачуван вистински одговор од pulse.eco · проверете го времето на мерењето.'
      : 'Вистински набљудувања од pulse.eco · прогнози од CAMS и Open-Meteo.',
    policyVersion: POLICY.version
  };
}

function demoRainProbability({ rainy, snowy, day }) {
  if (rainy) {
    return 78;
  }
  if (snowy) {
    return 70;
  }
  return [15, 20, 10, 25, 5, 18, 30][day];
}

function demoPrecipitation({ rainy, snowy }) {
  if (rainy) {
    return 1.2;
  }
  if (snowy) {
    return 0.2;
  }
  return 0;
}

function demoWeatherCode({ snowy, rainy, windy, day }) {
  if (snowy) {
    return 73;
  }
  if (rainy) {
    return 61;
  }
  if (windy || day === 1) {
    return 3;
  }
  return 1;
}

function addDemoHour({ index, levels, dailyAirOffset, day, scenario, forecast, dayClock, date, profile, weather }) {
  const hour = 8 + index;
  const minutes = hour * 60;
  let pm25 = levels[index] + dailyAirOffset[day];
  if (scenario === 'polluted' && day === 0) pm25 += 60;
  forecast.push({
    stamp: new Date(dayClock + (minutes - (8 * 60 + 45)) * 60000).toISOString(),
    local: { date, minutes },
    pm25,
    pm10: pm25 * 1.6
  });
  const curve = Math.sin((index / 10) * Math.PI);
  const baseTemperature = (profile?.temperatures || [13, 14, 16, 7, 18, 17, 15])[day];
  const rainy = profile ? profile.rainy.includes(day) : day === 1;
  const snowy = profile?.snowy.includes(day) || false;
  const windy = profile ? profile.windy.includes(day) : day === 3;
  weather.push({
    stamp: new Date(dayClock + (minutes - (8 * 60 + 45)) * 60000).toISOString(),
    local: { date, minutes },
    temperature: Math.round((baseTemperature + curve * 6) * 10) / 10,
    apparentTemperature: Math.round((baseTemperature - 1 + curve * 5.5) * 10) / 10,
    precipitationProbability: demoRainProbability({ rainy, snowy, day }),
    precipitation: demoPrecipitation({ rainy, snowy }),
    weatherCode: demoWeatherCode({ snowy, rainy, windy, day }),
    windSpeed: windy ? 24 : 10 + day
  });
}
