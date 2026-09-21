import { readFile, writeFile, mkdir, rename } from 'node:fs/promises';
import { ANNOUNCEMENTS, MINISTRY, KNOWN_ANNOUNCEMENTS, SNAPSHOT_2026 } from '../config/holiday-snapshot.js';
import { calendarSnapshot } from '../domain/holidays.js';

const MONTHS = [
  'јануари',
  'февруари',
  'март',
  'април',
  'мај',
  'јуни',
  'јули',
  'август',
  'септември',
  'октомври',
  'ноември',
  'декември'
];
const DAYS = ['недела', 'понеделник', 'вторник', 'среда', 'четврток', 'петок', 'сабота'];
const PATTERNS = [
  ['new-year', /нова година/iu],
  ['orthodox-christmas', /божи[кќ].*православ/iu],
  ['catholic-christmas', /божи[кќ]/iu],
  ['eid-fitr', /рамазан бајрам/iu],
  ['good-friday', /велики петок/iu],
  ['orthodox-easter', /велигден.*православ/iu],
  ['catholic-easter', /велигден/iu],
  ['labour', /ден на трудот/iu],
  ['cyril-methodius', /кирил и методиј/iu],
  ['republic', /ден на републиката/iu],
  ['independence', /ден на независноста/iu],
  ['uprising', /ден на народното востание/iu],
  ['revolution', /револуционерна борба/iu],
  ['clement', /климент охридски/iu],
  ['christmas-eve', /бадник/iu],
  ['epiphany', /богојавление|водици/iu],
  ['pentecost', /духовден/iu],
  ['dormition', /богородица/iu],
  ['all-saints', /сите светци/iu],
  ['eid-adha', /курбан бајрам/iu],
  ['albanian-alphabet', /албанската азбука/iu],
  ['saint-sava', /свети сава/iu],
  ['roma', /ден на ромите/iu],
  ['vlach', /ден на власите/iu],
  ['yom-kippur', /јом кипур/iu],
  ['bosniak', /ден на бошњаците/iu],
  ['turkish-language', /наставата на турски јазик/iu]
];
function safeURL(value) {
  const url = new URL(value, MINISTRY);
  if (
    url.origin !== MINISTRY ||
    url.username ||
    url.password ||
    url.hash ||
    url.search ||
    !(
      url.href === ANNOUNCEMENTS ||
      /^\/mk-MK\/odnosi-so-javnost\/soopstenija\/soopstenie-za-neraboten-den\d*$/.test(url.pathname)
    )
  )
    throw new Error('holiday_source_not_allowed');
  return url.href;
}
function plainText(html) {
  return html
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, '')
    .replaceAll(/<[^<>]*>/g, ' ')
    .replace(/&#(x[0-9a-f]+|\d+);/gi, (_, n) => {
      const code = n[0].toLowerCase() === 'x' ? Number.parseInt(n.slice(1), 16) : Number(n);
      return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : ' ';
    })
    .replace(/&(?:nbsp|bdquo|ldquo|rdquo|quot|ndash|mdash|amp);/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
export function announcementLinks(html) {
  const links = [];
  for (const match of html.matchAll(/href\s*=\s*["']([^"']+)["']/gi)) {
    try {
      const url = safeURL(match[1]);
      if (url !== ANNOUNCEMENTS) links.push(url);
    } catch {
      /* Ignore external/navigation links. */
    }
  }
  return [...new Set(links)].slice(0, 12);
}
export function announcementPublicationDates(html) {
  const result = new Map();
  for (const url of announcementLinks(html)) {
    const positions = [...html.matchAll(/href\s*=\s*["']([^"']+)["']/gi)].filter((match) => {
      try {
        return safeURL(match[1]) === url;
      } catch {
        return false;
      }
    });
    if (positions.length < 2) continue;
    // The publication badge sits between repeated links to the SAME article card.
    const card = html.slice(positions[0].index, positions.at(-1).index);
    if (card.length > 15000) continue;
    const dates = [...card.matchAll(/>\s*(\d{2})\/(\d{2})\/(20\d{2})\s*<\/div>/g)];
    if (dates.length !== 1) continue;
    const [, day, month, year] = dates[0];
    const date = `${year}-${month}-${day}`;
    const parsed = new Date(`${date}T12:00:00Z`);
    if (Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date) result.set(url, date);
  }
  return result;
}
export function parseHolidayAnnouncement(html, year, sourceUrl, { publishedOn } = {}) {
  safeURL(sourceUrl);
  const content = html.match(/<div\b[^>]*class=["'][^"']*\bblog-content\b[^"']*["'][^>]*>([\s\S]*?)<\/div>/i)?.[1];
  if (!content) throw new Error('holiday_format_changed');
  const text = plainText(content);
  if (!/министерството за економија и труд/iu.test(text) || !/неработен ден/iu.test(text))
    throw new Error('not_a_holiday_announcement');
  const expression = new RegExp(
    String.raw`(\d{1,2})\s+(${MONTHS.join('|')})\s*\((${DAYS.join('|')})\)(?:\s*(20\d{2})\s*година)?`,
    'giu'
  );
  const matches = [...text.matchAll(expression)];
  if (!matches.length || matches.length > 2) throw new Error('ambiguous_holiday_date');
  if (matches.some((match) => match[4] && Number(match[4]) !== year)) return null;
  const dates = matches.map(([, day, month, weekday, foundYear]) => {
    const date = `${year}-${String(MONTHS.indexOf(month.toLowerCase()) + 1).padStart(2, '0')}-${day.padStart(2, '0')}`;
    const parsed = new Date(`${date}T12:00:00Z`);
    if (
      !Number.isFinite(parsed.getTime()) ||
      parsed.toISOString().slice(0, 10) !== date ||
      DAYS[parsed.getUTCDay()] !== weekday.toLowerCase()
    )
      throw new Error('invalid_holiday_date');
    if (!foundYear) {
      const published = /^20\d{2}-\d{2}-\d{2}$/.test(publishedOn || '') ? new Date(`${publishedOn}T12:00:00Z`) : null;
      const gap = parsed - published;
      if (
        !published ||
        !Number.isFinite(published.getTime()) ||
        published.toISOString().slice(0, 10) !== publishedOn ||
        gap < 0 ||
        gap > 45 * 86400000
      )
        throw new Error('missing_holiday_year');
    }
    return date;
  });
  const id = PATTERNS.find(([, pattern]) => pattern.test(text))?.[0];
  const definition = SNAPSHOT_2026.find((row) => row[0] === id);
  if (!definition) throw new Error('unknown_holiday');
  const [, , expectedScope, mk, en, family] = definition;
  const all = /за сите граѓани/iu.test(text);
  if (all !== (expectedScope === 'all')) throw new Error('holiday_scope_mismatch');
  if (dates.length === 2) {
    const between = text.slice(matches[0].index + matches[0][0].length, matches[1].index);
    if (
      !all ||
      !/^,?\s*односно$/iu.test(between.trim()) ||
      new Date(`${dates[0]}T12:00:00Z`).getUTCDay() !== 0 ||
      Date.parse(dates[1]) - Date.parse(dates[0]) !== 86400000
    )
      throw new Error('ambiguous_holiday_date');
  }
  return {
    id,
    date: dates.at(-1),
    ...(dates.length === 2 ? { holidayDate: dates[0] } : {}),
    ...(matches.some((match) => !match[4]) ? { yearBasis: 'publication_date', publishedOn } : {}),
    scope: expectedScope,
    name: { mk, en },
    family,
    kind: all ? 'public' : 'community',
    sourceUrl: safeURL(sourceUrl)
  };
}

export function createHolidayImporter({
  fetcher = (...args) => fetch(...args),
  now = Date.now,
  cacheDir = new URL('../../.cache/holidays/', import.meta.url)
} = {}) {
  const memory = new Map();
  const pending = new Map();
  async function getHTML(url, signal) {
    const response = await fetcher(safeURL(url), { signal, redirect: 'error', headers: { Accept: 'text/html' } });
    if (
      !response.ok ||
      !/text\/html/i.test(response.headers.get('content-type') || '') ||
      Number(response.headers.get('content-length')) > 1_500_000
    )
      throw new Error('holiday_fetch_failed');
    const chunks = [];
    let size = 0;
    for await (const chunk of response.body) {
      size += chunk.length;
      if (size > 1_500_000) {
        await response.body.cancel().catch(() => {});
        throw new Error('holiday_body_too_large');
      }
      chunks.push(chunk);
    }
    return Buffer.concat(chunks).toString('utf8');
  }
  return async function getCalendar(year, { fresh = false } = {}) {
    if (!Number.isInteger(year) || year < 2024 || year > 2100) throw new Error('invalid_calendar_year');
    if (pending.has(year)) return pending.get(year);
    const task = (async () => {
      let previous = memory.get(year);
      if (!previous && cacheDir) previous = await readCalendarCache(year, cacheDir);
      previous ||= calendarSnapshot(year);
      const cacheAge = now() - Date.parse(previous.checkedAt);
      if (
        !fresh &&
        Number.isFinite(cacheAge) &&
        cacheAge >= 0 &&
        cacheAge < (previous.refreshFailed ? 15 * 60000 : 24 * 3600000)
      )
        return { ...previous, source: previous.fetchedAt ? 'cache' : 'snapshot' };
      const checkedAt = new Date(now()).toISOString();
      try {
        // One deadline covers discovery and all articles. Never follow arbitrary upstream URLs.
        const signal = AbortSignal.timeout(9000);
        const index = await getHTML(ANNOUNCEMENTS, signal);
        const publicationDates = announcementPublicationDates(index);
        const links = [...new Set([...announcementLinks(index), ...KNOWN_ANNOUNCEMENTS])];
        if (!announcementLinks(index).length) throw new Error('holiday_index_changed');
        const results = [];
        for (let offset = 0; offset < links.length; offset += 3) {
          results.push(
            ...(await Promise.allSettled(
              links.slice(offset, offset + 3).map(async (url) =>
                parseHolidayAnnouncement(await getHTML(url, signal), year, url, {
                  publishedOn: publicationDates.get(url)
                })
              )
            ))
          );
        }
        const updates = results.filter((r) => r.status === 'fulfilled' && r.value).map((r) => r.value);
        if (!updates.length) throw new Error('no_verified_announcements');
        const events = new Map(previous.events.map((e) => [e.id, e]));
        for (const event of updates)
          events.set(event.id, { ...event, verifiedOn: checkedAt.slice(0, 10), fetchedAt: checkedAt });
        const result = {
          ...previous,
          events: [...events.values()].sort((a, b) => a.date.localeCompare(b.date)),
          checkedAt,
          fetchedAt: checkedAt,
          source: 'live',
          refreshFailed: false,
          partial: results.some((r) => r.status === 'rejected'),
          warnings: previous.warnings.filter(
            (w) => w !== 'republic_observed_date_unverified' || !updates.some((e) => e.id === 'republic')
          )
        };
        memory.set(year, result);
        await writeCalendarCache({ cacheDir, year, result });
        return result;
      } catch {
        const result = {
          ...previous,
          checkedAt,
          source: previous.fetchedAt ? 'cache' : 'snapshot',
          refreshFailed: true
        };
        memory.set(year, result);
        return result;
      }
    })();
    pending.set(year, task);
    try {
      return await task;
    } finally {
      pending.delete(year);
    }
  };
}
export const getHolidayCalendar = createHolidayImporter();

async function readCalendarCache(year, cacheDir) {
  try {
    const saved = JSON.parse(await readFile(new URL(`${year}.json`, cacheDir), 'utf8'));
    if (
      saved.year === year &&
      Array.isArray(saved.events) &&
      saved.events.every((e) => /^20\d{2}-\d{2}-\d{2}$/.test(e.date) && SNAPSHOT_2026.some((row) => row[0] === e.id))
    )
      return saved;
  } catch {
    /* A missing/unreadable cache falls back to the verified snapshot. */
  }

  return null;
}

async function writeCalendarCache({ cacheDir, year, result }) {
  if (cacheDir) {
    try {
      await mkdir(cacheDir, { recursive: true });
      const temp = new URL(`${year}.tmp`, cacheDir);
      await writeFile(temp, JSON.stringify(result));
      await rename(temp, new URL(`${year}.json`, cacheDir));
    } catch {
      /* Calendar remains usable without disk cache. */
    }
  }
}
