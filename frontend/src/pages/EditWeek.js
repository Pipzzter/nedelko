import { html, useState, useEffect, useRef, text, dayName, degrees, localTime } from '../lib/ui.js';
import { t, errorText } from '../locales/index.js';
import { Calendar } from '../components/Calendar.js';
import { InlineText } from '../components/InlineText.js';
import { Icon, WeatherIcon } from '../components/Icon.js';
import { Occasions, HolidaySources } from '../components/Holidays.js';
import { DayAssistant } from '../components/DayAssistant.js';
import { GenerationStatus } from '../components/GenerationStatus.js';

const toMinutes = time => Number(time.slice(0, 2)) * 60 + Number(time.slice(3));
const toTime = n => `${String(Math.floor(n / 60)).padStart(2, '0')}:${String(n % 60).padStart(2, '0')}`;
const updateDay = (week, date, patch) => ({ ...week, days: week.days.map(day => day.date === date ? { ...day, ...(typeof patch === 'function' ? patch(day) : patch) } : day) });

function draftIssue(draft, today) {
  for (const day of draft.days.filter(d => d.theme && d.date >= today)) {
    const rows = [...day.timeline].sort((a, b) => a.start.localeCompare(b.start));
    if (rows.some(r => r.start < draft.settings.dayStart || r.end > draft.settings.dayEnd || r.start >= r.end)) return { date: day.date, code: 'time_bounds' };
    if (rows.some((r, i) => i && r.start < rows[i - 1].end)) return { date: day.date, code: 'overlapping_times' };
    const pairs = [...rows.map(r => [r.label, 100]), ...[['title', 100], ['goal', 220], ['inside', 400], ['outside', 400], ['habit', 180]].map(([key, limit]) => [day.theme[key], limit])];
    if (pairs.some(([pair, limit]) => ['mk', 'en'].some(lang => !pair?.[lang]?.trim() || pair[lang].trim().length > limit))) return { date: day.date, code: 'invalid_text' };
  }
  return null;
}

