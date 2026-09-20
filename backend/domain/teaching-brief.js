import { teacherInstruction } from './settings.js';

// Preserve explicitly requested daily topics, including briefs saved by older versions
// that flattened newlines. Ordinary prose remains available to the model verbatim.
export function dailyTopics(value) {
  const brief = teacherInstruction(value);
  const marker = /(?:\bone\s+days?\b|\bday\s+\d+\b|еден\s+ден|едниот\s+ден|ден\s+\d+)/giu;
  const matches = [...brief.matchAll(marker)];
  if (!matches.length) return [];
  return matches.map((match, index) => {
    const text = brief.slice(match.index + match[0].length, matches[index + 1]?.index ?? brief.length)
      .replace(/^[\s:,.\-]+|[\s:,.\-]+$/gu, '')
      .replace(/^(?:talking\s+about|about|за)\s+/iu, '').trim();
    return { id: `topic-${index + 1}`, text, language: /[а-шѓќѕјљњџ]/iu.test(text) ? 'mk' : 'en' };
  }).filter(topic => topic.text);
}

export function assignDailyTopics(value, dates, today = dates[0]) {
  const upcoming = dates.filter(date => date >= today);
  return dailyTopics(value).map((topic, index) => ({ ...topic, date: upcoming[index % upcoming.length] }));
}

const normalized = text => text.normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim();
export function validateTopicCoverage(themes, dates, assignments) {
  for (const topic of assignments) {
    const theme = themes[dates.indexOf(topic.date)];
    // Require visible coverage in both alternatives. This is a text-coverage check,
    // not a claim that code can evaluate teaching quality or a translation.
    if (!theme || ['inside', 'outside'].some(key => !normalized(theme[key][topic.language]).includes(normalized(topic.text)))) {
      throw new Error('missing_teacher_topic');
    }
  }
}
