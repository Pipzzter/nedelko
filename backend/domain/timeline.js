import { minutes, timeLabel, invalid } from './settings.js';

// Resolve collisions in the authored order without shortening or deleting rows.
// Existing started rows are immutable, including any historical overlap.
export function resolveTimelineOverlaps(rows, lockedIds = new Set()) {
  let cursor = 0;
  return rows.map(row => {
    const start = minutes(row.start);
    const duration = minutes(row.end) - start;
    if (lockedIds.has(row.id)) {
      cursor = Math.max(cursor, minutes(row.end));
      return structuredClone(row);
    }
    const resolved = Math.max(start, cursor);
    cursor = resolved + duration;
    if (cursor > 1439) throw invalid('time_bounds');
    return { ...row, start: timeLabel(resolved), end: timeLabel(cursor) };
  });
}

// Consolidate only upcoming, unedited generated play. Fixed routines and eco slots stay intact.
export function compactTimeline(rows, { consolidate = false, from = '00:00' } = {}) {
  const result = [];
  for (const row of [...rows].sort((a, b) => a.start.localeCompare(b.start))) {
    const previous = result.at(-1);
    const same = previous && previous.start >= from && !previous.customized && !row.customized && !previous.plannedSession && !row.plannedSession &&
      !previous.occasionIds?.length && !row.occasionIds?.length && minutes(row.end) - minutes(previous.start) <= 90 &&
      previous.label.mk === row.label.mk && previous.label.en === row.label.en && previous.activityRole === row.activityRole &&
      previous.customized === row.customized && JSON.stringify(previous.note) === JSON.stringify(row.note);
    const generated = consolidate && previous?.activityRole && row.activityRole && !previous.customized && !row.customized && !previous.plannedSession && !row.plannedSession &&
      !previous.occasionIds?.length && !row.occasionIds?.length && previous.start >= from && minutes(row.end) - minutes(previous.start) <= 60;
    if (row.kind === 'activity' && previous?.kind === 'activity' && previous.end === row.start && (same || generated)) previous.end = row.end;
    else result.push({ ...row, label: { ...row.label } });
  }
  return result;
}
