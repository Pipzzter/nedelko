import { skopjeParts } from '../config/index.js';
import { invalid, minutes, validateTimeline } from './settings.js';
import { validateCurriculum } from './curriculum.js';
import { learningText, titleKey } from './session-plan.js';
import { enforceTiming } from './schedule-timing.js';

export const protectedActivity = row => ['meal', 'rest', 'routine'].includes(row.kind) || !!row.occasionIds?.length;
export const rowContent = row => structuredClone({ id: row.id, start: row.start, end: row.end, kind: row.kind, label: row.label, note: row.note || null });
export function assertUpcoming(day, clock, row) {
  const local = skopjeParts(new Date(clock));
  if (!day?.theme || day.closed || day.date < local.date || day.date === local.date &&
      (row ? minutes(row.start) <= local.minutes : day.timeline.every(item => minutes(item.start) <= local.minutes))) throw invalid('activity_finished', 409);
  if (row && protectedActivity(row)) throw invalid('protected_activity');
  return local;
}

// Both preview and apply use this boundary. No model field supplies evidence,
// ownership, holiday context, closure, or permission to go outside.
export function validateDayChange(day, settings, request, change, clock) {
  const local = assertUpcoming(day, clock);
  const next = structuredClone(day);
  if (request.scope === 'activity') {
    const row = day.timeline.find(item => item.id === request.rowId);
    if (!row) throw invalid('invalid_timeline');
    assertUpcoming(day, clock, row);
    if (row.kind === 'eco') {
      const [theme] = validateCurriculum([change?.theme], settings, { count: 1 });
      // A targeted lesson change must not rewrite supporting classroom sessions.
      theme.dayActivities = structuredClone(day.theme.dayActivities);
      next.theme = theme; next.baseTheme = structuredClone(theme); next.themePinned = true;
      next.timeline = next.timeline.map(item => item.id === row.id ? { ...item, label: theme.title, customized: true } : item);
    } else {
      const label = learningText(change?.label, 100); const note = learningText(change?.note, 1200);
      next.timeline = next.timeline.map(item => item.id === row.id ? { ...item, label, note, customized: true } : item);
    }
  } else if (request.scope === 'schedule') {
    const rows = validateTimeline(change?.timeline, settings);
    enforceTiming(request.timingTargets, rows, settings);
    if (!rows.length || rows[0].start !== settings.dayStart || rows.at(-1).end !== settings.dayEnd ||
        rows.some((row, i) => i && row.start !== rows[i - 1].end)) throw invalid('schedule_gaps');
    const [theme] = validateCurriculum([change?.theme], settings, { count: 1 });
    const oldEco = day.timeline.find(row => row.kind === 'eco');
    const eco = rows.find(row => row.kind === 'eco');
    if (!eco || eco.id !== oldEco?.id || minutes(eco.end) - minutes(eco.start) < 15 || minutes(eco.end) - minutes(eco.start) > 60) throw invalid('one_eco_slot');
    const fixed = row => protectedActivity(row) || day.date === local.date && minutes(row.start) <= local.minutes;
    for (const original of day.timeline.filter(fixed)) {
      const proposed = change.timeline.find(row => row.id === original.id);
      if (!proposed || JSON.stringify(rowContent(proposed)) !== JSON.stringify(rowContent(original))) throw invalid('protected_activity');
    }
    if (fixed(oldEco) && JSON.stringify(theme) !== JSON.stringify(validateCurriculum([day.theme], settings, { count: 1 })[0])) throw invalid('protected_activity');
    next.timeline = rows.map(row => {
      const original = day.timeline.find(item => item.id === row.id);
      if (original && row.kind !== original.kind || !original && row.kind !== 'activity') throw invalid('invalid_timeline');
      if (original && fixed(original)) return structuredClone(original);
      if (day.date === local.date && minutes(row.start) <= local.minutes) throw invalid('activity_finished', 409);
      const raw = change.timeline.find(item => item.id === row.id);
      const label = row.kind === 'eco' ? theme.title : learningText(row.label, 100);
      const note = raw.note == null ? undefined : learningText(raw.note, 1200);
      return { ...original, ...row, label, ...(note ? { note } : {}), customized: true };
    });
    next.theme = theme; next.baseTheme = structuredClone(theme); next.themePinned = true;
  } else throw invalid('invalid_plan');
  for (const lang of ['mk', 'en']) {
    const seen = new Set();
    for (const row of next.timeline.filter(row => ['eco', 'activity'].includes(row.kind))) {
      const key = titleKey(row.label[lang]);
      if (seen.has(key)) throw invalid('duplicate_activity');
      seen.add(key);
    }
  }
  return next;
}
