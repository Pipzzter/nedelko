import { minutes, timeLabel } from './constraints.js';
import { skopjeParts } from '../config/index.js';

const DAY_MS = 86400000;
const toIsoDate = (date) => date.toISOString().slice(0, 10);
const addDate = (date, days) => toIsoDate(new Date(Date.parse(`${date}T12:00:00Z`) + days * DAY_MS));
const weekday = (date) => new Date(`${date}T12:00:00Z`).getUTCDay();

export function planningWeekDates(clock) {
  const today = skopjeParts(new Date(clock)).date;
  const day = weekday(today);
  let mondayOffset;
  if (day === 0) {
    mondayOffset = 1;
  } else if (day === 6) {
    mondayOffset = 2;
  } else {
    mondayOffset = 1 - day;
  }
  const monday = addDate(today, mondayOffset);
  return Array.from({ length: 5 }, (_, index) => addDate(monday, index));
}
export function findOpenActivityWindow(schedule, conditions, { date, useCurrentTime = true } = {}) {
  const local = skopjeParts(new Date(conditions.clock));
  const targetDate = date ?? local.date;
  const dayStart = minutes(schedule.dayStart);
  const earliest =
    targetDate === local.date && useCurrentTime ? Math.max(dayStart, Math.ceil(local.minutes / 15) * 15) : dayStart;
  const dayEnd = minutes(schedule.dayEnd);
  const candidates = [];
  for (let start = earliest; start + schedule.duration <= dayEnd; start += 15) {
    const finish = start + schedule.duration;
    if (schedule.blocks.some((block) => start < minutes(block.end) && finish > minutes(block.start))) continue;
    candidates.push({
      start: timeLabel(start),
      end: timeLabel(finish),
      duration: schedule.duration,
      distanceFromPreferred: Math.abs(start + schedule.duration / 2 - 630)
    });
  }
  candidates.sort((a, b) => a.distanceFromPreferred - b.distanceFromPreferred || minutes(a.start) - minutes(b.start));
  if (!candidates.length) return null;
  const { distanceFromPreferred, ...window } = candidates[0];
  return window;
}
