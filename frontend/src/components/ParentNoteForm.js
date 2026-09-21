import { html, useState, useRef, useEffect, localizedDate } from '../lib/ui.js';
import { api } from '../lib/api.js';
import { t, errorText } from '../locales/index.js';
import { Icon } from './Icon.js';

export function ParentNoteForm({ token, days, selected, lang }) {
  const [open, setOpen] = useState(false); const [text, setText] = useState('');
  const [date, setDate] = useState(selected); const [busy, setBusy] = useState(false);
  const [error, setError] = useState(''); const [sent, setSent] = useState(false);
  const input = useRef(null); const nonce = useRef(crypto.randomUUID());
  useEffect(() => { if (open) input.current?.focus(); }, [open]);
  useEffect(() => { if (!text) setDate(selected); }, [selected]);
  const submit = async event => {
    event.preventDefault(); if (busy || text.trim().length < 3) return;
    setBusy(true); setError('');
    try { await api(`/parents/${token}/notes`, { text, date, nonce: nonce.current }); setText(''); setSent(true); nonce.current = crypto.randomUUID(); }
    catch (err) { setError(errorText(err.code, lang)); }
    finally { setBusy(false); }
  };
  return html`<aside class="parent-note-composer"><button type="button" class="button primary note-launcher" aria-expanded=${open} aria-controls="parent-note-form" onClick=${() => { setOpen(!open); setSent(false); }}><${Icon} name=${open ? 'close' : 'message'} size=${18}/>${t('leaveParentNote', lang)}</button>
    ${open && html`<form id="parent-note-form" class="card" onSubmit=${submit}><h2>${t('leaveParentNote', lang)}</h2><p class="soft-note">${t('parentNotePrivacy', lang)}</p>
      <label>${t('noteAboutDay', lang)}<select disabled=${busy} value=${date || ''} onChange=${event => { setDate(event.currentTarget.value || null); nonce.current = crypto.randomUUID(); }}><option value="">${t('wholeWeek', lang)}</option>${days.map(day => html`<option value=${day.date}>${localizedDate(day.date, lang, { weekday: 'long', day: 'numeric', month: 'short' })}</option>`)}</select></label>
      <label>${t('yourNote', lang)}<textarea ref=${input} required minLength="3" maxLength="1200" rows="5" disabled=${busy} value=${text} onInput=${event => { setText(event.currentTarget.value); setSent(false); nonce.current = crypto.randomUUID(); }}/></label>
      ${error && html`<p class="form-error" role="alert">${error}</p>`}${sent && html`<p class="note-sent" role="status">${t('parentNoteSent', lang)}</p>`}
      <button type="submit" class="button primary" disabled=${busy || text.trim().length < 3}>${t(busy ? 'loading' : 'sendParentNote', lang)}</button>
    </form>`}</aside>`;
}
