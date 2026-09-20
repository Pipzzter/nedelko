import test from 'node:test';
import assert from 'node:assert/strict';
import { assignDailyTopics, dailyTopics, validateTopicCoverage } from '../domain/teaching-brief.js';
import { createCurriculum } from '../services/curriculum.js';
import { localCurriculum } from '../domain/curriculum.js';
import { DEFAULT_SETTINGS } from '../domain/settings.js';
import { occasionsForWeek } from '../domain/holidays.js';

const brief = `one days talking about good habits,
one day about healthy food
one day about recycling
one day about how important is to excercise
one day about how important is to save electricity`;
const dates = ['2026-11-16', '2026-11-17', '2026-11-18', '2026-11-19', '2026-11-20'];

test('all five requested daily topics survive newlines and legacy flattened briefs', () => {
  assert.deepEqual(dailyTopics(brief).map(t => t.text), ['good habits', 'healthy food', 'recycling', 'how important is to excercise', 'how important is to save electricity']);
  assert.deepEqual(dailyTopics(brief.replaceAll('\n', ' ')), dailyTopics(brief));
  assert.deepEqual(assignDailyTopics(brief, dates).map(t => t.date), dates);
  assert.ok(assignDailyTopics(brief, dates, dates[2]).every(t => t.date >= dates[2]));
  assert.deepEqual(dailyTopics('Explore autumn through music and movement.'), []);
});

test('a model response that ignores a requested topic cannot be accepted as an AI plan', async t => {
  const old = process.env.OPENAI_API_KEY; process.env.OPENAI_API_KEY = 'test-only';
  t.after(() => { if (old === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = old; });
  const settings = { ...DEFAULT_SETTINGS, teacherPrompt: brief };
  const themes = localCurriculum(dates, settings);
  let sent;
  t.mock.method(globalThis, 'fetch', async (_url, options) => {
    sent = JSON.parse(options.body);
    return Response.json({ status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify({ themes, outdoorOrder: dates }) }] }] });
  });
  assert.equal((await createCurriculum(dates, settings)).generationIssue, 'ai_invalid_output');
  assert.equal(JSON.parse(sent.input).topicAssignments.length, 5);
  for (const topic of assignDailyTopics(brief, dates)) {
    const theme = themes[dates.indexOf(topic.date)];
    for (const field of ['inside', 'outside']) theme[field].en = `With the teacher, explore ${topic.text} through a shared drawing and discussion.`;
  }
  occasionsForWeek(dates).forEach((events, index) => {
    if (events.length) themes[index].title = events[0].name;
    for (const lang of ['mk', 'en']) for (const field of ['inside', 'outside']) {
      themes[index][field][lang] += events.map(event => ` ${event.name[lang]}`).join('');
    }
  });
  assert.doesNotThrow(() => validateTopicCoverage(themes, dates, assignDailyTopics(brief, dates)));
  assert.equal((await createCurriculum(dates, settings)).source, 'ai');
  themes[2].outside.en = 'An unrelated game.';
  assert.equal((await createCurriculum(dates, settings)).source, 'library');
});
