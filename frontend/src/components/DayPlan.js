import { html, useState, useEffect, useRef, text, dayName, localTime } from '../lib/ui.js';
import { t } from '../locales/index.js';
import { Icon } from './Icon.js';
import { Occasions } from './Holidays.js';
import { ChangeAssistant } from './ChangeAssistant.js';

export function DayPlan({ day, data, lang, clock, materials, busy, onPlace, onSuggest, onApply, demo }) {
  const [selection, setSelection] = useState(null);
  const detail = useRef(null);
  useEffect(() => {
    if (selection?.date === day?.date && window.matchMedia?.('(max-width: 1020px)').matches) detail.current?.scrollIntoView?.({ behavior: 'auto', block: 'nearest' });
  }, [selection]);
  if (!day) return null;
  const now = localTime(clock); const today = day.date === now.date;
  const selected = day.timeline.find(row => selection?.date === day.date && row.id === selection.id) || day.timeline.find(row => row.kind === 'eco') || day.timeline[0];
  const isEco = selected?.kind === 'eco';
  const description = isEco ? day.activity || day.theme?.inside : selected?.note;
  const title = row => text(row.kind === 'eco' ? day.theme.title : row.label, lang);
  const discussion = selected?.occasionDiscussion;
  const upcoming = row => day.date > now.date || day.date === now.date && row.start > now.time;
  const editable = selected && ['activity', 'eco'].includes(selected.kind) && !selected.occasionIds?.length && upcoming(selected);
  return html`<section class="card day-plan" id="day-plan"><div class="card-heading"><div class="day-heading"><span class="date-tile">${Number(day.date.slice(8))}</span><div><span class="eyebrow">${today ? t('today', lang) : t('dailyPlan', lang)}</span><h2>${dayName(day.date, lang)}</h2></div></div>
      ${day.theme && !day.closed && onPlace && html`<label class="home-place">${t('activityPlace', lang)}<select disabled=${busy || day.date < now.date || today && day.timeline.some(row => row.kind === 'eco' && row.end <= now.time)} value=${day.outdoorPreference || 'auto'} onChange=${e => onPlace(e.currentTarget.value)}>${['auto', 'inside', 'outside'].map(value => html`<option value=${value}>${t(value === 'auto' ? 'automatic' : value, lang)}</option>`)}</select></label>`}</div>
    <${Occasions} day=${day} lang=${lang}/>
    ${!day.theme || day.closed ? html`<p class="empty-day">${t(day.closed ? 'closed' : 'noDay', lang)} ${!day.theme && day.date < data.today ? t('pastEmpty', lang) : ''}</p>` : html`
    <p class="day-decision"><b>${t(day.mode, lang)}.</b> ${day.outdoorPreference === 'outside' && day.mode !== 'outside' ? `${t('outdoorChoiceBlocked', lang)} ` : ''}${t(`reason_${day.reason}`, lang)}${['ai_plan', 'indoor_balance'].includes(day.reason) ? ` ${t('outdoorDays', lang)}: ${data.week.settings.outdoorDays}.` : ''}</p>
    <div class="day-layout"><ol class="timeline">${day.timeline.map(row => {
      const current = today && now.time >= row.start && now.time < row.end;
      return html`<li key=${row.id} data-row-id=${row.id} class=${`kind-${row.kind} ${row.kind === 'eco' ? 'eco-row' : ''} ${row.occasionIds?.length ? 'holiday-lesson' : ''} ${current ? 'current-row' : ''} ${selected?.id === row.id ? 'selected-row' : ''}`} aria-current=${current ? 'step' : undefined}>
        <button type="button" class="timeline-activity" aria-pressed=${selected?.id === row.id} aria-controls="activity-detail" onClick=${() => setSelection({ date: day.date, id: row.id })}>
          <span class="timeline-time">${row.start}<small>${row.end}</small></span><span class="activity-icon"><${Icon} name=${row.kind === 'eco' ? 'leaf' : row.kind === 'routine' ? 'clock' : row.kind} size=${18}/></span><span class="timeline-description"><span>${title(row)}</span>${row.occasionIds?.length && html`<small>${t('occasion', lang)}</small>`}${row.kind === 'eco' && html`<small>${t(day.mode, lang)} · ${t('ecoActivity', lang)}</small>`}</span>${current && html`<span class="now-badge">${t('now', lang)}</span>`}<${Icon} name="chevron" size=${15}/>
        </button></li>`;
    })}</ol>${selected && html`<aside ref=${detail} class=${`lesson-card kind-${selected.kind} ${selected.occasionIds?.length ? 'holiday-lesson' : ''}`} id="activity-detail" aria-labelledby="activity-title" aria-live="polite">
      ${isEco && html`<div class="lesson-illustration"><img src="/assets/little-gardeners.svg" alt="" width="530" height="330"/></div><span class=${`pill status-${day.mode}`}><${Icon} name=${day.mode === 'outside' ? 'leaf' : 'home'} size=${14}/>${t(day.mode, lang)}</span>`}
      <span class="activity-detail-time">${selected.start} - ${selected.end}</span><h3 id="activity-title">${title(selected)}</h3>
      <p class="activity-summary">${text(description, lang) || t(`description_${selected.kind}`, lang)}</p>
      ${discussion && JSON.stringify(discussion) !== JSON.stringify(description) && html`<p>${text(discussion, lang)}</p>`}
      ${isEco && html`${day.mode === 'outside' && html`<details class="indoor-backup" open><summary>${t('indoorBackup', lang)}</summary><p>${text(day.theme.inside, lang)}</p></details>`}<div class="lesson-detail"><span>${t('goal', lang)}</span><p>${text(day.theme.goal, lang)}</p></div><div class="lesson-detail"><span>${t('materials', lang)}</span><div class="material-tags">${day.theme.materials.map(id => html`<span key=${id}>${text(materials.find(m => m.id === id)?.label, lang)}</span>`)}</div></div>${day.snow && html`<p class="soft-note">${t('snowNote', lang)}</p>`}<div class="habit"><${Icon} name="leaf" size=${18}/><p>${text(day.theme.habit, lang)}</p></div>`}
      ${onSuggest && (editable ? html`<${ChangeAssistant} key=${`${day.date}/${selected.id}`} day=${day} row=${selected} scope="activity" lang=${lang} busy=${busy} demo=${demo} onSuggest=${onSuggest} onApply=${onApply}/>` : html`<p class="locked-activity"><${Icon} name="clock" size=${14}/>${t(upcoming(selected) ? 'protectedActivity' : 'activityAlreadyStarted', lang)}</p>`)}
    </aside>`}</div>
    ${onSuggest && day.timeline.some(upcoming) && html`<${ChangeAssistant} key=${day.date} day=${day} scope="schedule" lang=${lang} busy=${busy} demo=${demo} onSuggest=${onSuggest} onApply=${onApply}/>`}`}
  </section>`;
}
