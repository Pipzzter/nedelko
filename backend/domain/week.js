import { skopjeParts } from '../config/index.js';
import { planningWeekDates, findOpenActivityWindow } from './planner.js';
import { validateSettings, validateTimeline, minutes, timeLabel, invalid } from './settings.js';
import { validateCurriculum, SNOW_LESSON, holidayLesson, lessonCoversOccasion } from './curriculum.js';
import { parentMessages } from './messages.js';
import { compactTimeline } from './timeline.js';
import { occasionsForWeek, calendarSnapshot } from './holidays.js';
import { activityRole, activityText, adaptActivities } from './day-activities.js';
import { adaptOccasionActivities } from './occasion-activities.js';

export const weatherKind = code => !Number.isFinite(code) ? 'unknown' : [71, 73, 75, 77, 85, 86].includes(code) ? 'snow' : code >= 95 ? 'storm' : code >= 51 ? 'rain' : code >= 45 ? 'fog' : code >= 2 ? 'cloud' : 'sun';
const finite = values => values.filter(Number.isFinite);
const maximum = values => finite(values).length ? Math.max(...finite(values)) : null;
const minimum = values => finite(values).length ? Math.min(...finite(values)) : null;

export function weatherSummary(conditions, date, settings = { dayStart: '08:00', dayEnd: '16:00' }) {
  const rows = (conditions.weatherAvailable ? conditions.weather : []).filter(r => r.local.date === date && r.local.minutes >= minutes(settings.dayStart) && r.local.minutes < minutes(settings.dayEnd));
  const air = (conditions.forecastAvailable ? conditions.forecast : []).filter(r => r.local.date === date && r.local.minutes >= minutes(settings.dayStart) && r.local.minutes < minutes(settings.dayEnd));
  const priority = ['storm', 'snow', 'rain', 'fog', 'cloud', 'sun'];
  return { min: minimum(rows.map(r => r.temperature)), max: maximum(rows.map(r => r.temperature)),
    rain: maximum(rows.map(r => r.precipitationProbability)), wind: maximum(rows.map(r => r.windSpeed)),
    kind: priority.find(k => rows.some(r => weatherKind(r.weatherCode) === k)) || 'unknown',
    pm25: maximum(air.map(r => r.pm25)), forecastAir: air.some(r => Number.isFinite(r.pm25)) };
}

function windowEvidence(day, conditions, settings) {
  const slot = day.timeline.find(t => t.kind === 'eco');
  if (!slot || day.closed || day.outdoorPreference === 'inside') return { eligible: false, reason: day.closed ? 'closed' : !slot ? 'no_slot' : 'teacher_inside' };
  const local = skopjeParts(new Date(conditions.clock));
  if (day.date === local.date) {
    if (!conditions.assessment.valid || conditions.failedRefresh) return { eligible: false, reason: 'unknown_air' };
    if (conditions.assessment.aqi > 100) return { eligible: false, reason: 'pollution' };
    if (minutes(slot.end) <= local.minutes) return { eligible: false, reason: 'finished' };
  }
  const weather = []; const air = [];
  for (let hour = Math.floor(minutes(slot.start) / 60) * 60; hour < minutes(slot.end); hour += 60) {
    weather.push(conditions.weather?.find(r => r.local.date === day.date && r.local.minutes === hour));
    air.push(conditions.forecast?.find(r => r.local.date === day.date && r.local.minutes === hour));
  }
  if (!conditions.weatherAvailable || weather.some(r => !r || !['temperature', 'apparentTemperature', 'precipitation', 'precipitationProbability', 'windSpeed', 'weatherCode'].every(k => Number.isFinite(r[k])))) return { eligible: false, reason: 'unknown_weather' };
  const p = settings.preferences;
  if (weather.some(r => r.apparentTemperature < p.minApparentC || r.apparentTemperature > p.maxApparentC || r.windSpeed > p.maxWindKmh || r.precipitation > p.maxPrecipitationMm || r.precipitationProbability > p.maxPrecipProbability || r.weatherCode >= 95 || [56, 57, 66, 67].includes(r.weatherCode))) return { eligible: false, reason: 'weather' };
  const completeAir = conditions.forecastAvailable && air.every(r => Number.isFinite(r?.pm25) && r.pm25 >= 0);
  if (conditions.forecastAvailable && air.some(r => Number.isFinite(r?.pm25) && r.pm25 > 35.4)) return { eligible: false, reason: 'air_forecast' };
  const avg = key => weather.reduce((sum, r) => sum + r[key], 0) / weather.length;
  return { eligible: true, reason: completeAir ? 'forecast' : 'weather_only', snow: weather.some(r => weatherKind(r.weatherCode) === 'snow'),
    score: Math.abs(avg('apparentTemperature') - 20) + avg('precipitationProbability') * .12 + avg('windSpeed') * .08 + (completeAir ? Math.max(...air.map(r => r.pm25)) * .15 : 4) };
}

