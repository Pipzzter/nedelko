import { html, text, safeUuid, useState } from '../lib/ui.js';
import { t } from '../locales/index.js';
import { Icon } from './Icon.js';

const preferenceLabels = { minApparentC: 'minTemp', maxApparentC: 'maxTemp', maxPrecipProbability: 'maxRain', maxPrecipitationMm: 'maxRainMm', maxWindKmh: 'maxWind' };

export function PairInput({ value, onChange, label, multiline = false, maxLength = 100 }) {
  const fields = ['mk', 'en'].map(lang => {
    const attrs = { 'aria-label': label + ' (' + lang + ')', value: value[lang], required: true, maxLength,
      onInput: event => onChange({ ...value, [lang]: event.currentTarget.value }) };
    const field = multiline ? html`<textarea ...${attrs} rows="3"/>` : html`<input ...${attrs}/>`;
    return html`<label key=${lang}><span class="language-mini">${lang === 'mk' ? 'МК' : 'EN'}</span>${field}</label>`;
  });
  return html`<div class="pair-input"><span class="field-label">${label}</span><div>${fields}</div></div>`;
}
export function SettingsForm({ value, onChange, config, lang, issues = [], rhythmConfirmed, onConfirm }) {
  const set = (key, val) => onChange({ ...value, [key]: val });
  const changeBlock = (id, changes) => set('blocks', value.blocks.map(b => b.id === id ? { ...b, ...changes } : b));
  const issue = field => issues.find(i => i.field === field);
  const attrs = field => {
    const descriptions = [];
    if (field !== 'teacherPrompt') descriptions.push('help-' + field);
    if (issue(field)) descriptions.push('error-' + field);
    return { id: 'plan-' + field, name: field, required: true,
      'aria-invalid': issue(field) ? 'true' : undefined,
      'aria-describedby': descriptions.join(' ') || undefined };
  };
  const title = key => html`<span>${t(key,lang)} <span class="required-mark" aria-hidden="true">*</span></span>`;
  const fieldError = field => issue(field) && html`<small class="field-error" id=${'error-' + field}>${t(issue(field).key,lang)}</small>`;
  const help = (field,key) => html`<small id=${'help-' + field}>${t(key,lang)}</small>${fieldError(field)}`;
  const heading = (number,key,icon) => html`<div class="planning-section-heading"><span class=${'step-number step-' + number}><${Icon} name=${icon} size=${23}/></span><div><span class="eyebrow">0${number} · ${t(number===1?'shortLearning':'shortRhythm',lang)}</span><h2 id=${'planning-title-' + number}>${t(key,lang)}</h2></div></div><p class="section-help">${t(key + 'Help',lang)}</p>`;
  const preference = ([key,{min,max}])=>html`<label for=${'plan-' + key}>${t(preferenceLabels[key],lang)}<input ...${attrs(key)} type="number" min=${min} max=${max} step="any" value=${value.preferences[key]} onInput=${e=>set('preferences',{...value.preferences,[key]:e.currentTarget.valueAsNumber})}/><small id=${'help-' + key}>${min} – ${max}</small>${fieldError(key)}</label>`;
  const routine = block=>html`<details class=${'routine-editor kind-' + block.kind} key=${block.id} id=${'plan-routine-' + block.id}><summary><span class="routine-icon"><${Icon} name=${({rest:'rest',meal:'meal'}[block.kind] || 'clock')} size=${20}/></span><span class="routine-summary-name"><b>${text(block.label,lang)||t('activityName',lang)}</b><small>${t('routineEdit',lang)}</small></span><time>${block.start||'··:··'}–${block.end||'··:··'}</time><${Icon} name="chevron" size=${18}/></summary><div class="routine-edit-body"><p class="soft-note">${t('routineTranslations',lang)}</p><${PairInput} label=${t('activityName',lang)} value=${block.label} onChange=${label=>changeBlock(block.id,{label})}/><div class="time-fields"><label>${title('start')}<input type="time" required aria-label=${t('start',lang) + ' · ' + text(block.label,lang)} value=${block.start} onInput=${e=>changeBlock(block.id,{start:e.currentTarget.value})}/></label><span aria-hidden="true">→</span><label>${title('end')}<input type="time" required aria-label=${t('end',lang) + ' · ' + text(block.label,lang)} value=${block.end} onInput=${e=>changeBlock(block.id,{end:e.currentTarget.value})}/></label></div>${fieldError('routine-' + block.id)}<button type="button" class="button danger-quiet" onClick=${()=>set('blocks',value.blocks.filter(b=>b.id!==block.id))}><${Icon} name="trash" size=${16}/>${t('remove',lang)} ${text(block.label,lang)}</button></div></details>`;
  return html`<div class="settings-layout guided-settings">
    <section id="plan-section-1" class="card planning-section teacher-brief">
      ${heading(1,'sectionLearning','leaf')}
      <label for="plan-teacherPrompt">${title('briefLabel')}<textarea ...${attrs('teacherPrompt')} rows="4" maxLength="2000" value=${value.teacherPrompt||''} placeholder=${t('teacherBriefPlaceholder',lang)} onInput=${e=>set('teacherPrompt',e.currentTarget.value)}/>${fieldError('teacherPrompt')}</label>
      <fieldset class="materials-select" id="plan-materials" aria-describedby="help-materials"><legend>${title('materials')}</legend>${help('materials','materialsRequired')}<${MaterialPicker} value=${value} onChange=${onChange} config=${config} lang=${lang}/></fieldset>
      <div class="form-grid"><label for="plan-outdoorDays">${title('outdoorDays')}<select ...${attrs('outdoorDays')} value=${value.outdoorDays} onChange=${e=>set('outdoorDays',Number(e.currentTarget.value))}>${[0,1,2,3,4,5].map(n=>html`<option value=${n}>${n} ${t(n===1?'oneDay':'days',lang)}</option>`)}</select>${help('outdoorDays','outdoorHelp')}</label></div>
      <details class="weather-preferences"><summary><span>${t('preferencesOptional',lang)}<small>${t('suggestedPreferences',lang)}</small></span><${Icon} name="chevron" size=${18}/></summary><p class="soft-note">${t('logisticsOnly',lang)}</p><div class="form-grid">${Object.entries(config.preferenceBounds).map(preference)}</div></details>
    </section>
    <section id="plan-section-2" class="card planning-section routines-card">
      ${heading(2,'sectionRhythm','clock')}
      <div class="form-grid"><label for="plan-dayStart">${title('start')}<input ...${attrs('dayStart')} type="time" min="06:00" max="19:00" value=${value.dayStart} onInput=${e=>set('dayStart',e.currentTarget.value)}/>${help('dayStart','hoursHelp')}</label><label for="plan-dayEnd">${title('end')}<input ...${attrs('dayEnd')} type="time" min="06:00" max="19:00" value=${value.dayEnd} onInput=${e=>set('dayEnd',e.currentTarget.value)}/><small id="help-dayEnd">${t('hoursHelp',lang)}</small></label></div>
      <div class="routine-list" id="plan-routines">${value.blocks.map(routine)}</div>
      ${issue('routines')&&html`<p class="field-error">${t(issue('routines').key,lang)}</p>`}
      <button type="button" class="button secondary" disabled=${value.blocks.length>=10} onClick=${()=>set('blocks',[...value.blocks,{id:'custom-' + safeUuid(),label:{mk:'Нова активност',en:'New activity'},start:'15:00',end:'15:15',kind:'routine'}])}><${Icon} name="plus" size=${17}/>${t('addRoutine',lang)}</button>
      <label class=${'rhythm-confirm ' + (rhythmConfirmed?'confirmed':'')}><input id="plan-rhythmConfirmed" type="checkbox" required checked=${rhythmConfirmed} onChange=${e=>onConfirm(e.currentTarget.checked)}/><span>${t('confirmRhythm',lang)} <span class="required-mark" aria-hidden="true">*</span></span></label>${issue('rhythmConfirmed')&&html`<p class="field-error">${t('confirmRhythmError',lang)}</p>`}
    </section>
  </div>`;
}

