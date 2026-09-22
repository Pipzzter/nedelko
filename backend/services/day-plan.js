import { structuredResponse, aiStatus } from './ai.js';
import { aiFailure } from './ai-errors.js';
import { lessonSchema, pairSchema, timelineSchema, TIMETABLE_GUIDANCE, validateModelTimeline } from './curriculum.js';
import { teacherInstruction, materialCatalog, minutes, timeLabel } from '../domain/settings.js';
import { assertTimelineCoverage } from '../domain/timeline.js';
import { localCurriculum } from '../domain/curriculum.js';
import { protectedActivity, rowContent, validateDayChange } from '../domain/day-edit.js';
import { ACTIVITY_GUIDANCE, descriptionSchema, teacherPlanningInstructions } from './learning-guidance.js';
import { activityDescription } from '../domain/session-plan.js';
import { playChoices } from '../domain/play-ideas.js';
import { requestedTimings, validateRequestedTimings } from '../domain/teacher-timing.js';
import { skopjeParts } from '../config/index.js';

export async function suggestDayPlan(day, settings, { scope, rowId, instruction, useAI = true, clock, weekDays = [] }) {
  const request = { scope, rowId };
  const row = day.timeline.find((item) => item.id === rowId);
  const editable = editableWindow(day, clock);
  if (!useAI) {
    return demoDayChange({ scope, settings, day, row, request, clock });
  }
  if (!aiStatus().configured) return { change: null, generationIssue: 'ai_not_configured' };
  const properties = changeProperties(scope, row, settings);
  try {
    const result = await structuredResponse({
      name: 'kindergarten_day_change',
      schema: { type: 'object', additionalProperties: false, properties, required: Object.keys(properties) },
      maxOutputTokens: scope === 'schedule' ? 12000 : 6000,
      timeoutMs: 90000,
      reasoningEffort: 'medium',
      instructions: `${teacherPlanningInstructions(settings.teacherPrompt, instruction)}\n${ACTIVITY_GUIDANCE} Edit the requested kindergarten activity or daily schedule in natural Macedonian and equivalent English. Apply requestedChange directly to the selected scope. For activity scope, change ONLY the selected activity; do not change any times or other sessions. For schedule scope, ${TIMETABLE_GUIDANCE} The requestedChange is the latest teacher instruction and takes priority over the older teacherBrief. Return the complete updated day. Only rows whose start time has already arrived are locked; preserve them exactly, including ID, times, kind, label and note. Never add a new row in elapsed time. Meals, rest, routines and occasion activities that have not started may all be changed or removed. Retain existing IDs where possible. Keep the lesson theme unless the request changes it. Use available material IDs, the supplied age group and adult supervision. Do not decide air quality, weather eligibility, closures or medical permissions. No purchases, dangerous materials, links, child identifiers or em dashes.`,
      input: JSON.stringify(changeInput(day, settings, { scope, rowId, instruction, clock, weekDays, editable }))
    });
    validateModelChange(day, settings, request, result.value, { row, instruction, clock, editable });
    return { change: result.value, source: 'ai' };
  } catch (error) {
    if (error.code === 'activity_finished') throw error;
    const failure = aiFailure(error.status === 400 || error.status === 409 ? { code: 'ai_invalid_output' } : error);
    return { change: null, generationIssue: failure.issue, generationError: failure.details };
  }
}

// On the current Skopje date, rows that have started are locked and editing starts next minute.
function editableWindow(day, clock) {
  const local = skopjeParts(new Date(clock));
  const today = day.date === local.date;
  return { local, from: today ? timeLabel(Math.min(local.minutes + 1, 1439)) : null,
    locked: (item) => today && minutes(item.start) <= local.minutes };
}

function changeInput(day, settings, { scope, rowId, instruction, clock, weekDays, editable }) {
  return {
    scope,
    selectedRowId: rowId || null,
    requestedChange: teacherInstruction(instruction),
    teacherBrief: teacherInstruction(settings.teacherPrompt),
    ageGroup: settings.ageGroup,
    defaultRoutine: { dayStart: settings.dayStart, dayEnd: settings.dayEnd, duration: settings.duration, blocks: settings.blocks },
    outdoorPreference: day.outdoorPreference,
    materials: materialCatalog(settings).filter((item) => settings.materials.includes(item.id)),
    date: day.date,
    clock,
    editableFrom: editable.from,
    theme: day.theme,
    timeline: day.timeline.map((item) => ({ ...rowContent(item), locked: editable.locked(item) })),
    otherDays: weekDays
      .filter((item) => item.date !== day.date)
      .map((item) => ({ date: item.date, title: item.theme?.title }))
  };
}

// Model output is untrusted: validate the proposal exactly as it would be applied.
function validateModelChange(day, settings, request, value, { row, instruction, clock, editable }) {
  if (request.scope === 'activity' && row?.kind !== 'eco') activityDescription(value.note);
  if (request.scope === 'schedule') validateModelTimeline(value.timeline);
  const checked = validateDayChange(day, settings, request, value, clock);
  if (request.scope !== 'schedule') return;
  const lockedRows = day.timeline.filter(editable.locked);
  assertTimelineCoverage(checked.timeline, settings, { from: editable.from, lockedRows });
  validateRequestedTimings([checked.timeline], [day.date], requestedTimings(instruction, [day.date], editable.local.date, day.date),
    [{ date: day.date, lockedRows }]);
}

function demoDayChange({ scope, settings, day, row, request, clock }) {
  // An explicitly labelled example, never presented as understanding free text.
  let change;
  if (scope === 'activity') {
    const example =
      playChoices(settings.materials).find((idea) => !day.timeline.some((item) => item.label.en === idea.label.en)) ||
      playChoices(settings.materials)[0];
    change =
      row?.kind === 'eco'
        ? { theme: localCurriculum([day.date], settings, [], 2)[0] }
        : { label: example.label, note: example.note };
  } else {
    const timeline = day.timeline.map(rowContent);
    const editable = timeline.filter(
      (item) => item.kind === 'activity' && !protectedActivity(day.timeline.find((row) => row.id === item.id))
    );
    if (editable.length >= 2) {
      const [a, b] = editable.slice(-2);
      [a.label, b.label] = [b.label, a.label];
      [a.note, b.note] = [b.note, a.note];
    }
    change = { timeline, theme: day.theme };
  }
  validateDayChange(day, settings, request, change, clock);
  return { change, source: 'library' };
}

function changeProperties(scope, row, settings) {
  let properties;
  if (scope === 'schedule') {
    properties = {
      timeline: timelineSchema,
      theme: lessonSchema(settings),
      outdoorPreference: { type: 'string', enum: ['auto', 'inside', 'outside'] }
    };
  } else if (row?.kind === 'eco') {
      properties = {
        theme: lessonSchema(settings)
      };
    } else {
      properties = {
        label: pairSchema(100),
        note: descriptionSchema
      };
    }
  return properties;
}