export function EditWeek({ data, lang, onSave, onDelete, busy, onCancel, selected, onSelect, error, onSuggestDay, onApplyDay }) {
  const [draft, setDraft] = useState(() => structuredClone(data.week));
  const [open, setOpen] = useState(selected || data.today);
  const [editor, setEditor] = useState(null);
  const [issue, setIssue] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [focusRequest, setFocusRequest] = useState(0);
  const activeDay = useRef(null);
  useEffect(() => { if (focusRequest) activeDay.current?.scrollIntoView?.({ behavior: 'auto', block: 'start' }); }, [focusRequest]);
  const commit = () => {
    if (!editor) return draft;
    const value = editor.value.trim().replace(/\s*\n+\s*/g, ' ');
    if (!value || /[<>\p{Cc}]/u.test(value)) {
      setIssue({ date: editor.date, code: 'invalid_text' }); return null;
    }
    const next = updateDay(draft, editor.date, day => {
      if (!editor.rowId) return { theme: { ...day.theme, [editor.field]: { ...day.theme[editor.field], [editor.lang]: value } } };
      const row = day.timeline.find(row => row.id === editor.rowId);
      const label = { ...row.label, [editor.lang]: value };
      return { timeline: day.timeline.map(r => r.id === row.id ? { ...r, label } : r),
        ...(row.kind === 'eco' ? { theme: { ...day.theme, title: label } } : {}) };
    });
    setDraft(next); setEditor(null); setIssue(null); return next;
  };
  const choose = (date, toggle = false) => {
    if (!commit()) return;
    const next = toggle && open === date ? null : date;
    setOpen(next); onSelect(date);
    if (next) setFocusRequest(n => n + 1);
  };
  const changeDay = (date, patch) => { const current = commit(); if (!current) return; setIssue(null); setDraft(updateDay(current, date, patch)); };
  const inline = (day, field, value, label, { rowId, multiline = false, maxLength = 100, className = '' } = {}) => {
    const key = `${day.date}/${rowId || 'theme'}/${field}`;
    return html`<${InlineText} key=${key} value=${value} label=${`${label}: ${value}`} className=${className} disabled=${busy || day.date < data.today}
      active=${editor?.key === key} draft=${editor?.value} multiline=${multiline} maxLength=${maxLength}
      onBegin=${() => { if (commit()) setEditor({ key, date: day.date, rowId, field, value, lang }); }}
      onInput=${value => { setEditor(previous => ({ ...previous, value })); setIssue(null); }} onCommit=${commit} onCancel=${() => { setEditor(null); setIssue(null); }}/>`;
  };
  const addRow = day => {
    const current = commit(); if (!current) return;
    const currentDay = current.days.find(d => d.date === day.date);
    const rows = [...currentDay.timeline].sort((a, b) => a.start.localeCompare(b.start));
    let start = current.settings.dayStart;
    for (const row of rows) { if (toMinutes(row.start) - toMinutes(start) >= 30) break; start = row.end; }
    const next = rows.find(row => row.start >= start);
    const available = toMinutes(next?.start || current.settings.dayEnd) - toMinutes(start);
    if (available < 30) { setIssue({ date: day.date, code: 'day_full' }); return; }
    const id = `custom-${crypto.randomUUID()}`;
    setIssue(null);
    setDraft(updateDay(current, day.date, { timeline: [...currentDay.timeline, { id, start, end: toTime(toMinutes(start) + Math.min(60, available)), kind: 'activity', label: { mk: 'Нова активност', en: 'New activity' } }].sort((a, b) => a.start.localeCompare(b.start)) }));
  };
  const submit = event => {
    event.preventDefault(); if (busy) return;
    const next = commit(); if (!next) return;
    const invalid = draftIssue(next, data.today); setIssue(invalid);
    if (invalid) { setOpen(invalid.date); onSelect(invalid.date); return; }
    onSave(next);
  };
  const issueText = issue ? `${dayName(issue.date, lang)}: ${issue.code === 'day_full' ? t('dayFull', lang) : errorText(issue.code, lang)}` : error;
  return html`<form class="week-editor" onSubmit=${submit} noValidate>
    <${GenerationStatus} week=${data.week} lang=${lang}/>
    <${Calendar} data=${{ ...data, week: draft }} lang=${lang} selected=${open} onSelect=${choose} compact=${true}/>
    <div class="editor-toolbar">
      <button type="button" class="button danger-quiet" disabled=${busy} onClick=${() => setConfirmDelete(true)}><${Icon} name="trash" size=${16}/>${t('deleteWeek', lang)}</button>
    </div>
    ${confirmDelete && html`<div class="delete-week-confirm" role="alert"><div><b>${t('deleteWeekQuestion', lang)}</b><p>${t('deleteWeekHelp', lang)}</p></div><button type="button" class="button secondary" disabled=${busy} onClick=${() => setConfirmDelete(false)}>${t('keepWeek', lang)}</button><button type="button" class="button danger" disabled=${busy} onClick=${onDelete}>${t('deleteAndStart', lang)}</button></div>`}
    <details class="week-preferences"><summary>${t('weekOptions', lang)}</summary><div class="profile-fields"><label>${t('kindergartenName', lang)}<input maxLength="100" value=${draft.settings.gradinka?.name || ''} onInput=${e => setDraft({ ...draft, settings: { ...draft.settings, gradinka: { name: e.currentTarget.value, locationId: draft.settings.locationId } } })}/></label><label>${t('groupName', lang)}<input maxLength="60" value=${draft.settings.groupName} onInput=${e => setDraft({ ...draft, settings: { ...draft.settings, groupName: e.currentTarget.value } })}/></label></div><label class="outdoor-target">${t('outdoorDays', lang)}<select disabled=${busy} value=${draft.settings.outdoorDays} onChange=${e => { const value = Number(e.currentTarget.value); setDraft(previous => ({ ...previous, settings: { ...previous.settings, outdoorDays: value } })); }}>${[0, 1, 2, 3, 4, 5].map(n => html`<option value=${n}>${n}</option>`)}</select></label><${HolidaySources} calendars=${draft.holidayCalendars} lang=${lang}/>
      ${draft.generationIssue && html`<p class="soft-note">${t(draft.generationIssue, lang)}</p>`}
      ${draft.generationError?.httpStatus && html`<details class="soft-note"><summary>${t('aiErrorDetails', lang)}</summary><p style="overflow-wrap:anywhere"><code>HTTP ${draft.generationError.httpStatus}${draft.generationError.code ? ` · ${draft.generationError.code}` : ''}</code>${draft.generationError.requestId && html`<br/><code>${draft.generationError.requestId}</code>`}</p></details>`}
    </details>
    <div class="editor-days">${draft.days.map(day => {
      const editable = day.theme && day.date >= data.today;
      const eco = day.timeline.find(row => row.kind === 'eco');
      const hasEco = !!eco;
      const lessonFinished = day.date === data.today && eco && eco.end <= localTime(data.clock).time;
      const placeChanged = day.outdoorPreference !== data.week.days.find(original => original.date === day.date)?.outdoorPreference;
      return html`<section key=${day.date} ref=${open === day.date ? activeDay : undefined} class=${`card editor-day ${open === day.date ? 'is-open' : ''}`}>
        <button type="button" class="editor-day-heading" onClick=${() => choose(day.date, true)} aria-expanded=${open === day.date} aria-controls=${`editor-${day.date}`}>
          <span class="date-tile">${Number(day.date.slice(8))}</span><div><h2>${dayName(day.date, lang)}</h2><span>${day.theme ? text(day.theme.title, lang) : t('pastEmpty', lang)}</span></div>
          <span class="editor-weather"><${WeatherIcon} kind=${day.summary.kind} size=${24}/>${degrees(day.summary.max)}</span><span class=${`pill status-${day.closed ? 'closed' : day.mode}`}>${t(day.closed ? 'closed' : day.mode, lang)}</span><${Icon} name="chevron" size=${18}/>
        </button>
        ${day.theme && open !== day.date && html`<div class="timetable-strip">${day.timeline.map(row => html`<button type="button" key=${row.id} class=${`strip-item kind-${row.kind} ${row.occasionIds?.length ? 'holiday-lesson' : ''}`} onClick=${() => choose(day.date)}><b>${row.start}</b>${text(row.kind === 'eco' ? day.theme.title : row.label, lang)}</button>`)}</div>`}
        ${open === day.date && html`<div id=${`editor-${day.date}`} class="day-editor-body">
          <${Occasions} day=${day} lang=${lang}/>
          <p class="day-weather-note">${t(day.summary.kind === 'unknown' ? 'weatherUnknown' : day.summary.kind, lang)} · ${degrees(day.summary.min)} / ${degrees(day.summary.max)}${Number.isFinite(day.summary.wind) ? ` · ${t('windLabel', lang)} ${Math.round(day.summary.wind)} km/h` : ''}. ${t(`reason_${day.reason}`, lang)}</p>
          ${!editable ? html`<p class="soft-note">${t(day.theme ? 'pastReadOnly' : 'pastEmpty', lang)}</p>` : html`<fieldset disabled=${busy} class="day-editor-fields">
            ${onSuggestDay && !day.closed && hasEco && !(day.date === data.today && eco.start <= localTime(data.clock).time) && html`<${DayAssistant} key=${day.date} day=${day} lang=${lang} demo=${!!data.demoId} busy=${busy} dirty=${!!editor || JSON.stringify(draft) !== JSON.stringify(data.week)} onSuggest=${onSuggestDay} onApply=${onApplyDay}/>`}
            <div class="day-place-control"><label>${t('ecoActivityPlace', lang)}<select class="day-place-select" value=${day.outdoorPreference} disabled=${day.closed || !hasEco || lessonFinished} aria-describedby=${`place-help-${day.date}`} onChange=${e => changeDay(day.date, { outdoorPreference: e.currentTarget.value })}><option value="auto">${t('automatic', lang)}</option><option value="inside">${t('inside', lang)}</option><option value="outside">${t('outside', lang)}</option></select></label>
              <p id=${`place-help-${day.date}`} class="soft-note" role="status">${t(day.closed ? 'reason_closed' : !hasEco ? 'reason_no_slot' : lessonFinished ? 'reason_finished' : placeChanged ? 'savePlaceChoice' : day.outdoorPreference === 'outside' && day.mode !== 'outside' ? 'outdoorChoiceBlocked' : 'dayPlaceHelp', lang)}</p>
            </div>
            <details class="day-options"><summary>${t('dayOptions', lang)}</summary><div class="day-edit-options"><label class="checkbox-label"><input type="checkbox" checked=${day.closed} onChange=${e => changeDay(day.date, { closed: e.currentTarget.checked })}/>${t('closed', lang)}</label></div><p class="soft-note">${day.summary.forecastAir ? `${t('airForecast', lang)}: ${Math.round(day.summary.pm25)} µg/m³ · ~11 km` : t('noAirForecast', lang)}</p></details>
            ${day.closed ? html`<p class="empty-day">${t('closed', lang)}</p>` : html`<ol class="readable-timeline">${day.timeline.map(row => html`<li class=${`readable-row kind-${row.kind} ${row.kind === 'eco' ? 'eco-row' : ''} ${row.occasionIds?.length ? 'holiday-lesson' : ''}`} key=${row.id} data-row-id=${row.id}>
              <span class="edit-time-range" title=${t('fixedTimes', lang)}>${row.start} - ${row.end}</span>
              <div class="readable-activity">${inline(day, 'label', text(row.kind === 'eco' ? day.theme.title : row.label, lang), t('editActivityText', lang), { rowId: row.id, className: 'edit-activity-title' })}${row.occasionIds?.length && html`<small>${t('occasion', lang)}</small>`}${row.kind === 'eco' ? html`<small>${t(day.mode, lang)} · ${t('indoorBackupReady', lang)}</small>` : row.note && html`<p>${text(row.note, lang)}</p>`}${row.occasionDiscussion && row.occasionDiscussion !== row.note && JSON.stringify(row.occasionDiscussion) !== JSON.stringify(row.note) && html`<p>${text(row.occasionDiscussion, lang)}</p>`}</div>
              <button type="button" class="icon-button delete-button" aria-label=${`${t('remove', lang)} ${text(row.label, lang)}`} onClick=${() => changeDay(day.date, current => ({ timeline: current.timeline.filter(r => r.id !== row.id) }))}><${Icon} name="trash" size=${16}/></button>
            </li>`)}</ol><button class="button quiet" type="button" disabled=${day.timeline.length >= 30} onClick=${() => addRow(day)}><${Icon} name="plus" size=${16}/>${t('addActivity', lang)}</button>
            ${hasEco && html`<div class="readable-lesson"><h3>${text(day.theme.title, lang)}</h3><div class="lesson-versions">${[['outside', 'activityOutside'], ['inside', 'indoorBackup']].map(([key, label]) => html`<div class=${`lesson-version ${key === day.mode ? 'selected-version' : ''}`} key=${key}><b><${Icon} name=${key === 'outside' ? 'leaf' : 'home'} size=${16}/>${t(label, lang)}</b>${inline(day, key, text(day.theme[key], lang), t('editActivityText', lang), { multiline: true, maxLength: 400 })}</div>`)}</div><p class="lesson-sentence"><b>${t('goal', lang)}: </b>${inline(day, 'goal', text(day.theme.goal, lang), t('goal', lang), { multiline: true, maxLength: 220 })}</p><p class="lesson-sentence"><b>${t('homeHabit', lang)}: </b>${inline(day, 'habit', text(day.theme.habit, lang), t('homeHabit', lang), { multiline: true, maxLength: 180 })}</p></div>`}
            ${hasEco && day.holidaySuggestion && html`<details class="holiday-preview"><summary>${t('holidayIdea', lang)}: ${text(day.holidaySuggestion.title, lang)}</summary><p>${text(day.holidaySuggestion.inside, lang)}</p><p class="soft-note">${t('holidayPreviewHelp', lang)}</p><button type="button" class="button secondary" onClick=${() => changeDay(day.date, current => ({ theme: { ...structuredClone(day.holidaySuggestion), dayActivities: current.theme.dayActivities }, timeline: current.timeline.map(r => r.kind === 'eco' ? { ...r, label: day.holidaySuggestion.title } : r) }))}>${t('applyLesson', lang)}</button></details>`}`}
          </fieldset>`}
        </div>`}
      </section>`;
    })}</div>
    <div class="save-bar"><div>${issueText ? html`<p class="editor-error" role="alert">${issueText}</p>` : html`<p>${t('saveRefreshHelp', lang)}</p>`}</div><div><button class="button secondary" type="button" onClick=${onCancel} disabled=${busy}>${t('cancel', lang)}</button><button class="button primary" type="submit" onClick=${submit} disabled=${busy}>${t(busy ? 'working' : 'save', lang)}<${Icon} name="check" size=${18}/></button></div></div>
  </form>`;
}
