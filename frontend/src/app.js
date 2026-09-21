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
import { ParentWeek } from './pages/ParentWeek.js';
import { PlanChanges } from './components/PlanChanges.js';
import { ParentNotes } from './components/ParentNotes.js';
import { RequestProgress } from './components/RequestProgress.js';
const demoRoute = () =>
  /^#demo\/([a-f0-9-]{36})(?:\/(home|plan(?:\/new)?|edit|create|classroom|messages|notes))?$/.exec(window.location.hash);
const pages = new Set(['home', 'plan', 'plan/new', 'create', 'edit', 'notes']);
// Keep existing bookmarks working within the single planning destination.
const currentPage = () => {
  const next = demoRoute()?.[2] || window.location.hash.slice(1);
  if (next === 'notes') return 'notes';
  if (next === 'edit' || next === 'plan') return 'home';
  if (next === 'create' || next === 'plan/new') return 'create';
  return 'home';
};

const initialLanguage = () => {
  try {
    return localStorage.getItem('nedelko-language') === 'en' ? 'en' : 'mk';
  } catch {
    return 'mk';
  }
};
const firstVisit = () => {
  try {
    return !localStorage.getItem('nedelko-visited');
  } catch {
    return false;
  }
};
const markVisited = () => {
  try {
    localStorage.setItem('nedelko-visited', '1');
  } catch {}
};
function App() {
  const [lang, setLang] = useState(initialLanguage);
  const [config, setConfig] = useState(null);
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [page, setPage] = useState(currentPage);
  const [resetSettings, setResetSettings] = useState(null);
  const [demoIntro, setDemoIntro] = useState(false);
  const [selected, setSelected] = useState(null);
  const [demoId, setDemoId] = useState(() => demoRoute()?.[1] || null);
  const [scenario, setScenario] = useState('normal');
  const [location, setLocation] = useState(null);
  const [clock, setClock] = useState(new Date().toISOString());
  const running = useRef(false);
  const navigate = (next) => {
    setPage(next);
    locationHash(demoId ? `demo/${demoId}/${next}` : next);
    setError('');
    window.scrollTo({ top: 0 });
  };
  function accept(result) {
    setData(result);
    setClock(result.clock);
    setLocation(result.environment.location.id);
    if (result.demoId && result.demoScenario) setScenario(result.demoScenario);
    setSelected((old) => {
      if (result.calendar.some((d) => d.date === old)) {
        return old;
      }
      if (result.calendar.some((d) => d.date === result.today)) {
        return result.today;
      }
      return result.calendar[0].date;
    });
  }
  const run = async (operation, propagate = false, background = false) => {
    if (running.current) {
      if (propagate) throw Object.assign(new Error('operation_pending'), { code: 'operation_pending' });
      if (!background) setError('operation_pending');
      return;
    }
    running.current = true;
    // Polls share the operation lock without disabling a teacher's active draft.
    if (!background) setBusy(true);
    setError('');
    try {
      return await operation();
    } catch (err) {
      setError(err.code || 'unexpected_error');
      if (err.status === 401) {
        setUser(null);
        setDemoId(null);
        setData(null);
      }
      if (propagate) throw err;
    } finally {
      running.current = false;
      if (!background) setBusy(false);
    }
  };
  const load = async (id = demoId, selectedLocation = location, selectedScenario = scenario, fresh = false, background = false) => {
    const query = new URLSearchParams({
      ...(selectedLocation ? { location: selectedLocation } : {}),
      ...(selectedScenario ? { scenario: selectedScenario } : {}),
      ...(id ? { demoId: id } : {}),
      ...(fresh ? { fresh: '1' } : {})
    });
    accept(await api(`/dashboard?${query}`, undefined, { background }));
  };
  const refreshDashboard = (background = false) =>
    run(async () => {
      // Clear approval in the UI immediately, including while the network is unavailable.
      setData(current => current?.week ? { ...current, week: { ...current.week, approval: null, checkedAt: null } } : current);
      await load(demoId, location, scenario, true, background);
    }, false, background);
  const refresh = () => refreshDashboard();
  const beginDemo = (demoWeek = config.defaultDemoWeek) =>
    run(async () => {
      const result = await api('/demo', { locationId: location, demoWeek });
      setDemoId(result.demoId);
      setResetSettings(null);
      setScenario('normal');
      accept(result);
      setSelected(result.today);
      navigate('home');
      locationHash(`demo/${result.demoId}/home`);
    });
  const toggleDemo = () =>
    demoId
      ? run(async () => {
          setDemoId(null);
          setResetSettings(null);
          setData(null);
          setScenario('normal');
          navigate('home');
          locationHash('home');
          if (user) await load(null, location, 'normal');
        })
      : beginDemo();
  const action = (path, body = {}, propagate = false) =>
    run(async () => {
      const result = await api(path, {
        ...body,
        ...(demoId ? { demoId, scenario } : {}),
        revision: body.revision ?? data?.week?.revision
      });
      if (result.environment) accept(result);
      else setData((previous) => ({ ...previous, ...result }));
      return result;
    }, propagate);
  useEffect(() => {
    document.documentElement.lang = lang;
    document.title = `${t('brand', lang)} · ${t('yourWeek', lang)}`;
    try {
      localStorage.setItem('nedelko-language', lang);
    } catch {}
  }, [lang]);
  useEffect(() => {
    run(async () => {
      const [configuration, auth] = await Promise.all([api('/config'), api('/auth/me')]);
      setConfig(configuration);
      setUser(auth.user);
      if (demoId) {
        setReady(true);
        await load(demoId, null, null);
      } else if (auth.user) {
        setReady(true);
        await load(null);
      } else if (firstVisit()) {
        markVisited();
        const result = await api('/demo', { locationId: location, demoWeek: configuration.defaultDemoWeek });
        setDemoId(result.demoId);
        setScenario('normal');
        accept(result);
        setSelected(result.today);
        locationHash(`demo/${result.demoId}/home`);
        setDemoIntro(true);
        setReady(true);
      } else setReady(true);
    });
  }, []);
  useEffect(() => {
    const interval = setInterval(() => {
      if (!demoId) setClock(new Date().toISOString());
    }, 30000);
    return () => clearInterval(interval);
  }, [demoId]);
  useEffect(() => {
    if (page !== 'home' || !data) return;
    const resume = () => {
      if (!document.hidden) refreshDashboard(true);
    };
    const interval = setInterval(resume, 60000);
    document.addEventListener('visibilitychange', resume);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', resume);
    };
  }, [page, demoId, location, scenario, data?.week?.revision]);
  useEffect(() => {
    const handler = () => {
      if (demoRoute() || pages.has(window.location.hash.slice(1))) setPage(currentPage());
    };
    window.addEventListener('hashchange', handler);
    return () => window.removeEventListener('hashchange', handler);
  }, []);
  if (!ready || !config) return renderBootScreen({ lang, error });
  if (!user && !demoId)
    return html`
      <${Auth}
        lang=${lang}
        setLang=${setLang}
        config=${config}
        busy=${busy}
        error=${error && errorText(error, lang)}
        onDemo=${() => beginDemo()}
        onAuth=${(kind, fields) =>
          run(async () => {
            const auth = await api('/auth/' + kind, fields);
            setUser(auth.user);
            navigate('home');
            await load(null);
          })}
      />

`;
  const day = data?.week?.days.find((d) => d.date === selected);
  const creating = page === 'create';
  const header = pageTitle(page, creating, Boolean(data?.week));
  const gradinkaName = data?.week?.settings.gradinka?.name || data?.profile?.gradinka?.name || '';
  const groupName = data?.week?.settings.groupName || data?.profile?.groupName || '';
  const place = config.locations.find(
    (l) => l.id === (data?.week?.settings.locationId || data?.profile?.locationId || location)
  );
  return renderApplicationShell({
    lang,
    demoId,
    navigate,
    page,
    place,
    busy,
    toggleDemo,
    setLang,
    run,
    setUser,
    setDemoId,
    setResetSettings,
    setData,
    data,
    header,
    gradinkaName,
    groupName,
    clock,
    scenario,
    config,
    beginDemo,
    load,
    location,
    setScenario,
    error,
    refresh,
    user,
    action,
    creating,
    resetSettings,
    accept,
    selected,
    setSelected,
    day,
    demoIntro,
    setDemoIntro
  });
}
function locationHash(next) {
  if (window.location.hash !== `#${next}`) window.history.pushState(null, '', `#${next}`);
}
function Root() {
  const [hash, setHash] = useState(window.location.hash);
  useEffect(() => {
    const update = () => setHash(window.location.hash);
    window.addEventListener('hashchange', update);
    return () => window.removeEventListener('hashchange', update);
  }, []);
  return html`
    <div class="application-root">
      <div id="app-screen">${renderRoute({ hash })}</div>
      <${RequestProgress} />
    </div>

`;
}
render(html`
 <${Root} />
`, document.getElementById('app'));

