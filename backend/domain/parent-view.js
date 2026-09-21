import { locationById } from '../config/index.js';
import { materialCatalog } from './settings.js';
import { dashboard } from './week.js';

const occasion = event => event ? Object.fromEntries(['id', 'name', 'date', 'lessonDate', 'kind', 'scope'].map(key => [key, event[key]])) : null;
const lesson = theme => theme ? Object.fromEntries(['title', 'goal', 'inside', 'outside', 'habit', 'materials'].map(key => [key, theme[key]])) : null;

// Explicit projection: never serialize the stored account plan to an anonymous reader.
export function parentView(week, expiresAt, conditions) {
  const location = locationById(week.settings.locationId);
  return {
    kindergarten: week.settings.gradinka?.name || '', groupName: week.settings.groupName,
    location: { mk: location.name, en: location.nameEn }, weekStart: week.weekStart,
    today: week.today, clock: conditions?.clock || week.clock, mode: week.mode, expiresAt,
    environment: conditions ? dashboard(null, conditions).environment : null,
    materials: materialCatalog(week.settings), outdoorDays: week.settings.outdoorDays,
    updatedAt: week.conditionsCheckedAt || week.clock, weeklyMessage: week.messages.weekly,
    changes: (week.changes || []).map(({ from, to, reason }) => ({ from, to, reason })),
    days: week.days.map(day => ({
      date: day.date, authoredTimeline: !!day.authoredTimeline, mode: day.mode, reason: day.reason, closed: day.closed,
      title: day.theme?.title || null, goal: day.theme?.goal || null, theme: lesson(day.theme),
      outdoorPreference: day.outdoorPreference, snow: day.snow,
      occasions: (day.occasions || []).map(occasion), preparationFor: occasion(day.preparationFor),
      activity: day.activity || null, habit: day.theme?.habit || null,
      summary: { kind: day.summary?.kind ?? 'unknown', min: day.summary?.min ?? null, max: day.summary?.max ?? null },
      message: week.messages.daily[day.date] || null,
      timeline: day.timeline.map(row => ({ id: row.id, start: row.start, end: row.end,
        kind: row.kind, label: row.label, note: row.note || null, lesson: lesson(row.lesson), variants: row.variants || null,
        occasionIds: row.occasionIds || [], occasionDiscussion: row.occasionDiscussion || null })),
    })),
  };
}
