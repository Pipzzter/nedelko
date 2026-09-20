import { adaptWeek } from './week.js';
import { holidayLesson } from './curriculum.js';

// Closures and preparation days are preset teacher choices in this isolated example.
// Real accounts still confirm their own kindergarten's closures.
export function prepareDemoWeek(input, conditions, profile) {
  const week = structuredClone(input);
  week.demoWeek = profile.id;
  for (const day of week.days) day.closed = profile.closed.includes(day.date);
  if (profile.preparation) {
    const event = week.days.flatMap(day => day.occasions).find(event => event.id === profile.preparation.event);
    const day = week.days.find(day => day.date === profile.preparation.date);
    if (event && day?.theme) {
      day.preparationFor = { ...event, lessonDate: day.date };
      day.theme = holidayLesson(event, week.settings);
      day.themePinned = true;
      day.timeline = day.timeline.map(row => row.kind === 'eco' ? { ...row, label: day.theme.title } : row);
    }
  }
  const result = adaptWeek(week, conditions);
  result.changes = []; // Selecting a fixture is not an observed change in conditions.
  return result;
}
