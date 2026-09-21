import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { DEFAULT_SETTINGS, pair, minutes, validateTimeline, validateSettings, materialCatalog } from '../domain/settings.js';
import { createWeek, adaptWeek, dailyPlanningContext, dashboard } from '../domain/week.js';
import { localCurriculum, validateCurriculum } from '../domain/curriculum.js';
import { manualDayEdit } from '../domain/manual-day-edit.js';
import { validateDayChange, rowContent } from '../domain/day-edit.js';
import { resolveTimelineOverlaps } from '../domain/timeline.js';
import { parentView } from '../domain/parent-view.js';
import { createApp } from '../http/app.js';
import { openStore } from '../storage/database.js';
import { demoConditions } from '../services/conditions.js';
import { LOCATIONS } from '../config/index.js';
import { planningWeekDates } from '../domain/planner.js';
import { calendarSnapshot, occasionsForWeek } from '../domain/holidays.js';

const row = (id, start, end, kind = 'activity') => ({ id, start, end, kind, label: pair(id, id), note: pair('Опис на активноста.', 'Activity description.') });
function conditions(clock = '2026-09-21T05:00:00Z') {
  const c = demoConditions(LOCATIONS[0], 'normal', Date.parse(clock), {
    clock, temperatures: [20, 20, 20, 20, 20, 20, 20], rainy: [], snowy: [], windy: []
  });
  c.forecast.forEach(item => { item.pm25 = 10; });
  return c;
}
function curriculum(c, settings = DEFAULT_SETTINGS) {
  return { source: 'ai', themes: localCurriculum(planningWeekDates(c.clock), settings),
    timelines: [[row('run', '09:00', '14:00', 'eco')], [row('breakfast', '08:45', '09:15', 'meal')], [],
      [row('first', '08:00', '09:00', 'eco'), row('second', '15:00', '17:00', 'eco')],
      [row('early', '05:00', '06:00', 'free'), row('late', '18:00', '20:00', 'rest')]],
    outdoorPreferences: ['outside', 'auto', 'auto', 'outside', 'auto'] };
}

test('several authored eco activities keep distinct bilingual mode variants in parent notices and projection', () => {
  const c = conditions(); const supplied = curriculum(c);
  const variants = [
    { inside: pair('Трчаме во салата.', 'Run in the hall.'), outside: pair('Трчаме во дворот.', 'Run in the yard.') },
    { inside: pair('Правиме мозаик на масата.', 'Make a mosaic at the table.'), outside: pair('Правиме мозаик во дворот.', 'Make a mosaic in the yard.') }
  ];
  supplied.timelines[0] = variants.map((variant, i) => ({ ...row(`eco-${i}`, i ? '10:00' : '09:00', i ? '11:00' : '10:00', 'eco'), variants: variant }));
  c.assessment.aqi = 160;
  const week = createWeek(DEFAULT_SETTINGS, supplied, c);
  const parent = parentView(week, Date.parse(c.clock) + 1000, c);
  assert.equal(week.days[0].mode, 'inside');
  for (const [i, variant] of variants.entries()) {
    assert.deepEqual(parent.days[0].timeline[i].variants, variant);
    for (const lang of ['mk', 'en']) {
      assert.ok(week.messages.daily[week.today][lang].includes(variant.inside[lang]));
      assert.ok(!week.messages.daily[week.today][lang].includes(variant.outside[lang]));
    }
  }
  assert.throws(() => validateTimeline([{ ...supplied.timelines[0][0], variants: { inside: { en: 'Only English' } } }]), { status: 400 });
});

test('authored holiday lessons receive server-owned occasion markers without rewriting their rows', () => {
  const c = conditions(); const supplied = curriculum(c);
  const event = occasionsForWeek(planningWeekDates(c.clock))[4][0];
  supplied.themes[4].title = event.name;
  for (const mode of ['inside', 'outside']) for (const lang of ['mk', 'en'])
    supplied.themes[4][mode][lang] = `${event.name[lang]}: ${supplied.themes[4][mode][lang]}`;
  supplied.timelines[4] = [row('occasion-eco', '09:00', '10:00', 'eco')];
  const week = createWeek(DEFAULT_SETTINGS, supplied, c);
  const day = week.days[4]; const lesson = day.timeline[0];
  assert.ok(day.occasions.length);
  assert.ok(lesson.occasionIds.includes(day.occasions[0].id));
  assert.deepEqual(rowContent(lesson), rowContent(supplied.timelines[4][0]));
  supplied.timelines[4][0].variants = { inside: pair('Градиме на масата.', 'Build at the table.'), outside: pair('Градиме во дворот.', 'Build in the yard.') };
  const unrelated = createWeek(DEFAULT_SETTINGS, supplied, c).days[4].timeline[0];
  assert.equal(unrelated.occasionIds, undefined, 'a different row variant must not inherit the day theme marker');
});

