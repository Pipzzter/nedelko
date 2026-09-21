import { skopjeParts } from '../config/index.js';
import { invalid, minutes, validateTimeline } from './settings.js';
import { validateCurriculum } from './curriculum.js';
import { learningText } from './session-plan.js';
import { resolveTimelineOverlaps } from './timeline.js';

// Only elapsed time protects a row; its kind or occasion never does.
export const protectedActivity = () => false;
export const rowContent = (row) => structuredClone({
  id: row.id, start: row.start, end: row.end, kind: row.kind,
  label: row.label, note: row.note || null
});
export function assertUpcoming(day, clock, row) {
  const local = skopjeParts(new Date(clock));
  if (!day?.theme || day.closed || day.date < local.date ||
      (row && day.date === local.date && minutes(row.start) <= local.minutes))
    throw invalid('activity_finished', 409);
  return local;
}

export function authoredTimeline(day, proposed, clock) {
  const local = skopjeParts(new Date(clock));
  const rows = validateTimeline(proposed);
  const started = day.timeline.filter(row => day.date < local.date ||
    (day.date === local.date && minutes(row.start) <= local.minutes));
  const lockedIds = new Set(started.map(row => row.id));
  for (const original of started) {
    const next = rows.find(row => row.id === original.id);
    if (!next || JSON.stringify(rowContent(next)) !== JSON.stringify(rowContent(original)))
      throw invalid('activity_finished', 409);
  }
  if (JSON.stringify(rows.filter(row => lockedIds.has(row.id)).map(row => row.id)) !==
      JSON.stringify(started.map(row => row.id))) throw invalid('activity_finished', 409);
  const lastStarted = rows.findLastIndex(row => lockedIds.has(row.id));
  if (lastStarted >= 0 && rows.slice(0, lastStarted).some(row => !lockedIds.has(row.id))) throw invalid('activity_finished', 409);
  for (const row of rows) {
    if (!lockedIds.has(row.id) && day.date === local.date && minutes(row.start) <= local.minutes)
      throw invalid('activity_finished', 409);
  }
  return resolveTimelineOverlaps(rows, lockedIds).map(row => {
    const original = day.timeline.find(item => item.id === row.id);
    if (original && JSON.stringify(rowContent(row)) === JSON.stringify(rowContent(original)))
      return structuredClone(original);
    return { ...(row.kind === 'eco' && original?.lesson ? { lesson: structuredClone(original.lesson) } : {}),
      ...row, customized: true };
  });
}

// Both preview and apply use this boundary. Model fields never supply evidence.
export function validateDayChange(day, settings, request, change, clock) {
  const local = assertUpcoming(day, clock);
  const next = structuredClone(day);
  if (request.scope === 'activity') {
    changeActivity({ day, request, clock, change, settings, next });
  } else if (request.scope === 'schedule') {
    next.timeline = authoredTimeline(day, change?.timeline, clock);
    const [theme] = validateCurriculum([change?.theme || day.theme], settings, { count: 1 });
    const [previousTheme] = validateCurriculum([day.theme], settings, { count: 1 });
    if (day.date === local.date && day.timeline.some(row => row.kind === 'eco' && minutes(row.start) <= local.minutes) &&
        JSON.stringify(theme) !== JSON.stringify(previousTheme)) throw invalid('activity_finished', 409);
    next.theme = theme;
    next.baseTheme = structuredClone(theme);
    next.themePinned = true;
    next.authoredTimeline = true;
    if (change.outdoorPreference !== undefined) {
      if (!['auto', 'inside', 'outside'].includes(change.outdoorPreference)) throw invalid('invalid_plan');
      next.outdoorPreference = change.outdoorPreference;
    }
  } else throw invalid('invalid_plan');
  return next;
}

function changeActivity({ day, request, clock, change, settings, next }) {
  const row = day.timeline.find(item => item.id === request.rowId);
  if (!row) throw invalid('invalid_timeline');
  assertUpcoming(day, clock, row);
  if (row.kind === 'eco') {
    const [theme] = validateCurriculum([change?.theme], settings, { count: 1 });
    theme.dayActivities = structuredClone(day.theme.dayActivities);
    if (day.timeline.filter(item => item.kind === 'eco').length === 1) {
      next.theme = theme;
      next.baseTheme = structuredClone(theme);
      next.themePinned = true;
    }
    next.timeline = next.timeline.map(item => {
      if (item.id !== row.id) return item;
      const changed = { ...item, label: theme.title, lesson: theme, customized: true };
      delete changed.note;
      return changed;
    });
  } else {
    const label = learningText(change?.label, 100);
    const note = learningText(change?.note, 1200);
    next.timeline = next.timeline.map(item => item.id === row.id ? { ...item, label, note, customized: true } : item);
  }
}
