import { html, useState, useEffect, text } from '../lib/ui.js';
import { t, errorText } from '../locales/index.js';
import { Icon } from './Icon.js';

export function ChildAvatar({child, large=false}) {
  return html`<span class=${`child-avatar tone-${child.color || 0} ${large ? 'large' : ''}`} aria-hidden="true">${child.initials}<span class="avatar-spark">✦</span></span>`;
}
export function DemoRoleBar({role, teacherPath, parentPath, lang}) {
  return html`<aside class="demo-role-bar"><div><b>${t('demoRoles',lang)}</b><p>${t('fictionalDemo',lang)}</p></div><nav aria-label=${t('demoRoles',lang)}>
    <a class=${role==='teacher'?'active':''} aria-current=${role==='teacher'?'page':undefined} href=${teacherPath}><${Icon} name="people" size=${16}/>${t('teacherDemo',lang)}</a>
    <a class=${role==='parent'?'active':''} aria-current=${role==='parent'?'page':undefined} href=${parentPath}><${Icon} name="home" size=${16}/>${t('parentDemo',lang)}</a>
  </nav></aside>`;
}
export function ClassroomSummary({classroom,lang,onClass,onInbox}) {
  return html`<section class="classroom-welcome"><div class="classroom-welcome-copy"><span class="eyebrow">${text(classroom.group,lang)} · ${text(classroom.room,lang)}</span><h2>${t('teacherGreeting',lang)}</h2><p>${t('demoExplorePrompt',lang)}</p><div class="welcome-actions"><button class="button primary" onClick=${onClass}><${Icon} name="people" size=${17}/>${t('viewClass',lang)}</button><button class="button secondary" onClick=${onInbox}>${t('familyInbox',lang)}<${Icon} name="arrow" size=${17}/></button></div></div><div class="attendance-summary">${['present','expected','absent'].map(status=>html`<button class=${`attendance-stat ${status}`} onClick=${onClass}><b>${classroom.counts[status]}</b><span>${t(`attendance_${status}`,lang)}</span></button>`)}</div></section>`;
}
export function Conversation({classroom,role,lang,busy,onAction}) {
  const [draft,setDraft]=useState(''); const [error,setError]=useState(''); const [sent,setSent]=useState(false); const [sending,setSending]=useState(false);
  const submit=async e=>{
    e.preventDefault(); if (!draft.trim()) return;
    setSending(true); setError(''); setSent(false);
    try { const result=await onAction({action:'message',content:draft}); if(result) {setDraft('');setSent(true);} }
    catch(err) {setError(errorText(err.code,lang));}
    finally {setSending(false);}
  };
  return html`<section class="card conversation"><div class="card-heading"><div><span class="eyebrow">${t('familyConnected',lang)}</span><h2>${text(role==='teacher'?classroom.family.label:classroom.teacher.name,lang)}</h2><p class="soft-note">${t('conversationHelp',lang)}</p></div><span class="conversation-icon"><${Icon} name="message" size=${25}/></span></div>
    <ol class="conversation-messages" aria-label=${t('familyInbox',lang)}>${classroom.messages.map(message=>html`<li key=${message.id} class=${message.sender===role?'own':'received'}><div><b>${message.sender===role?t('you',lang):text(message.sender==='teacher'?classroom.teacher.name:classroom.family.name,lang)}</b><time>${message.time}</time></div><p>${text(message.content,lang)}</p></li>`)}</ol>
    <form onSubmit=${submit}><label>${t(role==='teacher'?'messageFamily':'messageTeacher',lang)}<textarea rows="3" maxlength="1000" placeholder=${t('messagePlaceholder',lang)} value=${draft} onInput=${e=>{setDraft(e.currentTarget.value);setSent(false);}} disabled=${sending}/></label>
      <div class="quick-replies">${['quickThanks',role==='parent'?'quickPickup':'quickWelcome'].map(key=>html`<button type="button" onClick=${()=>setDraft(t(key,lang))}>${t(key,lang)}</button>`)}</div>
      <div class="conversation-send"><span role="status">${sent?t('demoSaved',lang):''}</span><button class="button primary" disabled=${busy||sending||!draft.trim()}>${t('sendDemoMessage',lang)}<${Icon} name="arrow" size=${17}/></button></div>
      ${error&&html`<p class="form-error" role="alert">${error}</p>`}
    </form></section>`;
}
export function DailyRecords({child,lang}) {
  return html`<div class="daily-records">${[['breakfast','mealBreakfast','meal'],['lunch','mealLunch','meal'],['rest','restLog','rest']].map(([key,label,icon])=>html`<div class=${`daily-record ${key}`}><${Icon} name=${icon} size=${19}/><span>${t(label,lang)}<b>${t(`log_${child.log[key]}`,lang)}</b></span></div>`)}</div>`;
}