function outdoorSlots(settings, conditions, date) {
  const slots = [];
  for (let start = minutes(settings.dayStart); start + settings.duration <= minutes(settings.dayEnd); start += 15) {
    const end = start + settings.duration;
    if (settings.blocks.some(block => start < minutes(block.end) && end > minutes(block.start))) continue;
    const slot = { start: timeLabel(start), end: timeLabel(end), kind: 'eco' };
    const evidence = windowEvidence({ date, timeline: [slot], outdoorPreference: 'auto', closed: false }, conditions, settings);
    if (evidence.eligible) slots.push({ ...slot, ...evidence,
      score: evidence.score + Math.abs(start + settings.duration / 2 - 630) * .015 });
  }
  return slots.sort((a, b) => a.score - b.score || a.start.localeCompare(b.start));
}

// Model input contains logistics-only forecast context. The server has already applied air and weather gates.
export function outdoorPlanningContext(dates, input, conditions) {
  const settings = validateSettings(input);
  return dates.map(date => {
    const summary = weatherSummary(conditions, date, settings); const best = outdoorSlots(settings, conditions, date)[0];
    return { date, serverEligible: !!best, bestWindow: best ? { start: best.start, end: best.end } : null,
      weather: { kind: summary.kind, minC: summary.min, maxC: summary.max, rainChancePct: summary.rain, windKmh: summary.wind } };
  });
}

function createTimeline(settings, theme, conditions, date, index) {
  const basic = { ...settings, blocks: settings.blocks.map(b => ({ ...b, label: b.label.mk })) };
  let slot = findOpenActivityWindow(basic, conditions, { date, useCurrentTime: false });
  if (!slot) throw invalid('no_activity_space');
  const candidates = outdoorSlots(settings, conditions, date);
  if (candidates.length) slot = candidates[0];
  const rows = settings.blocks.map(b => structuredClone(b));
  rows.push({ id: 'eco', start: slot.start, end: slot.end, kind: 'eco', label: theme.title });
  rows.sort((a, b) => a.start.localeCompare(b.start));
  const all = []; let cursor = minutes(settings.dayStart); let serial = 0;
  const summary = weatherSummary(conditions, date, settings);
  const gap = end => {
    while (cursor < end) {
      const remaining = end - cursor;
      const count = Math.ceil(remaining / 60);
      const length = count === 1 ? remaining : Math.min(60, Math.ceil(remaining / count / 15) * 15, remaining - 30 * (count - 1));
      const role = activityRole(timeLabel(cursor));
      all.push({ id: `play-${serial++}`, start: timeLabel(cursor), end: timeLabel(cursor + length), kind: 'activity', activityRole: role,
        ...activityText(role, index, summary, theme) }); cursor += length;
    }
  };
  for (const row of rows) { gap(minutes(row.start)); all.push(row); cursor = minutes(row.end); }
  gap(minutes(settings.dayEnd));
  validateTimeline(all, settings);
  return compactTimeline(all);
}

export function createWeek(input, curriculum, conditions, calendars) {
  const settings = validateSettings(input); const themes = validateCurriculum(curriculum.themes, settings);
  const dates = planningWeekDates(conditions.clock); const today = skopjeParts(new Date(conditions.clock)).date;
  calendars ||= [...new Set(dates.map(date => Number(date.slice(0, 4))))].map(calendarSnapshot);
  const occasions = occasionsForWeek(dates, calendars);
  const variant = Number.isInteger(curriculum.variant) ? curriculum.variant : 0;
  const outdoorOrder = Array.isArray(curriculum.outdoorOrder) && curriculum.outdoorOrder.length === dates.length &&
    new Set(curriculum.outdoorOrder).size === dates.length && curriculum.outdoorOrder.every(date => dates.includes(date)) ? [...curriculum.outdoorOrder] : null;
  const week = { weekStart: dates[0], settings, source: curriculum.source, variant, generationIssue: curriculum.generationIssue || null,
    generationError: curriculum.generationError ?? null, outdoorOrder,
    outdoorDecisionSource: curriculum.source === 'ai' && outdoorOrder ? 'ai' : 'conditions', createdAt: conditions.clock, revision: 0,
    days: dates.map((date, i) => ({ date, theme: date < today ? null : themes[i], baseTheme: date < today ? null : themes[i], timeline: date < today ? [] : createTimeline(settings, themes[i], conditions, date, (i + variant) % 5),
      themePinned: !!curriculum.topicAssignments?.some(topic => topic.date === date),
      occasions: occasions[i], closed: false, outdoorPreference: 'auto', mode: date < today ? 'empty' : 'inside', reason: date < today ? 'past' : 'pending' })),
    holidayCalendars: calendars,
    checkedAt: null, checkedDate: null, approval: null, changes: [], mode: conditions.mode };
  return adaptWeek(week, conditions);
}

