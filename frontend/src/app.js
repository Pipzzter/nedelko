import { html, render, useState, useEffect, useRef, localizedDate } from './lib/ui.js';
import { api } from './lib/api.js';
import { t, errorText } from './locales/index.js';
import { Icon } from './components/Icon.js';
import { Calendar } from './components/Calendar.js';
import { AirCard } from './components/AirCard.js';
import { DayPlan } from './components/DayPlan.js';
import { Messages } from './components/Messages.js';
import { Auth } from './pages/Auth.js';
import { CreatePlan } from './pages/CreatePlan.js';
import { WeekActions } from './components/WeekActions.js';
import { DemoControls } from './components/DemoControls.js';
import { ParentShare } from './components/ParentShare.js';
import { GenerationStatus } from './components/GenerationStatus.js';
import { ParentWeek } from './pages/ParentWeek.js';
import { PlanChanges } from './components/PlanChanges.js';
import { ParentNotes } from './components/ParentNotes.js';
import { RequestProgress } from './components/RequestProgress.js';
const demoRoute = () => window.location.hash.match(/^#demo\/([a-f0-9-]{36})(?:\/(home|plan(?:\/new)?|edit|create|classroom|messages))?$/);
const pages = ['home', 'plan', 'plan/new', 'create', 'edit'];
// Keep existing bookmarks working within the single planning destination.
const currentPage = () => {
  const next = demoRoute()?.[2] || window.location.hash.slice(1);
  if (next === 'edit' || next === 'plan') return 'home';
  if (next === 'create' || next === 'plan/new') return 'create';
  return 'home';
};

const initialLanguage = () => { try { return localStorage.getItem('eko-language') === 'en' ? 'en' : 'mk'; } catch { return 'mk'; } };
const firstVisit = () => { try { return !localStorage.getItem('eko-visited'); } catch { return false; } };
const markVisited = () => { try { localStorage.setItem('eko-visited', '1'); } catch {} };
function App() {
  const [lang, setLang] = useState(initialLanguage); const [config, setConfig] = useState(null); const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false); const [data, setData] = useState(null); const [busy, setBusy] = useState(false);
  const [error, setError] = useState(''); const [page, setPage] = useState(currentPage);
  const [resetSettings, setResetSettings] = useState(null);
  const [notesOpen, setNotesOpen] = useState(false); const [demoIntro, setDemoIntro] = useState(false);
  const [selected, setSelected] = useState(null); const [demoId, setDemoId] = useState(() => demoRoute()?.[1] || null); const [scenario, setScenario] = useState('normal');
  const [location, setLocation] = useState(null); const [clock, setClock] = useState(new Date().toISOString());
  const running = useRef(false);
  const navigate = next => { setPage(next); locationHash(demoId ? `demo/${demoId}/home` : 'home'); setError(''); window.scrollTo({ top: 0 }); };
  function accept(result) {
    setData(result); setClock(result.clock); setLocation(result.environment.location.id);
    if (result.demoId && result.demoScenario) setScenario(result.demoScenario);
    setSelected(old => result.calendar.some(d => d.date === old) ? old : result.calendar.some(d => d.date === result.today) ? result.today : result.calendar[0].date);
  }
  const run = async (operation, propagate = false) => {
    if (running.current) { if (propagate) throw Object.assign(new Error('operation_pending'), { code: 'operation_pending' }); return; }
    running.current = true; setBusy(true); setError('');
    try { return await operation(); }
    catch (err) { setError(err.code || 'unexpected_error'); if (err.status === 401) { setUser(null); setDemoId(null); setData(null); } if (propagate) throw err; }
    finally { running.current = false; setBusy(false); }
  };
  const load = async (id = demoId, selectedLocation = location, selectedScenario = scenario, fresh = false) => {
    const query = new URLSearchParams({ ...(selectedLocation ? { location: selectedLocation } : {}), ...(selectedScenario ? { scenario: selectedScenario } : {}), ...(id ? { demoId: id } : {}), ...(fresh ? { fresh: '1' } : {}) });
    accept(await api(`/dashboard?${query}`));
  };
  const refresh = () => run(async () => {
    // Clear approval in the UI immediately, including while the network is unavailable.
    if (data?.week) setData({ ...data, week: { ...data.week, approval: null, checkedAt: null } });
    await load(demoId, location, scenario, true);
  });
  const beginDemo = (demoWeek = config.defaultDemoWeek) => run(async () => { const result = await api('/demo', { locationId: location, demoWeek }); setDemoId(result.demoId); setResetSettings(null); setScenario('normal'); accept(result); setSelected(result.today); navigate('home'); locationHash(`demo/${result.demoId}/home`); });
  const toggleDemo = () => demoId ? run(async () => { setDemoId(null); setResetSettings(null); setData(null); setScenario('normal'); navigate('home'); locationHash('home'); if (user) await load(null, location, 'normal'); }) : beginDemo();
  const action = (path, body = {}, propagate = false) => run(async () => { const result = await api(path, { ...body, ...(demoId ? { demoId, scenario } : {}), revision: body.revision ?? data?.week?.revision }); if (result.environment) accept(result); else setData(previous => ({ ...previous, ...result })); return result; }, propagate);
  useEffect(() => { document.documentElement.lang = lang; document.title = `${t('brand', lang)} · ${t('yourWeek', lang)}`; try { localStorage.setItem('eko-language', lang); } catch {} }, [lang]);
  useEffect(() => {
    run(async () => {
      const [configuration, auth] = await Promise.all([api('/config'), api('/auth/me')]); setConfig(configuration); setUser(auth.user);
      if (demoId) { setReady(true); await load(demoId, null, null); }
      else if (auth.user) { setReady(true); await load(null); }
      else if (firstVisit()) {
        markVisited();
        const result = await api('/demo', { locationId: location, demoWeek: configuration.defaultDemoWeek });
        setDemoId(result.demoId); setScenario('normal'); accept(result); setSelected(result.today);
        locationHash(`demo/${result.demoId}/home`); setDemoIntro(true); setReady(true);
      } else setReady(true);
    });
  }, []);
  useEffect(() => {
    const interval = setInterval(() => { if (!demoId) setClock(new Date().toISOString()); }, 30000);
    return () => clearInterval(interval);
  }, [demoId]);
  useEffect(() => {
    if (page !== 'home' || !data) return;
    const resume = () => { if (!document.hidden) refresh(); };
    const interval = setInterval(resume, 60000);
    document.addEventListener('visibilitychange', resume);
    return () => { clearInterval(interval); document.removeEventListener('visibilitychange', resume); };
  }, [page, demoId, data?.week?.revision]);
  useEffect(() => {
    const handler = () => { if (demoRoute() || pages.includes(window.location.hash.slice(1))) setPage(currentPage()); };
    window.addEventListener('hashchange', handler); return () => window.removeEventListener('hashchange', handler);
  }, []);
  if (!ready || !config) return html`<div class="boot">${t('brand', lang)}<span>${error ? errorText(error, lang) : t('loading', lang)}</span>${error && html`<button class="button primary" onClick=${() => window.location.reload()}>${t('retry', lang)}</button>`}</div>`;
  if (!user && !demoId) return html`<${Auth} lang=${lang} setLang=${setLang} config=${config} busy=${busy} error=${error && errorText(error, lang)} onDemo=${() => beginDemo()} onAuth=${(kind, fields) => run(async () => { const auth = await api(`/auth/${kind}`, fields); setUser(auth.user); navigate('home'); await load(null); })}/>`;
  const day = data?.week?.days.find(d => d.date === selected);
  const creating = page === 'create';
  const header = creating ? data?.week ? 'regenerateWeek' : 'createPlan' : data?.week ? 'yourWeek' : 'kindergarten';
  const gradinkaName = data?.week?.settings.gradinka?.name || data?.profile?.gradinka?.name || '';
  const groupName = data?.week?.settings.groupName || data?.profile?.groupName || '';
  const place = config.locations.find(l => l.id === (data?.week?.settings.locationId || data?.profile?.locationId || location));
  return html`<div class=${`app-shell ${notesOpen ? "notes-open" : ""}`}><a class="skip-link" href="#main">${lang === 'mk' ? 'Прескокни до содржината' : 'Skip to content'}</a><aside class="sidebar"><a class="brand" href=${demoId ? `#demo/${demoId}/home` : "#home"} onClick=${e => { e.preventDefault(); navigate('home'); }}><span class="brand-mark"><${Icon} name="leaf" size=${23}/></span>${t('brand', lang)}<span class="brand-period">.</span></a><nav aria-label=${lang === 'mk' ? 'Главно мени' : 'Main navigation'}><a href=${demoId ? `#demo/${demoId}/home` : "#home"} class="active" aria-current="page" onClick=${e => { e.preventDefault(); navigate('home'); }}><${Icon} name="home"/>${t('home', lang)}</a></nav><${ParentNotes} key=${demoId || user.id} demoId=${demoId} week=${data?.week} lang=${lang} open=${notesOpen} onToggle=${() => setNotesOpen(value => !value)} busy=${busy}
      onSuggest=${noteId => run(() => api('/parent-notes/suggest', { noteId, revision: data.week.revision, ...(demoId ? { demoId, scenario } : {}) }), true)}
      onApply=${proposalId => action('/parent-notes/apply', { proposalId }, true)}/><div class="sidebar-bottom">${!demoId && user && html`<span class="account-name"><span class="account-initial">${user.displayName.slice(0, 1).toUpperCase()}</span><span>${user.displayName}<small>${user.email}</small></span></span>`}<button class="logout-button" disabled=${busy} onClick=${() => demoId ? toggleDemo() : run(async () => { await api('/auth/logout', {}); setUser(null); setDemoId(null); setResetSettings(null); setData(null); navigate('home'); })}><${Icon} name="logout" size=${18}/>${t(demoId ? 'exitDemo' : user ? 'signOut' : 'signIn', lang)}</button></div></aside>
    <div class="workspace"><header class="topbar"><div class="location-control"><${Icon} name="pin" size=${17}/><span>${place ? lang === 'mk' ? place.name : place.nameEn : ''}</span></div><div class="topbar-actions"><label class="demo-switch"><input type="checkbox" checked=${!!demoId} disabled=${busy} onChange=${toggleDemo}/><span class="switch-track"></span>${t('demo', lang)}</label><button class="language-switch" onClick=${() => setLang(lang === 'mk' ? 'en' : 'mk')} aria-label=${lang === 'mk' ? 'Switch to English' : 'Промени на македонски'}>${lang === 'mk' ? 'EN' : 'МК'}</button></div></header>
    <main id="main"><div class="page-heading"><div><span class="eyebrow">${data ? localizedDate(data.clock, lang, { weekday: 'long', day: 'numeric', month: 'long' }) : t('loading', lang)}</span><h1>${t(header, lang)}<span class="heading-dot">.</span></h1><p class="group-heading">${`${gradinkaName}${groupName && groupName !== gradinkaName ? ` · ${groupName}` : ''}`}</p></div><img class="heading-illustration" src="/assets/little-gardeners.svg" alt="" width="530" height="330"/></div>
    ${demoId && !creating && html`<${DemoControls} week=${data?.week} clock=${data?.clock || clock} scenario=${scenario} config=${config} lang=${lang} busy=${busy} onWeek=${beginDemo} onScenario=${value => run(async () => { await load(demoId, location, value, true); setScenario(value); })}/>`}
    ${error && html`<div class="alert error" role="alert"><span>${errorText(error, lang)}</span><button class="button quiet" onClick=${refresh} disabled=${busy}>${t('refresh', lang)}</button></div>`}
    ${busy && html`<div class="busy-status" role="status"><span class="spinner"></span>${t(creating ? 'generating' : 'loading', lang)}</div>`}
    ${!data ? html`<div class="card loading-card"><${Icon} name="leaf" size=${36}/><p>${t('loading', lang)}</p></div>` : creating ? html`
      <${CreatePlan} demo=${!!demoId} replacing=${Boolean(data.week)} key=${demoId || 'real'} config=${config} lang=${lang}
        initial=${data.week?.settings || resetSettings || data.profile || { ...config.defaults, locationId: location }} busy=${busy}
        onCancel=${() => navigate('home')} onGenerate=${settings => run(async () => {
          accept(await api('/week/generate', { settings, requireAI: Boolean(data.week) && !demoId, revision: data.week?.revision, ...(demoId ? { demoId, scenario } : {}) })); navigate('home');
        })}/>` : !data.week ? html`
      <section class="card kindergarten-empty"><span class="empty-sprout"><${Icon} name="leaf" size=${32}/></span>
        <h2>${t('weekEmpty', lang)}</h2><p>${t('kindergartenStart', lang)}</p>
        <button class="button primary" onClick=${() => navigate('create')}>${t('generate', lang)}<${Icon} name="arrow" size=${18}/></button></section>` : html`
      <${GenerationStatus} week=${data.week} lang=${lang}/>
      <div class="overview-grid"><${Calendar} data=${data} lang=${lang} selected=${selected} onSelect=${setSelected}/><${AirCard} environment=${data.environment} lang=${lang} busy=${busy} refresh=${refresh}/></div>
      <${PlanChanges} changes=${data.week.changes} today=${data.today} lang=${lang} onSelect=${setSelected}/>
      ${day && html`<${DayPlan} day=${day} data=${data} lang=${lang} clock=${clock} materials=${config.materials} busy=${busy}
        demo=${!!demoId} onSuggest=${request => run(() => api('/week/change/suggest', { ...request, revision: data.week.revision, ...(demoId ? { demoId, scenario } : {}) }), true)}
        onApply=${proposalId => action('/week/change/apply', { proposalId }, true)}
        onEdit=${request => action('/week/day/edit', request, true)}
        onPlace=${value => action('/week/edit', { settings: data.week.settings, days: data.week.days.map(item => item.date === day.date ? { ...item, outdoorPreference: value } : item) })}/>`}
      <${ParentShare} share=${data.share} lang=${lang} busy=${busy} onShare=${shareAction => action('/week/share', { action: shareAction })}/>
      <${Messages} share=${data.share} week=${data.week} selected=${selected} lang=${lang} busy=${busy} onRecheck=${() => action('/week/recheck')} onApprove=${() => action('/week/approve')}/>
      <${WeekActions} lang=${lang} busy=${busy} onRegenerate=${() => navigate('create')} onDelete=${() => run(async () => {
        const result = await api('/week/delete', { revision: data.week.revision, ...(demoId ? { demoId } : {}) });
        setResetSettings(result.settings); setData(previous => ({ ...previous, week: null, share: null })); navigate('home');
      })}/>
    `}
    </main></div>
    ${demoIntro && demoId && html`<div class="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="demo-intro-title" onClick=${e => { if (e.target === e.currentTarget) setDemoIntro(false); }}>
      <div class="modal-card"><span class="modal-icon"><${Icon} name="leaf" size=${26}/></span>
        <h2 id="demo-intro-title">${t('demoIntroTitle', lang)}</h2>
        <p>${t('demoIntroBody', lang)}</p><p class="soft-note">${t('demoIntroToggle', lang)}</p>
        <div class="modal-actions"><button class="button primary" onClick=${() => setDemoIntro(false)}>${t('demoIntroExplore', lang)}<${Icon} name="arrow" size=${18}/></button>
          <button class="button secondary" onClick=${() => { setDemoIntro(false); toggleDemo(); }}>${t('demoIntroLeave', lang)}</button></div>
      </div></div>`}
    </div>`;
}
function locationHash(next) { if (window.location.hash !== `#${next}`) window.history.pushState(null, '', `#${next}`); }
function Root() {
  const [hash, setHash] = useState(window.location.hash);
  useEffect(() => { const update = () => setHash(window.location.hash); window.addEventListener('hashchange', update); return () => window.removeEventListener('hashchange', update); }, []);
  return html`<div class="application-root"><div id="app-screen">${hash.startsWith('#parents/') ? html`<${ParentWeek} token=${/^[a-f0-9]{64}$/.test(hash.slice(9)) ? hash.slice(9) : 'invalid'}/>` : html`<${App} key=${hash.match(/^#demo\/([a-f0-9-]{36})/)?.[1] || 'real'}/>`}</div><${RequestProgress}/></div>`;
}
render(html`<${Root}/>`, document.getElementById('app'));
