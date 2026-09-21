import { minutes, timeLabel, validateSchedule, validateWeeklySchedule } from './constraints.js';
import { skopjeParts, SOURCES } from '../config/index.js';

const DAY_MS = 86400000;
const toIsoDate = (date) => date.toISOString().slice(0, 10);
const addDate = (date, days) => toIsoDate(new Date(Date.parse(`${date}T12:00:00Z`) + days * DAY_MS));
const dateDistance = (from, to) =>
  Math.round((Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / DAY_MS);
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
function rowsForHours(rows, date, start, finish) {
  const hours = [];
  for (let hour = Math.floor(start / 60) * 60; hour < finish; hour += 60) hours.push(hour);
  return hours.map((hour) => rows.find((row) => row.local.date === date && row.local.minutes === hour));
}
function summarizeWindow(airRows, weatherRows) {
  const maximum = (key) => Math.max(...weatherRows.map((row) => row[key]));
  const average = (key) => weatherRows.reduce((sum, row) => sum + row[key], 0) / weatherRows.length;
  return {
    pm25: Math.max(...airRows.map((row) => row.pm25)),
    temperature: Math.round(average('temperature') * 10) / 10,
    apparentTemperature: Math.round(average('apparentTemperature') * 10) / 10,
    precipitationProbability: maximum('precipitationProbability'),
    precipitation: maximum('precipitation'),
    windSpeed: maximum('windSpeed'),
    weatherCode: weatherRows[0].weatherCode
  };
}
export function findWindows(schedule, conditions, { date, useCurrentTime = true } = {}) {
  const local = skopjeParts(new Date(conditions.clock));
  const targetDate = date ?? local.date;
  const dayStart = minutes(schedule.dayStart);
  const earliest =
    targetDate === local.date && useCurrentTime ? Math.max(dayStart, Math.ceil(local.minutes / 15) * 15) : dayStart;
  const end = minutes(schedule.dayEnd);
  const preferences = schedule.preferences;
  const windows = [];
  for (let start = earliest; start + schedule.duration <= end; start += 15) {
    const finish = start + schedule.duration;
    if (schedule.blocks.some((block) => start < minutes(block.end) && finish > minutes(block.start))) continue;
    const airRows = rowsForHours(conditions.forecast, targetDate, start, finish);
    const weatherRows = rowsForHours(conditions.weather ?? [], targetDate, start, finish);
    if (
      airRows.some((row) => !Number.isFinite(row?.pm25) || row.pm25 < 0) ||
      weatherRows.some(
        (row) =>
          !row ||
          !['temperature', 'apparentTemperature', 'precipitationProbability', 'precipitation', 'windSpeed'].every(
            (key) => Number.isFinite(row[key])
          )
      )
    )
      continue;
    const summary = summarizeWindow(airRows, weatherRows);
    // Explicit prototype screens on hourly model forecasts; these are not future NowCast values or medical limits.
    if (
      summary.pm25 > 35.4 ||
      weatherRows.some(
        (row) =>
          row.apparentTemperature < preferences.minApparentC ||
          row.apparentTemperature > preferences.maxApparentC ||
          row.precipitationProbability > preferences.maxPrecipProbability ||
          row.precipitation > preferences.maxPrecipitationMm ||
          row.windSpeed > preferences.maxWindKmh
      )
    )
      continue;
    const score =
      summary.pm25 * 1.5 +
      summary.precipitationProbability * 0.2 +
      Math.abs(summary.apparentTemperature - 18) * 0.8 +
      summary.windSpeed * 0.1;
    windows.push({
      start: timeLabel(start),
      end: timeLabel(finish),
      duration: schedule.duration,
      ...summary,
      score: Math.round(score * 10) / 10
    });
  }
  return windows.sort((a, b) => a.score - b.score || minutes(a.start) - minutes(b.start));
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
function dayTimeline(schedule, activityWindow, activity) {
  const items = schedule.blocks.map((block) => ({
    kind: 'fixed',
    label: block.label,
    start: block.start,
    end: block.end
  }));
  if (activityWindow)
    items.push({ kind: 'activity', label: activity, start: activityWindow.start, end: activityWindow.end });
  return items.sort((a, b) => minutes(a.start) - minutes(b.start) || minutes(a.end) - minutes(b.end));
}
function unavailablePlan(schedule, conditions, targetDate) {
  return {
    verdict: 'unknown',
    title: 'Потребна е свежа проверка.',
    explanation: 'Податоците се недоволни, застарени или бараат проверка. Во моментов нема препорака за излегување.',
    window: null,
    alternatives: [],
    schedule,
    conditions,
    decisionDate: targetDate
  };
}
export function planDay(input, conditions, { date, theme = null } = {}) {
  const schedule = validateSchedule(input);
  const local = skopjeParts(new Date(conditions.clock));
  const targetDate = date ?? local.date;
  const assessment = conditions.assessment;
  let result = unavailablePlan(schedule, conditions, targetDate);
  if (targetDate !== local.date && conditions.mode === 'live') {
    result.explanation = 'Конечен дневен план се прави тоа утро со свежи локални набљудувања.';
  } else if (assessment.valid) {
    if (assessment.aqi > 100) {
      result = {
        ...result,
        verdict: 'wait',
        title: 'Одложете ја играта надвор.',
        explanation:
          'Локалната PM2.5 процена е покачена. Прототипот користи конзервативна политика за предучилишна група: одложете и проверете повторно.'
      };
    } else if (!conditions.forecastAvailable || !conditions.weatherAvailable) {
      result.explanation =
        'Има локални мерења, но недостасува свежа прогноза за воздухот или времето. Нема доволно информации за избор на подоцнежен термин.';
    } else {
      const windows = findWindows(schedule, conditions, { date: targetDate });
      if (windows.length) {
        const window = windows[0];
        result = {
          ...result,
          verdict: 'outside',
          title: 'Има време за игра надвор.',
          window,
          alternatives: windows
            .filter(
              (item) => item.start !== window.start && Math.abs(minutes(item.start) - minutes(window.start)) >= 30
            )
            .slice(0, 2),
          explanation:
            'Терминот се вклопува меѓу фиксните обврски и е најдобрата достапна комбинација од PM2.5, температура, дожд и ветер. Проверете повторно непосредно пред излегување.'
        };
      } else {
        result = {
          ...result,
          verdict: 'no-window',
          title: 'Денес остануваме со планот внатре.',
          explanation:
            'Ниту еден целосен слободен период не ги исполнува зададените услови за PM2.5, температура, дожд и ветер. Можете да ги измените границите или да проверите подоцна.'
        };
      }
    }
  }
  const selectedActivity = themeActivity(theme, result.verdict);
  const activityWindow =
    result.verdict === 'outside' ? result.window : findOpenActivityWindow(schedule, conditions, { date: targetDate });
  return {
    ...result,
    theme,
    selectedActivity,
    activityWindow,
    timeline: selectedActivity ? dayTimeline(schedule, activityWindow, selectedActivity) : [],
    scope:
      'Ориентациски прототип за PM2.5 и логистички временски услови. Не ги проценува сите загадувачи, внатрешниот воздух или индивидуалните здравствени потреби.',
    sources: SOURCES
  };
}
function dailyForecastSummary(conditions, date, schedule) {
  const start = minutes(schedule.dayStart);
  const end = minutes(schedule.dayEnd);
  const weather = (conditions.weather ?? []).filter(
    (row) =>
      row.local.date === date &&
      row.local.minutes >= start &&
      row.local.minutes < end &&
      Number.isFinite(row.temperature)
  );
  const air = conditions.forecast.filter(
    (row) =>
      row.local.date === date && row.local.minutes >= start && row.local.minutes < end && Number.isFinite(row.pm25)
  );
  return {
    temperatureMin: weather.length ? Math.min(...weather.map((row) => row.temperature)) : null,
    temperatureMax: weather.length ? Math.max(...weather.map((row) => row.temperature)) : null,
    rainMax: weather.length ? Math.max(...weather.map((row) => row.precipitationProbability)) : null,
    windMax: weather.length ? Math.max(...weather.map((row) => row.windSpeed)) : null,
    pm25Min: air.length ? Math.min(...air.map((row) => row.pm25)) : null,
    pm25Max: air.length ? Math.max(...air.map((row) => row.pm25)) : null
  };
}
export function planWeek(input, conditions) {
  const schedule = validateWeeklySchedule(input);
  const todayDate = skopjeParts(new Date(conditions.clock)).date;
  const dates = planningWeekDates(conditions.clock);
  const days = dates.map((date, index) => {
    const theme = schedule.themes[index];
    const summary = dailyForecastSummary(conditions, date, schedule);
    const offset = dateDistance(todayDate, date);
    const windows =
      conditions.forecastAvailable && conditions.weatherAvailable
        ? findWindows(schedule, conditions, { date, useCurrentTime: date === todayDate })
        : [];
    let verdict = 'unknown';
    let reason = 'Недостасува дел од часовната прогноза. Ќе се пополни при следното освежување.';
    if (offset < 0) {
      verdict = 'past';
      reason = 'Овој ден веќе помина.';
    } else if (date === todayDate && !conditions.assessment.valid)
      reason = 'Локалните набљудувања не ја поминаа проверката. Потребна е нова утринска проверка.';
    else if (date === todayDate && conditions.assessment.aqi > 100) {
      verdict = 'inside-draft';
      reason = 'Тековната локална PM2.5 процена го активира планот внатре.';
    } else if (windows.length) {
      verdict = 'outside-draft';
      reason = 'Приближен термин според тековната моделска прогноза; се потврдува тоа утро.';
    } else if (
      conditions.forecastAvailable &&
      conditions.weatherAvailable &&
      summary.pm25Max !== null &&
      summary.temperatureMin !== null
    ) {
      verdict = 'inside-draft';
      reason =
        'Во слободните периоди нема комбинација што ги исполнува поставените граници. Подготвен е планот внатре.';
    }
    const window = windows[0] ?? null;
    const activity = verdict === 'outside-draft' ? theme.outdoor : theme.indoor;
    const activityWindow =
      verdict === 'outside-draft'
        ? window
        : findOpenActivityWindow(schedule, conditions, { date, useCurrentTime: date === todayDate });
    return {
      date,
      index,
      verdict,
      reason,
      theme,
      window,
      summary,
      activity,
      activityWindow,
      timeline: dayTimeline(schedule, activityWindow, activity),
      confidence: dayConfidence({ offset }),
      canFinalize: conditions.mode === 'demo' ? index === 0 : date === todayDate,
      requiresMorningCheck: true
    };
  });
  return {
    weekStart: dates[0],
    weekEnd: dates.at(-1),
    todayDate,
    days,
    schedule,
    conditions,
    createdAt: new Date().toISOString(),
    provisional: true,
    explanation:
      'Ова е петдневна еко-скица. Фиксните оброци и одмор остануваат, а надворешната или внатрешната варијанта и терминот се потврдуваат секое утро.'
  };
}
export function noticeFacts(plan) {
  const conditions = plan.conditions;
  const prefix = conditions.mode === 'demo' ? 'ПРИМЕР — пробни податоци, не е вистинско известување.\n\n' : '';
  const observation =
    conditions.assessment.aqi === null
      ? 'Нема доволно потврдени свежи податоци за тековна процена.'
      : `Локална PM2.5 NowCast процена: ${conditions.assessment.pm25.toFixed(1)} µg/m³; US AQI за PM2.5: ${conditions.assessment.aqi}.`;
  const activityTime = plan.activityWindow ? ` од ${plan.activityWindow.start} до ${plan.activityWindow.end}` : '';
  const activity = plan.selectedActivity ? ` Денешна еко-активност${activityTime}: ${plan.selectedActivity}.` : '';
  const lesson = plan.theme
    ? ` Цел: ${plan.theme.goal} Користиме: ${plan.theme.materials.join(', ')}. Мала навика за дома: ${plan.theme.habit}`
    : '';
  let action;
  if (plan.verdict === 'outside') {
    action = `Предложен термин за игра: ${plan.window.start}–${plan.window.end}. За терминот се прогнозира околу ${plan.window.temperature.toFixed(1)} °C (се чувствува ${plan.window.apparentTemperature.toFixed(1)} °C), до ${Math.round(plan.window.precipitationProbability)}% веројатност за врнежи и ветер до ${plan.window.windSpeed.toFixed(1)} km/h.${activity}${lesson} Терминот е врз основа на прогноза и распоред, а не гаранција за условите. Ќе направиме нова проверка пред излегувањето.`;
  } else if (plan.verdict === 'wait') {
      action = `Планираната игра надвор ја одложуваме поради покачената PM2.5 процена.${activity}${lesson} Ќе ги провериме условите повторно.`;
    } else {
      action = `Во моментов не потврдуваме термин за игра надвор.${activity}${lesson} Ќе направиме нова проверка кога ќе има доволно свежи податоци и соодветен период.`;
    }
  return `${prefix}План за ${plan.decisionDate} · ${conditions.location.name}, Скопје.\n\n${observation}\n\n${action}\n\nОва е ориентациска PM2.5 и временска процена. Конечната одлука ја носи воспитувачот според условите и правилата на градинката.`;
}
export function composeNotice(plan, tone) {
  return `${tone.opening}\n\n${noticeFacts(plan)}\n\n${tone.closing}`;
}

function dayConfidence({ offset }) {
  if (offset <= 0) {
    return 'morning';
  }
  if (offset === 1) {
    return 'medium';
  }
  return 'low';
}

function themeActivity(theme, verdict) {
  if (!theme) return null;
  return verdict === 'outside' ? theme.outdoor : theme.indoor;
}
