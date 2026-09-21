import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { announcementLinks, announcementPublicationDates, parseHolidayAnnouncement, createHolidayImporter } from '../services/holidays.js';
import { ANNOUNCEMENTS } from '../config/holiday-snapshot.js';
import { calendarSnapshot, occasionsForWeek } from '../domain/holidays.js';
import { localCurriculum, validateCurriculum } from '../domain/curriculum.js';
import { DEFAULT_SETTINGS } from '../domain/settings.js';

// Small synthetic HTML fixtures follow the observed official article structure.
const url = `${ANNOUNCEMENTS}/soopstenie-za-neraboten-den52`;
const announcement = (date = '13 април (понеделник) 2026 година', name = 'Велигден, вториот ден според православниот календар', scope = 'сите граѓани') => `<div class="blog-content text-sm"><p>Министерството за економија и труд соопштува дека по повод празникот &bdquo;${name}&ldquo;, ${date}, е неработен ден за ${scope} на Република Северна Македонија.</p></div>`;
const index = `<a href="${url}">Соопштение</a>`;
const html = value => new Response(value, { headers: { 'content-type': 'text/html; charset=utf-8' } });

test('scraper imports an official moving Easter date and validates date, weekday, scope and source', () => {
  const event = parseHolidayAnnouncement(announcement(), 2026, url);
  assert.equal(event.date, '2026-04-13'); assert.equal(event.id, 'orthodox-easter'); assert.equal(event.scope, 'all');
  assert.equal(parseHolidayAnnouncement(announcement(), 2027, url), null);
  assert.throws(() => parseHolidayAnnouncement(announcement('31 април (понеделник) 2026 година'), 2026, url), /invalid_holiday_date/);
  assert.throws(() => parseHolidayAnnouncement(announcement('13 април (вторник) 2026 година'), 2026, url), /invalid_holiday_date/);
  assert.throws(() => parseHolidayAnnouncement(announcement(undefined, undefined, 'католичката заедница'), 2026, url), /scope/);
  assert.throws(() => parseHolidayAnnouncement(announcement(), 2026, 'https://evil.invalid/holiday'), /source/);
  assert.throws(() => parseHolidayAnnouncement('<div>New site layout</div>', 2026, url), /format/);
  assert.throws(() => parseHolidayAnnouncement(announcement().replace('</p>', ' 20 април (понеделник) 2026 година</p>'), 2026, url), /ambiguous/);
});

test('discovery ignores injected or off-site URLs and deduplicates official article links', () => {
  assert.deepEqual(announcementLinks(`${index}${index}<a href="https://evil.invalid/">x</a><a href="http://127.0.0.1/">x</a><a href="${url}?url=http://localhost">x</a>`), [url]);
});

test('an explicit Sunday-to-Monday substitute resolves the programme typo without guessing', () => {
  const event = parseHolidayAnnouncement(announcement('2 Август (недела) 2026 година, односно 3 Август (понеделник) 2026 година', 'Ден на Републиката'), 2026, url);
  assert.equal(event.date, '2026-08-03'); assert.equal(event.holidayDate, '2026-08-02');
  assert.throws(() => parseHolidayAnnouncement(announcement('2 Август (недела) 2026 година и 3 Август (понеделник) 2026 година', 'Ден на Републиката'), 2026, url), /ambiguous/);
  assert.throws(() => parseHolidayAnnouncement(announcement('2 Август (недела) 2026 година, односно 10 Август (понеделник) 2026 година', 'Ден на Републиката'), 2026, url), /ambiguous/);
});

test('a missing paragraph year is inferred only from the same article’s dated listing within 45 days', () => {
  const entry = `${index}<div class="date">24/08/2026</div>${index}`;
  const dates = announcementPublicationDates(entry);
  assert.equal(dates.get(url), '2026-08-24');
  const body = announcement('28 август (петок)', 'Успение на Пресвета Богородица', 'граѓаните од православна вероисповед');
  const event = parseHolidayAnnouncement(body, 2026, url, { publishedOn: dates.get(url) });
  assert.equal(event.date, '2026-08-28'); assert.equal(event.yearBasis, 'publication_date');
  assert.throws(() => parseHolidayAnnouncement(body, 2026, url), /missing_holiday_year/);
  assert.throws(() => parseHolidayAnnouncement(body, 2026, url, { publishedOn: '2025-08-24' }), /missing_holiday_year/);
  assert.throws(() => parseHolidayAnnouncement(body, 2026, url, { publishedOn: '2026-09-01' }), /missing_holiday_year/);
  assert.equal(announcementPublicationDates(`${index}<div>24/08/2026</div><div>25/08/2026</div>${index}`).size, 0);
});

