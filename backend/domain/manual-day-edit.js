import { skopjeParts } from '../config/index.js';
import { invalid, minutes, timeLabel, textPair, validateTimeline } from './settings.js';
import { validateCurriculum } from './curriculum.js';
import { authoredTimeline } from './day-edit.js';

// Direct teacher edits are distinct from model proposals: routines and occasion
// content can be edited, but identities, evidence and elapsed times are server-owned.
export function manualDayEdit(day, settings, request, clock) {
  const local = skopjeParts(new Date(clock));
  if (!day?.theme || day.closed || day.date < local.date) throw invalid('activity_finished', 409);
  const next = structuredClone(day);
  if (request.action === 'content') {
    editContent({ next, request, day, local, settings });
  } else if (request.action === 'timing') {
    editTiming({ request, day, next });
  } else if (request.action === 'reorder') {
    reorderActivities({ request, day, settings, next });
  } else if (request.action === 'timeline') {
    next.timeline = authoredTimeline(day, request.timeline, clock);
    next.authoredTimeline = true;
  } else throw invalid('invalid_plan');
  if (request.action !== 'content') next.timeline = authoredTimeline(day, next.timeline, clock);
  return next;
}

function editContent({ next, request, day, local, settings }) {
  const row = next.timeline.find((item) => item.id === request.rowId);
  if (!row) throw invalid('invalid_timeline');
  if (day.date === local.date && minutes(row.start) <= local.minutes) throw invalid('activity_finished', 409);
  if (
    !request.content ||
    Object.keys(request.content).some((key) => !['label', 'note', 'theme', 'occasionDiscussion'].includes(key))
  )
    throw invalid('invalid_plan');
  if (row.kind === 'eco') {
    const [theme] = validateCurriculum(
      [{ ...request.content.theme, dayActivities: day.theme.dayActivities }],
      settings,
      { count: 1 }
    );
    if (day.timeline.filter(item => item.kind === 'eco').length === 1) {
      next.theme = theme;
      next.baseTheme = structuredClone(theme);
      next.themePinned = true;
    }
    row.lesson = theme;
    delete row.note;
    row.label = theme.title;
  } else {
    row.label = textPair(request.content.label, 100);
    row.note = textPair(request.content.note, 1200);
  }
  if (row.occasionDiscussion) row.occasionDiscussion = textPair(request.content.occasionDiscussion, 1200);
  row.customized = true;
}

function editTiming({ request, day, next }) {
  if (
    !Array.isArray(request.starts) ||
    request.starts.length !== day.timeline.length
  )
    throw invalid('invalid_timeline');
  next.timeline = day.timeline.map((row, index) => ({
    ...row,
    start: request.starts[index],
    end: timeLabel(minutes(request.starts[index]) + minutes(row.end) - minutes(row.start)),
    customized: true
  }));
  validateTimeline(next.timeline);
}

function reorderActivities({ request, day, settings, next }) {
  const ids = request.rowIds;
  if (
    !Array.isArray(ids) ||
    ids.length !== day.timeline.length ||
    new Set(ids).size !== ids.length ||
    ids.some((id) => !day.timeline.some((row) => row.id === id))
  )
    throw invalid('invalid_timeline');
  let cursor = minutes(day.timeline[0]?.start || settings.dayStart);
  next.timeline = ids.map((id) => {
    const row = structuredClone(day.timeline.find((item) => item.id === id));
    const duration = minutes(row.end) - minutes(row.start);
    row.start = timeLabel(cursor);
    cursor += duration;
    row.end = timeLabel(cursor);
    return { ...row, customized: true };
  });
  validateTimeline(next.timeline);
}
