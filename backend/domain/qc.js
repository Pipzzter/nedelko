import { nowCast, pm25Aqi, category } from './aqi.js';
import { POLICY } from '../config/index.js';
export const mean = (values) => (values.length ? values.reduce((a, b) => a + b, 0) / values.length : null);
export function distanceKm(a, b) {
  const radians = (v) => (v * Math.PI) / 180;
  const dlat = radians(b.lat - a.lat);
  const dlon = radians(b.lon - a.lon);
  const h = Math.sin(dlat / 2) ** 2 + Math.cos(radians(a.lat)) * Math.cos(radians(b.lat)) * Math.sin(dlon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}
export function checkSensor(sensor, now = Date.now()) {
  const flags = [];
  if ((sensor.samples ?? []).some((r) => !r || !Number.isFinite(r.value) || !Number.isFinite(Date.parse(r.stamp))))
    flags.push('malformed');
  const samples = (sensor.samples ?? [])
    .filter((r) => r && Number.isFinite(r.value) && Number.isFinite(Date.parse(r.stamp)))
    .sort((a, b) => Date.parse(b.stamp) - Date.parse(a.stamp));
  const latest = samples[0];
  if (!latest)
    return {
      ...sensor,
      samples: undefined,
      flags: [...flags, 'missing'],
      valid: false,
      ageMinutes: null,
      value: null,
      nowcast: null,
      aqi: null
    };
  const ageMinutes = (now - Date.parse(latest.stamp)) / 60000;
  if (ageMinutes > POLICY.freshnessMinutes) flags.push('stale');
  if (ageMinutes < -5) flags.push('future');
  if (latest.value < 0) flags.push('negative');
  if (latest.value >= POLICY.extremeReviewAt) flags.push('extreme-review');
  const recent = samples.filter((r) => now - Date.parse(r.stamp) <= 12 * 3600000 && now >= Date.parse(r.stamp));
  if (recent.some((r) => r.value >= POLICY.extremeReviewAt) && !flags.includes('extreme-review'))
    flags.push('extreme-review');
  if (isStuckSensor({ recent, latest })) flags.push('stuck');
  const previous = samples.find((s) => Date.parse(latest.stamp) - Date.parse(s.stamp) >= 30 * 60000);
  if (isSuddenRise({ previous, latest })) flags.push('sudden-rise');
  const currentHour = Math.floor(now / 3600000);
  const buckets = Array.from({ length: 12 }, () => []);
  for (const sample of recent) {
    const age = currentHour - Math.floor(Date.parse(sample.stamp) / 3600000);
    if (age >= 0 && age < 12 && sample.value >= 0 && sample.value < POLICY.extremeReviewAt)
      buckets[age].push(sample.value);
  }
  const concentration = nowCast(buckets.map(mean));
  if (concentration === null) flags.push('history');
  return {
    id: sensor.id,
    name: sensor.name,
    lat: sensor.lat,
    lon: sensor.lon,
    type: sensor.type,
    distance: sensor.distance,
    value: latest.value,
    stamp: latest.stamp,
    ageMinutes: Math.max(0, Math.round(ageMinutes)),
    nowcast: concentration,
    aqi: pm25Aqi(concentration),
    flags,
    valid: flags.length === 0
  };
}
export function assessSensors(sensors, now = Date.now()) {
  const checked = sensors.map((sensor) => checkSensor(sensor, now));
  const usable = checked.filter((s) => s.valid);
  const reasons = [];
  const importantFlags = new Set(['extreme-review', 'sudden-rise', 'future', 'malformed']);
  if (checked.some((s) => s.flags.some((f) => importantFlags.has(f)))) reasons.push('suspect');
  if (usable.length < 2) reasons.push('insufficient');
  if (usable.length >= 2) {
    const latest = usable.map((s) => s.value);
    const spread = Math.max(...latest) - Math.min(...latest);
    if (
      spread > POLICY.disagreementAbsolute &&
      Math.max(...latest) > Math.max(1, Math.min(...latest)) * POLICY.disagreementRatio
    )
      reasons.push('disagreement');
  }
  const valid = reasons.length === 0;
  // Do not manufacture a blended monitor. Conservatively screen with the highest valid local NowCast.
  const aqi = valid ? Math.max(...usable.map((s) => s.aqi)) : null;
  const concentration = usable.length ? Math.max(...usable.map((s) => s.nowcast)) : null;
  return {
    valid,
    aqi,
    pm25: concentration,
    category: category(aqi),
    sensors: checked,
    reasons,
    acceptedCount: usable.length,
    totalCount: checked.length,
    oldestObservation: usable.length
      ? new Date(Math.min(...usable.map((s) => Date.parse(s.stamp)))).toISOString()
      : null,
    assessedAt: new Date(now).toISOString()
  };
}

function isStuckSensor({ recent, latest }) {
  return (
    recent.length >= 8 &&
    latest.value > 0 &&
    new Set(recent.map((s) => s.value)).size === 1 &&
    Date.parse(recent[0].stamp) - Date.parse(recent.at(-1).stamp) >= 6 * 3600000
  );
}

function isSuddenRise({ previous, latest }) {
  return previous && latest.value - previous.value > 35 && latest.value > Math.max(previous.value, 1) * 2;
}
