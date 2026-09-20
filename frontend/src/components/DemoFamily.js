import { html, useState, text } from '../lib/ui.js';
import { t, errorText, parentReason } from '../locales/index.js';
import { ChildAvatar, DailyRecords, Conversation } from './DemoExperience.js';
import { Icon } from './Icon.js';

export function DemoFamily({family,day,lang,onAction}) {
  const [panel,setPanel]=useState('children'); const [busy,setBusy]=useState(false); const [error,setError]=useState(''); const [pendingBag,setPendingBag]=useState(null);
  const run=async action=>{
    setBusy(true);setError('');
    try{return await onAction({...action,classroomRevision:family.revision});}
    catch(err){setError(errorText(err.code,lang));}
    finally{setBusy(false);}
  };
  return html`<div class="demo-family"><div class="family-navigation" role="group" aria-label=${t('parentView',lang)}><button class=${panel==='children'?'active':''} aria-pressed=${panel==='children'} onClick=${()=>setPanel('children')}><${Icon} name="people" size=${18}/>${t('familyDays',lang)}</button><button class=${panel==='messages'?'active':''} aria-pressed=${panel==='messages'} onClick=${()=>setPanel('messages')}><${Icon} name="message" size=${18}/>${t('familyInbox',lang)}</button><button onClick=${()=>document.getElementById('family-week')?.scrollIntoView()}><${Icon} name="calendar" size=${18}/>${t('groupWeek',lang)}</button></div>
    ${error&&html`<p class="alert error" role="alert">${error}</p>`}
    ${panel==='messages'?html`<${Conversation} classroom=${family} role="parent" lang=${lang} busy=${busy} onAction=${run}/>`:html`
      <section class="family-day-update"><span class=${`update-symbol ${day?.mode==='inside'?'inside':''}`}><${Icon} name=${day?.mode==='outside'?'sun':'home'} size=${27}/></span><div><span class="eyebrow">${t('familyUpdate',lang)}</span><h2>${text(day?.title,lang)||t('groupWeek',lang)}</h2><p>${parentReason(day?.reason,lang)}</p></div><button class="button secondary" disabled=${busy||family.acknowledged} onClick=${()=>run({action:'acknowledge',noticeKey:family.noticeKey})}><${Icon} name="check" size=${16}/>${t(family.acknowledged?'updateAcknowledged':'acknowledgeUpdate',lang)}</button></section>
      <div class="family-section-heading"><div><span class="eyebrow">${text(family.group,lang)} · ${text(family.room,lang)}</span><h2>${t('familyDemoChildren',lang)}</h2></div><span class="family-heart" aria-hidden="true">✿</span></div>
      <div class="family-children">${family.children.map(child=>html`<${FamilyChild} key=${child.id} child=${child} lang=${lang} busy=${busy} onAction=${run}/>` )}</div>
      <div class="family-support-grid"><section class="card packing-card"><div class="card-heading"><div><span class="eyebrow">${family.bag.filter(item=>item.packed).length}/${family.bag.length} ${t('packedCount',lang)}</span><h2>${t('packingList',lang)}</h2></div><${Icon} name="check" size=${24}/></div><div>${family.bag.map(item=>html`<label class=${`packing-item ${item.packed?'packed':''}`}><input type="checkbox" checked=${pendingBag?.id===item.id?pendingBag.packed:item.packed} disabled=${busy} onChange=${async e=>{const packed=e.currentTarget.checked;setPendingBag({id:item.id,packed});try{await run({action:'bag',itemId:item.id,packed});}finally{setPendingBag(null);}}}/><span>${text(item.label,lang)}</span></label>`)}</div></section>
        <section class="card teacher-contact"><span class="eyebrow">${t('teacherTeam',lang)}</span><div class="teacher-profile"><span class="teacher-avatar">${family.teacher.initials}</span><div><h3>${text(family.teacher.name,lang)}</h3><p>${text(family.teacher.role,lang)} · ${family.teacher.experienceYears} ${t('experienceYears',lang)}</p></div></div><p class="soft-note">${text(family.assistant.name,lang)} · ${text(family.assistant.role,lang)}<br/>${family.teacher.hours}</p><button class="button secondary" onClick=${()=>setPanel('messages')}>${t('messageTeacher',lang)}<${Icon} name="message" size=${16}/></button></section>
      </div>
      <section class="family-menu"><div><${Icon} name="meal" size=${22}/><h3>${t('menuToday',lang)}</h3></div><p><b>${t('mealBreakfast',lang)}:</b> ${t('breakfastMenu',lang)}<br/><b>${t('mealLunch',lang)}:</b> ${t('lunchMenu',lang)}</p><small>${t('menuNote',lang)}</small></section>
    `}</div>`;
}
function FamilyChild({child,lang,busy,onAction}) {
  const [reason,setReason]=useState('family-day');
  return html`<article class=${`card family-child tone-${child.color}`}><div class="family-child-header"><${ChildAvatar} child=${child} large/><div><h3>${text(child.name,lang)}</h3><span>${Math.floor(child.ageMonths/12)} ${t('years',lang)} · ${text(child.interests,lang)}</span></div><span class=${`attendance-pill ${child.attendance}`}>${t(`attendance_${child.attendance}`,lang)}</span></div>
    <div class="family-child-times"><span>${child.arrival?`${t('arrivalTime',lang)} ${child.arrival}`:t(`attendance_${child.attendance}`,lang)}</span><span>${child.departure?`${t('departureTime',lang)} ${child.departure}`:`${t('pickupTime',lang)} ${child.pickupAt}`}</span></div>
    <${DailyRecords} child=${child} lang=${lang}/><div class="child-discovery"><span class="eyebrow">${t('littleDiscovery',lang)}</span><p>${text(child.log.note,lang)}</p></div>
    <details class="family-child-more"><summary>${t('childDetails',lang)}</summary><p><b>${t('learningFocus',lang)}</b><br/>${text(child.goal,lang)}</p><p><b>${t('familyInstructions',lang)}</b><br/>${text(child.care,lang)}</p></details>
    ${['expected','absent'].includes(child.attendance)&&html`<div class="absence-control">${child.absence?html`<p>${t('absenceReported',lang)} ${t(`absence_${child.absence.reason}`,lang)}</p><button class="button quiet" disabled=${busy} onClick=${()=>onAction({action:'absence',childId:child.id,value:'cancel'})}>${t('cancelAbsence',lang)}</button>`:html`<label>${t('absenceReason',lang)}<select value=${reason} disabled=${busy} onChange=${e=>setReason(e.currentTarget.value)}><option value="family-day">${t('absence_family-day',lang)}</option><option value="appointment">${t('absence_appointment',lang)}</option></select></label><button class="button secondary" disabled=${busy} onClick=${()=>onAction({action:'absence',childId:child.id,value:reason})}>${t('reportAbsence',lang)}</button>`}</div>`}
  </article>`;
}
