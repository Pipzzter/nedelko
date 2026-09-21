import { html, useState, text } from '../lib/ui.js';
import { t } from '../locales/index.js';
import { SettingsForm } from '../components/SettingsForm.js';
import { Icon } from '../components/Icon.js';
import { planIssues, focusPlanField } from '../lib/plan-form.js';

export function CreatePlan({ config, lang, initial, onGenerate, onCancel, busy, replacing = false, demo = false }) {
  const [settings, setSettings] = useState(() => structuredClone(initial || config.defaults));
  const [confirmed, setConfirmed] = useState(false);
  const [attempted, setAttempted] = useState(false);
  const issues = planIssues(settings, config, confirmed);
  const complete = [1, 2].map((section) => !issues.some((issue) => issue.section === section));
  const count = complete.filter(Boolean).length;
  const change = (next) => {
    if (
      next.dayStart !== settings.dayStart ||
      next.dayEnd !== settings.dayEnd ||
      JSON.stringify(next.blocks) !== JSON.stringify(settings.blocks)
    )
      setConfirmed(false);
    setSettings(next);
  };
  const submit = (event) => {
    event.preventDefault();
    if (busy) return;
    setAttempted(true);
    if (issues.length) {
      focusPlanField(issues[0].field);
      return;
    }
    // Open a collapsed advanced field before native validation tries to focus it.
    const invalid =
      event.currentTarget.checkValidity && !event.currentTarget.checkValidity()
        ? event.currentTarget.querySelector(':invalid')
        : null;
    if (invalid) {
      const details = invalid.closest('details');
      if (details) details.open = true;
      invalid.reportValidity?.();
      return;
    }
    onGenerate(settings);
  };
  const selectedLocation = config.locations.find(location => location.id === settings.locationId);
  return html`
    <form class="plan-builder" novalidate onSubmit=${submit}>
      <div class="planning-welcome">
        <span class="welcome-symbol"><${Icon} name="leaf" size=${29} /></span>
        <div>
          <span class="eyebrow">${t('startHere', lang)}</span>
          <h2>${t('planningWelcome', lang)}</h2>
          <p>${t('planningIntro', lang)}</p>
        </div>
      </div>
      ${replacing && html`
 <p class="alert planning-replace">${t('regenerateHelp', lang)}</p>
`}
      <p class="required-legend">${t('requiredLegend', lang)}</p>
      ${
        attempted &&
        issues.length > 0 &&
        html`
          <section class="planning-errors" role="alert">
            <h3>${t('fixBeforeGenerate', lang)}</h3>
            <ul>
              ${issues.map(
                (issue) => html`
                  <li>
                    <button type="button" onClick=${() => focusPlanField(issue.field)}>${t(issue.key, lang)}</button>
                  </li>

`
              )}
            </ul>
          </section>

`
      }
      <div class="planning-layout">
        <fieldset class="planning-fields" disabled=${busy}>
          <legend class="sr-only">${t(replacing ? 'regenerateWeek' : 'createPlan', lang)}</legend>
          <${SettingsForm}
            config=${config}
            value=${settings}
            onChange=${change}
            lang=${lang}
            issues=${attempted ? issues : []}
            rhythmConfirmed=${confirmed}
            onConfirm=${setConfirmed}
            demo=${demo}
          />
        </fieldset>
        <aside class="planning-companion">
          <div class="card planning-progress">
            <span class="eyebrow">${t('yourPlanPreview', lang)}</span>
            <h2>${settings.gradinka?.name?.trim() || t('kindergartenName', lang)}</h2>
            <div
              class="progress-track"
              role="progressbar"
              aria-label=${t('readySections', lang)}
              aria-valuenow=${count}
              aria-valuemin="0"
              aria-valuemax="2"
            >
              <span style=${'width:' + (count / 2) * 100 + '%'}></span>
            </div>
            <p class="progress-count" aria-live="polite">${count}/2 ${t('readySections', lang)}</p>
            <nav aria-label=${t('createPlan', lang)}>
              ${['shortLearning', 'shortRhythm'].map(
                (key, i) => html`
                  <button
                    type="button"
                    onClick=${() => document.getElementById('plan-section-' + (i + 1))?.scrollIntoView({ block: 'start', behavior: 'auto' })}
                  >
                    <span class=${complete[i] ? 'complete' : ''}
                      >${complete[i] ? html`
 <${Icon} name="check" size=${15} />
` : '0' + (i + 1)}</span
                    ><b>${t(key, lang)}</b><${Icon} name="arrow" size=${16} />
                  </button>

`
              )}
            </nav>
            <dl>
              <div>
                <dt>${t('city', lang)}</dt>
                <dd>
                  ${text(selectedLocation ? {mk: selectedLocation.name, en: selectedLocation.nameEn} : null, lang) || '··'}
                </dd>
              </div>
              <div>
                <dt>${t('shortRhythm', lang)}</dt>
                <dd>${settings.dayStart || '··:··'}–${settings.dayEnd || '··:··'}</dd>
              </div>
              <div>
                <dt>${t('materials', lang)}</dt>
                <dd>${settings.materials.length}/${config.materials.length}</dd>
              </div>
            </dl>
          </div>
        </aside>
      </div>
      <div class="save-bar plan-save-bar">
        <p role="status">
          <${Icon} name=${busy ? 'clock' : 'leaf'} size=${20} />${t(generationStatusLabel({ busy, count }), lang)}
        </p>
        <div>
          <button class="button secondary" type="button" onClick=${onCancel} disabled=${busy}>
            ${t('cancel', lang)}</button
          ><button class="button primary" type="submit" disabled=${busy}>
            ${t(generationButtonLabel({ busy, replacing }), lang)}<${Icon} name="arrow" size=${18} />
          </button>
        </div>
      </div>
    </form>

`;
}

function generationStatusLabel({ busy, count }) {
  if (busy) {
    return 'generationWait';
  }
  if (count === 2) {
    return 'readyToGenerate';
  }
  return 'needsDetails';
}

function generationButtonLabel({ busy, replacing }) {
  if (busy) {
    return 'generating';
  }
  if (replacing) {
    return 'regenerateWeek';
  }
  return 'generate';
}
