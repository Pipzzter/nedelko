import { html, useState } from '../lib/ui.js';
import { t } from '../locales/index.js';

export function WeekActions({ lang, source, busy, onRegenerate, onDelete }) {
  const [confirm, setConfirm] = useState(false);
  return html`<details class="card week-actions"><summary>${t('manageWeek', lang)}</summary>
    ${['library', 'mixed'].includes(source) && html`<p class="soft-note">${t(source === 'mixed' ? 'mixedSource' : 'librarySource', lang)}</p>`}
    <div class="share-actions"><button class="button secondary" disabled=${busy} onClick=${onRegenerate}>${t('regenerateWeek', lang)}</button>
      <button class="button quiet" disabled=${busy} onClick=${() => setConfirm(true)}>${t('deleteWeek', lang)}</button></div>
    ${confirm && html`<div class="delete-week-confirm" role="alert"><p>${t('deleteWeekHelp', lang)}</p><div class="share-actions">
      <button class="button secondary" disabled=${busy} onClick=${() => setConfirm(false)}>${t('keepWeek', lang)}</button>
      <button class="button danger" disabled=${busy} onClick=${onDelete}>${t('deleteAndStart', lang)}</button></div></div>`}
  </details>`;
}
