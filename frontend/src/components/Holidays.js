import { html, text, localizedDate } from '../lib/ui.js';
import { t } from '../locales/index.js';

const scopeNames = {
  orthodox: ['православни верници', 'Orthodox Christians'],
  catholic: ['католички верници', 'Catholics'],
  muslim: ['муслимански верници', 'Muslims'],
  albanian: ['албанската заедница', 'Albanian community'],
  serbian: ['српската заедница', 'Serbian community'],
  roma: ['ромската заедница', 'Roma community'],
  vlach: ['влашката заедница', 'Vlach community'],
  jewish: ['еврејската заедница', 'Jewish community'],
  bosniak: ['бошњачката заедница', 'Bosniak community'],
  turkish: ['турската заедница', 'Turkish community']
};
export function Occasions({ day, lang }) {
  const events = [
    ...(day.preparationFor ? [{ ...day.preparationFor, preparation: true }] : []),
    ...(day.occasions || [])
  ];
  if (!events.length) return null;
  return html`
    <div class="day-occasions">
      ${events.map(
        (event) => html`
          <p key=${'' + event.id + '-' + (event.preparation || false)} class="occasion-note">
            <b
              >${event.preparation || event.date !== day.date ? '' + t('holidayPreparation', lang) + ': ' : ''}${text(event.name, lang)}</b
            ><span
              >${localizedDate(event.date, lang, { day: 'numeric', month: 'numeric' })} ·
              ${t(occasionKindLabel({ event }), lang)}${occasionScope({ event, lang })}</span
            >
          </p>

`
      )}
    </div>

`;
}
function occasionKindLabel({ event }) {
  if (event.kind === 'classroom') {
    return 'classroomOccasion';
  }
  if (event.kind === 'public') {
    return 'publicHoliday';
  }
  return 'communityHoliday';
}

function occasionScope({ event, lang }) {
  if (event.kind === 'community') {
    return `: ${scopeNames[event.scope]?.[lang === 'mk' ? 0 : 1] || ''}`;
  }
  return '';
}