export function adaptWeek(input, conditions) {
  const week = structuredClone(input); const today = skopjeParts(new Date(conditions.clock)).date;
  week.holidayCalendars ||= [...new Set(week.days.map(d => Number(d.date.slice(0, 4))))].map(calendarSnapshot);
  const occasions = occasionsForWeek(week.days.map(d => d.date), week.holidayCalendars);
  week.days.forEach((day, i) => {
    day.occasions = occasions[i];
    const suggestion = occasions[i].find(event => holidayLesson(event, week.settings));
    day.holidaySuggestion = suggestion ? { ...holidayLesson(suggestion, week.settings), occasionId: suggestion.id } : null;
  });
  const local = skopjeParts(new Date(conditions.clock));
  for (const day of week.days.filter(day => day.date >= today)) day.timeline = compactTimeline(day.timeline, {
    consolidate: true, from: day.date === today ? timeLabel(local.minutes) : '00:00',
  });
  const previous = new Set(week.days.filter(d => d.mode === 'outside').map(d => d.date));
  const finishedToday = week.days.find(d => d.date === today && d.mode === 'outside' && d.timeline.some(r => r.kind === 'eco' && minutes(r.end) <= local.minutes));
  // Retain elapsed planned slots; no automatic refresh rewrites the past or claims actual attendance.
  const spent = week.days.filter(d => d.date < today && d.mode === 'outside').length + (finishedToday ? 1 : 0);
  const candidates = week.days.filter(d => d.date >= today && d.theme && d !== finishedToday).map(d => ({ date: d.date, preference: d.outdoorPreference, ...windowEvidence(d, conditions, week.settings) }));
  const modelOrder = week.outdoorDecisionSource === 'ai' && Array.isArray(week.outdoorOrder) ? new Map(week.outdoorOrder.map((date, index) => [date, index])) : null;
  // Explicit day choices take priority over the weekly target, but never over evidence.
  const requested = candidates.filter(day => day.eligible && day.preference === 'outside');
  const automatic = candidates.filter(day => day.eligible && day.preference !== 'outside').sort((a, b) => modelOrder ?
    (modelOrder.get(a.date) ?? 99) - (modelOrder.get(b.date) ?? 99) || a.score - b.score || a.date.localeCompare(b.date) :
    a.score - b.score || a.date.localeCompare(b.date)).slice(0, Math.max(0, week.settings.outdoorDays - spent - requested.length));
  const chosen = new Set([...requested, ...automatic].map(day => day.date));
  for (const day of week.days) {
    day.summary = weatherSummary(conditions, day.date, week.settings);
    if (day.date < today || !day.theme || day === finishedToday) continue;
    const lessonElapsed = day.date === today && day.timeline.some(row => row.kind === 'eco' && minutes(row.end) <= local.minutes);
    if (day.baseTheme && !day.themePinned && !lessonElapsed) {
      const datedLesson = day.occasions.some(event => lessonCoversOccasion(day.baseTheme, event) || event.kind !== 'community' && holidayLesson(event, week.settings));
      day.theme = !datedLesson && day.summary.kind === 'snow' ? { ...structuredClone(SNOW_LESSON), dayActivities: day.baseTheme.dayActivities, materials: week.settings.materials.slice(0, 3) } : structuredClone(day.baseTheme);
      day.timeline = day.timeline.map(row => row.kind === 'eco' ? { ...row, label: day.theme.title } : row);
    }
    const evidence = candidates.find(c => c.date === day.date);
    day.mode = day.closed ? 'closed' : chosen.has(day.date) ? 'outside' : 'inside';
    day.reason = evidence.eligible && !chosen.has(day.date) ? modelOrder ? 'ai_plan' : 'indoor_balance' : evidence.reason;
    day.snow = !!evidence.snow;
    day.provisional = day.date !== today;
    day.activity = day.timeline.some(row => row.kind === 'eco') ? day.mode === 'outside' ? day.theme.outside : day.theme.inside : null;
    adaptActivities(day, (week.days.indexOf(day) + (week.variant || 0)) % 5, today, local.minutes);
    adaptOccasionActivities(day, week.settings, today, local.minutes);
  }
  const removed = [...previous].filter(date => date >= today && date !== finishedToday?.date && !chosen.has(date));
  const added = [...chosen].filter(date => !previous.has(date));
  const changes = removed.map((from, i) => ({ from, to: added[i] ?? null, reason: week.days.find(d => d.date === from)?.reason }));
  if (changes.length) week.changes = changes;
  week.today = today; week.clock = conditions.clock; week.mode = conditions.mode;
  week.conditionsCheckedAt = conditions.clock;
  week.checkedAt = null; week.checkedDate = null; week.approval = null;
  week.messages = parentMessages(week);
  return week;
}

