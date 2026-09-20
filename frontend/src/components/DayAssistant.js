import { html, useState } from '../lib/ui.js';
import { t, errorText } from '../locales/index.js';

export function DayAssistant({ day, lang, demo, busy, dirty, onSuggest, onApply }) {
  const [instruction, setInstruction] = useState('');
  const [proposal, setProposal] = useState(null);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');
  const suggest = async () => {
    setWorking(true); setError(''); setProposal(null);
    try { setProposal(await onSuggest(day.date, instruction)); }
    catch (err) { setError(err.generationIssue ? `${errorText('ai_day_failed', lang)} ${t(err.generationIssue, lang)}` : errorText(err.code, lang)); }
    finally { setWorking(false); }
  };
  return html`<section class="day-assistant">
    <span class="eyebrow">${demo ? t('demo', lang) : 'AI'}</span><h3>${t('aiDayTitle', lang)}</h3><p>${t(demo ? 'demoDayHelp' : 'aiDayHelp', lang)}</p>
    <label>${t('aiDayTitle', lang)}<textarea rows="3" maxLength="2000" value=${instruction} disabled=${working || busy}
      placeholder=${t('aiDayPlaceholder', lang)} onInput=${e => { setInstruction(e.currentTarget.value); setProposal(null); }}/></label>
    ${dirty && html`<p class="soft-note" role="status">${t('saveBeforeAI', lang)}</p>`}
    <button type="button" class="button secondary" disabled=${busy || working || dirty || !instruction.trim()} onClick=${suggest}>${t(working ? 'suggestingDay' : 'suggestDay', lang)}</button>
    ${error && html`<p class="form-error" role="alert">${error}</p>`}
    ${proposal && html`<div class="day-proposal"><span class="eyebrow">${t('dayPreview', lang)} · ${proposal.source === 'ai' ? 'AI' : t('demo', lang)}</span>
      <h3>${proposal.theme.title[lang]}</h3><p>${proposal.theme.goal[lang]}</p>
      <div class="lesson-versions"><div><b>${t('activityInside', lang)}</b><p>${proposal.theme.inside[lang]}</p></div><div><b>${t('activityOutside', lang)}</b><p>${proposal.theme.outside[lang]}</p></div></div>
      <div class="share-actions"><button type="button" class="button primary" disabled=${busy || dirty} onClick=${() => onApply(proposal.proposalId)}>${t('applyDay', lang)}</button>
        <button type="button" class="button quiet" onClick=${() => setProposal(null)}>${t('discardSuggestion', lang)}</button></div>
    </div>`}
  </section>`;
}
