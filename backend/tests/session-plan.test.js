import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_SETTINGS, pair } from '../domain/settings.js';
import { createWeek, adaptWeek, dailyPlanningContext } from '../domain/week.js';
import { demoConditions } from '../services/conditions.js';
import { localCurriculum } from '../domain/curriculum.js';
import { validateSessions, titleKey } from '../domain/session-plan.js';
import { LOCATIONS } from '../config/index.js';
import { planningWeekDates } from '../domain/planner.js';

test('library days never reuse a generated title around meals or the eco lesson', () => {
  const conditions = demoConditions(LOCATIONS[0], 'normal');
  const dates = planningWeekDates(conditions.clock);
  let week = createWeek(DEFAULT_SETTINGS, { themes: localCurriculum(dates, DEFAULT_SETTINGS), source: 'library' }, conditions);
  for (let repeat = 0; repeat < 2; repeat++) {
    for (const day of week.days) for (const lang of ['mk', 'en']) {
      const titles = day.timeline.filter(row => ['activity', 'eco'].includes(row.kind)).map(row => titleKey(row.label[lang]));
      assert.equal(new Set(titles).size, titles.length, `${day.date} ${lang}`);
    }
    week = adaptWeek(week, conditions);
  }
});

test('whole-day session output must cover exact slots once with distinct bilingual activities', () => {
  const conditions = demoConditions(LOCATIONS[0], 'normal'); const dates = planningWeekDates(conditions.clock);
  const themes = localCurriculum(dates, DEFAULT_SETTINGS); const planningDays = dailyPlanningContext(dates, DEFAULT_SETTINGS, conditions);
  const sessions = planningDays.flatMap(day => day.slots.filter(row => row.kind === 'activity').map((row, i) => ({ date: day.date, slotId: row.id,
    title: pair(`Игра ${day.date} ${i}`, `Game ${day.date} ${i}`), description: pair('Со воспитувачот редиме форми.', 'With the teacher, arrange shapes.') })));
  const validated = validateSessions(sessions, planningDays, themes, dates);
  assert.throws(() => validateSessions(sessions.slice(1), planningDays, themes, dates));
  const duplicate = structuredClone(sessions); duplicate[1].title.en = duplicate[0].title.en;
  assert.throws(() => validateSessions(duplicate, planningDays, themes, dates), { code: 'duplicate_activity' });
  const extra = structuredClone(sessions); extra[0].slotId = 'breakfast';
  assert.throws(() => validateSessions(extra, planningDays, themes, dates));
  const week = createWeek(DEFAULT_SETTINGS, { themes, sessions: validated, source: 'ai' }, conditions);
  const refreshed = adaptWeek(week, demoConditions(LOCATIONS[0], 'polluted'));
  for (const item of sessions) {
    const row = refreshed.days.find(day => day.date === item.date).timeline.find(row => row.id === item.slotId);
    if (row.occasionIds?.length) continue;
    assert.deepEqual(row.label, item.title); assert.deepEqual(row.note, item.description);
  }
});
