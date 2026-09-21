import { html, useState, useEffect, localizedDate, safeHref } from '../lib/ui.js';
import { t } from '../locales/index.js';
import { Icon } from './Icon.js';
export function AirCard({ environment: e, lang, refresh, busy }) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    if (e?.mode === 'demo') return;
    const tick = () => setNow(Date.now());
    const timer = setInterval(tick, 1000);
    document.addEventListener('visibilitychange', tick);
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', tick); };
  }, [e?.mode]);
  if (!e) return null;
  const a = e.assessment;
  const clock = e.mode === 'demo' ? Date.parse(e.clock) : Math.max(now, Date.parse(e.clock));
  const age = clock - Date.parse(a.oldestObservation);
  const valid = a.valid && !e.failedRefresh && Number.isFinite(a.aqi) &&
    age >= 0 && age <= (e.freshnessMinutes ?? 60) * 60000;
  const state = airState(valid, a.aqi);
  return html`
    <section class=${'card air-card air-' + state}>
      <div class="card-heading">
        <h2>${t('airNow', lang)}</h2>
        ${
          refresh &&
          html`
            <button class="icon-button" disabled=${busy} onClick=${refresh} aria-label=${t('refresh', lang)}>
              <${Icon} name="refresh" size=${18} />
            </button>

`
        }
      </div>
      <span class=${'air-state ' + state}><span class="small-dot"></span>${t(state, lang)}</span>
      <div class="air-reading">
        ${valid ? a.aqi : '··'}<span>AQI</span>
        <div class="air-decoration"><${Icon} name="wind" size=${66} /></div>
      </div>
      <p class="air-metric">
        ${valid && Number.isFinite(a.pm25) ? '' + a.pm25.toFixed(1) + ' µg/m³ · PM2.5' : t('airUnknown', lang)}
      </p>
      <div class="air-scale" aria-hidden="true"><i /><i /><i /><i /><i /></div>
      <div class="air-bottom">
        <span class="data-label">${observationLabel({ e, lang, a })}</span>
        <small>${t('airScope', lang)}</small>
        <details class="source-details">
          <summary>${t('readings', lang)}</summary>
          <p>${t('airBasis', lang)}. ${t('weatherBasis', lang)}.</p>
          <a href=${safeHref('https://' + e.location.pulseCity + '.pulse.eco/')} target="_blank" rel="noreferrer"
            >pulse.eco · ${lang === 'mk' ? e.location.name : e.location.nameEn}</a
          >
          <p>${a.sensors?.length || 0} ${t('sensors', lang)} · ${observationSource({ e, lang })}</p>
          <a
            href="https://document.airnow.gov/air-quality-and-outdoor-guidance-for-schools.pdf"
            target="_blank"
            rel="noreferrer"
            >EPA · ${lang === 'mk' ? 'Основа за активностите' : 'Activity guidance'}</a
          >
        </details>
      </div>
    </section>

`;
}

function observationLabel({ e, lang, a }) {
  if (e.mode === 'demo') {
    return `${t('demoSample', lang)} · ${localizedDate(e.clock, lang, {
      day: 'numeric',
      month: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })}`;
  }
  if (a.oldestObservation) {
    return `${t('measured', lang)} ${localizedDate(a.oldestObservation, lang, {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    })}`;
  }
  return t('unknown', lang);
}

function observationSource({ e, lang }) {
  if (e.mode === 'demo') {
    return t('demo', lang);
  }
  if (e.cached) {
    if (lang === 'mk') {
      return 'Зачувани набљудувања';
    }
    return 'Cached observations';
  }
  return 'pulse.eco';
}

function airState(valid, aqi) {
  if (!valid) return 'unknown';
  if (aqi > 100) return 'elevated';
  return aqi > 50 ? 'moderate' : 'good';
}