test('timeline integrity permits long, overlapping, reordered and empty days and rejects malformed rows', () => {
  const rows = [row('a', '05:00', '10:00', 'eco'), row('b', '07:00', '09:00', 'eco'), row('c', '20:00', '23:59', 'free')];
  assert.deepEqual(validateTimeline(rows), rows);
  assert.deepEqual(validateTimeline([...rows].reverse()), [...rows].reverse());
  assert.deepEqual(validateTimeline([]), []);
  assert.equal(validateTimeline(Array.from({ length: 40 }, (_, i) => row(`r${i}`, '07:00', '08:00'))).length, 40);
  for (const invalid of [null, {}, [null], [...rows, rows[0]], Array.from({ length: 41 }, (_, i) => row(`r${i}`, '07:00', '08:00')),
    [{ ...rows[0], start: '24:00' }], [{ ...rows[0], end: '05:00' }], [{ ...rows[0], kind: 'verdict' }],
    [{ ...rows[0], label: { en: 'Missing translation' } }], [{ ...rows[0], id: 'with space' }]]) {
    assert.throws(() => validateTimeline(invalid), { status: 400 });
  }
  assert.equal(validateTimeline([{ ...rows[0], mode: 'outside', aqi: 0, approved: true }])[0].aqi, undefined);
  const resolved = resolveTimelineOverlaps(rows);
  assert.deepEqual(resolved.map(item => [item.start, item.end]), [['05:00', '10:00'], ['10:00', '12:00'], ['20:00', '23:59']]);
  assert.throws(() => resolveTimelineOverlaps([row('a', '22:00', '23:00'), row('b', '22:30', '23:59')]), { code: 'time_bounds' });
});

test('assembly retains each authored day and every label through weather refresh and parent projection', () => {
  const c = conditions(); const supplied = curriculum(c);
  const week = createWeek(DEFAULT_SETTINGS, supplied, c);
  for (const [index, day] of week.days.entries()) {
    assert.deepEqual(day.timeline.map(item => validateTimeline([item])[0]), supplied.timelines[index]);
    assert.equal(day.authoredTimeline, true);
  }
  assert.equal(week.days[0].timeline.some(item => item.id === 'breakfast'), false);
  assert.equal(minutes(week.days[0].timeline[0].end) - minutes(week.days[0].timeline[0].start), 300);
  assert.equal(week.days[1].timeline[0].start, '08:45');
  assert.match(week.messages.daily[week.days[3].date].en, /first, second/);
  assert.equal(week.days[2].reason, 'no_slot');
  const bad = structuredClone(c); bad.weatherAvailable = false;
  const refreshed = adaptWeek(week, bad);
  assert.deepEqual(refreshed.days.map(day => day.timeline), week.days.map(day => day.timeline));
  assert.equal(refreshed.approval, null);
  assert.equal(parentView(refreshed, Date.now() + 10000, bad).days[3].timeline.length, 2);
  assert.equal(dashboard(week, c).calendar.length, 5);
  const context = dailyPlanningContext(week.days.map(day => day.date), DEFAULT_SETTINGS, c);
  assert.deepEqual(context[0].defaultRoutine.blocks, DEFAULT_SETTINGS.blocks);
  assert.equal(context[0].slots, undefined);
  const midweek = createWeek(DEFAULT_SETTINGS, supplied, conditions('2026-09-23T05:00:00Z'));
  assert.deepEqual(midweek.days.slice(0, 2).map(day => day.timeline), [[], []]);
  assert.throws(() => createWeek(DEFAULT_SETTINGS, { ...supplied, timelines: [{ invalid: true }] }, c), { code: 'invalid_timeline' });
  const occupied = { ...DEFAULT_SETTINGS, blocks: [row('rest', '07:30', '16:00', 'rest')] };
  assert.doesNotThrow(() => createWeek(occupied, { themes: supplied.themes, source: 'library' }, c));
});

