import { html, text, localizedDate } from '../lib/ui.js';
import { t } from '../locales/index.js';

const scopeNames = {
  orthodox: ['православни верници', 'Orthodox Christians'], catholic: ['католички верници', 'Catholics'], muslim: ['муслимански верници', 'Muslims'],
  albanian: ['албанската заедница', 'Albanian community'], serbian: ['српската заедница', 'Serbian community'], roma: ['ромската заедница', 'Roma community'],
  vlach: ['влашката заедница', 'Vlach community'], jewish: ['еврејската заедница', 'Jewish community'], bosniak: ['бошњачката заедница', 'Bosniak community'], turkish: ['турската заедница', 'Turkish community'],
};
export function Occasions({ day, lang }) {
  const events = [...(day.preparationFor ? [{ ...day.preparationFor, preparation: true }] : []), ...(day.occasions || [])];
  if (!events.length) return null;
  return html`<div class="day-occasions">${events.map(event => html`<p key=${`${event.id}-${event.preparation || false}`} class="occasion-note">
    <b>${event.preparation || event.date !== day.date ? `${t('holidayPreparation', lang)}: ` : ''}${text(event.name, lang)}</b><span>${localizedDate(event.date, lang, { day: 'numeric', month: 'numeric' })} · ${t(event.kind === 'classroom' ? 'classroomOccasion' : event.kind === 'public' ? 'publicHoliday' : 'communityHoliday', lang)}${event.kind === 'community' ? `: ${scopeNames[event.scope]?.[lang === 'mk' ? 0 : 1] || ''}` : ''}</span>
  </p>`)}</div>`;
}
export function HolidaySources({ calendars, lang }) {
  if (!calendars?.length) return null;
  return html`<details class="holiday-sources"><summary>${t('holidayCalendar', lang)}</summary><p class="soft-note">${t('holidayHelp', lang)}</p>
    ${calendars.map(calendar => html`<div key=${calendar.year} class="holiday-source">
      <b>${calendar.year}</b><p>${t(calendar.complete ? 'holidayComplete' : 'holidayIncomplete', lang)}</p>
      ${calendar.verifiedOn && html`<p>${t('verifiedSnapshot', lang)}: ${calendar.verifiedOn}</p>`}
      ${calendar.fetchedAt && html`<p>${t('announcementSync', lang)}: ${localizedDate(calendar.fetchedAt, lang, { day: 'numeric', month: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>`}
      ${(calendar.refreshFailed || calendar.partial) && html`<p>${t('holidayCached', lang)}</p>`}
      ${calendar.warnings?.includes('republic_observed_date_unverified') && html`<p>${t('holidayDateWarning', lang)}</p>`}
      ${calendar.sourceUrl && html`<a href=${calendar.sourceUrl} target="_blank" rel="noreferrer">${t('officialProgramme', lang)}</a>`}
    </div>`)}
  </details>`;
}
