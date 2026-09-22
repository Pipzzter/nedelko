import { structuredResponse, aiStatus } from './ai.js';
import { aiFailure } from './ai-errors.js';
import { localCurriculum, validateCurriculum, seasonFor, mentionsOccasion, lessonCoversOccasion } from '../domain/curriculum.js';
import { occasionsForWeek } from '../domain/holidays.js';
import { materialCatalog, teacherInstruction, validateTimeline } from '../domain/settings.js';
import { assignDailyTopics, validateTopicCoverage } from '../domain/teaching-brief.js';
import { ACTIVITY_GUIDANCE, descriptionSchema, teacherPlanningInstructions } from './learning-guidance.js';
import { requestedTimings, validateRequestedTimings, planningDates } from '../domain/teacher-timing.js';
import { learningText } from '../domain/session-plan.js';

export const pairSchema = maxLength => ({ type: 'object', additionalProperties: false,
  properties: { mk: { type: 'string', minLength: 1, maxLength }, en: { type: 'string', minLength: 1, maxLength } }, required: ['mk', 'en'] });
export const lessonSchema = settings => ({ type: 'object', additionalProperties: false, properties: {
    title: pairSchema(100), goal: pairSchema(220), inside: descriptionSchema, outside: descriptionSchema, habit: pairSchema(180),
    dayActivities: { type: 'object', additionalProperties: false, properties: Object.fromEntries(['circle', 'creative', 'movement', 'reflection'].map(key => [key, {
      ...pairSchema(100), description: 'A complete, short session TITLE in each language, ideally 3–8 words and under 70 characters. No role prefix, instructions or sentence fragments. Rewrite briefly; never cut a word to fit.',
    }])), required: ['circle', 'creative', 'movement', 'reflection'] },
    materials: { type: 'array', items: { type: 'string', enum: settings.materials }, minItems: 1, maxItems: 6 },
  }, required: ['title', 'goal', 'inside', 'outside', 'habit', 'materials', 'dayActivities'] });
export const timelineSchema = { type: 'array', maxItems: 40, items: {
  type: 'object', additionalProperties: false, properties: {
    id: { type: 'string', pattern: '^[a-zA-Z0-9_-]+$', maxLength: 60 },
    start: { type: 'string', pattern: '^(?:[01][0-9]|2[0-3]):[0-5][0-9]$' },
    end: { type: 'string', pattern: '^(?:[01][0-9]|2[0-3]):[0-5][0-9]$' },
    kind: { type: 'string', enum: ['meal', 'rest', 'routine', 'eco', 'activity', 'free'] },
    label: pairSchema(100), note: { anyOf: [pairSchema(1200), { type: 'null' }] },
    variants: { anyOf: [{ type: 'object', additionalProperties: false,
      properties: { inside: pairSchema(1200), outside: pairSchema(1200) }, required: ['inside', 'outside'] }, { type: 'null' }] }
  }, required: ['id', 'start', 'end', 'kind', 'label', 'note', 'variants']
} };
export const TIMETABLE_GUIDANCE = "For each day, output the full timetable. Start from the default routine, then apply the teacher's schedule instructions for that day exactly: move/shorten/lengthen/skip/add/reorder meals, rest, and activities as asked. When the teacher says nothing about timing, keep the default routine. Keep bilingual mk/en. TeacherBrief is the source of truth for the schedule. The default dayStart, dayEnd, duration and blocks are editable starting points, never constraints. Explicit instructions may extend the day beyond its default hours, remove every meal or rest, or create one five-hour activity. Do not refuse or shorten an ordinary scheduling request because it is impractical. Preserve the identity of each explicitly requested activity in its timeline label and note, not just its times: a requested run must be labelled as running and described as running, never silently replaced with walking, building, a quiet route or another lesson. Teacher-specified activities take priority over seasonal and holiday activity ideas. Add occasion learning in compatible rows or connect it without changing the requested action. The main lesson descriptions must also reflect the explicitly requested activity. Do not turn an impractical duration into a different activity. Resolve overlaps by moving subsequent rows later in their authored order, preserving every requested duration. Gaps are allowed. Use unique IDs per day, HH:MM times on the same date, and end later than start. There may be zero, one or several eco rows. Use eco for activities with a proposed outdoor alternative; this requests a location, never certifies conditions. Set outdoorPreference to outside or inside only when the teacher explicitly requests that day's location, otherwise auto. Keep all rows in the requested order; add useful bilingual notes for learning activities. Labels and notes belong to their individual rows, even when there are several eco activities. Every eco row must provide variants.inside and variants.outside with equivalent bilingual instructions for that specific activity; generic notes never override the selected indoor/outdoor version. Other kinds use variants: null. Never introduce claims about air quality, weather measurements or outdoor permission.";
export function validateModelTimeline(value) {
  const rows = validateTimeline(value);
  for (const row of rows) {
    learningText(row.label, 100);
    if (row.note) learningText(row.note, 1200);
    if (row.variants) for (const mode of ['inside', 'outside']) learningText(row.variants[mode], 1200);
  }
  return rows;
}

