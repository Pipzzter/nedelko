import { html, localizedDate } from '../lib/ui.js';
import { t } from '../locales/index.js';
import { Icon } from './Icon.js';
export function AirCard({ environment: e, lang, refresh, busy }) {
  if (!e) return null;
  const a = e.assessment; const valid = a.valid && !e.failedRefresh;
  const state = !valid ? 'unknown' : a.aqi > 100 ? 'elevated' : a.aqi > 50 ? 'moderate' : 'good';
  return html`<section class=${`card air-card air-${state}`}><div class="card-heading"><h2>${t('airNow', lang)}</h2><button class="icon-button" disabled=${busy} onClick=${refresh} aria-label=${t('refresh', lang)}><${Icon} name="refresh" size=${18}/></button></div>
    <span class=${`air-state ${state}`}><span class="small-dot"></span>${t(state, lang)}</span>
    <div class="air-reading">${valid ? a.aqi : '··'}<span>AQI</span><div class="air-decoration"><${Icon} name="wind" size=${66}/></div></div>
    <p class="air-metric">${valid && Number.isFinite(a.pm25) ? `${a.pm25.toFixed(1)} µg/m³ · PM2.5` : t('airUnknown', lang)}</p>
    <div class="air-scale" aria-hidden="true"><i/><i/><i/><i/><i/></div>
    <div class="air-bottom"><span class="data-label">${e.mode === 'demo' ? `${t('demoSample', lang)} · ${localizedDate(e.clock, lang, { day: 'numeric', month: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}` : a.oldestObservation ? `${t('measured', lang)} ${localizedDate(a.oldestObservation, lang, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}` : t('unknown', lang)}</span>
      <small>${t('airScope', lang)}</small>
      <details class="source-details"><summary>${t('readings', lang)}</summary><p>${t('airBasis', lang)}. ${t('weatherBasis', lang)}.</p><a href=${`https://${e.location.pulseCity}.pulse.eco/`} target="_blank" rel="noreferrer">pulse.eco · ${lang === 'mk' ? e.location.name : e.location.nameEn}</a><p>${a.sensors?.length || 0} ${t('sensors', lang)} · ${e.mode === 'demo' ? t('demo', lang) : e.cached ? lang === 'mk' ? 'Зачувани набљудувања' : 'Cached observations' : 'pulse.eco'}</p><a href="https://document.airnow.gov/air-quality-and-outdoor-guidance-for-schools.pdf" target="_blank" rel="noreferrer">EPA · ${lang === 'mk' ? 'Основа за активностите' : 'Activity guidance'}</a></details>
    </div></section>`;
}
