import { holidayLesson, lessonCoversOccasion } from './curriculum.js';
import { minutes, pair } from './settings.js';

function covers(theme, event, settings) {
  if (lessonCoversOccasion(theme, event)) return true;
  const curated = holidayLesson(event, settings);
  return (
    curated &&
    ['inside', 'outside'].every((key) => ['mk', 'en'].every((lang) => theme[key]?.[lang] === curated[key][lang]))
  );
}

export function occasionDiscussion(events, date) {
  const context = (lang) =>
    events
      .map((event) => {
        const when = `${Number(event.date.slice(8))}.${Number(event.date.slice(5, 7))}.${event.date.slice(0, 4)}`;
        const preparation = event.date !== date;
        const scopes = {
          mk: { community: 'празник на заедница', public: 'државен празник', other: 'изборна тема' },
          en: { community: 'community holiday', public: 'public holiday', other: 'optional classroom occasion' }
        };
        const scope = scopes[lang][event.kind] || scopes[lang].other;
        const prefix = { mk: 'Подготовка за ', en: 'Preparing for ' }[lang];
        return `${preparation ? prefix : ''}${event.name[lang]} (${when}, ${scope}).`;
      })
      .join(' ');
  return pair(
    `${context('mk')} Со воспитувачот разговараме за поводот и како секој да се чувствува добредојден. Секое дете предлага гест на внимание; заедно правиме порака за добредојде со материјалите што ги имаме.`,
    `${context('en')} With the teacher, talk about the occasion and how to help everyone feel welcome. Each child suggests a kind gesture; together we make a welcome message using the materials we have.`
  );
}

// Add discussion within an existing slot. Never add time, infer closures or overwrite a teacher's lesson.
export function adaptOccasionActivities(day, settings, today, clockMinutes) {
  if (!day.theme || day.closed || day.date < today) return;
  const upcoming = (row) => day.date > today || minutes(row.start) >= clockMinutes;
  const events = [...(day.preparationFor ? [day.preparationFor] : []), ...(day.occasions || [])];
  const eco = day.timeline.find((row) => row.kind === 'eco');
  for (const row of day.timeline.filter((row) => upcoming(row) && !row.customized)) {
    delete row.occasionIds;
    delete row.occasionDiscussion;
  }
  const missing = [];
  for (const event of events) {
    if (day.timeline.some((row) => row.customized && row.occasionIds?.includes(event.id))) continue;
    if (day.timeline.some((row) => !upcoming(row) && row.occasionIds?.includes(event.id))) continue;
    if (eco && covers(day.theme, event, settings)) {
      eco.occasionIds = [...new Set([...(eco.occasionIds || []), event.id])];
    } else missing.push(event);
  }
  if (!missing.length) return;
  const rows = day.timeline.filter(upcoming);
  const available = rows.filter((row) => row.kind === 'activity' && row.activityRole && !row.customized);
  const row =
    available.find((row) => row.activityRole === 'circle') ||
    available[0] ||
    rows.find((row) => ['eco', 'activity'].includes(row.kind));
  if (!row) return;
  row.occasionIds = [...new Set([...(row.occasionIds || []), ...missing.map((event) => event.id)])];
  row.occasionDiscussion = occasionDiscussion(missing, day.date);
  if (available.includes(row)) {
    row.label = structuredClone(missing[0].name);
    row.note = row.occasionDiscussion;
  }
}