test('holiday refresh is shared, persisted and cached; failure never renews an old successful fetch', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'nedelko-holidays-'));
  t.after(() => { assert.ok(directory.startsWith(join(tmpdir(), 'nedelko-holidays-'))); return rm(directory, { recursive: true, force: true }); });
  let now = Date.parse('2026-09-20T10:00:00Z'); let fail = false; let calls = 0;
  const importer = createHolidayImporter({ cacheDir: pathToFileURL(directory + sep), now: () => now,
    fetcher: async source => { calls++; if (fail) throw new Error('offline'); return html(source === ANNOUNCEMENTS ? index : announcement()); } });
  const [first, shared] = await Promise.all([importer(2026), importer(2026)]);
  assert.equal(first.source, 'live'); assert.equal(shared.fetchedAt, first.fetchedAt);
  const count = calls; assert.equal((await importer(2026)).source, 'cache'); assert.equal(calls, count);
  fail = true; now += 25 * 3600000;
  const stale = await importer(2026);
  assert.equal(stale.refreshFailed, true); assert.equal(stale.fetchedAt, first.fetchedAt); assert.deepEqual(stale.events, first.events);
  const restart = createHolidayImporter({ cacheDir: pathToFileURL(directory + sep), now: () => now, fetcher: async () => { throw new Error('offline'); } });
  assert.deepEqual((await restart(2026)).events, first.events);
});

test('oversized, non-HTML and changed upstream pages fall back to dated evidence', async () => {
  for (const reply of [() => new Response('bad', { headers: { 'content-type': 'application/json' } }),
    () => new Response('large', { headers: { 'content-type': 'text/html', 'content-length': '2000000' } }),
    () => html('<main>New layout</main>'), () => html('x'.repeat(1_500_001))]) {
    const importer = createHolidayImporter({ cacheDir: null, fetcher: async () => reply() });
    const result = await importer(2026);
    assert.equal(result.source, 'snapshot'); assert.equal(result.refreshFailed, true); assert.equal(result.fetchedAt, null);
    assert.equal(result.events.length, 27);
  }
});

test('unknown years do not inherit the 2026 religious dates or claim a complete calendar', async () => {
  const importer = createHolidayImporter({ cacheDir: null, fetcher: async () => { throw new Error('offline'); } });
  const calendar = await importer(2027);
  assert.equal(calendar.complete, false); assert.equal(calendar.sourceUrl, null); assert.deepEqual(calendar.events, []);
  await assert.rejects(() => importer(2026.5), /invalid_calendar_year/);
});

test('Easter and Halloween change the correct day’s lessons without inventing closures', () => {
  const easter = ['2026-04-06', '2026-04-07', '2026-04-08', '2026-04-09', '2026-04-10'];
  let themes = localCurriculum(easter, DEFAULT_SETTINGS);
  assert.match(themes[4].title.en, /Easter/); assert.match(themes[4].inside.en, /egg shapes/);
  assert.ok(!('closed' in themes[4])); validateCurriculum(themes, DEFAULT_SETTINGS);
  const halloween = ['2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30'];
  const occasions = occasionsForWeek(halloween);
  assert.equal(occasions[4][0].id, 'halloween'); assert.equal(occasions[4][0].date, '2026-10-31'); assert.equal(occasions[4][0].kind, 'classroom');
  themes = localCurriculum(halloween, DEFAULT_SETTINGS);
  assert.match(themes[4].title.en, /Halloween/); assert.match(themes[4].habit.en, /reuse/); validateCurriculum(themes, DEFAULT_SETTINGS);
});

test('year-crossing weeks preserve the correct year and a sourced announcement corrects the PDF typo', () => {
  const dates = ['2026-12-28', '2026-12-29', '2026-12-30', '2026-12-31', '2027-01-01'];
  assert.ok(occasionsForWeek(dates).flat().every(event => event.date >= dates[0]));
  const calendar = calendarSnapshot(2026);
  assert.equal(calendar.events.find(e => e.id === 'republic').date, '2026-08-03');
  assert.match(calendar.events.find(e => e.id === 'republic').sourceUrl, /soopstenie-za-neraboten-den753$/);
  assert.ok(!calendar.events.some(e => e.id === 'republic' && e.date === '2026-03-03'));
});
