import test from 'node:test';
import assert from 'node:assert/strict';
import { validateView } from '../src/lib/view-data.js';
import { DEFAULT_SETTINGS } from '../../backend/domain/settings.js';
import { createWeek, dashboard } from '../../backend/domain/week.js';
import { parentView } from '../../backend/domain/parent-view.js';
import { localCurriculum } from '../../backend/domain/curriculum.js';
import { planningWeekDates } from '../../backend/domain/planner.js';
import { demoConditions } from '../../backend/services/conditions.js';
import { LOCATIONS } from '../../backend/config/index.js';

test('teacher and parent response shapes validate before state changes; malformed nesting is rejected', () => {
  const c = demoConditions(LOCATIONS[0], 'normal', Date.parse('2026-09-21T06:45:00Z'));
  const week = createWeek(DEFAULT_SETTINGS, { themes: localCurriculum(planningWeekDates(c.clock), DEFAULT_SETTINGS) }, c);
  const row = week.days[0].timeline[0]; row.lesson = week.days[0].theme;
  row.variants = { inside: row.lesson.inside, outside: row.lesson.outside };
  const teacher = dashboard(week, c); const parent = parentView(week, Date.parse(c.clock) + 1000, c);
  assert.equal(validateView(teacher), teacher); assert.equal(validateView(parent, true), parent);
  assert.doesNotThrow(() => validateView(dashboard(null, c)));
  for (const mutate of [value => { value.clock = 'bad'; }, value => { value.environment = null; },
    value => { value.calendar = [null]; }, value => { value.week.days[0].timeline = {}; },
    value => { value.week.days[0].timeline[0].label = {}; }, value => { value.week.days[0].theme.inside = {}; },
    value => { value.week.days[0].timeline[0].variants = {}; }, value => { value.week.days[0].timeline[0].note = []; }]) {
    const value = structuredClone(teacher); mutate(value);
    assert.throws(() => validateView(value), { code: 'unexpected_error' });
  }
  assert.throws(() => validateView({ ...parent, days: [null] }, true), { code: 'unexpected_error' });
});
