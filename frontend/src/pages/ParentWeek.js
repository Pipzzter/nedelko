import { BrandMark } from '../components/BrandMark.js';
import { html, useState, useEffect, localizedDate } from '../lib/ui.js';
import { api } from '../lib/api.js';
import { validateView } from '../lib/view-data.js';
import { t } from '../locales/index.js';
import { PlanChanges } from '../components/PlanChanges.js';
import { Calendar } from '../components/Calendar.js';
import { AirCard } from '../components/AirCard.js';
import { DayPlan } from '../components/DayPlan.js';
import { ParentNoteForm } from '../components/ParentNoteForm.js';

export function ParentWeek({ token }) {
  const [lang, setLang] = useState(() => {
    try {
      return localStorage.getItem('nedelko-language') === 'en' ? 'en' : 'mk';
    } catch {
      return 'mk';
    }
  });
  const [data, setData] = useState(null);
  const [selected, setSelected] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    document.documentElement.lang = lang;
    document.title = `${t('brand', lang)} · ${t('parentWeek', lang)}`;
    try {
      localStorage.setItem('nedelko-language', lang);
    } catch {}
  }, [lang]);
  useEffect(() => {
    let active = true;
    let loading = false;
    setData(null);
    setSelected(null);
    setError('');
    const load = async () => {
      if (loading || document.hidden) return;
      loading = true;
      setBusy(true);
      try {
        const result = validateView(await api(`/parents/${token}`, undefined, { background: true }), true);
        if (active) {
          setData(result);
          setError('');
          setSelected((previous) => {
            if (result.days.some((day) => day.date === previous)) {
              return previous;
            }
            if (result.days.some((day) => day.date === result.today)) {
              return result.today;
            }
            return result.days[0].date;
          });
        }
      } catch (err) {
        if (active) {
          setData(null);
          setError(err.status === 404 ? 'parentUnavailable' : 'parentRefreshFailed');
        }
      } finally {
        loading = false;
        if (active) setBusy(false);
      }
    };
    load();
    const timer = setInterval(load, 60000);
    document.addEventListener('visibilitychange', load);
    return () => {
      active = false;
      clearInterval(timer);
      document.removeEventListener('visibilitychange', load);
    };
  }, [token]);
  const day = data?.days.find((item) => item.date === selected);
  const week = data && {
    days: data.days,
    today: data.today,
    settings: { outdoorDays: data.outdoorDays },
    messages: {
      weekly: data.weeklyMessage,
      daily: Object.fromEntries(data.days.map((item) => [item.date, item.message]))
    }
  };
  const dashboard = data && { ...data, week };
  return html`
    <div class="app-shell parent-dashboard">
      <div class="workspace">
        <header class="parent-brand-header">
          <span class="brand"
            ><${BrandMark} />${t('brand', lang)}</span
          ><span class="soft-note">${t('readOnlyPlan', lang)}</span
          ><button class="language-switch" onClick=${() => setLang(lang === 'mk' ? 'en' : 'mk')}>
            ${lang === 'mk' ? 'EN' : 'МК'}
          </button>
        </header>
        <main id="main">
          <div class="page-heading">
            <div>
              <span class="eyebrow">${t('parentView', lang)}</span>
              <h1>${data?.kindergarten || t('parentWeek', lang)}<span class="heading-dot">.</span></h1>
              <p class="group-heading">${data?.groupName !== data?.kindergarten ? data?.groupName : ''}</p>
              <p>${t('parentProvisional', lang)}</p>
            </div>
            <img class="heading-illustration" src="/assets/little-gardeners.svg" alt="" width="530" height="330" />
          </div>
          ${renderParentContent({ error, lang, data, dashboard, selected, setSelected, day, token, busy })}
        </main>
      </div>
    </div>

`;
}

function renderParentContent({ error, lang, data, dashboard, selected, setSelected, day, token, busy }) {
  if (error) {
    return html`
      <section class="card parent-empty" role="alert">
        <h2>${t(error, lang)}</h2>
        <button class="button secondary" onClick=${() => window.location.reload()}>${t('retry', lang)}</button>
      </section>

`;
  }
  if (!data) {
    return html`
 <p role="status">${t('loading', lang)}</p>
`;
  }
  return html`
    ${data.mode === 'demo' && html`
 <p class="demo-banner">${t('demoSample', lang)}</p>
`}
    <div class="overview-grid">
      <${Calendar} data=${dashboard} lang=${lang} selected=${selected} onSelect=${setSelected} /><${AirCard}
        environment=${data.environment}
        lang=${lang}
      />
    </div>
    <${PlanChanges} changes=${data.changes} today=${data.today} lang=${lang} onSelect=${setSelected} />
    <${DayPlan}
      day=${day}
      data=${dashboard}
      lang=${lang}
      clock=${data.clock}
      materials=${data.materials}
      readOnly=${true}
    />
    <${ParentNoteForm} key=${token} token=${token} days=${data.days} selected=${selected} lang=${lang} />
    <footer class="parent-footer">
      ${t('lastChecked', lang)}:
      ${localizedDate(data.updatedAt, lang, {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit'
      })}${busy ? ' · ' + t('loading', lang) : ''}
    </footer>

`;
}
