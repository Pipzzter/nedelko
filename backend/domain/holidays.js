import { SNAPSHOT_2026, PROGRAMME_2026, VERIFIED_ON, VERIFIED_CORRECTIONS } from '../config/holiday-snapshot.js';

export function calendarSnapshot(year) {
  return {
    year,
    complete: year === 2026,
    source: 'snapshot',
    checkedAt: null,
    fetchedAt: null,
    refreshFailed: false,
    verifiedOn: year === 2026 ? VERIFIED_ON : null,
    sourceUrl: year === 2026 ? PROGRAMME_2026 : null,
    warnings: year === 2026 ? [] : ['annual_programme_unavailable'],
    events:
      year === 2026
        ? SNAPSHOT_2026.map(([id, date, scope, mk, en, family]) => ({
            id,
            date: `${year}-${date}`,
            scope,
            name: { mk, en },
            family,
            kind: scope === 'all' ? 'public' : 'community',
            sourceUrl: PROGRAMME_2026,
            verifiedOn: VERIFIED_ON,
            ...VERIFIED_CORRECTIONS[id]
          }))
        : []
  };
}

export function classroomOccasions(year) {
  return [
    { id: 'halloween', date: `${year}-10-31`, name: { mk: 'Ноќ на вештерките', en: 'Halloween' }, family: 'halloween' },
    {
      id: 'earth-day',
      date: `${year}-04-22`,
      name: { mk: 'Ден на планетата Земја', en: 'Earth Day' },
      family: 'community'
    },
    {
      id: 'environment-day',
      date: `${year}-06-05`,
      name: { mk: 'Светски ден на животната средина', en: 'World Environment Day' },
      family: 'community'
    }
  ].map((event) => ({ ...event, kind: 'classroom', scope: 'optional', sourceUrl: null }));
}

const stamp = (date) => Date.parse(`${date}T12:00:00Z`);
// Pick the occasion's day, or the preceding weekday when it falls on a weekend.
// An upcoming Monday occasion can inspire Friday preparation; its actual date is retained.
export function occasionsForWeek(dates, calendars = []) {
  const years = [
    ...new Set([dates[0].slice(0, 4), new Date(stamp(dates.at(-1)) + 3 * 86400000).getUTCFullYear().toString()])
  ];
  const events = years.flatMap((year) => [
    ...(calendars.find((c) => c.year === Number(year)) || calendarSnapshot(Number(year))).events,
    ...classroomOccasions(Number(year))
  ]);
  const assignments = dates.map(() => []);
  for (const event of events) {
    if (event.date < dates[0] || stamp(event.date) > stamp(dates.at(-1)) + 3 * 86400000) continue;
    let index = dates.indexOf(event.date);
    if (index < 0) index = dates.length - 1;
    if (stamp(event.date) - stamp(dates[index]) > 3 * 86400000) continue;
    assignments[index].push({ ...event, lessonDate: dates[index] });
  }
  return assignments.map((list) =>
    list.sort((a, b) => occasionPriority(a.kind) - occasionPriority(b.kind) || a.date.localeCompare(b.date))
  );
}

function occasionPriority(kind) {
  return { public: 0, classroom: 1 }[kind] ?? 2;
}
