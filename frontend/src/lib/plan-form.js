const timePattern = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
const minutes = time => Number(time.slice(0, 2)) * 60 + Number(time.slice(3));
export function planIssues(value, config, rhythmConfirmed = true) {
  const issues = [];
  const add = (field, key, section) => issues.push({ field, key, section });
  if (!value.gradinka?.name?.trim()) add('kindergarten', 'requiredKindergarten', 1);
  if (!value.groupName?.trim()) add('groupName', 'requiredGroup', 1);
  if (!config.locations.some(l => l.id === value.locationId)) add('locationId', 'requiredLocation', 1);
  if (!['3-4','4-5','5-6','mixed'].includes(value.ageGroup)) add('ageGroup', 'requiredAge', 1);
  if (!value.teacherPrompt?.trim()) add('teacherPrompt', 'requiredBrief', 2);
  if (!value.materials?.length) add('materials', 'requiredMaterials', 2);
  if (!Number.isInteger(value.outdoorDays) || value.outdoorDays < 0 || value.outdoorDays > 5) add('outdoorDays', 'requiredOutdoorDays', 2);
  if (![15,30,45,60].includes(value.duration)) add('duration', 'requiredDuration', 2);
  const timesValid = timePattern.test(value.dayStart) && timePattern.test(value.dayEnd) && value.dayStart >= '06:00' && value.dayEnd <= '19:00' && minutes(value.dayEnd) - minutes(value.dayStart) >= 180;
  if (!timesValid) add('dayStart', 'checkDayTimes', 3);
  const rows = [...value.blocks].sort((a,b) => a.start.localeCompare(b.start));
  for (const [i,row] of rows.entries()) {
    if (!row.label.mk?.trim() || !row.label.en?.trim()) add(`routine-${row.id}`, 'checkRoutineNames', 3);
    if (!timePattern.test(row.start) || !timePattern.test(row.end) || row.start >= row.end || row.start < value.dayStart || row.end > value.dayEnd || i > 0 && row.start < rows[i-1].end) add(`routine-${row.id}`, 'checkRoutineTimes', 3);
  }
  if (timesValid && !issues.some(i=>i.key==='checkRoutineTimes')) {
    let cursor = minutes(value.dayStart); let gap = 0;
    for (const row of rows) { gap = Math.max(gap, minutes(row.start)-cursor); cursor=minutes(row.end); }
    if (Math.max(gap,minutes(value.dayEnd)-cursor) < value.duration) add('routines', 'checkActivitySpace', 3);
  }
  for (const [key,min,max] of [['minApparentC',-10,20],['maxApparentC',20,38],['maxPrecipProbability',0,90],['maxPrecipitationMm',0,5],['maxWindKmh',0,50]]) {
    if (!Number.isFinite(value.preferences[key]) || value.preferences[key]<min || value.preferences[key]>max) add(key, 'checkWeatherPreferences', 2);
  }
  if (!rhythmConfirmed) add('rhythmConfirmed', 'confirmRhythmError', 3);
  return issues;
}
export function focusPlanField(field) {
  const target = document.getElementById(`plan-${field}`);
  if (!target) return;
  let ancestor = target.closest('details');
  while (ancestor) { ancestor.open = true; ancestor = ancestor.parentElement?.closest('details'); }
  target.scrollIntoView?.({block:'center',behavior:'auto'});
  const control = target.matches('input,select,textarea,button') ? target : target.querySelector('input,select,textarea,button,summary');
  (control || target).focus?.({preventScroll:true});
}
