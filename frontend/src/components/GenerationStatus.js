import { html } from '../lib/ui.js';
import { t } from '../locales/index.js';

export function GenerationStatus({ week, lang }) {
  if (!week) return null;
  const sources = new Set(week.days.filter(day => day.theme).map(day => day.source || week.source));
  const sourceKey = sources.size > 1 ? 'mixedSource' : sources.has('ai') ? 'aiSource' : 'librarySource';
  return html`<aside class=${`generation-status ${week.generationIssue ? 'has-issue' : ''}`} role="status">
    <div><span class="eyebrow">${t('planOrigin', lang)}</span><p>${t(sourceKey, lang)}</p></div>
    ${week.generationIssue && html`<p>${t(week.generationIssue, lang)}</p>`}
    ${week.settings.teacherPrompt && week.source !== 'ai' && html`<p>${t('promptNotApplied', lang)}</p>`}
  </aside>`;
}
