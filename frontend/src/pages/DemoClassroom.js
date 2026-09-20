import { html, useState, useEffect, text, localizedDate } from '../lib/ui.js';
import { t } from '../locales/index.js';
import { ChildAvatar } from '../components/DemoExperience.js';
import { Icon } from '../components/Icon.js';

export function DemoClassroom({classroom,lang,busy,onAction}) {
  const [search,setSearch]=useState(''); const [filter,setFilter]=useState('all'); const [selected,setSelected]=useState(classroom.children[0].id);
  const children=classroom.children.filter(c=>(filter==='all'||c.attendance===filter)&&`${c.name.mk} ${c.name.en}`.toLocaleLowerCase().includes(search.toLocaleLowerCase()));
  const child=classroom.children.find(c=>c.id===selected);
  return html`<div class="classroom-page"><div class="classroom-toolbar"><label class="roster-search">${t('searchChildren',lang)}<input type="search" placeholder=${t('searchPlaceholder',lang)} value=${search} onInput=${e=>setSearch(e.currentTarget.value)}/></label><button class="button secondary" disabled=${busy||!classroom.counts.expected} onClick=${()=>onAction({action:'check-in-expected'})}>${t('checkInExpected',lang)} (${classroom.counts.expected})</button></div>
    <div class="roster-filters" role="group" aria-label=${t('attendanceLabel',lang)}>${['all','present','expected','absent','collected'].map(status=>html`<button class=${filter===status?'active':''} aria-pressed=${filter===status} onClick=${()=>setFilter(status)}>${t(status==='all'?'attendanceAll':`attendance_${status}`,lang)}<span>${status==='all'?classroom.children.length:classroom.counts[status]}</span></button>`)}</div>
    <div class="roster-layout"><section class="roster-grid" aria-label=${t('ourClass',lang)}>${children.length?children.map(c=>html`<button key=${c.id} class=${`child-card ${c.id===selected?'selected':''}`} aria-pressed=${c.id===selected} onClick=${()=>setSelected(c.id)}><${ChildAvatar} child=${c}/><span><b>${text(c.name,lang)}</b><small>${Math.floor(c.ageMonths/12)} ${t('years',lang)} · ${c.ageMonths%12} ${t(c.ageMonths%12===1?'ageMonth':'ageMonths',lang)}</small></span><span class=${`attendance-pill ${c.attendance}`}>${t(`attendance_${c.attendance}`,lang)}</span></button>`):html`<p class="empty-day">${t('noChildren',lang)}</p>`}</section>
      <${ChildDetail} key=${child.id} child=${child} availability=${classroom.logAvailability} lang=${lang} busy=${busy} onAction=${onAction}/>
    </div></div>`;
}
function ChildDetail({child,availability,lang,busy,onAction}) {
  const [note,setNote]=useState(text(child.log.note,lang)); const [saved,setSaved]=useState(false); const [dirty,setDirty]=useState(false);
  useEffect(()=>{if(!dirty)setNote(text(child.log.note,lang));},[text(child.log.note,lang),lang,dirty]);
  const canLog=['present','collected'].includes(child.attendance);
  const update=(action)=>onAction({...action,childId:child.id});
  return html`<aside class="card child-detail" aria-label=${t('childDetails',lang)}><div class="child-detail-header"><${ChildAvatar} child=${child} large/><div><span class="eyebrow">${t('childProfile',lang)}</span><h2>${text(child.name,lang)}</h2><span class=${`attendance-pill ${child.attendance}`}>${t(`attendance_${child.attendance}`,lang)}</span></div></div>
    <div class="attendance-actions">${child.attendance!=='present'&&child.attendance!=='collected'?html`<button class="button primary" disabled=${busy} onClick=${()=>update({action:'attendance',value:'present'})}>${t('checkIn',lang)}</button>`:child.attendance==='present'?html`<button class="button secondary" disabled=${busy} onClick=${()=>update({action:'attendance',value:'collected'})}>${t('checkOut',lang)}</button>`:null}
      ${child.attendance==='expected'&&html`<button class="button quiet" disabled=${busy} onClick=${()=>update({action:'attendance',value:'absent'})}>${t('markAbsent',lang)}</button>`}
      ${child.attendance==='absent'&&html`<button class="button quiet" disabled=${busy} onClick=${()=>update({action:'attendance',value:'expected'})}>${t('markExpected',lang)}</button>`}</div>
    <dl class="child-facts"><div><dt>${t('birthday',lang)}</dt><dd>${localizedDate(child.birthday,lang,{day:'numeric',month:'long'})}</dd></div><div><dt>${t('pickupTime',lang)}</dt><dd>${child.pickupAt}</dd></div><div><dt>${t('familyContact',lang)}</dt><dd>${text(child.guardian,lang)}</dd></div>${child.arrival&&html`<div><dt>${t('arrivalTime',lang)}</dt><dd>${child.arrival}</dd></div>`}${child.departure&&html`<div><dt>${t('departureTime',lang)}</dt><dd>${child.departure}</dd></div>`}</dl>
    <div class="child-interest"><${Icon} name="activity" size=${19}/><div><b>${t('childInterests',lang)}</b><p>${text(child.interests,lang)}</p></div></div>
    <div class="child-focus"><span class="eyebrow">${t('learningFocus',lang)}</span><p>${text(child.goal,lang)}</p></div>
    <details class="care-details"><summary>${t('familyInstructions',lang)}</summary><p>${text(child.care,lang)}</p>${child.absence&&html`<p>${t('absenceReported',lang)} ${t(`absence_${child.absence.reason}`,lang)}</p>`}</details>
    <section class="child-log"><h3>${t('dailyLog',lang)}</h3><p class="soft-note">${t(canLog?'logHelp':'logAttendanceFirst',lang)}</p><p class="soft-note">${t('demoLogTiming',lang)}</p><div class="log-fields">${[['breakfast','mealBreakfast'],['lunch','mealLunch'],['rest','restLog']].map(([field,label])=>html`<label>${t(label,lang)}<select value=${child.log[field]} disabled=${busy||!canLog||!availability[field]} onChange=${e=>update({action:'daily-log',field,value:e.currentTarget.value})}>${(field==='rest'?['pending','slept','quiet']:['pending','all','some','declined']).map(value=>html`<option value=${value}>${t(`log_${value}`,lang)}</option>`)}</select></label>`)}</div>
      <form onSubmit=${async e=>{e.preventDefault();const result=await update({action:'daily-log',field:'note',value:note});if(result){setSaved(true);setDirty(false);}}}><label>${t('littleDiscovery',lang)}<textarea rows="3" maxlength="500" value=${note} disabled=${busy||!canLog} onInput=${e=>{setNote(e.currentTarget.value);setSaved(false);setDirty(true);}}/></label><button class="button secondary" disabled=${busy||!canLog||!note.trim()}>${t('saveDiscovery',lang)}</button><small role="status">${saved?t('demoSaved',lang):''}</small></form>
    </section></aside>`;
}
