import { invalid, minutes, validTime } from './settings.js';
import { skopjeParts } from '../config/index.js';

const NUMBER_WORDS = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, half: .5, еден: 1, една: 1, два: 2, две: 2, три: 3, четири: 4, пет: 5, шест: 6, половина: .5 };
export function explicitDurations(instruction) {
  const normalized = instruction.toLowerCase().replace(/\b(?:one|two|three|four|five|six|half)\b|еден|една|два|две|три|четири|пет|шест|половина/gu, word => String(NUMBER_WORDS[word]));
  const pattern = /(\d+(?:[.,]\d+)?)\s*(hours?|hrs?|h\b|час(?:а|ови)?)(?:\s*(?:and|и)?\s*(\d+)\s*(?:minutes?|mins?|минути|минута|мин\b))?|(\d+)\s*(?:minutes?|mins?|минути|минута|мин\b)/gu;
  return [...normalized.matchAll(pattern)].map(match => match[1] ? Math.round(Number(match[1].replace(',', '.')) * 60) + Number(match[3] || 0) : Number(match[4]));
}
export function timingLocks(day, clock) {
  const local = skopjeParts(new Date(clock));
  return day.timeline.filter(row => ['meal', 'rest', 'routine'].includes(row.kind) || row.occasionIds?.length || day.date === local.date && minutes(row.start) <= local.minutes);
}
export function timingWindows(day, settings, clock) {
  let cursor = minutes(settings.dayStart); const result = [];
  for (const row of timingLocks(day, clock)) {
    if (minutes(row.start) > cursor) result.push({ start: cursor, end: minutes(row.start) });
    cursor = Math.max(cursor, minutes(row.end));
  }
  if (cursor < minutes(settings.dayEnd)) result.push({ start: cursor, end: minutes(settings.dayEnd) });
  return result;
}
function conflict(requested, available) {
  return Object.assign(invalid('timing_conflict'), { timing: { requestedMinutes: requested, availableMinutes: Math.max(0, available) } });
}
export function validateTimingIntent(value, day, settings, instruction, clock) {
  if (!Array.isArray(value) || value.length > 8) throw invalid('timing_not_satisfied');
  const seen = new Set(); const windows = timingWindows(day, settings, clock);
  const locks = timingLocks(day, clock);
  const targets = value.map(item => {
    const row = day.timeline.find(row => row.id === item?.rowId);
    if (!row || seen.has(row.id) || !['any', 'start', 'end'].includes(item.position)) throw invalid('timing_not_satisfied');
    if (locks.some(locked => locked.id === row.id)) throw invalid('protected_activity');
    seen.add(row.id);
    const durationMinutes = item.durationMinutes;
    if (durationMinutes !== null && (!Number.isInteger(durationMinutes) || durationMinutes < 1 || durationMinutes > 780)) throw invalid('invalid_duration');
    const start = item.start === null ? null : validTime(item.start);
    const end = item.end === null ? null : validTime(item.end);
    const duration = durationMinutes ?? (start && end ? minutes(end) - minutes(start) : minutes(row.end) - minutes(row.start));
    const wantedStart = start ? minutes(start) : item.position === 'start' ? minutes(settings.dayStart) : end ? minutes(end) - duration : item.position === 'end' ? minutes(settings.dayEnd) - duration : null;
    const wantedEnd = end ? minutes(end) : item.position === 'end' ? minutes(settings.dayEnd) : wantedStart !== null ? wantedStart + duration : null;
    if (duration <= 0 || wantedStart !== null && wantedEnd !== null && wantedEnd - wantedStart !== duration) throw invalid('timing_not_satisfied');
    const available = item.position === 'end' ? windows.find(window => window.end === minutes(settings.dayEnd)) : item.position === 'start' ? windows.find(window => window.start === minutes(settings.dayStart)) : null;
    const maximum = item.position !== 'any' ? available ? available.end - available.start : 0 : Math.max(0, ...windows.map(window => window.end - window.start));
    if (duration > maximum || wantedStart !== null && !windows.some(window => wantedStart >= window.start && wantedStart + duration <= window.end)) throw conflict(duration, maximum);
    if (row.kind === 'eco' && (duration < 15 || duration > 60)) throw conflict(duration, Math.min(60, maximum));
    return { rowId: row.id, durationMinutes, position: item.position, start, end };
  });
  const durations = explicitDurations(instruction);
  if (durations.some(duration => !targets.some(target => target.durationMinutes === duration))) throw invalid('timing_not_satisfied');
  if (/(?:at|to) (?:the )?end|на крај/iu.test(instruction) && !targets.some(target => target.position === 'end')) throw invalid('timing_not_satisfied');
  return targets;
}
export function enforceTiming(targets = [], timeline, settings) {
  for (const target of targets) {
    const row = timeline.find(row => row.id === target.rowId);
    if (!row || target.durationMinutes !== null && minutes(row.end) - minutes(row.start) !== target.durationMinutes ||
        target.start !== null && row.start !== target.start || target.end !== null && row.end !== target.end ||
        target.position === 'end' && row.end !== settings.dayEnd || target.position === 'start' && row.start !== settings.dayStart) throw invalid('timing_not_satisfied');
  }
}