export function MaterialPicker({ value, onChange, config, lang }) {
  const [name, setName] = useState('');
  const catalog = [...config.materials, ...(value.customMaterials || [])];
  const valid = name.trim() && name.trim().length <= 80 && !/[<>\p{Cc}]/u.test(name);
  const add = () => {
    if (!valid || (value.customMaterials?.length || 0) >= 30) return;
    const existing = catalog.find(item => Object.values(item.label).some(label => label.toLowerCase() === name.trim().toLowerCase()));
    const material = existing || { id: 'custom-' + safeUuid(), label: { mk: name.trim(), en: name.trim() } };
    onChange({ ...value, materials: [...new Set([...value.materials, material.id])],
      customMaterials: existing ? value.customMaterials || [] : [...(value.customMaterials || []), material] });
    setName('');
  };
  const option = item => html`
    <label key=${item.id} class=${value.materials.includes(item.id)?'chosen':''}>
      <input type="checkbox" name="materials" value=${item.id} checked=${value.materials.includes(item.id)}
        onChange=${event => onChange({ ...value, materials: event.currentTarget.checked ? [...value.materials,item.id] : value.materials.filter(id=>id!==item.id) })}/>
      <span>${text(item.label,lang)}</span>
    </label>`;
  return html`<div class="material-options">${catalog.map(option)}</div>
    <div class="add-material"><label for="new-material">${t('newMaterial',lang)}
      <input id="new-material" value=${name} maxLength="80" placeholder=${t('newMaterialPlaceholder',lang)}
        onInput=${event=>setName(event.currentTarget.value)} onKeyDown=${event=>{ if(event.key==='Enter'){event.preventDefault();add();} }}/></label>
      <button type="button" class="button secondary" disabled=${!valid || (value.customMaterials?.length || 0)>=30} onClick=${add}><${Icon} name="plus" size=${16}/>${t('addMaterial',lang)}</button>
    </div>`;
}
