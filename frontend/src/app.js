import { html, render, useState, useEffect, useRef, text, dayName, localizedDate } from './lib/ui.js';
import { api } from './lib/api.js';
import { t, errorText } from './locales/index.js';
import { Icon } from './components/Icon.js';
import { Calendar } from './components/Calendar.js';
import { AirCard } from './components/AirCard.js';
import { DayPlan } from './components/DayPlan.js';
import { Messages } from './components/Messages.js';
import { Auth } from './pages/Auth.js';
import { CreatePlan } from './pages/CreatePlan.js';
import { EditWeek } from './pages/EditWeek.js';
import { DemoControls } from './components/DemoControls.js';
import { ParentShare } from './components/ParentShare.js';
import { GenerationStatus } from './components/GenerationStatus.js';
import { ParentWeek } from './pages/ParentWeek.js';
import { DemoClassroom } from './pages/DemoClassroom.js';
import { DemoRoleBar, ClassroomSummary, Conversation } from './components/DemoExperience.js';
const demoRoute = () => window.location.hash.match(/^#demo\/([a-f0-9-]{36})(?:\/(home|edit|create|classroom|messages))?$/);
const pages = ['home', 'create', 'edit', 'classroom', 'messages'];

const initialLanguage = () => { try { return localStorage.getItem('eko-language') === 'en' ? 'en' : 'mk'; } catch { return 'mk'; } };
function App() {
  const [lang, setLang] = useState(initialLanguage); const [config, setConfig] = useState(null); const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false); const [data, setData] = useState(null); const [busy, setBusy] = useState(false);
  const [error, setError] = useState(''); const [notice, setNotice] = useState(''); const [page, setPage] = useState(() => demoRoute()?.[2] || (pages.includes(window.location.hash.slice(1)) ? window.location.hash.slice(1) : 'home'));
  const [resetSettings, setResetSettings] = useState(null);
  const [selected, setSelected] = useState(null); const [demoId, setDemoId] = useState(() => demoRoute()?.[1] || null); const [scenario, setScenario] = useState('normal');
  const [location, setLocation] = useState(null); const [clock, setClock] = useState(new Date().toISOString());
  const running = useRef(false);
  const navigate = next => { setPage(next); locationHash(demoId ? `demo/${demoId}/${next}` : next); setError(''); setNotice(''); window.scrollTo({ top: 0 }); };
  function accept(result) {
    setData(result); setClock(result.clock); setLocation(result.environment.location.id);
    if (result.demoId && result.demoScenario) setScenario(result.demoScenario);
    setSelected(old => result.calendar.some(d => d.date === old) ? old : result.calendar.some(d => d.date === result.today) ? result.today : result.calendar[0].date);
  }
  const run = async operation => {
    if (running.current) return;
    running.current = true; setBusy(true); setError(''); setNotice('');
    try { return await operation(); }
    catch (err) { setError(err.code || 'unexpected_error'); if (err.status === 401) { setUser(null); setDemoId(null); setData(null); } }
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
  const beginDemo = (demoWeek = config.defaultDemoWeek, role = 'teacher') => run(async () => { const result = await api('/demo', { locationId: location, demoWeek }); setDemoId(result.demoId); setResetSettings(null); setScenario('normal'); accept(result); setSelected(result.today); navigate('home'); locationHash(`demo/${result.demoId}/home`); if (role === 'parent') window.location.hash = result.share.path.slice(1); });
  const toggleDemo = () => demoId ? run(async () => { setDemoId(null); setResetSettings(null); setData(null); setScenario('normal'); navigate('home'); locationHash('home'); if (user) await load(null, location, 'normal'); }) : beginDemo();
  const action = (path, body = {}) => run(async () => { const result = await api(path, { ...body, ...(demoId ? { demoId, scenario } : {}), revision: data?.week?.revision }); if (result.environment) accept(result); else setData(previous => ({ ...previous, ...result })); return result; });
  useEffect(() => { document.documentElement.lang = lang; document.title = `${t('brand', lang)} · ${t('yourWeek', lang)}`; try { localStorage.setItem('eko-language', lang); } catch {} }, [lang]);
  useEffect(() => {
    run(async () => { const [configuration, auth] = await Promise.all([api('/config'), api('/auth/me')]); setConfig(configuration); setUser(auth.user); setReady(true); if (demoId) await load(demoId, null, null); else if (auth.user) await load(null); });
  }, []);
  useEffect(() => {
    const interval = setInterval(() => { if (!demoId) setClock(new Date().toISOString()); }, 30000);
    return () => clearInterval(interval);
  }, [demoId]);
  useEffect(() => {
    if (page !== 'home' || !data) return;
    const interval = setInterval(() => { if (!document.hidden) refresh(); }, 5 * 60000);
    return () => clearInterval(interval);
  }, [page, demoId, data?.week?.revision]);
  useEffect(() => {
    const handler = () => { const next = window.location.hash.slice(1); if (demoRoute()) setPage(demoRoute()[2] || 'home'); else if (pages.includes(next)) setPage(next); };
    window.addEventListener('hashchange', handler); return () => window.removeEventListener('hashchange', handler);
  }, []);
  useEffect(() => {
    if (!demoId) return;
    let active = true;
    const refreshClassroom = async () => {
      if (document.hidden || running.current) return;
      try {
        const result = await api(`/demo/classroom?demoId=${demoId}`);
        if (active) setData(previous => previous && (!previous.demoClassroom || result.demoClassroom.revision >= previous.demoClassroom.revision) ? { ...previous, ...result } : previous);
      } catch (err) { if (active && err.status === 404) setError(err.code); }
    };
    const interval = setInterval(refreshClassroom, 10000);
    document.addEventListener('visibilitychange', refreshClassroom);
    return () => { active = false; clearInterval(interval); document.removeEventListener('visibilitychange', refreshClassroom); };
  }, [demoId]);
  if (!ready || !config) return html`<div class="boot">${t('brand', lang)}<span>${error ? errorText(error, lang) : t('loading', lang)}</span>${error && html`<button class="button primary" onClick=${() => window.location.reload()}>${t('retry', lang)}</button>`}</div>`;
  if (!user && !demoId) return html`<${Auth} lang=${lang} setLang=${setLang} busy=${busy} error=${error && errorText(error, lang)} onDemo=${role => beginDemo(config.defaultDemoWeek, role)} onAuth=${(kind, fields) => run(async () => { const auth = await api(`/auth/${kind}`, fields); setUser(auth.user); navigate('home'); await load(null); })}/>`;
  const day = data?.week?.days.find(d => d.date === selected);
  const header = page === 'classroom' && demoId ? 'ourClass' : page === 'messages' && demoId ? 'familyInbox' : page === 'create' || page === 'edit' && !data?.week ? 'createPlan' : page === 'edit' ? 'editWeek' : 'yourWeek';
  const classroomAction = body => action('/demo/classroom', { ...body, classroomRevision: data.demoClassroom.revision });
  const changeLocation = value => run(async () => { if (data?.week) accept(await api('/week/location', { locationId: value, revision: data.week.revision, ...(demoId ? { demoId, scenario } : {}) })); else await load(demoId, value); });
  return html`<div class="app-shell"><a class="skip-link" href="#main">${lang === 'mk' ? 'Прескокни до содржината' : 'Skip to content'}</a><aside class="sidebar"><a class="brand" href=${demoId ? `#demo/${demoId}/home` : "#home"} onClick=${e => { e.preventDefault(); navigate('home'); }}><span class="brand-mark"><${Icon} name="leaf" size=${23}/></span>${t('brand', lang)}<span class="brand-period">.</span></a><nav aria-label=${lang === 'mk' ? 'Главно мени' : 'Main navigation'}><a href=${demoId ? `#demo/${demoId}/home` : "#home"} class=${page === 'home' ? 'active' : ''} aria-current=${page === 'home' ? 'page' : undefined} onClick=${e => { e.preventDefault(); navigate('home'); }}><${Icon} name="home"/>${t('home', lang)}</a><a href=${demoId ? `#demo/${demoId}/create` : "#create"} class=${page === 'create' ? 'active' : ''} aria-current=${page === 'create' ? 'page' : undefined} onClick=${e => { e.preventDefault(); navigate('create'); }}><${Icon} name="plus"/>${t('createPlan', lang)}</a><a href=${demoId ? `#demo/${demoId}/edit` : "#edit"} class=${page === 'edit' ? 'active' : ''} aria-current=${page === 'edit' ? 'page' : undefined} onClick=${e => { e.preventDefault(); navigate('edit'); }}><${Icon} name="calendar"/>${t('editWeek', lang)}</a>${demoId && html`<a href=${`#demo/${demoId}/classroom`} class=${page==='classroom'?'active':''} aria-current=${page==='classroom'?'page':undefined} onClick=${e=>{e.preventDefault();navigate('classroom');}}><${Icon} name="people"/>${t('ourClass',lang)}</a><a href=${`#demo/${demoId}/messages`} class=${page==='messages'?'active':''} aria-current=${page==='messages'?'page':undefined} onClick=${e=>{e.preventDefault();navigate('messages');}}><${Icon} name="message"/>${t('familyInbox',lang)}</a>`}</nav><div class="sidebar-bottom">${demoId && data?.demoClassroom && html`<span class="account-name"><span class="account-initial">ES</span><span>${text(data.demoClassroom.teacher.name,lang)}<small>${t('teacherDemo',lang)} · ${text(data.demoClassroom.group,lang)}</small></span></span>`}${!demoId && user && html`<span class="account-name"><span class="account-initial">${user.displayName.slice(0, 1).toUpperCase()}</span><span>${user.displayName}<small>@${user.username}</small></span></span>`}<button class="logout-button" disabled=${busy} onClick=${() => demoId ? toggleDemo() : run(async () => { await api('/auth/logout', {}); setUser(null); setDemoId(null); setResetSettings(null); setData(null); navigate('home'); })}><${Icon} name="logout" size=${18}/>${t(demoId ? 'exitDemo' : user ? 'signOut' : 'signIn', lang)}</button></div></aside>
    <div class="workspace"><header class="topbar"><div class="location-control"><${Icon} name="pin" size=${17}/><select aria-label=${t('city', lang)} value=${location} disabled=${busy || page !== 'home'} onChange=${e => changeLocation(e.currentTarget.value)}>${config.locations.map(l => html`<option key=${l.id} value=${l.id}>${lang === 'mk' ? l.name : l.nameEn}</option>`)}</select></div><div class="topbar-actions"><label class="demo-switch"><input type="checkbox" checked=${!!demoId} disabled=${busy} onChange=${toggleDemo}/><span class="switch-track"></span>${t('demo', lang)}</label><button class="language-switch" onClick=${() => setLang(lang === 'mk' ? 'en' : 'mk')} aria-label=${lang === 'mk' ? 'Switch to English' : 'Промени на македонски'}>${lang === 'mk' ? 'EN' : 'МК'}</button></div></header>
    <main id="main">${demoId && data?.share && html`<${DemoRoleBar} role="teacher" lang=${lang} teacherPath=${`/#demo/${demoId}/home`} parentPath=${data.share.path}/>`}<div class="page-heading"><div><span class="eyebrow">${data ? localizedDate(data.clock, lang, { weekday: 'long', day: 'numeric', month: 'long' }) : t('loading', lang)}</span><h1>${t(header, lang)}<span class="heading-dot">.</span></h1><p class="group-heading">${demoId&&data?.demoClassroom?`${text(data.demoClassroom.kindergarten,lang)} · ${text(data.demoClassroom.group,lang)}`:`${data?.week?.settings.gradinka?.name || data?.profile?.gradinka?.name || ''}${data?.week?.settings.groupName ? ` · ${data.week.settings.groupName}` : ''}`}</p><p>${t(header === 'createPlan' ? 'createSubtitle' : page === 'edit' ? 'editSubtitle' : 'weekSubtitle', lang)}</p></div><img class="heading-illustration" src="/assets/little-gardeners.svg" alt="" width="530" height="330"/></div>
    ${demoId && page !== 'create' && html`<${DemoControls} week=${data?.week} clock=${data?.clock || clock} scenario=${scenario} config=${config} lang=${lang} busy=${busy} onWeek=${beginDemo} onScenario=${value => run(async () => { await load(demoId, location, value, true); setScenario(value); })}/>`}
    ${error && html`<div class="alert error" role="alert"><span>${errorText(error, lang)}</span><button class="button quiet" onClick=${refresh} disabled=${busy}>${t('refresh', lang)}</button></div>`}${notice && html`<div class="alert success" role="status">${t(notice, lang)}</div>`}
    ${busy && html`<div class="busy-status" role="status"><span class="spinner"></span>${t(page === 'create' ? 'generating' : 'loading', lang)}</div>`}
    ${!data ? html`<div class="card loading-card"><${Icon} name="leaf" size=${36}/><p>${t('loading', lang)}</p></div>` : page === 'classroom' && demoId ? html`<${DemoClassroom} classroom=${data.demoClassroom} lang=${lang} busy=${busy} onAction=${classroomAction}/>` : page === 'messages' && demoId ? html`<${Conversation} classroom=${data.demoClassroom} role="teacher" lang=${lang} busy=${busy} onAction=${classroomAction}/>` : page === 'home' ? html`${demoId && data.demoClassroom && html`<${ClassroomSummary} classroom=${data.demoClassroom} lang=${lang} onClass=${()=>navigate('classroom')} onInbox=${()=>navigate('messages')}/>`}<${GenerationStatus} week=${data.week} lang=${lang}/><div class="overview-grid"><${Calendar} data=${data} lang=${lang} selected=${selected} onSelect=${setSelected} onGenerate=${() => navigate('create')}/><${AirCard} environment=${data.environment} lang=${lang} busy=${busy} refresh=${refresh}/></div>${data.week?.changes?.length ? html`<div class="adaptation-note" role="status"><${Icon} name="refresh" size=${18}/><p><b>${t('changedDay', lang)}.</b> ${data.week.changes.map(c => `${t('moved', lang)}: ${dayName(c.from, lang)} → ${c.to ? dayName(c.to, lang) : t('noReplacement', lang)}`).join(' ')}</p></div>` : null}${day && html`<${DayPlan} day=${day} data=${data} lang=${lang} clock=${clock} onEdit=${() => navigate('edit')} materials=${config.materials}/><${ParentShare} share=${data.share} lang=${lang} busy=${busy} onShare=${shareAction => action('/week/share', { action: shareAction })}/><${Messages} share=${data.share} week=${data.week} selected=${selected} lang=${lang} busy=${busy} onRecheck=${() => action('/week/recheck')} onApprove=${() => action('/week/approve')}/>`}` : page === 'create' || !data.week ? html`<${CreatePlan} demo=${!!demoId} replacing=${Boolean(data.week) && !demoId} key=${demoId || 'real'} config=${config} lang=${lang} initial=${data.week?.settings || resetSettings || data.profile || { ...config.defaults, locationId: location }} busy=${busy} onCancel=${() => navigate('home')} onGenerate=${settings => run(async () => { accept(await api('/week/generate', { settings, requireAI: Boolean(data.week) && !demoId, revision: data.week?.revision, ...(demoId ? { demoId, scenario } : {}) })); navigate('edit'); })}/>` : html`<${EditWeek} onSuggestDay=${(date, instruction) => api('/week/day/suggest', { date, instruction, revision: data.week.revision, ...(demoId ? { demoId, scenario } : {}) })} onApplyDay=${proposalId => action('/week/day/apply', { proposalId })} error=${error ? errorText(error, lang) : ''} key=${`${demoId || 'real'}-${data.week.revision}`} data=${data} lang=${lang} busy=${busy} selected=${selected} onSelect=${setSelected} onCancel=${() => navigate('home')} onDelete=${() => run(async () => { const result = await api('/week/delete', { revision: data.week.revision, ...(demoId ? { demoId } : {}) }); setResetSettings(result.settings); setData(previous => ({ ...previous, week: null })); navigate('create'); setNotice('weekDeleted'); })} onSave=${draft => run(async () => { accept(await api('/week/edit', { settings: draft.settings, days: draft.days, revision: data.week.revision, ...(demoId ? { demoId, scenario } : {}) })); navigate('home'); setNotice('saved'); })}/>`}
    </main></div></div>`;
}
function locationHash(next) { if (window.location.hash !== `#${next}`) window.history.pushState(null, '', `#${next}`); }
function Root() {
  const [hash, setHash] = useState(window.location.hash);
  useEffect(() => { const update = () => setHash(window.location.hash); window.addEventListener('hashchange', update); return () => window.removeEventListener('hashchange', update); }, []);
  return hash.startsWith('#parents/') ? html`<${ParentWeek} token=${/^[a-f0-9]{64}$/.test(hash.slice(9)) ? hash.slice(9) : 'invalid'}/>` : html`<${App} key=${hash.match(/^#demo\/([a-f0-9-]{36})/)?.[1] || 'real'}/>`;
}
render(html`<${Root}/>`, document.getElementById('app'));
