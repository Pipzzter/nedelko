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