function renderPage({
  page,
  demoId,
  user,
  data,
  lang,
  busy,
  run,
  scenario,
  action,
  creating,
  config,
  resetSettings,
  location,
  navigate,
  accept,
  selected,
  setSelected,
  refresh,
  day,
  clock,
  setResetSettings,
  setData
}) {
  if (page === 'notes') {
    return html`
      <${ParentNotes}
        key=${demoId || user.id}
        demoId=${demoId}
        week=${data?.week}
        lang=${lang}
        busy=${busy}
        onSuggest=${(noteId) =>
          run(
            () =>
              api('/parent-notes/suggest', {
                noteId,
                revision: data.week.revision,
                ...(demoId
                  ? {
                      demoId,
                      scenario
                    }
                  : {})
              }),
            true
          )}
        onApply=${(proposalId) =>
          action(
            '/parent-notes/apply',
            {
              proposalId
            },
            true
          )}
      />

`;
  }
  if (!data) {
    return html`
      <div class="card loading-card">
        <${Icon} name="leaf" size=${36} />
        <p>${t('loading', lang)}</p>
      </div>

`;
  }
  if (creating) {
    return html`
      <${CreatePlan}
        demo=${!!demoId}
        replacing=${Boolean(data.week)}
        key=${demoId || 'real'}
        config=${config}
        lang=${lang}
        initial=${
          data.week?.settings ||
          resetSettings ||
          data.profile || {
            ...config.defaults,
            locationId: location
          }
        }
        busy=${busy}
        onCancel=${() => navigate('home')}
        onGenerate=${(settings) =>
          run(async () => {
            accept(
              await api('/week/generate', {
                settings,
                requireAI: Boolean(data.week) && !demoId,
                revision: data.week?.revision,
                ...(demoId
                  ? {
                      demoId,
                      scenario
                    }
                  : {})
              })
            );
            navigate('home');
          })}
      />

`;
  }
  if (!data.week) {
    return html`
      <section class="card kindergarten-empty">
        <span class="empty-sprout"><${Icon} name="leaf" size=${32} /></span>
        <h2>${t('weekEmpty', lang)}</h2>
        <p>${t('kindergartenStart', lang)}</p>
        <button class="button primary" onClick=${() => navigate('create')}>
          ${t('generate', lang)}<${Icon} name="arrow" size=${18} />
        </button>
      </section>

`;
  }
  return html`
    <div class="overview-grid">
      <${Calendar} data=${data} lang=${lang} selected=${selected} onSelect=${setSelected} /><${AirCard}
        environment=${data.environment}
        lang=${lang}
        busy=${busy}
        refresh=${refresh}
      />
    </div>
    <${PlanChanges} changes=${data.week.changes} today=${data.today} lang=${lang} onSelect=${setSelected} />
    ${
      day &&
      html`
        <${DayPlan}
          day=${day}
          data=${data}
          lang=${lang}
          clock=${clock}
          materials=${config.materials}
          busy=${busy}
          demo=${!!demoId}
          onSuggest=${(request) =>
            run(
              () =>
                api('/week/change/suggest', {
                  ...request,
                  revision: data.week.revision,
                  ...(demoId
                    ? {
                        demoId,
                        scenario
                      }
                    : {})
                }),
              true
            )}
          onApply=${(proposalId) =>
            action(
              '/week/change/apply',
              {
                proposalId
              },
              true
            )}
          onEdit=${(request) => action('/week/day/edit', request, true)}
          onPlace=${(value) =>
            action('/week/edit', {
              settings: data.week.settings,
              days: data.week.days.map((item) =>
                item.date === day.date
                  ? {
                      ...item,
                      outdoorPreference: value
                    }
                  : item
              )
            })}
        />

`
    }
    <${ParentShare}
      share=${data.share}
      lang=${lang}
      busy=${busy}
      onShare=${(shareAction) =>
        action('/week/share', {
          action: shareAction
        })}
    />
    <${Messages}
      share=${data.share}
      week=${data.week}
      selected=${selected}
      lang=${lang}
      busy=${busy}
      onRecheck=${() => action('/week/recheck')}
      onApprove=${() => action('/week/approve')}
    />
    <${WeekActions}
      lang=${lang}
      source=${data.week.source}
      busy=${busy}
      onRegenerate=${() => navigate('create')}
      onDelete=${() =>
        run(async () => {
          const result = await api('/week/delete', {
            revision: data.week.revision,
            ...(demoId
              ? {
                  demoId
                }
              : {})
          });
          setResetSettings(result.settings);
          setData((previous) => ({
            ...previous,
            week: null,
            share: null
          }));
          navigate('home');
        })}
    />

`;
}

