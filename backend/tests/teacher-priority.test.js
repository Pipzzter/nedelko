import test from 'node:test';
import assert from 'node:assert/strict';
import { requestedTimings, validateRequestedTimings, planningDates } from '../domain/teacher-timing.js';
import { assignDailyTopics } from '../domain/teaching-brief.js';
import { teacherPlanningInstructions } from '../services/learning-guidance.js';
import { createCurriculum } from '../services/curriculum.js';
import { localCurriculum } from '../domain/curriculum.js';
import { DEFAULT_SETTINGS, pair } from '../domain/settings.js';
import { createWeek } from '../domain/week.js';
import { demoConditions } from '../services/conditions.js';
import { LOCATIONS } from '../config/index.js';

const dates = ['2026-09-21', '2026-09-22', '2026-09-23', '2026-09-24', '2026-09-25'];
const row = (start = '09:00', end = '14:00') => ({ id: 'run', start, end, kind: 'activity', label: pair('Трчање', 'Running'), note: pair('Трчаме со воспитувачот.', 'Run with the teacher.') });
const key = t => { const old = process.env.OPENAI_API_KEY; process.env.OPENAI_API_KEY = 'test-only'; t.after(() => {
  if (old === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = old;
}); };

test('English, Cyrillic and Latin Macedonian durations retain the requested weekday', () => {
  for (const brief of ['we should run for 5 hours in monday', 'Monday: a five-hour run.', 'Во понеделник да трчаме пет часа.', 'Sakam vo ponedelnik da trcame 5 chasa.', 'ponedelnik: trcanje pet casa.']) {
    const requirements = requestedTimings(brief, dates);
    assert.equal(requirements.length, 1, brief);
    assert.equal(requirements[0].date, dates[0]); assert.equal(requirements[0].durationMinutes, 300);
    assert.doesNotThrow(() => validateRequestedTimings([[row()]], dates, requirements));
    assert.throws(() => validateRequestedTimings([[row('09:00', '09:45')]], dates, requirements), { code: 'ai_invalid_output' });
    assert.throws(() => validateRequestedTimings([[], [row()]], dates, requirements), { code: 'ai_invalid_output' });
  }
  assert.equal(requestedTimings('vtornik: 30 minuti za muzika.', dates)[0].durationMinutes, 30);
  assert.equal(requestedTimings('среда: еден час игра.', dates)[0].durationMinutes, 60);
  assert.equal(requestedTimings('четврток: 1,5 часа игра.', dates)[0].durationMinutes, 90);
  assert.equal(requestedTimings('Friday: play for 1.5 hours.', dates)[0].durationMinutes, 90);
  assert.equal(requestedTimings('cetvrtok: 30 min igra.', dates)[0].date, dates[3]);
});

test('requested intervals and starts are checked after default-row overlap resolution', () => {
  const requirements = requestedTimings('Monday: run 09:00–14:00; Tuesday: breakfast at 8:45.', dates);
  assert.equal(requirements[0].end, '14:00'); assert.equal(requirements[1].start, '08:45');
  assert.doesNotThrow(() => validateRequestedTimings([[row()], [row('08:45', '09:15')]], dates, requirements));
  assert.throws(() => validateRequestedTimings([[{ ...row('08:30', '09:30'), id: 'breakfast' }, row()], [row('08:45', '09:15')]], dates, requirements), { code: 'ai_invalid_output' });
  assert.throws(() => validateRequestedTimings([], dates, requirements), { code: 'ai_invalid_output' });
  const history = [{ ...row('08:00', '10:00'), id: 'first' }, { ...row('09:00', '11:00'), id: 'second' }];
  const afterHistory = requestedTimings('Monday: run 11:00–16:00', dates);
  assert.doesNotThrow(() => validateRequestedTimings([[...history, row('11:00', '16:00')]], dates, afterHistory, [{ date: dates[0], lockedRows: history }]));
  const endOnly = requestedTimings('Run until 14:00.', [dates[1]], dates[0], dates[1]);
  assert.equal(endOnly[0].start, null); assert.equal(endOnly[0].end, '14:00');
  assert.doesNotThrow(() => validateRequestedTimings([[row()]], [dates[1]], endOnly));
  assert.equal(requestedTimings('Run for five hours.', [dates[1]], dates[0], dates[1])[0].date, dates[1]);
  assert.deepEqual(requestedTimings('Monday: run for 5 hours', dates, dates[1]), []);
});

test('ambiguous, negative and multi-day prose remains model context rather than a guessed time constraint', () => {
  for (const brief of ['Run for 5 hours.', 'Monday and Tuesday: run for 5 hours.', 'Monday: do not run for 5 hours.', 'Monday: draw for 30 minutes and run for 45 minutes.',
    'Monday: run for 0 hours.', 'Monday: play for 24 hours.', 'Monday: play for 1.1 minutes.', 'Monday: arrive 09:00 and finish 14:00.', 'Monday: 09:00 12:00 14:00',
    'Monday: discuss autumn leaves.', 'Monday: run for 5 hours. Actually run for 2 hours.', 'Monday: start after 09:00.', 'Monday: run for 5 hours. Monday: run for 2 hours.']) assert.deepEqual(requestedTimings(brief, dates), [], brief);
  assert.deepEqual(requestedTimings('Friday: 30 min art', [dates[0]]), []);
  assert.deepEqual(requestedTimings('30 minutes', dates, dates[0], '2026-10-01'), []);
  assert.deepEqual(planningDates(dates, dates[1]).map(day => [day.weekday.en, day.elapsed]), [['Monday', true], ['Tuesday', false], ['Wednesday', false], ['Thursday', false], ['Friday', false]]);
});

test('numbered days retain their numbers and global instructions are not literal topic text', () => {
  const topics = assignDailyTopics('Day 3: Water. Keep activities under 20 minutes. Day 1: Recycling.', dates);
  assert.deepEqual(topics.map(topic => [topic.date, topic.text]), [[dates[2], 'Water'], [dates[0], 'Recycling']]);
  assert.deepEqual(assignDailyTopics('Day 6: Unavailable.', dates), []);
  assert.deepEqual(assignDailyTopics('Day 2:\nWater. Keep it playful.', dates).map(topic => [topic.date, topic.text]), [[dates[1], 'Water']]);
  assert.equal(assignDailyTopics('One day about water', dates, dates[3])[0].date, dates[3]);
});

test('verbatim teacher requirements lead weekly instructions and reach the saved calendar', async t => {
  key(t); let sent; let short = false;
  const teacherPrompt = 'we should run for 5 hours in monday\nSakam ostanatite denovi da zboruvame za padot na lisjata.';
  const settings = { ...DEFAULT_SETTINGS, teacherPrompt };
  t.mock.method(globalThis, 'fetch', async (_url, options) => {
    sent = JSON.parse(options.body);
    const themes = localCurriculum(dates, settings).map((theme, index) => ({ ...theme, timeline: index ? [] : [row('09:00', short ? '09:45' : '14:00')], outdoorPreference: 'auto' }));
    return Response.json({ status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify({ themes, outdoorOrder: dates }) }] }] });
  });
  const generated = await createCurriculum(dates, settings);
  assert.equal(generated.source, 'ai', 'unrelated holiday requirements must not invalidate a teacher-directed plan');
  assert.ok(sent.instructions.startsWith("TEACHER'S PLAN REQUIREMENTS"));
  assert.ok(sent.instructions.includes(JSON.stringify(teacherPrompt)));
  assert.equal(JSON.parse(sent.input).teacherBrief, teacherPrompt);
  assert.equal(JSON.parse(sent.input).timingRequirements[0].durationMinutes, 300);
  assert.equal(JSON.parse(sent.input).calendarDays[0].weekday.en, 'Monday');
  assert.match(sent.instructions, /Latin-transliterated Macedonian/);
  const clock = '2026-09-21T05:00:00Z';
  const conditions = demoConditions(LOCATIONS[0], 'normal', Date.parse(clock), { clock, temperatures: [20,20,20,20,20,20,20], rainy: [], snowy: [], windy: [] });
  const week = createWeek(settings, generated, conditions);
  assert.deepEqual(week.days[0].timeline.map(item => [item.label.en, item.start, item.end]), [['Running', '09:00', '14:00']]);
  short = true;
  assert.equal((await createCurriculum(dates, settings)).generationIssue, 'ai_invalid_output');
  const revised = teacherPlanningInstructions('Use art.', 'Tuesday: use music instead.');
  assert.ok(revised.includes(JSON.stringify('Tuesday: use music instead.')));
  assert.match(revised, /latest change > teacher brief/);
});
