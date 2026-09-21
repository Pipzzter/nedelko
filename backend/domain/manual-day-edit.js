import { skopjeParts } from '../config/index.js';
import { invalid, minutes, timeLabel, textPair, validateTimeline } from './settings.js';
import { validateCurriculum } from './curriculum.js';

// Direct teacher edits are distinct from model proposals: routines and occasion
// content can be edited, but identities, evidence and elapsed times are server-owned.
export function manualDayEdit(day, settings, request, clock) {
  const local = skopjeParts(new Date(clock));
  if (!day?.theme || day.closed || day.date < local.date) throw invalid('activity_finished', 409);
  const next = structuredClone(day);
  if (request.action === 'content') {
    const row = next.timeline.find(item => item.id === request.rowId);
    if (!row) throw invalid('invalid_timeline');
    if (day.date === local.date && minutes(row.end) <= local.minutes) throw invalid('activity_finished', 409);
    if (!request.content || Object.keys(request.content).some(key => !['label', 'note', 'theme', 'occasionDiscussion'].includes(key))) throw invalid('fixed_times');
    if (row.kind === 'eco') {
      const [theme] = validateCurriculum([{ ...request.content.theme, dayActivities: day.theme.dayActivities }], settings, { count: 1 });
      next.theme = theme; next.baseTheme = structuredClone(theme); next.themePinned = true;
      row.label = theme.title;
    } else {
      row.label = textPair(request.content.label, 100);
      row.note = textPair(request.content.note, 1200);
    }
    if (row.occasionDiscussion) row.occasionDiscussion = textPair(request.content.occasionDiscussion, 1200);
    row.customized = true;
  } else if (request.action === 'timing') {
    if (!Array.isArray(request.starts) || request.starts.length !== day.timeline.length || request.starts[0] !== settings.dayStart) throw invalid('invalid_timeline');
    next.timeline = day.timeline.map((row, index) => ({ ...row, start: request.starts[index], end: request.starts[index + 1] || settings.dayEnd, customized: true }));
    validateTimeline(next.timeline, settings);
    const eco = next.timeline.find(row => row.kind === 'eco');
    if (!eco || minutes(eco.end) - minutes(eco.start) < 15 || minutes(eco.end) - minutes(eco.start) > 60) throw invalid('one_eco_slot');
  } else if (request.action === 'reorder') {
    const ids = request.rowIds;
    if (!Array.isArray(ids) || ids.length !== day.timeline.length || new Set(ids).size !== ids.length || ids.some(id => !day.timeline.some(row => row.id === id))) throw invalid('invalid_timeline');
    let cursor = minutes(settings.dayStart);
    next.timeline = ids.map(id => {
      const row = structuredClone(day.timeline.find(item => item.id === id));
      const duration = minutes(row.end) - minutes(row.start);
      row.start = timeLabel(cursor); cursor += duration; row.end = timeLabel(cursor);
      return { ...row, customized: true };
    });
    validateTimeline(next.timeline, settings);
    if (next.timeline.at(-1)?.end !== settings.dayEnd) throw invalid('schedule_gaps');
  } else throw invalid('invalid_plan');
  if (request.action !== 'content') for (const original of day.timeline) {
    const moved = next.timeline.find(row => row.id === original.id);
    if (day.date === local.date && (minutes(original.start) <= local.minutes || minutes(moved.start) <= local.minutes) &&
        (original.start !== moved.start || original.end !== moved.end)) throw invalid('activity_finished', 409);
    // Do not change metadata on rows whose times have not changed.
    if (original.start === moved.start && original.end === moved.end) next.timeline[next.timeline.indexOf(moved)] = structuredClone(original);
  }
  return next;
}
