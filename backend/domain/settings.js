import { DEFAULT_COMFORT, locationById } from '../config/index.js';
import { minutes, timeLabel } from './constraints.js';

export const pair = (mk, en) => ({ mk, en });
export const MATERIALS = [
  ['paper', 'Користена хартија', 'Used paper'], ['cardboard', 'Чист картон', 'Clean cardboard'],
  ['leaves', 'Паднати лисја', 'Fallen leaves'], ['cups', 'Чаши за повеќекратна употреба', 'Reusable cups'],
  ['crayons', 'Боички', 'Crayons'], ['fabric', 'Остатоци од ткаенина', 'Fabric scraps'],
].map(([id, mk, en]) => ({ id, label: pair(mk, en) }));
export const DEFAULT_SETTINGS = {
  gradinka: { name: '', locationId: 'centar' }, teacherPrompt: '',
  locationId: 'centar', groupName: '', ageGroup: '4-5', dayStart: '07:30', dayEnd: '16:00', duration: 45, outdoorDays: 2,
  materials: ['paper', 'cardboard', 'leaves', 'crayons'], preferences: { ...DEFAULT_COMFORT },
  blocks: [
    { id: 'breakfast', label: pair('Појадок', 'Breakfast'), start: '08:30', end: '09:00', kind: 'meal' },
    { id: 'snack', label: pair('Овошна ужинка', 'Fruit snack'), start: '10:00', end: '10:15', kind: 'meal' },
    { id: 'lunch', label: pair('Ручек', 'Lunch'), start: '11:30', end: '12:00', kind: 'meal' },
    { id: 'rest', label: pair('Одмор и спиење', 'Rest and nap'), start: '12:30', end: '14:00', kind: 'rest' },
    { id: 'afternoon-snack', label: pair('Попладневна ужинка', 'Afternoon snack'), start: '14:00', end: '14:15', kind: 'meal' },
  ],
};
export const invalid = (code = 'invalid_plan', status = 400) => Object.assign(new Error(code), { status, code });
export function teacherInstruction(value = '') {
  if (typeof value !== 'string' || value.length > 2000 || /[<>\u0000-\u0008\u000b-\u001f]/u.test(value)) throw invalid('invalid_instruction');
  return value.trim().replace(/\r?\n/g, ' ');
}
export function cleanText(value, max = 200) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max || /[<>\p{Cc}]/u.test(value)) throw invalid('invalid_text');
  return value.trim().replace(/\u2014/g, ',');
}
export function textPair(value, max = 200) {
  if (!value || typeof value !== 'object') throw invalid('both_languages');
  return pair(cleanText(value.mk, max), cleanText(value.en, max));
}
export function validTime(value) {
  if (typeof value !== 'string' || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value)) throw invalid('invalid_time');
  return value;
}
export function validateTimeline(items, settings) {
  if (!Array.isArray(items) || items.length > 30) throw invalid('invalid_timeline');
  const ids = new Set(); let ecoCount = 0;
  const result = items.map(item => {
    const id = cleanText(item.id, 60);
    if (!/^[a-zA-Z0-9_-]+$/.test(id) || ids.has(id)) throw invalid('invalid_timeline');
    ids.add(id);
    const start = validTime(item.start); const end = validTime(item.end);
    if (end <= start || start < settings.dayStart || end > settings.dayEnd) throw invalid('time_bounds');
    if (!['meal', 'rest', 'routine', 'eco', 'activity'].includes(item.kind)) throw invalid('invalid_timeline');
    if (item.kind === 'eco' && ++ecoCount > 1) throw invalid('one_eco_slot');
    return { id, start, end, kind: item.kind, label: textPair(item.label, 100) };
  }).sort((a, b) => a.start.localeCompare(b.start));
  if (result.some((row, i) => i > 0 && row.start < result[i - 1].end)) throw invalid('overlapping_times');
  return result;
}
export function validateSettings(input) {
  if (!input || typeof input !== 'object') throw invalid('invalid_settings');
  const locationId = locationById(input.locationId).id;
  const gradinka = { name: input.gradinka?.name ? cleanText(input.gradinka.name, 100) : '', locationId };
  const teacherPrompt = teacherInstruction(input.teacherPrompt);
  const groupName = input.groupName ? cleanText(input.groupName, 60) : '';
  if (!['3-4', '4-5', '5-6', 'mixed'].includes(input.ageGroup)) throw invalid('invalid_age');
  const dayStart = validTime(input.dayStart); const dayEnd = validTime(input.dayEnd);
  if (dayStart < '06:00' || dayEnd > '19:00' || minutes(dayEnd) - minutes(dayStart) < 180) throw invalid('time_bounds');
  if (!Number.isInteger(input.duration) || input.duration < 15 || input.duration > 60 || input.duration % 15) throw invalid('invalid_duration');
  if (!Number.isInteger(input.outdoorDays) || input.outdoorDays < 0 || input.outdoorDays > 5) throw invalid('invalid_outdoor_days');
  const materials = Array.isArray(input.materials) ? [...new Set(input.materials)] : [];
  if (!materials.length || materials.some(id => !MATERIALS.some(m => m.id === id))) throw invalid('invalid_materials');
  const preferences = {};
  for (const [key, min, max] of [['minApparentC', -10, 20], ['maxApparentC', 20, 38], ['maxPrecipProbability', 0, 90], ['maxPrecipitationMm', 0, 5], ['maxWindKmh', 0, 50]]) {
    const n = input.preferences?.[key]; if (!Number.isFinite(n) || n < min || n > max) throw invalid('invalid_preferences'); preferences[key] = n;
  }
  if (!Array.isArray(input.blocks) || input.blocks.length > 10) throw invalid('invalid_timeline');
  const blocks = validateTimeline(input.blocks, { dayStart, dayEnd });
  if (blocks.some(b => !['meal', 'rest', 'routine'].includes(b.kind))) throw invalid('invalid_timeline');
  const gaps = []; let cursor = minutes(dayStart);
  for (const block of blocks) { gaps.push(minutes(block.start) - cursor); cursor = minutes(block.end); }
  gaps.push(minutes(dayEnd) - cursor);
  if (!gaps.some(gap => gap >= input.duration)) throw invalid('no_activity_space');
  return { locationId, gradinka, teacherPrompt, groupName, ageGroup: input.ageGroup, dayStart, dayEnd, duration: input.duration,
    outdoorDays: input.outdoorDays, materials, preferences, blocks };
}
export function validateGenerationSettings(input) {
  if (!input || typeof input !== 'object') throw invalid('invalid_settings');
  if (typeof input.gradinka?.name !== 'string' || !input.gradinka.name.trim()) throw invalid('kindergarten_required');
  if (typeof input.groupName !== 'string' || !input.groupName.trim()) throw invalid('group_required');
  if (typeof input.teacherPrompt !== 'string' || !input.teacherPrompt.trim()) throw invalid('brief_required');
  return validateSettings(input);
}
export { minutes, timeLabel };
