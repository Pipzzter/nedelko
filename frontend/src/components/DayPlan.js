import { html, useState, useEffect, useRef, text, dayName, localTime } from '../lib/ui.js';
import { t, errorText } from '../locales/index.js';
import { Icon } from './Icon.js';
import { Occasions } from './Holidays.js';
import { ActivityEditor } from './ActivityEditor.js';
import { ChangeAssistant } from './ChangeAssistant.js';

const ARRIVAL = 10;
const shift = (time, delta) => {
  const m = Number(time.slice(0, 2)) * 60 + Number(time.slice(3)) + delta;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
};
function displayTimeline(day, lang) {
  const eco = day.timeline.find((row) => row.kind === 'eco');
  if (day.authoredTimeline || day.mode !== 'outside' || !eco) return day.timeline;
  const startMinutes = Number(eco.start.slice(0, 2)) * 60 + Number(eco.start.slice(3));
  const endMinutes = Number(eco.end.slice(0, 2)) * 60 + Number(eco.end.slice(3));
  if (endMinutes - startMinutes < 30) return day.timeline;
  const out = {
    id: 'eco-out',
    kind: 'transition',
    start: eco.start,
    end: shift(eco.start, ARRIVAL),
    label: { mk: t('transitionOut', 'mk'), en: t('transitionOut', 'en') }
  };
  const back = {
    id: 'eco-in',
    kind: 'transition',
    start: shift(eco.end, -ARRIVAL),
    end: eco.end,
    label: { mk: t('transitionIn', 'mk'), en: t('transitionIn', 'en') }
  };
  const middle = { ...eco, start: out.end, end: back.start };
  return day.timeline.flatMap((row) => (row.id === eco.id ? [out, middle, back] : [row]));
}

export function DayPlan({
  day,
  data,
  lang,
  clock,
  materials,
  busy,
  onPlace,
  onSuggest,
  onApply,
  onEdit,
  demo,
  readOnly = false
}) {
  const [selection, setSelection] = useState(null);
  const [editing, setEditing] = useState(null);
  const [dragged, setDragged] = useState(null);
  const [moveError, setMoveError] = useState('');
  const detail = useRef(null);
  const pencil = useRef(null);
  useEffect(() => {
    if (selection?.date === day?.date && window.matchMedia?.('(max-width: 1020px)').matches)
      detail.current?.scrollIntoView?.({ behavior: 'auto', block: 'nearest' });
  }, [selection]);
  if (!day) return null;
  const now = localTime(clock);
  const today = day.date === now.date;
  const rows = day.timeline;
  const move = async (id, targetId, before = false) => {
    setDragged(null);
    if (!onEdit || busy || id === targetId) return;
    const ids = day.timeline.map((row) => row.id).filter((rowId) => rowId !== id);
    ids.splice(ids.indexOf(targetId) + (before ? 0 : 1), 0, id);
    setMoveError('');
    try {
      await onEdit({ action: 'reorder', date: day.date, rowIds: ids });
    } catch (err) {
      setMoveError(errorText(err.code, lang));
    }
  };
  const selected =
    rows.find((row) => selection?.date === day.date && row.id === selection.id) ||
    rows.find((row) => row.kind === 'eco') ||
    rows[0];
  const isEco = selected?.kind === 'eco';
  const activityMode = day.mode === 'outside' ? 'outside' : 'inside';
  let description = selected?.note;
  if (!description && isEco) description = selected.lesson?.[activityMode] || day.activity || day.theme?.inside;
  const title = (row) => text(row.label, lang);
  const discussion = selected?.occasionDiscussion;
  const upcoming = (row) => day.date > now.date || (day.date === now.date && row.start > now.time);
  const contentEditable =
    onEdit && selected && (day.date > now.date || (day.date === now.date && selected.start > now.time));
  const editable =
    selected && upcoming(selected);
  return html`
    <section class="card day-plan" id="day-plan">
      <div class="card-heading">
        <div class="day-heading">
          <span class="date-tile">${Number(day.date.slice(8))}</span>
          <div>
            <span class="eyebrow">${today ? t('today', lang) : t('dailyPlan', lang)}</span>
            <h2>${dayName(day.date, lang)}</h2>
          </div>
        </div>
        ${
          readOnly &&
          day.theme &&
          !day.closed &&
          html`
            <div class="home-place">
              <small>${t('activityPlace', lang)}</small
              ><span
                >${t(day.outdoorPreference === 'auto' ? 'automatic' : day.outdoorPreference || 'automatic', lang)}</span
              >
            </div>

`
        }
        ${
          day.theme &&
          !day.closed &&
          onPlace &&
          html`
            <label class="home-place"
              >${t('activityPlace', lang)}<select
                disabled=${busy || day.date < now.date || (today && !day.timeline.some(row => row.kind === 'eco' && row.end > now.time))}
                value=${day.outdoorPreference || 'auto'}
                onChange=${(e) => onPlace(e.currentTarget.value)}
              >
                ${['auto', 'inside', 'outside'].map(
                  (value) => html`
 <option value=${value}>${t(value === 'auto' ? 'automatic' : value, lang)}</option>
`
                )}
              </select></label
            >

`
        }
      </div>
      <${Occasions} day=${day} lang=${lang} />
      ${renderDayContent({
        day,
        lang,
        data,
        onEdit,
        moveError,
        rows,
        today,
        now,
        selected,
        busy,
        upcoming,
        setDragged,
        dragged,
        move,
        setSelection,
        setEditing,
        title,
        detail,
        contentEditable,
        pencil,
        isEco,
        editing,
        materials,
        description,
        discussion,
        onSuggest,
        editable,
        demo,
        onApply,
        onPlace,
        clock
      })}
    </section>

`;
}