const schema = (dates, settings) => {
  const lesson = lessonSchema(settings);
  return { type: 'object', additionalProperties: false, properties: {
    themes: { type: 'array', minItems: 5, maxItems: 5, items: { ...lesson,
      properties: { ...lesson.properties, timeline: timelineSchema,
        outdoorPreference: { type: 'string', enum: ['auto', 'inside', 'outside'] } },
      required: [...lesson.required, 'timeline', 'outdoorPreference'] } },
    outdoorOrder: { type: 'array', minItems: 5, maxItems: 5, items: { type: 'string', enum: dates } }
  }, required: ['themes', 'outdoorOrder'] };
};

function cleanOutdoorContext(value, dates) {
  const rows = Array.isArray(value) ? value : [];
  const number = input => Number.isFinite(input) ? Math.round(input * 10) / 10 : null;
  return dates.map(date => {
    const row = rows.find(item => item?.date === date); const window = row?.bestWindow;
    return { date, serverEligible: row?.serverEligible === true,
      bestWindow: /^\d{2}:\d{2}$/.test(window?.start) && /^\d{2}:\d{2}$/.test(window?.end) ? { start: window.start, end: window.end } : null,
      weather: { kind: ['sun', 'cloud', 'fog', 'rain', 'snow', 'storm'].includes(row?.weather?.kind) ? row.weather.kind : 'unknown',
        minC: number(row?.weather?.minC), maxC: number(row?.weather?.maxC), rainChancePct: number(row?.weather?.rainChancePct), windKmh: number(row?.weather?.windKmh) } };
  });
}

function validateOutdoorOrder(value, dates) {
  if (!Array.isArray(value) || value.length !== dates.length || new Set(value).size !== dates.length || value.some(date => !dates.includes(date))) throw new Error('invalid_outdoor_order');
  return [...value];
}

