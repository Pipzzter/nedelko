const timePattern = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
const minutes = (time) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3));
export function planIssues(value, config, rhythmConfirmed = true) {
  const issues = [];
  const add = (field, key, section) => issues.push({ field, key, section });
  if (!value.teacherPrompt?.trim()) add('teacherPrompt', 'requiredBrief', 1);
  if (!value.materials?.length) add('materials', 'requiredMaterials', 1);
  if (!Number.isInteger(value.outdoorDays) || value.outdoorDays < 0 || value.outdoorDays > 5)
    add('outdoorDays', 'requiredOutdoorDays', 1);
  const timesValid = validDayBounds({ value });
  if (!timesValid) add('dayStart', 'checkDayTimes', 2);
  const rows = [...value.blocks].sort((a, b) => a.start.localeCompare(b.start));
  if (!['meal', 'rest'].every((kind) => rows.some((row) => row.kind === kind)))
    add('routines', 'dailyRoutinesRequired', 2);
  validateRoutineRows({ rows, add, value });
  if (timesValid && !issues.some((i) => i.key === 'checkRoutineTimes')) {
    let cursor = minutes(value.dayStart);
    let gap = 0;
    for (const row of rows) {
      gap = Math.max(gap, minutes(row.start) - cursor);
      cursor = minutes(row.end);
    }
    if (Math.max(gap, minutes(value.dayEnd) - cursor) < value.duration) add('routines', 'checkActivitySpace', 2);
  }
  addPreferenceIssues(value.preferences, config.preferenceBounds, add);
  if (!rhythmConfirmed) add('rhythmConfirmed', 'confirmRhythmError', 2);
  return issues;
}

function addPreferenceIssues(preferences, bounds, add) {
  for (const [key, { min, max }] of Object.entries(bounds)) {
    if (!Number.isFinite(preferences[key]) || preferences[key] < min || preferences[key] > max)
      add(key, 'checkWeatherPreferences', 1);
  }
  if (preferences.minApparentC >= preferences.maxApparentC)
    add('minApparentC', 'checkTemperatureOrder', 1);
}
export function focusPlanField(field) {
  const target = document.getElementById(`plan-${field}`);
  if (!target) return;
  let ancestor = target.closest('details');
  while (ancestor) {
    ancestor.open = true;
    ancestor = ancestor.parentElement?.closest('details');
  }
  target.scrollIntoView?.({ block: 'center', behavior: 'auto' });
  const control = target.matches('input,select,textarea,button')
    ? target
    : target.querySelector('input,select,textarea,button,summary');
  (control || target).focus?.({ preventScroll: true });
}

function validateRoutineRows({ rows, add, value }) {
  for (const [i, row] of rows.entries()) {
    if (!row.label.mk?.trim() || !row.label.en?.trim()) add(`routine-${row.id}`, 'checkRoutineNames', 2);
    if (
      !timePattern.test(row.start) ||
      !timePattern.test(row.end) ||
      row.start >= row.end ||
      row.start < value.dayStart ||
      row.end > value.dayEnd ||
      (i > 0 && row.start < rows[i - 1].end)
    )
      add(`routine-${row.id}`, 'checkRoutineTimes', 2);
  }
}

function validDayBounds({ value }) {
  return (
    timePattern.test(value.dayStart) &&
    timePattern.test(value.dayEnd) &&
    value.dayStart >= '06:00' &&
    value.dayEnd <= '19:00' &&
    minutes(value.dayEnd) - minutes(value.dayStart) >= 180
  );
}