function renderBootScreen({ lang, error }) {
  return html`
    <div class="boot">
      ${t('brand', lang)}<span>${error ? errorText(error, lang) : t('loading', lang)}</span>${
        error &&
        html`
 <button class="button primary" onClick=${() => window.location.reload()}>${t('retry', lang)}</button>
`
      }
    </div>

`;
}

function renderRoute({ hash }) {
  if (hash.startsWith('#parents/')) {
    return html`
 <${ParentWeek} token=${/^[a-f0-9]{64}$/.test(hash.slice(9)) ? hash.slice(9) : 'invalid'} />
`;
  }
  return html`
 <${App} key=${hash.match(/^#demo\/([a-f0-9-]{36})/)?.[1] || 'real'} />
`;
}

function locationLabel({ place, lang }) {
  if (place) {
    if (lang === 'mk') {
      return place.name;
    }
    return place.nameEn;
  }
  return '';
}

function renderApplicationShell({
  lang,
  demoId,
  navigate,
  page,
  place,
  busy,
  toggleDemo,
  setLang,
  run,
  setUser,
  setDemoId,
  setResetSettings,
  setData,
  data,
  header,
  gradinkaName,
  groupName,
  clock,
  scenario,
  config,
  beginDemo,
  load,
  location,
  setScenario,
  error,
  refresh,
  user,
  action,
  creating,
  resetSettings,
  accept,
  selected,
  setSelected,
  day,
  demoIntro,
  setDemoIntro
}) {
  return html`
    <div class="app-shell">
      <a class="skip-link" href="#main">${lang === 'mk' ? 'Прескокни до содржината' : 'Skip to content'}</a>
      <div class="workspace">
        <header class="topbar teacher-navbar">
          <a
            class="brand"
            href=${demoId ? '#demo/' + demoId + '/home' : '#home'}
            onClick=${(e) => {
              e.preventDefault();
              navigate('home');
            }}
            ><span class="brand-mark"><${Icon} name="leaf" size=${23} /></span>${t('brand', lang)}</a
          >
          <nav aria-label=${lang === 'mk' ? 'Главно мени' : 'Main navigation'}>
            ${[
              ['home', 'home', 'home'],
              ['notes', 'parentNotes', 'message']
            ].map(
              ([destination, label, icon]) => html`
                <a
                  href=${demoId ? '#demo/' + demoId + '/' + destination : '#' + destination}
                  class=${page === destination ? 'active' : ''}
                  aria-current=${page === destination ? 'page' : undefined}
                  onClick=${(e) => {
                    e.preventDefault();
                    navigate(destination);
                  }}
                  ><${Icon} name=${icon} size=${18} />${t(label, lang)}</a
                >

`
            )}
          </nav>
          <div class="topbar-actions">
            <div class="location-control">
              <${Icon} name="pin" size=${17} /><span>${locationLabel({ place, lang })}</span>
            </div>
            <label class="demo-switch"
              ><input type="checkbox" checked=${!!demoId} disabled=${busy} onChange=${toggleDemo} /><span
                class="switch-track"
              ></span
              >${t('demo', lang)}</label
            ><button
              class="language-switch"
              onClick=${() => setLang(lang === 'mk' ? 'en' : 'mk')}
              aria-label=${lang === 'mk' ? 'Switch to English' : 'Промени на македонски'}
            >
              ${lang === 'mk' ? 'EN' : 'МК'}
            </button>
            <button
              class="logout-button"
              disabled=${busy}
              onClick=${() =>
                demoId
                  ? toggleDemo()
                  : run(async () => {
                      await api('/auth/logout', {});
                      setUser(null);
                      setDemoId(null);
                      setResetSettings(null);
                      setData(null);
                      navigate('home');
                    })}
            >
              <${Icon} name="logout" size=${18} />${t(demoId ? 'exitDemo' : 'signOut', lang)}
            </button>
          </div>
        </header>
        <main id="main">
          <div class="page-heading">
            <div>
              <span class="eyebrow"
                >${data ? localizedDate(data.clock, lang, { weekday: 'long', day: 'numeric', month: 'long' }) : t('loading', lang)}</span
              >
              <h1>${t(header, lang)}<span class="heading-dot">.</span></h1>
              <p class="group-heading">
                ${'' + gradinkaName + (groupName && groupName !== gradinkaName ? ' · ' + groupName : '')}
              </p>
            </div>
            <img class="heading-illustration" src="/assets/little-gardeners.svg" alt="" width="530" height="330" />
          </div>
          ${
            demoId &&
            page === 'home' &&
            html`
              <${DemoControls}
                week=${data?.week}
                clock=${data?.clock || clock}
                scenario=${scenario}
                config=${config}
                lang=${lang}
                busy=${busy}
                onWeek=${beginDemo}
                onScenario=${(value) =>
                  run(async () => {
                    await load(demoId, location, value, true);
                    setScenario(value);
                  })}
              />

`
          }
          ${
            error &&
            html`
              <div class="alert error" role="alert">
                <span>${errorText(error, lang)}</span
                ><button class="button quiet" onClick=${refresh} disabled=${busy}>${t('refresh', lang)}</button>
              </div>

`
          }
          ${renderPage({
            page,
            demoId,
            user,
            data,
            lang,
            busy,
            run,
            scenario,
            action,
            creating,
            config,
            resetSettings,
            location,
            navigate,
            accept,
            selected,
            setSelected,
            refresh,
            day,
            clock,
            setResetSettings,
            setData
          })}
        </main>
      </div>
      ${
        demoIntro &&
        demoId &&
        html`
          <div
            class="modal-overlay"
            role="dialog"
            aria-modal="true"
            aria-labelledby="demo-intro-title"
            onClick=${(e) => {
              if (e.target === e.currentTarget) setDemoIntro(false);
            }}
          >
            <div class="modal-card">
              <span class="modal-icon"><${Icon} name="leaf" size=${26} /></span>
              <h2 id="demo-intro-title">${t('demoIntroTitle', lang)}</h2>
              <p>${t('demoIntroBody', lang)}</p>
              <p class="soft-note">${t('demoIntroToggle', lang)}</p>
              <div class="modal-actions">
                <button class="button primary" onClick=${() => setDemoIntro(false)}>
                  ${t('demoIntroExplore', lang)}<${Icon} name="arrow" size=${18} />
                </button>
                <button
                  class="button secondary"
                  onClick=${() => {
                    setDemoIntro(false);
                    toggleDemo();
                  }}
                >
                  ${t('demoIntroLeave', lang)}
                </button>
              </div>
            </div>
          </div>

`
      }
    </div>

`;
}

function pageTitle(page, creating, hasWeek) {
  if (page === 'notes') return 'parentNotes';
  if (creating) return hasWeek ? 'regenerateWeek' : 'createPlan';
  return hasWeek ? 'yourWeek' : 'kindergarten';
}