test('all remaining outdoor rows require hourly evidence, including an extended afternoon slot', () => {
  const c = conditions(); const week = createWeek(DEFAULT_SETTINGS, curriculum(c), c);
  const date = week.days[3].date;
  assert.equal(week.days[3].mode, 'outside');
  c.forecast = c.forecast.filter(item => !(item.local.date === date && item.local.minutes === 16 * 60));
  const denied = adaptWeek(week, c);
  assert.equal(denied.days[3].reason, 'air_forecast_unavailable');
  const afternoon = conditions(`${date}T10:00:00Z`);
  afternoon.weather = afternoon.weather.filter(item => item.local.date !== date || item.local.minutes >= 12 * 60);
  const afterFirst = adaptWeek(week, afternoon);
  assert.equal(afterFirst.days[3].mode, 'outside', 'an elapsed morning slot does not drop the remaining afternoon slot');
});

test('elapsed integrity is enforced for manual edits, removed rows, proposals and changes at apply time', () => {
  const c = conditions(); const week = createWeek(DEFAULT_SETTINGS, curriculum(c), c); const day = week.days[0];
  const request = { scope: 'schedule' }; const clock = '2026-09-21T07:00:00Z';
  assert.throws(() => manualDayEdit(day, week.settings, { action: 'content', rowId: 'run', content: { theme: day.theme } }, clock), { code: 'activity_finished' });
  assert.throws(() => manualDayEdit(day, week.settings, { action: 'timeline', timeline: [] }, clock), { code: 'activity_finished' });
  assert.throws(() => validateDayChange(day, week.settings, request, { timeline: [], theme: day.theme }, clock), { code: 'activity_finished' });
  const added = [...day.timeline.map(rowContent), row('meal', '14:00', '14:30', 'meal')];
  const preview = validateDayChange(day, week.settings, request, { timeline: added, theme: day.theme }, c.clock);
  assert.equal(preview.timeline.length, 2);
  assert.equal(validateDayChange(day, week.settings, request, { timeline: added }, clock).timeline.length, 2);
  assert.throws(() => validateDayChange(day, week.settings, request, { timeline: [added[1], added[0]] }, clock), { code: 'activity_finished' });
  const changedTheme = { ...day.theme, title: pair('Ново', 'Changed') };
  assert.throws(() => validateDayChange(day, week.settings, request, { timeline: added, theme: changedTheme }, clock), { code: 'activity_finished' });
  assert.throws(() => validateDayChange(day, week.settings, request, { timeline: [], theme: day.theme }, '2026-09-22T05:00:00Z'), { code: 'activity_finished' });
  const future = week.days[1];
  const edited = manualDayEdit(future, week.settings, { action: 'timeline', timeline: [row('nap', '17:00', '19:00', 'rest')] }, c.clock);
  assert.equal(edited.timeline[0].start, '17:00');
  assert.throws(() => validateDayChange(future, week.settings, request, { timeline: [], outdoorPreference: 'force' }, c.clock), { code: 'invalid_plan' });
  const proposed = curriculum(c); proposed.timelines[0] = [];
  assert.throws(() => createWeek(week.settings, proposed, conditions(clock), undefined, week), { code: 'activity_finished' });
  const context = dailyPlanningContext(week.days.map(item => item.date), week.settings, conditions(clock), week);
  assert.deepEqual(context[0].lockedRows.map(item => item.id), ['run']);
  assert.deepEqual(context[0].lockedTheme, day.theme);
  const withLesson = { ...day, timeline: [{ ...day.timeline[0], lesson: day.theme }] };
  const moved = validateDayChange(withLesson, week.settings, request,
    { timeline: [{ ...rowContent(day.timeline[0]), start: '10:00', end: '15:00' }] }, c.clock);
  assert.deepEqual(moved.timeline[0].lesson, day.theme, 'moving a row preserves its previously edited lesson');
});

