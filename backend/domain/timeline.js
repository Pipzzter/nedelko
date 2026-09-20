import { minutes } from './settings.js';

// Consolidate only upcoming, unedited generated play. Fixed routines and eco slots stay intact.
export function compactTimeline(rows, { consolidate = false, from = '00:00' } = {}) {
  const result = [];
  for (const row of [...rows].sort((a, b) => a.start.localeCompare(b.start))) {
    const previous = result.at(-1);
    const same = previous && previous.start >= from && !previous.customized && !row.customized && !previous.plannedSession && !row.plannedSession &&
      previous.label.mk === row.label.mk && previous.label.en === row.label.en && previous.activityRole === row.activityRole &&
      previous.customized === row.customized && JSON.stringify(previous.note) === JSON.stringify(row.note);
    const generated = consolidate && previous?.activityRole && row.activityRole && !previous.customized && !row.customized && !previous.plannedSession && !row.plannedSession &&
      !previous.occasionIds?.length && !row.occasionIds?.length && previous.start >= from && minutes(row.end) - minutes(previous.start) <= 60;
    if (row.kind === 'activity' && previous?.kind === 'activity' && previous.end === row.start && (same || generated)) previous.end = row.end;
    else result.push({ ...row, label: { ...row.label } });
  }
  return result;
}