function renderTimelineRow({
  row,
  current,
  selected,
  onEdit,
  busy,
  upcoming,
  setDragged,
  dragged,
  move,
  setSelection,
  day,
  setEditing,
  title,
  lang,
  index,
  rows
}) {
  return html`
    <li
      key=${row.id}
      data-row-id=${row.id}
      class=${'kind-' + row.kind + ' ' + (row.kind === 'eco' ? 'eco-row' : '') + ' ' + (row.occasionIds?.length ? 'holiday-lesson' : '') + ' ' + (current ? 'current-row' : '') + ' ' + (selected?.id === row.id ? 'selected-row' : '')}
      aria-current=${current ? 'step' : undefined}
      draggable=${!!onEdit && !busy && upcoming(row)}
      onDragStart=${(event) => {
        setDragged(row.id);
        event.dataTransfer?.setData('text/plain', row.id);
        if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
      }}
      onDragEnd=${() => setDragged(null)}
      onDragOver=${(event) => {
        if (dragged && upcoming(row)) event.preventDefault();
      }}
      onDrop=${(event) => {
        event.preventDefault();
        if (dragged && upcoming(row)) move(dragged, row.id);
      }}
    >
      <button
        type="button"
        class="timeline-activity"
        aria-pressed=${selected?.id === row.id}
        aria-controls="activity-detail"
        onClick=${() => {
          setSelection({ date: day.date, id: row.id });
          setEditing(null);
        }}
      >
        <span class="timeline-time">${row.start}<small>${row.end}</small></span
        ><span class="activity-icon"><${Icon} name=${activityIcon({ row })} size=${18} /></span
        ><span class="timeline-description"
          ><span>${title(row)}</span>${row.occasionIds?.length > 0 && html`
 <small>${t('occasion', lang)}</small>
`}${
            row.kind === 'eco' && html`
 <small>${t(day.mode, lang)} · ${t('ecoActivity', lang)}</small>
`
          }</span
        >${current && html`
 <span class="now-badge">${t('now', lang)}</span>
`}<${Icon}
          name="chevron"
          size=${15}
        /></button
      >${
        onEdit &&
        upcoming(row) &&
        html`
          <div class="reorder-controls">
            <button
              type="button"
              class="button quiet"
              aria-label=${'' + t('moveUp', lang) + ': ' + title(row)}
              disabled=${busy || index === 0 || !upcoming(rows[index - 1])}
              onClick=${() => move(row.id, rows[index - 1].id, true)}
            >
              ↑</button
            ><button
              type="button"
              class="button quiet"
              aria-label=${'' + t('moveDown', lang) + ': ' + title(row)}
              disabled=${busy || index === rows.length - 1}
              onClick=${() => move(row.id, rows[index + 1].id)}
            >
              ↓
            </button>
          </div>

`
      }
    </li>

`;
}

