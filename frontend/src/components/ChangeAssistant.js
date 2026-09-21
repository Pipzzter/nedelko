import { html, useState, useRef, useEffect } from '../lib/ui.js';
import { t, errorText } from '../locales/index.js';

export function ChangeAssistant({
  day,
  row,
  scope,
  lang,
  busy,
  demo,
  onSuggest,
  onApply
}) {
  const [open, setOpen] = useState(false);
  const [instruction, setInstruction] = useState('');
  const [error, setError] = useState('');
  const [working, setWorking] = useState(false);
  const input = useRef(null);
  useEffect(() => {
    if (open) input.current?.focus();
  }, [open]);
  const apply = async (value) => {
    const result = await onApply(value.proposalId);
    if (result) {
      setOpen(false);
      setInstruction('');
    }
  };
  const submit = async (event) => {
    event.preventDefault();
    if (busy || working || !instruction.trim()) return;
    setWorking(true);
    setError('');
    try {
      const result = await onSuggest({ date: day.date, scope, ...(row ? { rowId: row.id } : {}), instruction });
      await apply(result);
    } catch (err) {
      setError(changeError({ err, lang }));
    } finally {
      setWorking(false);
    }
  };
  const title = scope === 'activity' ? 'changeActivity' : 'changeSchedule';
  return html`
    <section class=${'change-assistant change-' + scope}>
      <button
        type="button"
        class="button secondary"
        disabled=${busy || working}
        aria-expanded=${open}
        onClick=${() => setOpen((value) => !value)}
      >
        ${t(title, lang)}
      </button>
      ${open && html`
          <form class="change-form" onSubmit=${submit}>
            <label
              >${t(scope === 'activity' ? 'activityChangePrompt' : 'scheduleChangePrompt', lang)}
              <textarea
                ref=${input}
                rows="3"
                maxlength="2000"
                required
                value=${instruction}
                disabled=${busy || working}
                placeholder=${t(scope === 'activity' ? 'aiDayPlaceholder' : 'scheduleChangePlaceholder', lang)}
                onInput=${e => setInstruction(e.currentTarget.value)}
              />
            </label>
            ${demo && html`<p class="soft-note">${t('demoDayHelp', lang)}</p>`}
            <button type="submit" class="button primary" disabled=${busy || working || !instruction.trim()}>
              ${t(working ? 'suggestingDay' : 'submitChange', lang)}
            </button>
          </form>

`
      }
      ${error && html`
 <p class="form-error" role="alert">${error}</p>
`}
    </section>`;
}


function changeError({ err, lang }) {
  if (err.timing) {
    return `${errorText(err.code, lang)} ${t('requestedMinutes', lang)}: ${err.timing.requestedMinutes}. ${t('availableMinutes', lang)}: ${err.timing.availableMinutes}.`;
  }
  if (err.generationIssue) {
    return `${errorText('ai_day_failed', lang)} ${t(err.generationIssue, lang)}`;
  }
  return errorText(err.code, lang);
}
