import { html, useState } from '../lib/ui.js';
import { t } from '../locales/index.js';
import { SettingsForm } from '../components/SettingsForm.js';
import { Icon } from '../components/Icon.js';
export function CreatePlan({ config, lang, initial, onGenerate, onCancel, busy, replacing = false }) {
  const [settings, setSettings] = useState(() => structuredClone(initial || config.defaults));
  return html`<form onSubmit=${e => { e.preventDefault(); onGenerate(settings); }}>${replacing && html`<p class="soft-note">${t('regenerateHelp', lang)}</p>`}<${SettingsForm} config=${config} value=${settings} onChange=${setSettings} lang=${lang}/><div class="save-bar"><p><${Icon} name="leaf" size=${20}/>${t(busy ? 'generationWait' : 'generatedTogether', lang)}</p><div><button class="button secondary" type="button" onClick=${onCancel} disabled=${busy}>${t('cancel', lang)}</button><button class="button primary" type="submit" disabled=${busy}>${t(busy ? 'generating' : 'generate', lang)}<${Icon} name="arrow" size=${18}/></button></div></div></form>`;
}
