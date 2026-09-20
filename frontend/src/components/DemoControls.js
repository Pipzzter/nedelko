import { html, text, localizedDate } from '../lib/ui.js';
import { t } from '../locales/index.js';

export function DemoControls({ week, clock, scenario, config, lang, busy, onWeek, onScenario }) {
  return html`<section class="demo-banner" aria-label=${t('demo', lang)}>
    <div class="demo-description"><b>${t('demoSample', lang)} · ${localizedDate(clock, lang, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</b><span>${t('demoPrivate', lang)}</span></div>
    <div class="demo-controls">
      <label>${t('demoWeek', lang)}<select class="demo-week-select" value=${week?.demoWeek || config.defaultDemoWeek} disabled=${busy} onChange=${e => onWeek(e.currentTarget.value)}>
        ${config.demoWeeks.map(option => html`<option key=${option.id} value=${option.id}>${text(option.label, lang)}</option>`)}
      </select></label>
      <label>${t('demoAir', lang)}<select class="demo-air-select" value=${scenario} disabled=${busy} onChange=${e => onScenario(e.currentTarget.value)}>
        ${config.demoScenarios.map(value => html`<option key=${value} value=${value}>${t(value, lang)}</option>`)}
      </select></label>
    </div>
  </section>`;
}
