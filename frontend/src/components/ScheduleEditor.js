import { html, useState, useRef, text, localTime } from '../lib/ui.js';
import { t, errorText } from '../locales/index.js';

export function ScheduleEditor({ day, clock, lang, revision, busy, onSave }) {
  const baseRevision = useRef(revision);
  const [starts, setStarts] = useState(() => day.timeline.map(row => row.start));
  const [review, setReview] = useState(false); const [error, setError] = useState('');
  const now = localTime(clock); const lastEnd = day.timeline.at(-1).end;
  const changed = starts.some((start, index) => start !== day.timeline[index].start);
  const valid = starts.every((start, index) => /^\d{2}:\d{2}$/.test(start) && start < (starts[index + 1] || lastEnd));
  const save = async () => {
    setError('');
    try { await onSave({ action: 'timing', date: day.date, starts, revision: baseRevision.current }); setReview(false); }
    catch (err) { setError(errorText(err.code, lang)); }
  };
  return html`<section class="schedule-editor"><h3>${t('editTimes', lang)}</h3><p class="soft-note">${t('editTimesHelp', lang)}</p>
    <ol>${day.timeline.map((row, index) => html`<li><label>${text(row.label, lang)}<input type="time" value=${starts[index]} aria-label=${`${t('startsAt', lang)}: ${text(row.label, lang)}`} disabled=${busy || index === 0 || day.date < now.date || day.date === now.date && day.timeline[index - 1].start <= now.time}
      onInput=${event => { const value = event.currentTarget.value; setStarts(previous => previous.map((start, i) => i === index ? value : start)); setReview(false); }}/></label><span>${t('endsAt', lang)} ${starts[index + 1] || lastEnd}</span></li>`)}</ol>
    ${!valid && html`<p class="form-error" role="alert">${errorText('overlapping_times', lang)}</p>`}
    ${error && html`<p class="form-error" role="alert">${error}</p>`}
    ${review ? html`<div class="schedule-review"><p>${t('reviewTimes', lang)}</p><button type="button" class="button primary" disabled=${busy || !valid} onClick=${save}>${t('applySchedule', lang)}</button></div>` : html`<button type="button" class="button secondary" disabled=${busy || !changed || !valid} onClick=${() => setReview(true)}>${t('reviewSchedule', lang)}</button>`}
  </section>`;
}
