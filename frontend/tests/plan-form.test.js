import test from 'node:test';
import assert from 'node:assert/strict';
import { planIssues } from '../src/lib/plan-form.js';
import { DEFAULT_SETTINGS } from '../../backend/domain/settings.js';
import { LOCATIONS } from '../../backend/config/index.js';
const config={locations:LOCATIONS};
const ready=()=>structuredClone({...DEFAULT_SETTINGS,gradinka:{name:'Sun Garden'},groupName:'Sunflowers',teacherPrompt:'Autumn through music and movement.'});
test('first-time planning identifies every missing essential and requires an explicit timetable review',()=>{
  assert.deepEqual(planIssues(DEFAULT_SETTINGS,config,false).map(i=>i.field),['teacherPrompt','rhythmConfirmed']);
  assert.deepEqual(planIssues(ready(),config,true),[]);
  const value=ready();value.materials=[];value.teacherPrompt='\n';
  assert.deepEqual(planIssues(value,config).map(i=>i.field),['teacherPrompt','materials']);
});
test('planning finds overlaps, missing translations and insufficient activity space before generation',()=>{
  const value=ready();value.blocks[1].start='08:45';value.blocks[0].label.en='';
  assert.ok(planIssues(value,config).some(i=>i.key==='checkRoutineTimes'&&i.field==='routine-snack'));
  assert.ok(planIssues(value,config).some(i=>i.key==='checkRoutineNames'));
  const full=ready();full.blocks=[{id:'all-day',start:'07:30',end:'16:00',label:{mk:'Рутина',en:'Routine'}}];
  assert.ok(planIssues(full,config).some(i=>i.key==='checkActivitySpace'));
  const reversed=ready();reversed.dayEnd='06:30';
  assert.ok(planIssues(reversed,config).some(i=>i.key==='checkDayTimes'));
});
