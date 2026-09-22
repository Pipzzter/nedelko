import { teacherInstruction } from './settings.js';

// Preserve explicitly requested daily topics, including briefs saved by older versions
// that flattened newlines. Ordinary prose remains available to the model verbatim.
export function dailyTopics(value) {
  const brief = teacherInstruction(value);
  const marker = /(?:\bone\s+days?\b|\bday\s+\d+\b|еден\s+ден|едниот\s+ден|ден\s+\d+)/giu;
  const matches = [...brief.matchAll(marker)];
  if (!matches.length) return [];
  return matches
    .map((match, index) => {
      const section = trimTopic(brief.slice(match.index + match[0].length, matches[index + 1]?.index ?? brief.length));
      const text = trimTopic(section.split(/[!?\n]|\.(?=\s|$)/u)[0])
        .replace(/^(?:talking\s+about|about|за)\s+/iu, '')
        .trim();
      const dayNumber = /\d+/u.exec(match[0]);
      return { id: `topic-${index + 1}`, ...(dayNumber ? { dayIndex: Number(dayNumber[0]) - 1 } : {}), text, language: /[а-шѓќѕјљњџ]/iu.test(text) ? 'mk' : 'en' };
    })
    .filter((topic) => topic.text);
}

export function assignDailyTopics(value, dates, today = dates[0]) {
  const topics = dailyTopics(value);
  const upcoming = dates.filter((date) => date >= today);
  if (!upcoming.length) return [];
  let next = 0;
  return topics.map(topic => ({ ...topic, date: topic.dayIndex === undefined ? upcoming[next++ % upcoming.length] : dates[topic.dayIndex] }))
    .filter(topic => topic.date && topic.date >= today);
}

const normalized = (text) => text.normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim();
export function validateTopicCoverage(themes, dates, assignments) {
  for (const topic of assignments) {
    const theme = themes[dates.indexOf(topic.date)];
    // Require visible coverage in both alternatives. This is a text-coverage check,
    // not a claim that code can evaluate teaching quality or a translation.
    if (
      !theme ||
      ['inside', 'outside'].some((key) => !normalized(theme[key][topic.language]).includes(normalized(topic.text)))
    ) {
      throw new Error('missing_teacher_topic');
    }
  }
}

function trimTopic(value) {
  let start = 0;
  let end = value.length;
  const punctuation = /[\s:,.-]/u;
  while (start < end && punctuation.test(value[start])) start++;
  while (end > start && punctuation.test(value[end - 1])) end--;
  return value.slice(start, end);
}
