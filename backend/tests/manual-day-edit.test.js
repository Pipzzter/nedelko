import test from 'node:test';
import assert from 'node:assert/strict';
import { manualDayEdit } from '../domain/manual-day-edit.js';
import { DEFAULT_SETTINGS, pair, minutes } from '../domain/settings.js';
import { createWeek, adaptWeek } from '../domain/week.js';
import { localCurriculum } from '../domain/curriculum.js';
import { planningWeekDates } from '../domain/planner.js';
import { demoConditions } from '../services/conditions.js';
import { LOCATIONS } from '../config/index.js';
import { demoWeekById } from '../config/demo.js';

function fixture() {
  const conditions = demoConditions(LOCATIONS[0], 'normal', Date.now(), demoWeekById('spring-garden'));
  const week = createWeek(DEFAULT_SETTINGS, { themes: localCurriculum(planningWeekDates(conditions.clock), DEFAULT_SETTINGS), source: 'library' }, conditions);
  return { conditions, week, day: week.days[3] };
}
const content = { label: pair('Заеднички појадок', 'Breakfast together'), note: pair('Го подготвуваме оброкот заедно.', 'We prepare the meal together.') };

test('moving a row retains saved occasion discussion and ignores forged metadata', () => {
  const { conditions, week, day } = fixture();
  const original = day.timeline.at(-1);
  original.occasionIds = ['teacher-occasion'];
  original.occasionDiscussion = pair('Наш разговор', 'Our discussion');
  const timeline = structuredClone(day.timeline);
  Object.assign(timeline.at(-1), { start: '17:00', end: '18:00', occasionIds: ['forged'],
    occasionDiscussion: pair('Туѓ разговор', 'Forged discussion') });
  const moved = manualDayEdit(day, week.settings, { action: 'timeline', timeline }, conditions.clock);
  assert.equal(moved.timeline.at(-1).start, '17:00');
  assert.deepEqual(moved.timeline.at(-1).occasionIds, original.occasionIds);
  assert.deepEqual(moved.timeline.at(-1).occasionDiscussion, original.occasionDiscussion);
  const reordered = manualDayEdit(day, week.settings, { action: 'reorder', rowIds: day.timeline.map(row => row.id).reverse() }, conditions.clock);
  assert.deepEqual(reordered.timeline[0].occasionDiscussion, original.occasionDiscussion);
});

test('manual meal/rest/occasion details persist through adaptation without changing times or evidence', () => {
  const { conditions, week, day } = fixture();
  for (const kind of ['meal', 'rest', 'activity', 'eco']) {
    const row = day.timeline.find(row => row.kind === kind);
    row.occasionIds = ['teacher-occasion']; row.occasionDiscussion = pair('Разговор', 'Discussion');
    const theme = { ...day.theme, title: content.label, inside: content.note };
    const next = manualDayEdit(day, week.settings, { action: 'content', rowId: row.id, content: { ...content, theme, occasionDiscussion: pair('Наш разговор', 'Our discussion') } }, conditions.clock);
    assert.deepEqual(next.timeline.map(({ id, start, end, kind }) => ({ id, start, end, kind })), day.timeline.map(({ id, start, end, kind }) => ({ id, start, end, kind })));
    assert.equal(next.timeline.find(item => item.id === row.id).label.en, content.label.en);
    const adapted = adaptWeek({ ...week, days: week.days.map(item => item.date === day.date ? next : item) }, conditions);
    const saved = adapted.days[3].timeline.find(item => item.id === row.id);
    assert.equal(saved.label.en, content.label.en); assert.equal(saved.occasionDiscussion.en, 'Our discussion');
    assert.equal(adapted.approval, null); assert.equal(adapted.checkedAt, null);
    assert.deepEqual(next.theme.dayActivities, day.theme.dayActivities);
  }
});

