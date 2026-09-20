import { html, useState, useRef, useEffect, text } from '../lib/ui.js';
import { t, errorText } from '../locales/index.js';

export function ChangeAssistant({ day, row, scope, lang, busy, demo, onSuggest, onApply }) {
  const [open, setOpen] = useState(false); const [instruction, setInstruction] = useState('');
  const [proposal, setProposal] = useState(null); const [error, setError] = useState(''); const [working, setWorking] = useState(false);
  const input = useRef(null);
  useEffect(() => { if (open) input.current?.focus(); }, [open]);
  const apply = async value => {
    const result = await onApply(value.proposalId);
    if (result) { setOpen(false); setProposal(null); setInstruction(''); }
  };
  const submit = async event => {
    event.preventDefault(); if (busy || working || !instruction.trim()) return;
    setWorking(true); setError(''); setProposal(null);
    try {
      const result = await onSuggest({ date: day.date, scope, ...(row ? { rowId: row.id } : {}), instruction });
      if (scope === 'activity') await apply(result); else setProposal(result);
    } catch (err) { setError(err.generationIssue ? `${errorText('ai_day_failed', lang)} ${t(err.generationIssue, lang)}` : errorText(err.code, lang)); }
    finally { setWorking(false); }
  };
  const confirm = async () => {
    setWorking(true); setError('');
    try { await apply(proposal); } catch (err) { setError(errorText(err.code, lang)); }
    finally { setWorking(false); }
  };
  const title = scope === 'activity' ? 'changeActivity' : 'changeSchedule';
  return html`<section class=${`change-assistant change-${scope}`}>
    <button type="button" class="button secondary" disabled=${busy || working} aria-expanded=${open} onClick=${() => setOpen(value => !value)}>${t(title, lang)}</button>
    ${open && html`<form class="change-form" onSubmit=${submit}>
      <label>${t(scope === 'activity' ? 'activityChangePrompt' : 'scheduleChangePrompt', lang)}
        <textarea ref=${input} rows="3" maxLength="2000" required value=${instruction} disabled=${busy || working}
          placeholder=${t(scope === 'activity' ? 'aiDayPlaceholder' : 'scheduleChangePlaceholder', lang)}
          onInput=${e => { setInstruction(e.currentTarget.value); setProposal(null); }}/></label>
      <p class="soft-note">${t(demo ? 'demoDayHelp' : scope === 'activity' ? 'activityOnlyHelp' : 'scheduleLockedHelp', lang)}</p>
      <button type="submit" class="button primary" disabled=${busy || working || !instruction.trim()}>${t(working ? 'suggestingDay' : 'submitChange', lang)}</button>
    </form>`}
    ${error && html`<p class="form-error" role="alert">${error}</p>`}
    ${open && proposal && html`<section class="schedule-proposal"><h3>${t('reviewSchedule', lang)}</h3><p>${t('scheduleLockedHelp', lang)}</p>
      <ol>${proposal.timeline.map(item => {
        const old = day.timeline.find(before => before.id === item.id);
        const changed = !old || ['start', 'end', 'label', 'note'].some(key => JSON.stringify(old[key] || null) !== JSON.stringify(item[key] || null));
        return html`<li key=${item.id} class=${changed ? 'proposal-changed' : ''}><time>${item.start} - ${item.end}</time><div><b>${text(item.label, lang)}</b>${changed && html`<small>${t('proposedChange', lang)}${old ? ` · ${old.start} - ${old.end}` : ''}</small>`}${item.note && html`<p>${text(item.note, lang)}</p>`}</div></li>`;
      })}</ol><details><summary>${t('ecoActivity', lang)}</summary><h4>${text(proposal.theme.title, lang)}</h4><p>${text(proposal.theme.inside, lang)}</p><p>${text(proposal.theme.outside, lang)}</p><p>${text(proposal.theme.goal, lang)}</p><p>${text(proposal.theme.habit, lang)}</p></details>
      <div class="share-actions"><button type="button" class="button primary" disabled=${busy || working} onClick=${confirm}>${t('applySchedule', lang)}</button>
        <button type="button" class="button quiet" disabled=${busy || working} onClick=${() => setProposal(null)}>${t('discardSuggestion', lang)}</button></div>
    </section>`}
  </section>`;
}