test('custom materials validate, remain available to model lessons and appear on the shared parent view', () => {
  const custom = { id: 'custom-loupe', label: pair('Лупи', 'Magnifying glasses') };
  const settings = validateSettings({ ...DEFAULT_SETTINGS, materials: [custom.id], customMaterials: [custom] });
  assert.deepEqual(materialCatalog(settings).at(-1), custom);
  const c = conditions(); const generated = curriculum(c, settings);
  assert.equal(validateCurriculum(generated.themes, settings)[0].materials[0], custom.id);
  const week = createWeek(settings, generated, c);
  assert.deepEqual(parentView(week, Date.now() + 10000, c).materials.at(-1), custom);
  for (const customMaterials of [[custom, custom], [{ ...custom, id: 'paper' }], [{ ...custom, label: { en: 'Only English' } }], {}, Array(31).fill(custom)])
    assert.throws(() => validateSettings({ ...settings, customMaterials }), { status: 400 });
  assert.throws(() => validateSettings({ ...settings, materials: ['custom-forged'] }), { code: 'invalid_materials' });
});

test('authenticated generation saves the five-hour Monday and Tuesday breakfast and edits the day without 503', async t => {
  t.mock.timers.enable({ apis: ['Date'], now: Date.parse('2026-09-21T05:00:00Z') });
  const server = createApp({ store: openStore(':memory:'), conditionsProvider: async () => conditions(new Date().toISOString()),
    holidayProvider: async year => calendarSnapshot(year), curriculumProvider: async (_dates, settings) => curriculum(conditions(), settings),
    dayPlanProvider: async day => ({ source: 'ai', change: { theme: day.theme, timeline: [row('breakfast', '08:45', '09:15', 'meal'), row('long-run', '09:15', '14:15', 'eco')] } }) });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
  let cookie = '';
  const post = async (path, body) => {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api${path}`, { method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie }, body: JSON.stringify(body) });
    cookie = response.headers.get('set-cookie')?.split(';')[0] || cookie;
    return { status: response.status, body: await response.json() };
  };
  assert.equal((await post('/auth/register', { email: 'timeline@test.mk', password: 'TimetableTests123', displayName: 'Teacher', kindergarten: 'Test garden', ageGroup: '4-5', locationId: 'centar' })).status, 200);
  const generated = await post('/week/generate', { settings: { ...DEFAULT_SETTINGS, gradinka: { name: 'Test garden' }, groupName: 'Test garden',
    teacherPrompt: 'Monday: no breakfast, run outside 09:00–14:00. Tuesday: move breakfast to 08:45.' }, requireAI: true });
  assert.equal(generated.status, 201);
  let week = generated.body.week;
  assert.deepEqual(week.days[0].timeline.map(item => [item.start, item.end]), [['09:00', '14:00']]);
  assert.equal(week.days[1].timeline[0].start, '08:45');
  const preview = await post('/week/change/suggest', { date: week.days[1].date, scope: 'schedule', instruction: 'Breakfast at 08:45 followed by a five-hour run.', revision: week.revision });
  assert.equal(preview.status, 200);
  const applied = await post('/week/change/apply', { proposalId: preview.body.proposalId, revision: week.revision });
  assert.equal(applied.status, 200); week = applied.body.week;
  assert.equal(week.days[1].timeline[1].end, '14:15');
  assert.equal(week.days[0].timeline[0].end, '14:00');
  assert.equal(week.approval, null);
  const split = await post('/week/day/edit', { date: week.days[0].date, action: 'timeline', revision: week.revision,
    timeline: [row('morning', '09:00', '10:00', 'eco'), row('afternoon', '13:00', '14:00', 'eco')] });
  assert.equal(split.status, 200); week = split.body.week;
  for (const [clock, expected] of [['2026-09-21T05:00:00Z', 200], ['2026-09-21T09:00:00Z', 200], ['2026-09-21T13:00:00Z', 409]]) {
    t.mock.timers.setTime(Date.parse(clock));
    const checked = await post('/week/recheck', { revision: week.revision });
    assert.equal(checked.status, 200); week = checked.body.week;
    const approved = await post('/week/approve', { revision: week.revision });
    assert.equal(approved.status, expected, clock);
    if (approved.status === 200) week = approved.body.week;
  }
});