function renderActivityDetail({
  detail,
  selected,
  contentEditable,
  pencil,
  lang,
  busy,
  setEditing,
  day,
  isEco,
  title,
  editing,
  data,
  materials,
  onEdit,
  description,
  discussion,
  onSuggest,
  editable,
  demo,
  onApply,
  upcoming
}) {
  return html`
    <aside
      ref=${detail}
      class=${'lesson-card kind-' + selected.kind + ' ' + (selected.occasionIds?.length ? 'holiday-lesson' : '')}
      id="activity-detail"
      aria-labelledby="activity-title"
      aria-live="polite"
    >
      ${
        contentEditable &&
        html`
          <button
            ref=${pencil}
            type="button"
            class="button quiet edit-activity"
            aria-label=${t('editActivity', lang)}
            title=${t('editActivity', lang)}
            disabled=${busy}
            onClick=${() => setEditing('' + day.date + '/' + selected.id)}
          >
            <${Icon} name="edit" size=${19} />
          </button>

`
      }
      ${
        isEco &&
        html`
          <div class="lesson-illustration">
            <img src="/assets/little-gardeners.svg" alt="" width="530" height="330" />
          </div>
          <span class=${'pill status-' + day.mode}
            ><${Icon} name=${day.mode === 'outside' ? 'leaf' : 'home'} size=${14} />${t(day.mode, lang)}</span
          >

`
      }
      <span class="activity-detail-time">${selected.start} - ${selected.end}</span>
      <h3 id="activity-title">${title(selected)}</h3>
      ${renderActivityEditor({
        contentEditable,
        editing,
        day,
        selected,
        lang,
        data,
        materials,
        busy,
        onEdit,
        setEditing,
        pencil,
        description,
        discussion,
        isEco,
        onSuggest,
        editable,
        demo,
        onApply,
        upcoming
      })}
    </aside>

`;
}

function renderActivityContent({
  description,
  lang,
  selected,
  discussion,
  isEco,
  day,
  materials,
  onSuggest,
  editable,
  busy,
  demo,
  onApply,
  contentEditable,
  upcoming
}) {
  const theme = selected.lesson || day.theme;
  return html`
    <div class="activity-content">
      <p class="activity-summary">${text(description, lang) || t('description_' + selected.kind, lang)}</p>
      ${
        discussion &&
        JSON.stringify(discussion) !== JSON.stringify(description) &&
        html`
 <p>${text(discussion, lang)}</p>
`
      }
      ${
        isEco &&
        !day.authoredTimeline &&
        day.mode === 'outside' &&
        html`
          <ol class="activity-transitions">
            ${displayTimeline(day, lang)
              .filter((row) => ['eco-out', 'eco-in'].includes(row.id))
              .map((row) => html`
 <li>${row.start} - ${row.end}: ${text(row.label, lang)}</li>
`)}
          </ol>

`
      }
      ${
        isEco &&
        html`
          ${
            day.mode === 'outside' &&
            html`
              <details class="indoor-backup" open>
                <summary>${t('indoorBackup', lang)}</summary>
                <p>${text(theme.inside, lang)}</p>
              </details>

`
          }
          <div class="lesson-detail">
            <span>${t('goal', lang)}</span>
            <p>${text(theme.goal, lang)}</p>
          </div>
          <div class="lesson-detail">
            <span>${t('materials', lang)}</span>
            <div class="material-tags">
              ${theme.materials.map(
                (id) => html`
 <span key=${id}>${text(materials.find((m) => m.id === id)?.label, lang)}</span>
`
              )}
            </div>
          </div>
          ${day.snow && html`
 <p class="soft-note">${t('snowNote', lang)}</p>
`}
          <div class="habit">
            <${Icon} name="leaf" size=${18} />
            <p>${text(theme.habit, lang)}</p>
          </div>

`
      }
      ${onSuggest && renderActivityAssistant({ editable, day, selected, lang, busy, demo, onSuggest, onApply, contentEditable, upcoming })}
    </div>

`;
}