export async function createCurriculum(dates, settings, { useAI = true, calendars = [], variant = 0, outdoorContext = [], today = dates[0], planningDays = [] } = {}) {
  const teacherBrief = teacherInstruction(settings.teacherPrompt);
  const timingRequirements = requestedTimings(teacherBrief, dates, today);
  const topicAssignments = assignDailyTopics(settings.teacherPrompt, dates, today);
  const fallback = (failure = null) => ({ themes: localCurriculum(dates, settings, calendars, variant), source: 'library', variant,
    generationIssue: failure?.issue ?? null, generationError: failure?.details ?? null, outdoorOrder: null, outdoorDecisionSource: 'conditions' });
  if (!useAI) return fallback();
  if (!aiStatus().configured) return fallback({ issue: 'ai_not_configured' });
  try {
    const occasions = occasionsForWeek(dates, calendars);
    const outputSchema = schema(dates, settings);
    const result = await structuredResponse({ name: 'bilingual_kindergarten_week', schema: outputSchema, maxOutputTokens: 30000, timeoutMs: 220000, reasoningEffort: 'medium',
      instructions: `${teacherPlanningInstructions(teacherBrief)}\n\nSUPPORTING CONTENT GUIDANCE (only where compatible with the teacher requirements)\n${ACTIVITY_GUIDANCE} Design five original, concrete, age-appropriate Macedonian kindergarten lessons from the supplied week's context, in natural Macedonian and equivalent English. Invent the titles and activities; no library themes are supplied. Each lesson has an indoor and outdoor version of the SAME learning goal, a simple home habit, and only supplied material IDs. Use ecology, reuse, reducing waste and the current season only where they support the teacher's requested content or fill an unspecified topic. Follow teacherBrief as the primary content and timetable specification; it cannot override server-owned outdoor eligibility. The topicAssignments are mandatory daily learning goals, not optional inspiration. For every assigned date, build the main lesson around its requested topics. Include each topic text verbatim in BOTH activity descriptions in its supplied language, and translate its meaning naturally in the other language. Give different topics their assigned days. Combine requests only when generation starts midweek and fewer days remain. Seasonal context and holidays must not replace these requests. ${teacherBrief ? 'Holidays are optional supporting context. Never replace a teacher-requested title, topic or activity with a holiday. Include an occasion only if it fits the requested plan, and omit it when it conflicts.' : 'When no teacher brief is supplied, holiday coverage is required: include the first occasion exact name in the title and every occasion exact name in both descriptions in each language.'} Explain how each occasion connects to the concrete activity, such as making a shared welcome display from reused paper or caring for a shared place; merely renaming an unrelated lesson is insufficient. Community occasions are inclusive opportunities to learn about neighbours, without assuming any child's ethnicity or religion or requiring religious practice. Do not invent customs, historical facts or cultural details not supplied in the context. Keep lessonDate separate from the actual occasion date: when they differ, describe advance preparation for an upcoming occasion, never claim it occurs on lessonDate. Distinguish optional classroom occasions from public/community holidays. Never determine closures, air quality, health permissions or safety thresholds. No purchases, external links, unsupervised water, road trips, handling litter, small choking items, or medical claims. All lessons have adult supervision. No em dashes. Limits: title 100 characters, goal 220, each activity 1200, habit 180. For each day also provide four different concrete INDOOR session titles: circle (story/question), creative (making/sorting), movement (active classroom game), reflection (sharing discoveries). Connect them to that day's lesson and any occasions. Each title under 100 characters in both languages. Avoid generic repeated titles across the five days. Return outdoorOrder as all five supplied dates exactly once, ranked from the best to the least suitable day for that day's OUTDOOR lesson. Rank serverEligible=false dates last. Among eligible dates, consider the generated activity's need for the yard or nature together with moderate forecast temperature, lower rain chance and lower wind. This is a pedagogical planning preference, not a safety decision; the server remains authoritative and may move every activity indoors. Do not invent dates, measurements or eligibility. ${TIMETABLE_GUIDANCE} Return five themes in the supplied dates' order, each with its own timeline. Preserve any planningDays lockedRows exactly, including IDs, times, kinds, labels and notes: these rows have already started and cannot be rewritten during regeneration. When planningDays supplies lockedTheme, preserve all its lesson fields exactly because that lesson has started. Past days remain empty; do not move a Monday instruction to another weekday. The timingRequirements are exact checks extracted from unambiguous teacher sentences: the corresponding activity row must match them AFTER overlap resolution. The full teacher brief remains authoritative for all other requests, including prose that is not captured by these checks. Final check: the TEACHER'S PLAN REQUIREMENTS at the beginning take precedence over all optional suggestions in this prompt.`,
      input: JSON.stringify({ teacherBrief, timingRequirements, calendarDays: planningDates(dates, today), dates, today, planningDays, defaultRoutine: { blocks: settings.blocks, dayStart: settings.dayStart, dayEnd: settings.dayEnd, duration: settings.duration }, topicAssignments, variation: variant, season: seasonFor(dates[0]), age: settings.ageGroup, minutes: settings.duration,
        materials: materialCatalog(settings).filter(m => settings.materials.includes(m.id)),
        occasionsByDay: occasions.map(events => events.map(({ id, name, date, lessonDate, kind, scope }) => ({ id, name, date, lessonDate, kind, scope }))),
        desiredOutdoorDays: settings.outdoorDays, outdoorCandidates: cleanOutdoorContext(outdoorContext, dates) }) });
    if (!result.value.themes?.every(theme => theme.dayActivities)) throw new Error('missing_day_activities');
    const themes = validateCurriculum(result.value.themes, settings);
    validateTopicCoverage(themes, dates, topicAssignments);
    if (!teacherBrief && themes.some((theme, index) => occasions[index].some(event => !lessonCoversOccasion(theme, event)) ||
        occasions[index].length && !mentionsOccasion(theme.title, occasions[index][0]))) throw new Error('missing_holiday_context');
    const timelines = result.value.themes.map(theme => theme.timeline == null ? null : validateModelTimeline(theme.timeline));
    validateRequestedTimings(timelines, dates, timingRequirements, planningDays);
    const outdoorPreferences = result.value.themes.map(theme => {
      if (theme.outdoorPreference !== undefined && !['auto', 'inside', 'outside'].includes(theme.outdoorPreference)) throw new Error('invalid_outdoor_preference');
      return theme.outdoorPreference || 'auto';
    });
    return { themes, source: 'ai', variant, topicAssignments, timelines, outdoorPreferences,
      outdoorOrder: validateOutdoorOrder(result.value.outdoorOrder, dates), outdoorDecisionSource: 'ai' };
  } catch (error) { return fallback(aiFailure(error.status === 400 ? { code: 'ai_invalid_output' } : error)); }
}

