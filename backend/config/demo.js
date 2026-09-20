// Fixed, synthetic examples. Their dates and weather never depend on a client-supplied clock.
export const DEFAULT_DEMO_WEEK = 'independence';
export const DEMO_WEEKS = [
  { id: 'independence', label: { mk: '8 Септември · Ден на независноста', en: '8 September · Independence Day' },
    clock: '2026-09-07T06:45:00Z', closed: ['2026-09-08'], preparation: { date: '2026-09-07', event: 'independence' },
    temperatures: [18, 19, 17, 14, 20, 18, 17], rainy: [2], snowy: [], windy: [3] },
  { id: 'easter', label: { mk: 'Април · Велигденски подготовки', en: 'April · Easter preparations' },
    clock: '2026-04-06T06:45:00Z', closed: ['2026-04-10'], preparation: { date: '2026-04-09', event: 'orthodox-easter' },
    temperatures: [12, 14, 11, 13, 15, 16, 17], rainy: [2], snowy: [], windy: [3] },
  { id: 'halloween', label: { mk: 'Октомври · Ноќ на вештерките', en: 'October · Halloween' },
    clock: '2026-10-26T07:45:00Z', closed: [],
    temperatures: [10, 11, 12, 6, 13, 12, 11], rainy: [2], snowy: [], windy: [3] },
  { id: 'winter', label: { mk: 'Јануари · Снег и зимски еко-игри', en: 'January · Snow and winter eco play' },
    clock: '2026-01-12T07:45:00Z', closed: [],
    temperatures: [3, 4, -4, 2, 5, 3, 2], rainy: [], snowy: [2], windy: [3] },
  { id: 'autumn-afternoon', label: { mk: 'Октомври · Попладне со мали откритија', en: 'October · A day of little discoveries' },
    clock: '2026-10-05T12:30:00Z', closed: [],
    temperatures: [16, 17, 13, 15, 18, 17, 16], rainy: [2], snowy: [], windy: [3] },
  { id: 'spring-garden', label: { mk: 'Мај · Нашата пролетна градина', en: 'May · Our spring garden' },
    clock: '2026-05-11T06:45:00Z', closed: [],
    temperatures: [19, 20, 16, 18, 22, 21, 19], rainy: [2], snowy: [], windy: [] },
];
export function demoWeekById(id = DEFAULT_DEMO_WEEK) {
  const profile = DEMO_WEEKS.find(week => week.id === id);
  if (!profile) throw Object.assign(new Error('invalid_demo_week'), { code: 'invalid_demo_week', status: 400 });
  return profile;
}
export const demoWeekOptions = () => DEMO_WEEKS.map(({ id, label }) => ({ id, label }));
