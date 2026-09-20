import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createApp } from '../http/app.js';
import { openStore } from '../storage/database.js';
import { demoConditions } from '../services/conditions.js';
import { createCurriculum } from '../services/curriculum.js';
import { LOCATIONS } from '../config/index.js';
import { demoWeekById } from '../config/demo.js';

async function setup(t, demoWeek='independence') {
  const store=openStore(':memory:');
  const server=createApp({store, conditionsProvider:async ({locationId='centar',scenario='normal',demoWeek})=>demoConditions(LOCATIONS.find(l=>l.id===locationId),scenario,Date.now(),demoWeekById(demoWeek)),
    curriculumProvider:(dates,settings,options)=>createCurriculum(dates,settings,{...options,useAI:false})});
  server.listen(0,'127.0.0.1');await once(server,'listening');
  t.after(()=>new Promise(resolve=>{server.close(resolve);server.closeAllConnections();}));
  const base=`http://127.0.0.1:${server.address().port}`;
  const request=async(path,body)=>{const r=await fetch(base+path,{method:body?'POST':'GET',headers:{'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});return {status:r.status,body:await r.json()};};
  const demo=(await request('/api/demo',{demoWeek})).body;
  const familyPath='/api/parents/'+demo.share.path.split('/').at(-1);
  return {request,demo,familyPath,store};
}

test('teacher demo has 30 fictional profiles; family projection contains only its two children',async t=>{
  const {request,demo,familyPath,store}=await setup(t);
  const classroom=demo.demoClassroom;
  assert.equal(classroom.children.length,30);assert.equal(new Set(classroom.children.map(c=>c.id)).size,30);
  assert.deepEqual(classroom.counts,{present:26,expected:2,absent:2,collected:0});
  assert.equal(classroom.teacher.name.en,'Elena Stojanovska');
  const family=(await request(familyPath)).body.demoFamily;
  assert.deepEqual(family.children.map(c=>c.id),['child-01','child-02']);
  assert.equal(family.children[0].name.en,'Mila Petrovska');assert.equal(family.children[1].name.en,'Luka Petrovski');
  assert.doesNotMatch(JSON.stringify(family),/Sofija|child-03|password|generationError|teacherPath/);
  assert.equal(store.db.prepare('SELECT COUNT(*) AS n FROM users').get().n,0);
  assert.equal(store.db.prepare('SELECT COUNT(*) AS n FROM weeks').get().n,0);
});

test('attendance and daily records reach the parent, while future meal records and parent staff actions are rejected',async t=>{
  const {request,demo,familyPath}=await setup(t);let revision=demo.demoClassroom.revision;
  const teacher=async action=>{const result=await request('/api/demo/classroom',{demoId:demo.demoId,classroomRevision:revision,...action});if(result.status===200)revision=result.body.demoClassroom.revision;return result;};
  assert.equal((await teacher({action:'attendance',childId:'child-02',value:'present'})).status,200);
  assert.equal((await teacher({action:'daily-log',childId:'child-02',field:'breakfast',value:'some'})).status,200);
  assert.equal((await teacher({action:'daily-log',childId:'child-02',field:'lunch',value:'all'})).body.error,'demo_log_not_started');
  assert.equal((await teacher({action:'daily-log',childId:'child-02',field:'note',value:'Luka built a garden with a friend.'})).status,200);
  let family=(await request(familyPath)).body.demoFamily;
  assert.equal(family.children[1].attendance,'present');assert.equal(family.children[1].arrival,'08:45');
  assert.equal(family.children[1].log.breakfast,'some');assert.match(family.children[1].log.note,/built a garden/);
  assert.equal((await request(familyPath+'/demo',{classroomRevision:revision,action:'attendance',childId:'child-02',value:'collected'})).status,400);
  assert.equal((await request(familyPath+'/demo',{classroomRevision:revision,action:'absence',childId:'child-03',value:'family-day'})).status,404);
  assert.equal((await teacher({action:'attendance',childId:'child-02',value:'collected'})).status,200);
  family=(await request(familyPath)).body.demoFamily;
  assert.equal(family.children[1].departure,'08:45');
});

test('parent absence, checklist and messages round-trip, with optimistic conflict protection',async t=>{
  const {request,demo,familyPath}=await setup(t);let family=(await request(familyPath)).body.demoFamily;
  const parent=async action=>{const result=await request(familyPath+'/demo',{classroomRevision:family.revision,...action});if(result.status===200)family=result.body.demoFamily;return result;};
  assert.equal((await parent({action:'absence',childId:'child-02',value:'appointment'})).status,200);
  assert.equal(family.children[1].attendance,'absent');
  const teacherState=(await request(`/api/demo/classroom?demoId=${demo.demoId}`)).body.demoClassroom;
  assert.deepEqual(teacherState.counts,{present:26,expected:1,absent:3,collected:0});
  const stale=await request('/api/demo/classroom',{demoId:demo.demoId,classroomRevision:1,action:'check-in-expected'});
  assert.equal(stale.status,409);
  await parent({action:'absence',childId:'child-02',value:'cancel'});
  assert.equal(family.children[1].attendance,'expected');
  await parent({action:'bag',itemId:'layers',packed:true});assert.equal(family.bag.find(i=>i.id==='layers').packed,true);
  await parent({action:'message',content:'We packed both water bottles.'});
  const teacherRead=(await request(`/api/demo/classroom?demoId=${demo.demoId}`)).body.demoClassroom;
  assert.equal(teacherRead.messages.at(-1).content,'We packed both water bottles.');
  await request('/api/demo/classroom',{demoId:demo.demoId,classroomRevision:teacherRead.revision,action:'message',content:'Thank you, Ana!'});
  family=(await request(familyPath)).body.demoFamily;
  assert.equal(family.messages.at(-1).content,'Thank you, Ana!');
  assert.equal((await parent({action:'message',content:'<script>alert(1)</script>'})).status,400);
});

test('pollution invalidates a family acknowledgement and survives a role switch without resetting classroom data',async t=>{
  const {request,demo,familyPath}=await setup(t);
  const original=(await request(familyPath)).body.demoFamily;
  await request(familyPath+'/demo',{classroomRevision:original.revision,action:'acknowledge',noticeKey:original.noticeKey});
  assert.equal((await request(familyPath)).body.demoFamily.acknowledged,true);
  const polluted=(await request(`/api/dashboard?demoId=${demo.demoId}&scenario=polluted`)).body;
  assert.equal(polluted.week.days[0].mode,'inside');
  const changed=(await request(familyPath)).body;
  assert.equal(changed.demoFamily.acknowledged,false);
  assert.match(changed.days[0].message.en,/elevated PM2.5/);
  assert.equal((await request(familyPath+'/demo',{classroomRevision:changed.demoFamily.revision,action:'acknowledge',noticeKey:original.noticeKey})).status,409);
  const resumed=(await request(`/api/dashboard?demoId=${demo.demoId}`)).body;
  assert.equal(resumed.demoScenario,'polluted');assert.equal(resumed.week.days[0].mode,'inside');
  assert.equal(resumed.demoClassroom.children.length,30);
});

test('afternoon example has elapsed lunch/rest records and independent demos do not share mutations',async t=>{
  const {request,demo,familyPath}=await setup(t,'autumn-afternoon');
  assert.match(demo.clock,/T12:30/);assert.equal(demo.week.weekStart,'2026-10-05');
  assert.deepEqual(demo.demoClassroom.logAvailability,{breakfast:true,lunch:true,rest:true});
  const family=(await request(familyPath)).body.demoFamily;
  assert.equal(family.children[0].log.lunch,'all');assert.equal(family.children[1].attendance,'present');
  const changed=await request('/api/demo/classroom',{demoId:demo.demoId,classroomRevision:1,action:'daily-log',childId:'child-01',field:'rest',value:'slept'});
  assert.equal(changed.status,200);
  const another=(await request('/api/demo',{demoWeek:'spring-garden'})).body;
  assert.equal(another.week.weekStart,'2026-05-11');assert.equal(another.demoClassroom.children[0].log.rest,'pending');
  assert.notEqual(another.share.path,demo.share.path);
  assert.equal((await request(familyPath)).body.demoFamily.children[0].log.rest,'slept');
});
