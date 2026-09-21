import { html, useState, useEffect, useRef, text } from '../lib/ui.js';
import { t, errorText } from '../locales/index.js';

export function ActivityEditor({ day, row, lang, materials, revision, busy, onSave, onCancel }) {
  const eco = row.kind === 'eco'; const baseRevision = useRef(revision);
  const [draft, setDraft] = useState(() => eco ? { theme: structuredClone(day.theme), occasionDiscussion: row.occasionDiscussion } : {
    label: { ...row.label }, note: row.note || { mk: t(`description_${row.kind}`, 'mk'), en: t(`description_${row.kind}`, 'en') }, occasionDiscussion: row.occasionDiscussion,
  });
  const [error, setError] = useState(''); const first = useRef(null);
  useEffect(() => { first.current?.focus(); }, []);
  const update = (key, language, value) => setDraft(previous => key === 'occasionDiscussion' || !eco
    ? { ...previous, [key]: { ...previous[key], [language]: value } }
    : { ...previous, theme: { ...previous.theme, [key]: { ...previous.theme[key], [language]: value } } });
  const fields = eco ? [['title', 'activityTitle', 100], ['inside', 'activityInside', 1200], ['outside', 'activityOutside', 1200], ['goal', 'goal', 220], ['habit', 'homeHabit', 180]]
    : [['label', 'activityTitle', 100], ['note', 'activityDescription', 1200]];
  if (row.occasionDiscussion) fields.push(['occasionDiscussion', 'occasionDiscussion', 1200]);
  const submit = async event => {
    event.preventDefault(); if (busy) return; setError('');
    try { await onSave({ action: 'content', date: day.date, rowId: row.id, content: draft, revision: baseRevision.current }); onCancel(); }
    catch (err) { setError(errorText(err.code, lang)); }
  };
  return html`<form class="activity-editor" onSubmit=${submit}>
    <p class="soft-note">${t('editContentHelp', lang)}</p>
    ${fields.map(([key, label, limit], index) => html`<fieldset key=${key}><legend>${t(label, lang)}</legend>${['mk', 'en'].map(language => html`<label>${language === 'mk' ? 'Македонски' : 'English'}
      <textarea ref=${index === 0 && language === lang ? first : undefined} rows=${limit > 220 ? 4 : 2} required maxLength=${limit} lang=${language} disabled=${busy}
        value=${(eco && key !== 'occasionDiscussion' ? draft.theme[key] : draft[key])?.[language] || ''} onInput=${event => update(key, language, event.currentTarget.value)}/></label>`)}</fieldset>`)}
    ${eco && html`<fieldset><legend>${t('materials', lang)}</legend>${materials.map(material => html`<label class="material-choice"><input type="checkbox" checked=${draft.theme.materials.includes(material.id)} disabled=${busy} onChange=${event => {
      const checked = event.currentTarget.checked;
      setDraft(previous => ({ ...previous, theme: { ...previous.theme, materials: checked ? [...previous.theme.materials, material.id] : previous.theme.materials.filter(id => id !== material.id) } }));
    }}/> ${text(material.label, lang)}</label>`)}</fieldset>`}
    ${error && html`<p class="form-error" role="alert">${error}</p>`}
    <div class="share-actions"><button class="button primary" type="submit" disabled=${busy}>${t('saveActivity', lang)}</button><button class="button quiet" type="button" disabled=${busy} onClick=${onCancel}>${t('cancel', lang)}</button></div>
  </form>`;
}