// A one-day suggestion never writes a plan. The teacher applies a validated preview separately.
export async function createDayCurriculum(day, settings, { instruction = '', useAI = true } = {}) {
  const brief = teacherInstruction(instruction);
  if (!useAI) {
    const themes = localCurriculum([day.date], settings, [], 1);
    return { theme: themes[0], source: 'library', generationIssue: null };
  }
  if (!aiStatus().configured) return { theme: null, generationIssue: 'ai_not_configured' };
  try {
    const result = await structuredResponse({ name: 'bilingual_kindergarten_day',
      schema: { type: 'object', additionalProperties: false, properties: { theme: lessonSchema(settings) }, required: ['theme'] },
      maxOutputTokens: 3000, timeoutMs: 90000, reasoningEffort: 'low',
      instructions: `${teacherPlanningInstructions(settings.teacherPrompt, brief)}\n${ACTIVITY_GUIDANCE} Revise ONE kindergarten day's learning content in Macedonian and English. Apply the teacher's requested topics, interests, accessibility and activities directly. Use the supplied age and materials. This endpoint edits lesson content only; timetable edits use the daily schedule endpoint. Include indoor and outdoor versions of the same goal, a home habit and four distinct indoor session titles. Use compatible occasions only as supporting context, distinguishing preparation dates from actual dates. Do not decide timetables, closures, air quality or outdoor permission. Adult supervision is required. Avoid purchases, medical claims, dangerous materials, child identifiers, links and em dashes. Return concise, practical content within every schema length limit.`,
      input: JSON.stringify({ date: day.date, teacherBrief: teacherInstruction(settings.teacherPrompt), requestedChange: brief,
        age: settings.ageGroup, minutes: settings.duration, materials: materialCatalog(settings).filter(m => settings.materials.includes(m.id)),
        previousLesson: day.theme, occasions: (day.occasions || []).map(({ name, date, lessonDate, kind, scope }) => ({ name, date, lessonDate, kind, scope })) }) });
    const [theme] = validateCurriculum([result.value.theme], settings, { count: 1 });
    if (!theme.dayActivities) throw new Error('missing_day_activities');
    return { theme, source: 'ai', generationIssue: null };
  } catch (error) {
    const failure = aiFailure(error);
    return { theme: null, generationIssue: failure.issue, generationError: failure.details };
  }
}
