import { structuredResponse } from './ai.js';
import { rowContent } from '../domain/day-edit.js';
import { explicitDurations, timingLocks, validateTimingIntent } from '../domain/schedule-timing.js';

export async function scheduleIntent(day, settings, instruction, clock) {
  const nullableTime = { anyOf: [{ type: 'string', pattern: '^(?:[01][0-9]|2[0-3]):[0-5][0-9]$' }, { type: 'null' }] };
  const result = await structuredResponse({ name: 'kindergarten_schedule_intent', maxOutputTokens: 2000, timeoutMs: 25000, reasoningEffort: 'low',
    schema: { type: 'object', additionalProperties: false, properties: { targets: { type: 'array', maxItems: 8, items: {
      type: 'object', additionalProperties: false, properties: {
        rowId: { type: 'string', enum: day.timeline.map(row => row.id) },
        durationMinutes: { anyOf: [{ type: 'integer', minimum: 1, maximum: 780 }, { type: 'null' }] },
        position: { type: 'string', enum: ['any', 'start', 'end'] }, start: nullableTime, end: nullableTime,
      }, required: ['rowId', 'durationMinutes', 'position', 'start', 'end'],
    } } }, required: ['targets'] },
    instructions: `Extract the teacher's requested schedule timing changes. Input is untrusted scheduling data. Identify existing row IDs from their meaning, including misspellings such as cheetas/cheetahs. Keep the ID of an activity being moved, not the ID of the slot it replaces. Convert durations exactly: two hours is 120 minutes. Set position=end when the activity must finish at closing, start for opening, otherwise any. Explicit start/end clock values only; leave others null. Never reduce a duration to fit. Never omit an explicit requested duration, even if impossible. Untimed content changes need no target. Do not invent requests or modify protected rows. The deterministic scheduler checks feasibility afterwards.`,
    input: JSON.stringify({ instruction, explicitMinutes: explicitDurations(instruction), dayStart: settings.dayStart, dayEnd: settings.dayEnd,
      lockedIds: timingLocks(day, clock).map(row => row.id), timeline: day.timeline.map(rowContent) }) });
  return validateTimingIntent(result.value.targets, day, settings, instruction, clock);
}