test('content cannot inject times and validates bilingual descriptions, material IDs and elapsed rows', () => {
  const { conditions, week, day } = fixture(); const row = day.timeline[0];
  const request = { action: 'content', rowId: row.id, content };
  for (const field of ['start', 'end', 'kind', 'aqi']) assert.throws(() => manualDayEdit(day, week.settings, { ...request, content: { ...content, [field]: '09:00' } }, conditions.clock), { code: 'invalid_plan' });
  assert.throws(() => manualDayEdit(day, week.settings, { ...request, content: { ...content, note: { en: 'Only English' } } }, conditions.clock), { code: 'invalid_text' });
  assert.throws(() => manualDayEdit(day, week.settings, { ...request, rowId: 'missing' }, conditions.clock), { code: 'invalid_timeline' });
  assert.throws(() => manualDayEdit(day, week.settings, request, `${day.date}T16:00:00Z`), { code: 'activity_finished' });
  assert.throws(() => manualDayEdit(null, week.settings, request, conditions.clock), { code: 'activity_finished' });
  const eco = day.timeline.find(row => row.kind === 'eco');
  assert.throws(() => manualDayEdit(day, week.settings, { action: 'content', rowId: eco.id, content: { theme: { ...day.theme, materials: ['unavailable'] } } }, conditions.clock), { code: 'invalid_materials' });
});

test('reordering propagates times through meals and rest while preserving every duration and identity', () => {
  const { conditions, week, day } = fixture();
  const ids = day.timeline.map(row => row.id); const first = ids.shift(); ids.splice(3, 0, first);
  const next = manualDayEdit(day, week.settings, { action: 'reorder', rowIds: ids }, conditions.clock);
  assert.deepEqual(next.timeline.map(row => row.id), ids);
  assert.equal(next.timeline[0].start, week.settings.dayStart); assert.equal(next.timeline.at(-1).end, week.settings.dayEnd);
  for (const [index, row] of next.timeline.entries()) {
    const original = day.timeline.find(item => item.id === row.id);
    assert.equal(minutes(row.end) - minutes(row.start), minutes(original.end) - minutes(original.start));
    assert.deepEqual(row.label, original.label);
    if (index) assert.equal(next.timeline[index - 1].end, row.start);
  }
  for (const rowIds of [[], [...ids, ids[0]], ids.map(() => ids[0]), ids.map((id, i) => i ? id : 'forged')]) assert.throws(() => manualDayEdit(day, week.settings, { action: 'reorder', rowIds }, conditions.clock), { code: 'invalid_timeline' });
  assert.throws(() => manualDayEdit(day, week.settings, { action: 'reorder', rowIds: ids }, `${day.date}T07:00:00Z`), { code: 'activity_finished' });
});

test('explicit start edits preserve duration, leave gaps and resolve overlaps without a day-end clamp', () => {
  const { conditions, week, day } = fixture(); const starts = day.timeline.map(row => row.start);
  starts[starts.length - 1] = '18:00';
  const request = { action: 'timing', starts };
  const next = manualDayEdit(day, week.settings, request, conditions.clock);
  assert.equal(next.timeline.at(-2).end, day.timeline.at(-2).end);
  assert.equal(next.timeline.at(-1).start, '18:00');
  assert.ok(next.timeline.at(-1).end > week.settings.dayEnd);
  assert.deepEqual(next.timeline[0], day.timeline[0]);
  for (let i = 0; i < next.timeline.length; i++)
    assert.equal(minutes(next.timeline[i].end) - minutes(next.timeline[i].start), minutes(day.timeline[i].end) - minutes(day.timeline[i].start));
  assert.throws(() => manualDayEdit(day, week.settings, { ...request, starts: [] }, conditions.clock), { code: 'invalid_timeline' });
  const overlap = [...starts]; overlap[2] = overlap[1];
  const resolved = manualDayEdit(day, week.settings, { ...request, starts: overlap }, conditions.clock);
  assert.equal(resolved.timeline[2].start, resolved.timeline[1].end);
  const elapsed = [...starts]; elapsed[0] = '08:00';
  assert.throws(() => manualDayEdit(day, week.settings, { ...request, starts: elapsed }, `${day.date}T13:01:00Z`), { code: 'activity_finished' });
  assert.throws(() => manualDayEdit(day, week.settings, { action: 'unknown' }, conditions.clock), { code: 'invalid_plan' });
});
