import { minutes, teacherInstruction } from './settings.js';
import { resolveTimelineOverlaps } from './timeline.js';

const weekdays = [
  ['Monday', 'понеделник', 'ponedelnik'], ['Tuesday', 'вторник', 'vtornik'],
  ['Wednesday', 'среда', 'sreda'], ['Thursday', 'четврток', 'cetvrtok', 'chetvrtok'],
  ['Friday', 'петок', 'petok']
];
const weekdayPattern = weekdays.flat().join('|');
const amounts = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8,
  nine: 9, ten: 10, еден: 1, една: 1, два: 2, две: 2, три: 3, четири: 4,
  пет: 5, шест: 6, eden: 1, edna: 1, dva: 2, dve: 2, tri: 3, cetiri: 4, chetiri: 4, pet: 5, sest: 6, shest: 6 };
const durationPattern = new RegExp(String.raw`(?<![\p{L}\d])(?<amount>\d+(?:[.,]\d+)?|${Object.keys(amounts).join('|')})[\s-]*(?<unit>hours?|hrs?|minutes?|mins?|часа?|часови|минути?|chasovi|chasa?|casovi|casa?|minuti?)(?!\p{L})`, 'giu');
const weekdayMention = new RegExp(String.raw`(?<!\p{L})(?:${weekdayPattern})(?!\p{L})`, 'giu');
const correction = /(?<!\p{L})(?:actually|instead|наместо|всушност|namesto|vsushnost)(?!\p{L})/iu;
const negation = /(?<!\p{L})(?:not|don't|instead|except|не|наместо|освен|nemoj|namesto|osven)(?!\p{L})/iu;
const approximation = /(?<!\p{L})(?:after|before|around|approximately|at least|at most|longer|shorter|extra|околу|пред|потоа|okolu|pred|potoa)(?!\p{L})/iu;
const clockPattern = /(?<!\d)(?:[01]?\d|2[0-3]):[0-5]\d(?!\d)/gu;

function weekdayIndex(date) { return (new Date(`${date}T12:00:00Z`).getUTCDay() + 6) % 7; }
export function planningDates(dates, today) {
  return dates.map(date => ({ date, weekday: { en: weekdays[weekdayIndex(date)][0], mk: weekdays[weekdayIndex(date)][1] }, elapsed: date < today }));
}

// These checks intentionally cover only unambiguous, single-day timing clauses.
// The complete brief, including all other prose, always goes to the model verbatim.
// This is not a general natural-language parser or a semantic quality assessment.
export function requestedTimings(value, dates, today = dates[0], defaultDate = null) {
  const brief = teacherInstruction(value);
  // Corrections and relative/approximate times need semantic interpretation.
  if (correction.test(brief)) return [];
  const requirements = brief.split(/[;\n!?]+|\.(?=\s|$)/u)
    .map(clause => clauseRequirement(clause, dates, today, defaultDate)).filter(Boolean);
  // Repeated instructions for one day may revise each other. Do not guess.
  return requirements.filter(item => requirements.filter(other => other.date === item.date).length === 1);
}

function clauseRequirement(clause, dates, today, defaultDate) {
  if (negation.test(clause) || approximation.test(clause)) return null;
  const date = clauseDate(clause, dates, today, defaultDate);
  if (!date) return null;
  const durations = [...clause.matchAll(durationPattern)];
  const times = [...clause.matchAll(clockPattern)].map(match => match[0].padStart(5, '0'));
  if (durations.length > 1 || times.length > 2 || !durations.length && !times.length) return null;
  const durationMinutes = statedMinutes(durations[0]);
  const range = clockRange(clause, times);
  if (durationMinutes === undefined || !range) return null;
  return { date, quote: clause.trim(), durationMinutes, ...range };
}

// The single named weekday, or the default date when a clause names none.
function clauseDate(clause, dates, today, defaultDate) {
  const days = [...clause.matchAll(weekdayMention)];
  if (days.length > 1) return null;
  const index = days.length ? weekdays.findIndex(names => names.some(name => name.toLowerCase() === days[0][0].toLowerCase())) : -1;
  const date = index < 0 ? defaultDate : dates.find(item => weekdayIndex(item) === index);
  return date && date >= today && dates.includes(date) ? date : null;
}

// Null when no duration is stated; undefined rejects an unusable one.
function statedMinutes(match) {
  if (!match) return null;
  const { amount, unit } = match.groups;
  const number = amounts[amount.toLowerCase()] ?? Number(amount.replace(',', '.'));
  const result = number * (/^[hчc]/iu.test(unit) ? 60 : 1);
  return Number.isInteger(result) && result > 0 && result <= 1439 ? result : undefined;
}

function clockRange(clause, times) {
  // Two unrelated clock mentions are not necessarily a requested interval.
  if (times.length === 2)
    return /(?:\d{1,2}:\d{2})\s*(?:[-–—]|to|until|до|do)\s*(?:\d{1,2}:\d{2})/iu.test(clause) ? { start: times[0], end: times[1] } : null;
  if (!times.length) return { start: null, end: null };
  // "Until 10:00" supplies an end, not a start.
  return /(?:until|ends?\s+at|до|do)\s+\d{1,2}:\d{2}/iu.test(clause) ? { start: null, end: times[0] } : { start: times[0], end: null };
}

export function validateRequestedTimings(timelines, dates, requirements, planningDays = []) {
  for (const requirement of requirements) {
    // Validate what will actually be saved, including collision resolution.
    const lockedIds = new Set(planningDays.find(day => day.date === requirement.date)?.lockedRows.map(row => row.id) || []);
    const rows = resolveTimelineOverlaps(timelines[dates.indexOf(requirement.date)] || [], lockedIds);
    if (!rows.some(row => (!requirement.start || row.start === requirement.start) &&
      (!requirement.end || row.end === requirement.end) &&
      (requirement.durationMinutes === null || minutes(row.end) - minutes(row.start) === requirement.durationMinutes))) {
      throw Object.assign(new Error('teacher_timing_mismatch'), { code: 'ai_invalid_output' });
    }
  }
}
