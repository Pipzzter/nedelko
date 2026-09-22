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
const durationPattern = new RegExp(`(?<![\\p{L}\\d])(?<amount>\\d+(?:[.,]\\d+)?|${Object.keys(amounts).join('|')})[\\s-]*(?<unit>hours?|hrs?|minutes?|mins?|часа?|часови|минути?|chasovi|chasa?|casovi|casa?|minuti?)(?!\\p{L})`, 'giu');
const clockPattern = /(?<!\d)(?:[01]?\d|2[0-3]):[0-5]\d(?!\d)/gu;

function weekdayIndex(date) { return (new Date(`${date}T12:00:00Z`).getUTCDay() + 6) % 7; }
export function planningDates(dates, today) {
  return dates.map(date => ({ date, weekday: { en: weekdays[weekdayIndex(date)][0], mk: weekdays[weekdayIndex(date)][1] }, elapsed: date < today }));
}

// These checks intentionally cover only unambiguous, single-day timing clauses.
// The complete brief, including all other prose, always goes to the model verbatim.
// This is not a general natural-language parser or a semantic quality assessment.
export function requestedTimings(value, dates, today = dates[0], defaultDate = null) {
  const requirements = [];
  const brief = teacherInstruction(value);
  // Corrections and relative/approximate times need semantic interpretation.
  if (/(?<!\p{L})(?:actually|instead|наместо|всушност|namesto|vsushnost)(?!\p{L})/iu.test(brief)) return [];
  const clauses = brief.split(/[;\n!?]+|\.(?=\s|$)/u);
  for (const clause of clauses) {
    if (/(?<!\p{L})(?:not|don't|instead|except|не|наместо|освен|nemoj|namesto|osven)(?!\p{L})/iu.test(clause)) continue;
    if (/(?<!\p{L})(?:after|before|around|approximately|at least|at most|longer|shorter|extra|околу|пред|потоа|okolu|pred|potoa)(?!\p{L})/iu.test(clause)) continue;
    const days = [...clause.matchAll(new RegExp(`(?<!\\p{L})(?:${weekdayPattern})(?!\\p{L})`, 'giu'))];
    if (days.length > 1) continue;
    const index = days.length ? weekdays.findIndex(names => names.some(name => name.toLowerCase() === days[0][0].toLowerCase())) : -1;
    const date = index < 0 ? defaultDate : dates.find(item => weekdayIndex(item) === index);
    if (!date || date < today || !dates.includes(date)) continue;
    const durations = [...clause.matchAll(durationPattern)];
    const times = [...clause.matchAll(clockPattern)].map(match => match[0].padStart(5, '0'));
    if (durations.length > 1 || times.length > 2 || !durations.length && !times.length) continue;
    let durationMinutes = null;
    if (durations.length) {
      const { amount, unit } = durations[0].groups;
      const number = amounts[amount.toLowerCase()] ?? Number(amount.replace(',', '.'));
      durationMinutes = number * (/^(?:h|ч|c)/iu.test(unit) ? 60 : 1);
      if (!Number.isInteger(durationMinutes) || durationMinutes <= 0 || durationMinutes > 1439) continue;
    }
    // Two unrelated clock mentions are not necessarily a requested interval.
    if (times.length === 2 && !/(?:\d{1,2}:\d{2})\s*(?:[-–—]|to|until|до|do)\s*(?:\d{1,2}:\d{2})/iu.test(clause)) continue;
    // "Until 10:00" supplies an end, not a start.
    const endOnly = times.length === 1 && /(?:until|ends?\s+at|до|do)\s+\d{1,2}:\d{2}/iu.test(clause);
    requirements.push({ date, quote: clause.trim(), durationMinutes, start: endOnly ? null : times[0] || null,
      end: times.length === 2 ? times[1] : endOnly ? times[0] : null });
  }
  // Repeated instructions for one day may revise each other. Do not guess.
  return requirements.filter(item => requirements.filter(other => other.date === item.date).length === 1);
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
