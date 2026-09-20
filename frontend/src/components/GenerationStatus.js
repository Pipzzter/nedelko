import { html } from '../lib/ui.js';
import { t } from '../locales/index.js';

export function GenerationStatus({ week, lang }) {
  if (!week?.generationIssue) return null;
  return html`<aside class=${`generation-status ${week.generationIssue ? 'has-issue' : ''}`} role="status">
    ${week.generationIssue && html`<p>${t(week.generationIssue, lang)}</p>`}
    ${week.settings.teacherPrompt && week.source !== 'ai' && html`<p>${t('promptNotApplied', lang)}</p>`}
  </aside>`;
}