export function replaceDayTheme(previous, date, theme, source, conditions) {
  const local = skopjeParts(new Date(conditions.clock));
  const original = previous.days.find(day => day.date === date);
  const slot = original?.timeline.find(row => row.kind === 'eco');
  if (!original?.theme || original.closed || !slot || date < local.date ||
      date === local.date && minutes(slot.start) <= local.minutes) throw invalid('activity_finished', 409);
  const [validated] = validateCurriculum([theme], previous.settings, { count: 1 });
  const next = structuredClone(previous);
  const day = next.days.find(item => item.date === date);
  day.theme = validated;
  day.baseTheme = validated;
  day.themePinned = true;
  day.source = source;
  day.timeline = day.timeline.map(row => row.kind === 'eco' ? { ...row, label: validated.title } : row);
  return adaptWeek(next, conditions);
}

export function editWeek(previous, input, conditions) {
  if (!Array.isArray(input.days) || input.days.length !== 5) throw invalid('invalid_plan');
  const settings = validateSettings(input.settings);
  if (['dayStart', 'dayEnd', 'duration', 'blocks'].some(key => JSON.stringify(settings[key]) !== JSON.stringify(previous.settings[key]))) throw invalid('fixed_times');
  const local = skopjeParts(new Date(conditions.clock));
  const today = local.date;
  const days = previous.days.map((day, index) => {
    if (input.days[index]?.date !== day.date) throw invalid('invalid_plan');
    if (day.date < today || !day.theme) return day;
    const edit = input.days[index];
    if (typeof edit.closed !== 'boolean' || !['auto', 'inside', 'outside'].includes(edit.outdoorPreference)) throw invalid('invalid_plan');
    if (edit.outdoorPreference !== day.outdoorPreference && day.date === today && day.timeline.some(row => row.kind === 'eco' && minutes(row.end) <= local.minutes)) throw invalid('activity_finished');
    const theme = validateCurriculum(Array(5).fill(edit.theme), settings)[0];
    const themeChanged = JSON.stringify(theme) !== JSON.stringify(validateCurriculum(Array(5).fill(day.theme), settings)[0]);
    const timeline = validateTimeline(edit.timeline, settings).map(row => {
      const original = day.timeline.find(r => r.id === row.id);
      if (!original) {
        if (row.kind !== 'activity') throw invalid('invalid_timeline');
        return { ...row, customized: true };
      }
      if (row.start !== original.start || row.end !== original.end || row.kind !== original.kind) throw invalid('fixed_times');
      const changed = JSON.stringify(row.label) !== JSON.stringify(original.label);
      return { ...row, ...(original.activityRole ? { activityRole: original.activityRole } : {}),
        ...(original.note && !changed ? { note: original.note } : {}), customized: !!original.customized || changed };
    });
    return { ...day, closed: edit.closed, outdoorPreference: edit.outdoorPreference, theme, themePinned: day.themePinned || themeChanged, timeline };
  });
  return adaptWeek({ ...previous, settings, days }, conditions);
}

export function dashboard(week, conditions) {
  const dates = planningWeekDates(conditions.clock);
  const assessment = conditions.assessment;
  return { week, clock: conditions.clock, today: skopjeParts(new Date(conditions.clock)).date, mode: conditions.mode,
    calendar: dates.map(date => ({ date, summary: weatherSummary(conditions, date, week?.settings) })),
    environment: { location: conditions.location, assessment, clock: conditions.clock, fetchedAt: conditions.fetchedAt,
      forecastFetchedAt: conditions.forecastFetchedAt, weatherFetchedAt: conditions.weatherFetchedAt,
      historical: conditions.historical, failedRefresh: conditions.failedRefresh, mode: conditions.mode,
      cached: conditions.cached ?? false, forecastAvailable: conditions.forecastAvailable, weatherAvailable: conditions.weatherAvailable },
  };
}
