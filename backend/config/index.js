import { LOCATIONS } from './locations.js';
export { LOCATIONS } from './locations.js';
export const SCENARIOS = ['normal', 'polluted', 'stale', 'offline', 'disagreement', 'spike'];
export const POLICY = Object.freeze({
  version: 'prototype-2026-09-v1', freshnessMinutes: 60, radiusKm: 5,
  disagreementAbsolute: 25, disagreementRatio: 2, extremeReviewAt: 500,
  maxForecastAgeHours: 12, maxPlanAgeMinutes: 15,
});
export const DEFAULT_COMFORT = Object.freeze({
  minApparentC: 3, maxApparentC: 32, maxPrecipProbability: 55,
  maxPrecipitationMm: 0.5, maxWindKmh: 30,
});
export const SOURCES = [
  { label: 'pulse.eco · сензори и набљудувања', url: 'https://pulse.eco/restapi' },
  { label: 'Open-Meteo · CAMS прогноза (~11 km)', url: 'https://open-meteo.com/en/docs/air-quality-api' },
  { label: 'Open-Meteo · временска прогноза', url: 'https://open-meteo.com/en/docs' },
  { label: 'EPA · AQI и NowCast, мај 2024', url: 'https://nepis.epa.gov/Exe/ZyPURL.cgi?Dockey=P101AP0Q.TXT' },
  { label: 'EPA · активности на отворено во училишта', url: 'https://document.airnow.gov/air-quality-and-outdoor-guidance-for-schools.pdf' },
  { label: 'EPA · проверка на квалитет на сензори', url: 'https://www.epa.gov/air-sensor-toolbox/quality-assurance-air-sensors' },
];
export function locationById(id) {
  const location = LOCATIONS.find((item) => item.id === id);
  if (!location) throw Object.assign(new Error('Изберете поддржана локација. / Choose a supported location.'), { status: 400 });
  return location;
}
export function skopjeParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Skopje', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(date);
  const p = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return { date: `${p.year}-${p.month}-${p.day}`, minutes: Number(p.hour) * 60 + Number(p.minute) };
}
