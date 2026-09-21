import { textPair, invalid } from './settings.js';

export const titleKey = value => value.normalize('NFKC').toLowerCase().replace(/[\p{P}\p{S}]/gu, ' ').replace(/\s+/g, ' ').trim();
export function learningText(value, limit) {
  const result = textPair(value, limit);
  if (Object.values(result).some(text => /ignore.{0,20}instructions|system prompt|air is clean|safe to (?:go|play)|безбедно.{0,15}надвор|воздухот е чист|\bAQI\b|PM2[.,]5|\bhttps?:/iu.test(text))) throw invalid('invalid_curriculum');
  return result;
}

export function activityDescription(value) {
  const result = learningText(value, 1200);
  if (Object.values(result).some(text => text.length < 160 || (text.match(/[.!?](?:\s|$)/gu) || []).length < 3)) throw invalid('activity_detail_required');
  return result;
}

export function validateSessions(value, planningDays, themes, dates) {
  const slots = planningDays.flatMap(day => day.slots.filter(row => row.kind === 'activity').map(row => ({ date: day.date, id: row.id })));
  if (!Array.isArray(value) || value.length !== slots.length) throw invalid('invalid_curriculum');
  const used = new Set(); const titles = new Map();
  return value.map(item => {
    const key = `${item?.date}/${item?.slotId}`;
    if (used.has(key) || !slots.some(slot => slot.date === item?.date && slot.id === item?.slotId)) throw invalid('invalid_curriculum');
    used.add(key);
    const title = learningText(item.title, 100); const description = activityDescription(item.description);
    const dayTitles = titles.get(item.date) || Object.fromEntries(['mk', 'en'].map(lang => [lang, new Set([titleKey(themes[dates.indexOf(item.date)].title[lang])])]));
    for (const lang of ['mk', 'en']) {
      if (dayTitles[lang].has(titleKey(title[lang]))) throw invalid('duplicate_activity');
      dayTitles[lang].add(titleKey(title[lang]));
    }
    titles.set(item.date, dayTitles);
    return { date: item.date, slotId: item.slotId, title, description };
  });
}
