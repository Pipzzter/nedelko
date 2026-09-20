import { locationById } from '../config/index.js';

// Explicit projection: never serialize the stored account plan to an anonymous reader.
export function parentView(week, expiresAt) {
  const location = locationById(week.settings.locationId);
  return {
    kindergarten: week.settings.gradinka?.name || '', groupName: week.settings.groupName,
    location: { mk: location.name, en: location.nameEn }, weekStart: week.weekStart,
    today: week.today, mode: week.mode, expiresAt,
    updatedAt: week.conditionsCheckedAt || week.clock, weeklyMessage: week.messages.weekly,
    days: week.days.map(day => ({
      date: day.date, mode: day.mode, reason: day.reason, closed: day.closed,
      title: day.theme?.title || null, goal: day.theme?.goal || null,
      activity: day.activity || null, habit: day.theme?.habit || null,
      summary: { kind: day.summary.kind, min: day.summary.min, max: day.summary.max },
      message: week.messages.daily[day.date] || null,
      timeline: day.timeline.map(row => ({ id: row.id, start: row.start, end: row.end,
        kind: row.kind, label: row.label, note: row.note || null })),
    })),
  };
}