function renderDayActivities({
  day,
  lang,
  data,
  onEdit,
  moveError,
  rows,
  today,
  now,
  selected,
  busy,
  upcoming,
  setDragged,
  dragged,
  move,
  setSelection,
  setEditing,
  title,
  detail,
  contentEditable,
  pencil,
  isEco,
  editing,
  materials,
  description,
  discussion,
  onSuggest,
  editable,
  demo,
  onApply,
  onPlace,
  clock
}) {
  return html`
    <p class="day-decision">
      <b>${t(day.mode, lang)}.</b>
      ${day.outdoorPreference === 'outside' && day.mode !== 'outside' ? '' + t('outdoorChoiceBlocked', lang) + ' ' : ''}${t('reason_' + day.reason, lang)}${['ai_plan', 'indoor_balance'].includes(day.reason) ? ' ' + t('outdoorDays', lang) + ': ' + data.week.settings.outdoorDays + '.' : ''}
    </p>
    ${onEdit && html`
 <p class="soft-note reorder-help">${t('reorderHelp', lang)}</p>
`}
    ${moveError && html`
 <p class="form-error" role="alert">${moveError}</p>
`}
    <div class="day-layout">
      <ol class="timeline">
        ${rows.map((row, index) => {
          const current = today && now.time >= row.start && now.time < row.end;
          return renderTimelineRow({
            row,
            current,
            selected,
            onEdit,
            busy,
            upcoming,
            setDragged,
            dragged,
            move,
            setSelection,
            day,
            setEditing,
            title,
            lang,
            index,
            rows
          });
        })}
      </ol>
      ${
        selected &&
        renderActivityDetail({
          detail,
          selected,
          contentEditable,
          pencil,
          lang,
          busy,
          setEditing,
          day,
          isEco,
          title,
          editing,
          data,
          materials,
          onEdit,
          description,
          discussion,
          onSuggest,
          editable,
          demo,
          onApply,
          upcoming
        })
      }
    </div>
    ${
      onSuggest &&
      day.date >= now.date &&
      html`
        <${ChangeAssistant}
          key=${day.date}
          day=${day}
          scope="schedule"
          lang=${lang}
          busy=${busy}
          demo=${demo}
          onSuggest=${onSuggest}
          onApply=${onApply}
        />

`
    }

`;
}

function activityIcon({ row }) {
  if (row.kind === 'transition') {
    return 'arrow';
  }
  if (row.kind === 'eco') {
    return 'leaf';
  }
  if (row.kind === 'routine') {
    return 'clock';
  }
  return row.kind;
}

function renderActivityAssistant({
  editable,
  day,
  selected,
  lang,
  busy,
  demo,
  onSuggest,
  onApply,
  contentEditable,
  upcoming
}) {
  if (editable) {
    return html`
      <${ChangeAssistant}
        key=${'' + day.date + '/' + selected.id}
        day=${day}
        row=${selected}
        scope="activity"
        lang=${lang}
        busy=${busy}
        demo=${demo}
        onSuggest=${onSuggest}
        onApply=${onApply}
      />

`;
  }
  return (
    !contentEditable &&
    html`
      <p class="locked-activity">
        <${Icon}
          name="clock"
          size=${14}
        />${t(upcoming(selected) ? 'protectedActivity' : 'activityAlreadyStarted', lang)}
      </p>

`
  );
}

function renderActivityEditor({
  contentEditable,
  editing,
  day,
  selected,
  lang,
  data,
  materials,
  busy,
  onEdit,
  setEditing,
  pencil,
  description,
  discussion,
  isEco,
  onSuggest,
  editable,
  demo,
  onApply,
  upcoming
}) {
  return contentEditable && editing === `${day.date}/${selected.id}`
    ? html`
        <${ActivityEditor}
          key=${editing}
          day=${day}
          row=${selected}
          lang=${lang}
          revision=${data.week.revision}
          materials=${materials.filter((item) => data.week.settings.materials.includes(item.id))}
          busy=${busy}
          onSave=${onEdit}
          onCancel=${() => {
            setEditing(null);
            requestAnimationFrame(() => pencil.current?.focus());
          }}
        />

`
    : renderActivityContent({
        description,
        lang,
        selected,
        discussion,
        isEco,
        day,
        materials,
        onSuggest,
        editable,
        busy,
        demo,
        onApply,
        contentEditable,
        upcoming
      });
}

function renderDayContent({
  day,
  lang,
  data,
  onEdit,
  moveError,
  rows,
  today,
  now,
  selected,
  busy,
  upcoming,
  setDragged,
  dragged,
  move,
  setSelection,
  setEditing,
  title,
  detail,
  contentEditable,
  pencil,
  isEco,
  editing,
  materials,
  description,
  discussion,
  onSuggest,
  editable,
  demo,
  onApply,
  onPlace,
  clock
}) {
  if (!day.theme || day.closed) {
    return html`
      <p class="empty-day">
        ${t(day.closed ? 'closed' : 'noDay', lang)} ${!day.theme && day.date < data.today ? t('pastEmpty', lang) : ''}
      </p>

`;
  }
  return renderDayActivities({
    day,
    lang,
    data,
    onEdit,
    moveError,
    rows,
    today,
    now,
    selected,
    busy,
    upcoming,
    setDragged,
    dragged,
    move,
    setSelection,
    setEditing,
    title,
    detail,
    contentEditable,
    pencil,
    isEco,
    editing,
    materials,
    description,
    discussion,
    onSuggest,
    editable,
    demo,
    onApply,
    onPlace,
    clock
  });
}
