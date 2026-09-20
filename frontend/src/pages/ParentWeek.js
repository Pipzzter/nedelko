import { html, useState, useEffect, text, dayName, localizedDate } from '../lib/ui.js';
import { api } from '../lib/api.js';
import { t, parentReason } from '../locales/index.js';
import { Icon } from '../components/Icon.js';
import { PlanChanges } from '../components/PlanChanges.js';

export function ParentWeek({ token }) {
  const [lang, setLang] = useState(() => { try { return localStorage.getItem('eko-language') === 'en' ? 'en' : 'mk'; } catch { return 'mk'; } });
  const [data, setData] = useState(null);
  const [selected, setSelected] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    document.documentElement.lang = lang; document.title = `${t('brand', lang)} · ${t('parentWeek', lang)}`;
    try { localStorage.setItem('eko-language', lang); } catch { /* Language still works for this visit. */ }
  }, [lang]);
  useEffect(() => {
    let active = true; let loading = false;
    const load = async () => {
      if (loading || document.hidden) return;
      loading = true; setBusy(true);
      try {
        const result = await api(`/parents/${token}`);
        if (active) { setData(result); setError(''); setSelected(previous => result.days.some(day => day.date === previous) ? previous : result.days.some(day => day.date === result.today) ? result.today : result.days[0].date); }
      } catch (err) { if (active) { setData(null); setError(err.status === 404 ? 'parentUnavailable' : 'parentRefreshFailed'); } }
      finally { loading = false; if (active) setBusy(false); }
    };
    load(); const timer = setInterval(load, 60000);
    document.addEventListener('visibilitychange', load);
    return () => { active = false; clearInterval(timer); document.removeEventListener('visibilitychange', load); };
  }, [token]);
  const day = data?.days.find(item => item.date === selected);
  return html`<div class="parent-shell"><header class="parent-header"><span class="brand"><span class="brand-mark"><${Icon} name="leaf" size=${23}/></span>${t('brand', lang)}.</span>
    <button class="language-switch" onClick=${() => setLang(lang === 'mk' ? 'en' : 'mk')}>${lang === 'mk' ? 'EN' : 'МК'}</button></header>
    <main class="parent-main"><div class="parent-access-note"><${Icon} name="leaf" size=${18}/><span>${t("sharedByTeacher",lang)}</span><small>${t("parentNoLogin",lang)}</small></div><div class="parent-hero"><span class="eyebrow">${t('parentView', lang)}</span><h1>${data?.kindergarten || t('parentWeek', lang)}</h1>
      ${data && html`<p class="parent-group">${data.groupName} ${data.groupName ? '·' : ''} ${text(data.location, lang)}</p>`}<p>${t('parentIntro', lang)}</p></div>
      ${error ? html`<section class="card parent-empty" role="alert"><h2>${t(error, lang)}</h2><button class="button secondary" onClick=${() => window.location.reload()}>${t('retry', lang)}</button></section>` : !data ? html`<p role="status">${t('loading', lang)}</p>` : html`
        ${data.mode === 'demo' && html`<p class="demo-banner">${t('demoSample', lang)}</p>`}
        <div class="parent-meta" id="family-week"><span>${localizedDate(data.weekStart, lang, { day: 'numeric', month: 'long' })} – ${localizedDate(data.days.at(-1).date, lang, { day: 'numeric', month: 'long' })}</span><button class="button quiet" onClick=${() => window.print()}>${t('printWeek', lang)}</button></div>
        <p class="soft-note">${t('parentProvisional', lang)}</p>
        <${PlanChanges} changes=${data.changes} today=${data.today} lang=${lang} onSelect=${setSelected}/>
        <nav class="parent-days" aria-label=${t('parentWeek', lang)}>${data.days.map(item => html`<button key=${item.date} class=${`parent-day-tile ${item.date === selected ? 'selected' : ''}`} aria-pressed=${item.date === selected} onClick=${() => setSelected(item.date)}>
          <span>${dayName(item.date, lang)}</span><b>${Number(item.date.slice(8))}</b><span class=${`pill status-${item.mode}`}>${t(item.mode, lang)}</span><small>${text(item.title, lang) || t('noDay', lang)}</small></button>`)}</nav>
        ${day && html`<article class="card parent-day-detail"><div class="card-heading"><div><span class="eyebrow">${day.date === data.today ? t('today', lang) : dayName(day.date, lang)}</span><h2>${text(day.title, lang) || t('noDay', lang)}</h2></div><span class=${`pill status-${day.mode}`}>${t(day.mode, lang)}</span></div>
          <p class="parent-condition-note">${parentReason(day.reason, lang)}</p>
          ${day.closed ? html`<p>${t('closed', lang)}</p>` : html`<p class="parent-activity">${text(day.activity, lang)}</p>${day.goal && html`<div class="parent-learning"><b>${t('goal', lang)}</b><p>${text(day.goal, lang)}</p></div>`}
            <ol class="parent-timeline">${day.timeline.map(row => html`<li key=${row.id} class=${`kind-${row.kind}`}><time>${row.start}–${row.end}</time><div><b>${text(row.label, lang)}</b>${row.note && html`<p>${text(row.note, lang)}</p>`}</div></li>`)}</ol>`}
          ${day.message && html`<div class="parent-note"><span class="eyebrow">${t('dailyMessage', lang)}</span><p>${text(day.message, lang)}</p></div>`}
        </article>`}
        <section class="card parent-week-note"><h2>${t('weeklyMessage', lang)}</h2><p>${text(data.weeklyMessage, lang)}</p></section>
        <div class="print-all-days">${data.days.map(item => html`<section><h2>${dayName(item.date, lang)} · ${text(item.title, lang)}</h2><p>${text(item.message, lang)}</p>${!item.closed && html`<ul>${item.timeline.map(row => html`<li>${row.start}–${row.end} ${text(row.label, lang)}</li>`)}</ul>`}</section>`)}</div>
        <footer class="parent-footer">${t('lastChecked', lang)}: ${localizedDate(data.updatedAt, lang, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}${busy ? ` · ${t('loading', lang)}` : ''}<br/>${t('airScope', lang)}</footer>
      `}
    </main></div>`;
}
