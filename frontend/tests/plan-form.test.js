import test from 'node:test';
import assert from 'node:assert/strict';
import { planIssues } from '../src/lib/plan-form.js';
import { DEFAULT_SETTINGS, validateSettings } from '../../backend/domain/settings.js';
import { PREFERENCE_BOUNDS } from '../../backend/domain/preferences.js';
import { LOCATIONS } from '../../backend/config/index.js';
const config={locations:LOCATIONS,preferenceBounds:PREFERENCE_BOUNDS};
const ready=()=>structuredClone({...DEFAULT_SETTINGS,gradinka:{name:'Sun Garden'},groupName:'Sunflowers',teacherPrompt:'Autumn through music and movement.'});
test('first-time planning identifies every missing essential and requires an explicit timetable review',()=>{
  assert.deepEqual(planIssues(DEFAULT_SETTINGS,config,false).map(i=>i.field),['teacherPrompt','rhythmConfirmed']);
  assert.deepEqual(planIssues(ready(),config,true),[]);
  const value=ready();value.materials=[];value.teacherPrompt='\n';
  assert.deepEqual(planIssues(value,config).map(i=>i.field),['teacherPrompt','materials']);
});
test('every canonical preference bound accepts and rejects the same values in the form and server', () => {
  assert.deepEqual(Object.keys(config.preferenceBounds).sort(), Object.keys(DEFAULT_SETTINGS.preferences).sort());
  for (const [key, { min, max }] of Object.entries(PREFERENCE_BOUNDS)) {
    for (const [number, accepted] of [[min, true], [max, true], [(min + max) / 2, true], [min - 0.1, false], [max + 0.1, false], [null, false], [NaN, false], [Infinity, false], [String(min), false]]) {
      const value = ready(); value.preferences[key] = number;
      assert.equal(!planIssues(value, config).some(issue => issue.key === 'checkWeatherPreferences' || issue.key === 'checkTemperatureOrder'), accepted, `${key}: ${number}`);
      if (accepted) assert.doesNotThrow(() => validateSettings(value));
      else assert.throws(() => validateSettings(value), { code: 'invalid_preferences' });
    }
  }
  const equal = ready(); equal.preferences.minApparentC = equal.preferences.maxApparentC = 20;
  assert.ok(planIssues(equal, config).some(issue => issue.key === 'checkTemperatureOrder'));
  assert.throws(() => validateSettings(equal), { code: 'invalid_preferences' });
});
test('form validation reads the supplied configuration instead of retaining literal weather limits', () => {
  const value = ready(); value.preferences.maxWindKmh = 24;
  const changed = { ...config, preferenceBounds: { ...PREFERENCE_BOUNDS, maxWindKmh: { min: 7, max: 23 } } };
  assert.deepEqual(planIssues(value, config), []);
  assert.ok(planIssues(value, changed).some(issue => issue.field === 'maxWindKmh'));
});
test('planning validates translations and time integrity while allowing any default routine',()=>{
  const value=ready();value.blocks[1].start='08:45';value.blocks[0].label.en='';
  assert.equal(planIssues(value,config).some(i=>i.key==='checkRoutineTimes'), false);
  assert.ok(planIssues(value,config).some(i=>i.key==='checkRoutineNames'));
  const full=ready();full.blocks=[{id:'all-day',start:'07:30',end:'16:00',label:{mk:'Рутина',en:'Routine'}}];
  assert.deepEqual(planIssues(full,config), []);
  const reversed=ready();reversed.dayEnd='06:30';
  assert.ok(planIssues(reversed,config).some(i=>i.key==='checkDayTimes'));
});

test('form and server agree on operating-window boundaries and malformed times', () => {
  const cases = [
    ['06:00', '09:00', null], ['16:00', '19:00', null], ['06:00', '19:00', null],
    ['05:59', '09:00', 'time_bounds'], ['16:00', '19:01', 'time_bounds'],
    ['07:30', '10:29', 'time_bounds'], ['10:30', '10:30', 'time_bounds'],
    ['16:00', '07:30', 'time_bounds'], ['7:30', '16:00', 'invalid_time'],
    ['07:60', '16:00', 'invalid_time'], ['07:30', '24:00', 'invalid_time'],
    ['', '16:00', 'invalid_time']
  ];
  for (const [dayStart, dayEnd, code] of cases) {
    const value = { ...ready(), dayStart, dayEnd };
    assert.equal(planIssues(value, config).some(issue => issue.key === 'checkDayTimes'), !!code, `${dayStart}-${dayEnd}`);
    if (code) assert.throws(() => validateSettings(value), { code });
    else assert.doesNotThrow(() => validateSettings(value));
  }
});

test('form and server agree on routine timing without imposing an overlap or day-containment policy', () => {
  const routine = { id: 'routine', kind: 'routine', label: { mk: 'Игра', en: 'Play' } };
  for (const [start, end, code] of [
    ['08:00', '08:01', null], ['06:00', '19:00', null],
    ['09:00', '09:00', 'time_bounds'], ['09:01', '09:00', 'time_bounds'],
    ['9:00', '10:00', 'invalid_time'], ['09:00', '10:60', 'invalid_time']
  ]) {
    const value = { ...ready(), blocks: [{ ...routine, start, end }] };
    assert.equal(planIssues(value, config).some(issue => issue.key === 'checkRoutineTimes'), !!code, `${start}-${end}`);
    if (code) assert.throws(() => validateSettings(value), { code });
    else assert.doesNotThrow(() => validateSettings(value));
  }
  const overlapping = [
    { ...routine, id: 'first', start: '08:00', end: '10:00' },
    { ...routine, id: 'second', start: '09:00', end: '11:00' }
  ];
  for (const blocks of [[], overlapping]) {
    const value = { ...ready(), blocks };
    assert.deepEqual(planIssues(value, config), []);
    assert.doesNotThrow(() => validateSettings(value), 'routine preferences are inputs, not the final generated timetable');
  }
});

test('form and server agree that outdoor-day counts must be integers from zero to five', () => {
  for (const [outdoorDays, accepted] of [[0, true], [5, true], [-1, false], [6, false], [2.5, false], ['2', false], [null, false]]) {
    const value = { ...ready(), outdoorDays };
    assert.equal(planIssues(value, config).some(issue => issue.key === 'requiredOutdoorDays'), !accepted, String(outdoorDays));
    if (accepted) assert.doesNotThrow(() => validateSettings(value));
    else assert.throws(() => validateSettings(value), { code: 'invalid_outdoor_days' });
  }
});
