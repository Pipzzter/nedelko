const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const pair = value => object(value) && typeof value.mk === 'string' && typeof value.en === 'string';
const lesson = value => object(value) && ['title', 'goal', 'inside', 'outside', 'habit'].every(key => pair(value[key])) && Array.isArray(value.materials);
const days = value => Array.isArray(value) && value.length === 5 && value.every(day =>
  object(day) && /^\d{4}-\d{2}-\d{2}$/.test(day.date) &&
  (day.theme == null || lesson(day.theme)) &&
  Array.isArray(day.timeline) && day.timeline.every(row => object(row) && pair(row.label) &&
    typeof row.id === 'string' && typeof row.start === 'string' && typeof row.end === 'string' &&
    (row.note == null || pair(row.note)) && (row.lesson == null || lesson(row.lesson)) &&
    (row.variants == null || ['inside', 'outside'].every(mode => pair(row.variants[mode])))));

// Response shape checks protect rendering. Recommendation authority stays on the server.
export function validateView(value, parent = false) {
  const environment = value?.environment;
  const validEnvironment = object(environment) && object(environment.assessment) && object(environment.location);
  const valid = object(value) && Number.isFinite(Date.parse(value.clock)) && validEnvironment &&
    (parent ? days(value.days) : Array.isArray(value.calendar) && value.calendar.length === 5 &&
      value.calendar.every(day => object(day) && typeof day.date === 'string') &&
      (value.week == null || days(value.week.days) && object(value.week.settings) && object(value.week.messages)));
  if (!valid) throw Object.assign(new Error('unexpected_error'), { code: 'unexpected_error' });
  return value;
}
