import { minutes } from './settings.js';
import { titleKey } from './session-plan.js';
import { playChoices } from './play-ideas.js';

// Learning choices only. Outdoor permissions are owned by week.js.
const ROLES = ['welcome', 'circle', 'creative', 'movement', 'calm', 'together', 'reflection', 'departure'];
export function weatherContext(summary) {
  if (!summary || summary.kind === 'unknown' || !Number.isFinite(summary.max)) return 'unknown';
  if (summary.kind === 'snow') return 'snow';
  if (summary.kind === 'storm' || summary.kind === 'rain' || summary.rain >= 55) return 'rain';
  if (summary.wind >= 22) return 'wind';
  if (summary.max >= 28) return 'hot';
  if (summary.max < 13) return 'cold';
  return 'mild';
}
export function activityRole(start) {
  const n = minutes(start);
  if (n < 510) {
    return 'welcome';
  }
  if (n < 570) {
    return 'circle';
  }
  if (n < 615) {
    return 'movement';
  }
  if (n < 720) {
    return 'creative';
  }
  if (n < 840) {
    return 'calm';
  }
  if (n < 900) {
    return 'together';
  }
  if (n < 945) {
    return 'reflection';
  }
  return 'departure';
}
export function defaultDayActivities(index, materials = ['paper', 'cardboard']) {
  const choices = playChoices(materials);
  return Object.fromEntries(
    ['circle', 'creative', 'movement', 'reflection'].map((role) => [
      role,
      structuredClone(choices[(index * 3 + ROLES.indexOf(role)) % choices.length].label)
    ])
  );
}
export function activityText(role, index, summary, theme) {
  const choices = playChoices(theme.materials);
  const weather = { rain: 1, wind: 2, hot: 3, cold: 4, snow: 5 }[weatherContext(summary)] || 0;
  const selected = choices[(index * 3 + Math.max(0, ROLES.indexOf(role)) + weather) % choices.length];
  return { label: structuredClone(selected.label), note: structuredClone(selected.note) };
}
export function adaptActivities(day, index, today, clockMinutes) {
  day.learningWeather = weatherContext(day.summary);
  day.timeline = day.timeline.map((row) => {
    if (
      !row.activityRole ||
      row.customized ||
      row.plannedSession ||
      day.date < today ||
      (day.date === today && minutes(row.start) <= clockMinutes)
    )
      return row;
    return { ...row, ...activityText(row.activityRole, index, day.summary, day.theme) };
  });
}
export function diversifyActivities(day, index, today, clockMinutes) {
  const seen = { mk: new Set(), en: new Set() };
  const remember = (row) => {
    for (const lang of ['mk', 'en']) seen[lang].add(titleKey(row.label[lang]));
  };
  const canChange = (row) =>
    row.kind === 'activity' &&
    !row.customized &&
    !row.plannedSession &&
    !row.occasionIds?.length &&
    day.date >= today &&
    (day.date !== today || minutes(row.start) > clockMinutes);
  day.timeline.filter((row) => !canChange(row)).forEach(remember);
  const choices = playChoices(day.theme?.materials);
  for (const row of day.timeline.filter(canChange)) {
    if (['mk', 'en'].some((lang) => seen[lang].has(titleKey(row.label[lang])))) {
      const selected = Array.from({ length: choices.length }, (_, i) => choices[(i + index) % choices.length]).find(
        (item) => ['mk', 'en'].every((lang) => !seen[lang].has(titleKey(item.label[lang])))
      );
      if (selected) {
        row.label = structuredClone(selected.label);
        row.note = structuredClone(selected.note);
      }
    }
    remember(row);
  }
}
