import { html, degrees, monthLabel, shortDay, localizedDate } from '../lib/ui.js';
import { t } from '../locales/index.js';
import { Icon, WeatherIcon } from './Icon.js';

export function Calendar({ data, lang, selected, onSelect }) {
  const days = data.week?.days || data.calendar;
  if (!days?.length) return null;
  const calendar = days.map(day => ({ ...day, summary: day.weatherDisplay || data.calendar?.find(item => item.date === day.date)?.weatherDisplay || day.summary }));
  const month =
    calendar[0].date.slice(0, 7) === calendar[4].date.slice(0, 7)
      ? monthLabel(calendar[0].date, lang)
      : `${localizedDate(calendar[0].date, lang, { month: 'long' })} / ${monthLabel(calendar[4].date, lang)}`;
  return html`
    <section class="card calendar-card" aria-label=${t('forecast', lang)}>
      <div class="card-heading">
        <div>
          <span class="eyebrow">${t('forecast', lang)}</span>
          <h2 class="month-title">${month}</h2>
        </div>
        <span class="week-range">${Number(calendar[0].date.slice(8))}–${Number(calendar[4].date.slice(8))}</span>
      </div>
      <div class="week-grid">
        ${calendar.map(
          (day) => html`
            <button
              type="button"
              data-date=${day.date}
              key=${day.date}
              class=${'calendar-day ' + (selected === day.date ? 'selected' : '') + ' ' + (day.date === data.today ? 'today' : '')}
              aria-pressed=${selected === day.date}
              aria-label=${
                '' +
                localizedDate(day.date, lang, {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'long'
                }) +
                ', ' +
                t(day.summary?.kind === 'unknown' ? 'weatherUnknown' : day.summary?.kind, lang) +
                ', ' +
                degrees(day.summary?.max) +
                ', ' +
                t(day.mode || 'empty', lang) +
                (weatherStatus(day.summary, lang) ? ', ' + weatherStatus(day.summary, lang) : '') +
                (day.occasions?.length ? ', ' + day.occasions.map((event) => event.name[lang]).join(', ') : '')
              }
              onClick=${() => onSelect(day.date)}
              title=${localizedDate(day.date, lang, { weekday: 'long', day: 'numeric', month: 'long' })}
            >
              <${WeatherIcon} kind=${day.summary?.kind} size=${32} /><span class="day-temperatures"
                >${degrees(day.summary?.max)} <small>${degrees(day.summary?.min)}</small></span
              >
              <span class="weather-status" aria-hidden=${!weatherStatus(day.summary, lang) || undefined} title=${weatherStatus(day.summary, lang) ? weatherDetail(day.summary, lang) : undefined}>${weatherStatus(day.summary, lang)}</span>
              <span class="weekday">${shortDay(day.date, lang)}</span
              ><span class="day-number">${Number(day.date.slice(8))}</span>
              ${
                day.occasions?.length
                  ? html`
                      <span class="calendar-occasion" title=${day.occasions.map((event) => event.name[lang]).join(', ')}
                        ><${Icon} name="calendar" size=${10} />${t('occasion', lang)}</span
                      >

`
                  : null
              }
              <span class=${'day-status status-' + (day.mode || 'empty')}
                >${
                  day.mode === 'outside' && html`
 <${Icon} name="leaf" size=${12} />
`
                }${t(day.mode || 'empty', lang)}</span
              >
            </button>

`
        )}
      </div>
      ${renderCalendarFooter({ data, lang })}
    </section>

`;
}

function renderCalendarFooter({ data, lang }) {
  return html`
    <div class="calendar-caption">
      <span class="small-dot"></span>${t('provisionalWeek', lang)} ${t('morningCheck', lang)}${
        data.mode === 'demo'
          ? html`
 <span class="caption-source">${t('demoForecast', lang)}</span>
`
          : html`
              <a class="caption-source" href="https://open-meteo.com/" target="_blank" rel="noreferrer">Open-Meteo</a>

`
      }
    </div>

`;
}


function weatherStatus(summary, lang) {
  const key = { cached: 'weatherSaved', historical: 'weatherPast', unavailable: 'weatherUnknown' }[summary?.status];
  return key ? t(key, lang) : '';
}
function weatherDetail(summary, lang) {
  const label = weatherStatus(summary, lang);
  return Number.isFinite(Date.parse(summary?.fetchedAt))
    ? `${label}: ${localizedDate(summary.fetchedAt, lang, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}`
    : label;
}
