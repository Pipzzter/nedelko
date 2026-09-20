import { html, dayName } from '../lib/ui.js';
import { t, parentReason } from '../locales/index.js';
import { Icon } from './Icon.js';

export function PlanChanges({ changes = [], today, lang, onSelect }) {
  if (!changes.length) return null;
  return html`<section class="adaptation-note" role=${changes.some(change => change.from === today) ? 'alert' : 'status'}>
    <${Icon} name="home" size=${21}/><div>${changes.map(change => html`<div key=${change.from} class="day-change">
      <p><b>${change.from === today ? t('todayInside', lang) : `${dayName(change.from, lang)}: ${t('dayMovedInside', lang)}`}</b> ${parentReason(change.reason, lang)}</p>
      <p>${change.to ? html`${t('replacementSuggestion', lang)}: ${onSelect ? html`<button class="text-button" type="button" onClick=${() => onSelect(change.to)}>${dayName(change.to, lang)}</button>` : dayName(change.to, lang)}. ${t('replacementRecheck', lang)}` : t('noReplacement', lang)}</p>
    </div>`)}</div>
  </section>`;
}
