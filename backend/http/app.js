import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, sep, extname } from 'node:path';
import { randomUUID, randomInt, randomBytes } from 'node:crypto';
import { LOCATIONS, skopjeParts, POLICY, SCENARIOS } from '../config/index.js';
import { demoWeekById, demoWeekOptions, DEFAULT_DEMO_WEEK } from '../config/demo.js';
import { prepareDemoWeek } from '../domain/demo-week.js';
import {
  DEFAULT_SETTINGS,
  MATERIALS,
  validateSettings,
  validateGenerationSettings,
  invalid,
  minutes,
  teacherInstruction,
  pair
} from '../domain/settings.js';
import { planningWeekDates } from '../domain/planner.js';
import { PREFERENCE_BOUNDS } from '../domain/preferences.js';
import {
  createWeek,
  adaptWeek,
  editWeek,
  dashboard,
  outdoorPlanningContext,
  dailyPlanningContext,
  replaceDayTheme,
  applyDayChange
} from '../domain/week.js';
import { getConditions } from '../services/conditions.js';
import { createCurriculum, createDayCurriculum } from '../services/curriculum.js';
import { suggestDayPlan } from '../services/day-plan.js';
import { assertUpcoming, validateDayChange } from '../domain/day-edit.js';
import { manualDayEdit } from '../domain/manual-day-edit.js';
import { aiStatus } from '../services/ai.js';
import { parentView } from '../domain/parent-view.js';
import { dailyTopics } from '../domain/teaching-brief.js';
import { startAutoRefresh } from '../services/auto-refresh.js';
import { getHolidayCalendar } from '../services/holidays.js';
import { calendarSnapshot } from '../domain/holidays.js';
import { register, login, tokenHash, readSessionCookie, createSession } from '../services/auth.js';
import { openStore } from '../storage/database.js';
import { securityHeaders, jsonBody, rateLimiter } from './security.js';
import { validateParentNote, informationalNote } from '../domain/parent-notes.js';
import { suggestParentNote } from '../services/parent-notes.js';

const FRONTEND = fileURLToPath(new URL('../../frontend/', import.meta.url));
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.woff2': 'font/woff2'
};

export function createApp({
  store = openStore(),
  conditionsProvider = getConditions,
  curriculumProvider = createCurriculum,
  dayCurriculumProvider = createDayCurriculum,
  dayPlanProvider = suggestDayPlan,
  noteAdviceProvider = suggestParentNote,
  holidayProvider = getHolidayCalendar,
  autoRefreshMs = 0
} = {}) {
  const limit = rateLimiter();
  const demos = new Map();
  const locks = new Map();
  const proposals = new Map();
  const withLock = async (key, operation) => {
    if (locks.has(key)) throw invalid('operation_pending', 409);
    locks.set(key, true);
    try {
      return await operation();
    } finally {
      locks.delete(key);
    }
  };
  function demoRecord(id) {
    const record = demos.get(id);
    if (!record || Date.now() - record.at > 3600000) {
      demos.delete(id);
      throw invalid('demo_expired', 404);
    }
    return record;
  }
  function save(user, demoId, week, expected, updateProfile = false) {
    if (demoId) {
      const record = demoRecord(demoId);
      if ((record.week?.revision || 0) !== expected) throw invalid('plan_changed', 409);
      record.revision = (record.revision || 0) + 1;
      record.week = { ...week, revision: record.revision };
      return record.week;
    }
    const result = store.saveWeek(user.id, week, expected);
    if (!result) throw invalid('plan_changed', 409);
    if (updateProfile) store.saveProfile(user.id, result.settings);
    return result;
  }
  function refreshView(user, demoId, week) {
    const owner = demoId || user.id;
    for (const [id, proposal] of proposals) if (proposal.owner === owner) proposals.delete(id);
    if (demoId) {
      const record = demoRecord(demoId);
      if (record.week?.revision !== week.revision) throw invalid('plan_changed', 409);
      record.week = week;
      return week;
    }
    const result = store.refreshWeek(user.id, week, week.revision);
    if (!result) throw invalid('plan_changed', 409);
    return result;
  }
  function sharing(user, demoId, week) {
    if (!week) return null;
    if (!demoId) return store.sharing(user.id, week.weekStart);
    const record = demoRecord(demoId);
    return record.parentToken
      ? { path: `/#parents/${record.parentToken}`, expiresAt: new Date(record.at + 3600000).toISOString() }
      : null;
  }
  function present(week, conditions, user, demoId) {
    return {
      ...dashboard(week, conditions),
      demoId,
      share: sharing(user, demoId, week),
      profile: !demoId && user ? store.profile(user.id) : null,
      ...(demoId ? { demoScenario: demoRecord(demoId).scenario || 'normal' } : {})
    };
  }
  function notesFor(user, demoId, week) {
    return demoId
      ? (demoRecord(demoId).notes || [])
          .map(({ nonce: _nonce, ...note }) => note)
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      : store.parentNotes(user.id);
  }
  function noteSnapshot(user, demoId, week) {
    const notes = notesFor(user, demoId, week);
    return { notes, unread: notes.filter((note) => !note.readAt).length };
  }
  function updateNote(user, demoId, week, note, status, advice) {
    if (demoId)
      Object.assign(
        demoRecord(demoId).notes.find((item) => item.id === note.id),
        { readAt: note.readAt || new Date().toISOString(), ...(status ? { status, advice } : {}) }
      );
    else if (status) store.updateParentNote(user.id, note.weekStart, note.id, status, advice);
    else store.readParentNote(user.id, note.weekStart, note.id);
  }
  async function refreshStoredWeek(userId, start) {
    return withLock(userId, async () => {
      let old = store.week(userId, start);
      if (!old) throw invalid('parent_link_unavailable', 404);
      const today = skopjeParts(new Date()).date;
      if (Date.now() - Date.parse(old.conditionsCheckedAt) < 60000 && old.today === today) return old;
      old = save({ id: userId }, null, { ...old, approval: null, checkedAt: null, checkedDate: null }, old.revision);
      const conditions = await conditionsProvider({ locationId: old.settings.locationId, mode: 'live', fresh: true });
      return save({ id: userId }, null, adaptWeek(old, conditions), old.revision);
    });
  }




  async function serveParentLink({ response, url, request, send }) {
    response.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive');
    const noteMatch = url.pathname.match(/^\/api\/parents\/([a-f0-9]{64})\/notes$/);
    if (noteMatch && request.method === 'POST') {
      return await receiveParentNote({ request, noteMatch, limit, demos, send, store });
    }
    if (request.method !== 'GET') throw invalid('method_not_allowed', 405);
    const token = url.pathname.slice('/api/parents/'.length);
    if (!/^[a-f0-9]{64}$/.test(token)) throw invalid('parent_link_unavailable', 404);
    for (const [id, record] of demos) {
      if (record.parentToken !== token) continue;
      assertParentRecord(record, token);
      const conditions = await conditionsProvider({
        locationId: record.week.settings.locationId,
        mode: 'demo',
        scenario: record.scenario || 'normal',
        demoWeek: record.demoWeek
      });
      assertParentRecord(record, token);
      return send(200, parentView(record.week, sharing(null, id, record.week).expiresAt, conditions));
    }
    const owner = store.sharedWeek(token);
    if (!owner) throw invalid('parent_link_unavailable', 404);
    let week = store.week(owner.userId, owner.weekStart);
    if (!week) throw invalid('parent_link_unavailable', 404);
    const today = skopjeParts(new Date()).date;
    const refreshPending = locks.has(owner.userId);
    if (!refreshPending && today >= week.weekStart && today <= week.days.at(-1).date)
      week = await refreshStoredWeek(owner.userId, owner.weekStart);
    const conditions = await conditionsProvider({ locationId: week.settings.locationId, mode: 'live' });
    // Re-check revocation after any awaited refresh.
    if (!store.sharedWeek(token)) throw invalid('parent_link_unavailable', 404);
    // A public read never waits for a writer. Screen the stored snapshot against
    // available observations without claiming the stored plan was refreshed.
    if (refreshPending) week = { ...adaptWeek(week, conditions), conditionsCheckedAt: week.conditionsCheckedAt };
    return send(200, parentView(week, store.sharing(owner.userId, owner.weekStart).expiresAt, conditions));
  }

  async function handleAuthRegister({ request, url, response, cookie, send }) {
    limit(`auth:${request.socket.remoteAddress}`, 12, 15 * 60000);
    const body = await jsonBody(request);
    const account = await (url.pathname.endsWith('/register') ? register(store, body) : login(store, body));
    response.setHeader('Set-Cookie', createSession(store, account, cookie));
    return send(200, { user: account });
  }

  async function handleAuthLogout({ request, cookie, response, send }) {
    await jsonBody(request);
    if (cookie) store.deleteSession(tokenHash(cookie));
    response.setHeader('Set-Cookie', 'nedelko_session=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0');
    return send(200, { ok: true });
  }

  async function handleDemo({ request, send, user }) {
    const body = await jsonBody(request);
    const settings = validateSettings({
      ...DEFAULT_SETTINGS,
      locationId: body.locationId || 'centar',
      gradinka: { name: 'Сончева градина' },
      groupName: 'Сончева градина',
      ageGroup: 'mixed',
      teacherPrompt: 'Eco activities with movement, shared creations and care for nature.'
    });
    const profile = demoWeekById(body.demoWeek);
    const conditions = await conditionsProvider({
      locationId: settings.locationId,
      mode: 'demo',
      scenario: 'normal',
      demoWeek: profile.id
    });
    const curriculum = await curriculumProvider(planningWeekDates(conditions.clock), settings, { useAI: false });
    const week = {
      ...prepareDemoWeek(createWeek(settings, curriculum, conditions), conditions, profile),
      revision: 1
    };
    const demoId = randomUUID();
    for (const [id, record] of demos) if (Date.now() - record.at > 3600000 || demos.size >= 50) demos.delete(id);
    demos.set(demoId, { week, revision: 1, demoWeek: profile.id, at: Date.now(), parentToken: null });
    return send(201, present(week, conditions, user, demoId));
  }

  async function handleParentNotes({ send, user, demoId, currentWeek }) {
    return send(200, noteSnapshot(user, demoId, currentWeek()));
  }

  async function handleParentNotesRead({ demoId, user, currentWeek, url, body, send, mode, scenario, demoWeek }) {
    return await withLock(demoId || user.id, async () => {
      const week = currentWeek();
      if (url.pathname.endsWith('/read')) {
        const note = notesFor(user, demoId, week).find((note) => note.id === body.noteId);
        if (!note) throw invalid('parent_note_unavailable', 404);
        updateNote(user, demoId, week, note);
        return send(200, noteSnapshot(user, demoId, week));
      }
      if (!week) throw invalid('no_plan', 404);
      const owner = demoId || user.id;
      if (url.pathname.endsWith('/apply')) {
        return await applyParentNote({
          proposals,
          body,
          owner,
          week,
          notesFor,
          user,
          demoId,
          conditionsProvider,
          mode,
          scenario,
          demoWeek,
          save,
          updateNote,
          send,
          present
        });
      }
      const note = notesFor(user, demoId, week).find((note) => note.id === body.noteId);
      if (!note) throw invalid('parent_note_unavailable', 404);
      if (body.revision !== week.revision) throw invalid('plan_changed', 409);
      if (note.status === 'applied') throw invalid('proposal_expired', 409);
      limit(`ai-note:${owner}`, 12, 3600000);
      const clock = demoId ? week.clock : new Date().toISOString();
      const advice =
        (note.weekStart !== week.weekStart
          ? {
              kind: 'informational',
              explanation: pair(
                'Белешката се однесува на друга недела. Прочитајте ја како информација; нема да го менуваме тековниот план.',
                'This note concerns another week. Review it as information; the current plan will not be changed.'
              )
            }
          : informationalNote(note.text)) || (await noteAdviceProvider(note, week, { useAI: !demoId, clock }));
      if (!['informational', 'actionable'].includes(advice.kind))
        return send(503, {
          error: 'ai_day_failed',
          generationIssue: advice.generationIssue || 'ai_invalid_output'
        });
      const publicAdvice = { kind: advice.kind, explanation: advice.explanation };
      if (advice.kind === 'informational') {
        updateNote(user, demoId, week, note, 'informational', publicAdvice);
        return send(200, { advice: publicAdvice, proposal: null });
      }
      return await suggestParentNoteAction({
        week,
        advice,
        clock,
        dayPlanProvider,
        demoId,
        send,
        proposals,
        owner,
        note,
        publicAdvice,
        updateNote,
        user
      });
    });
  }

  async function handleHolidays({ demoId, user, url, send }) {
    if (demoId) demoRecord(demoId);
    const year = Number(url.searchParams.get('year'));
    if (!Number.isInteger(year) || year < 2024 || year > 2100) throw invalid('invalid_calendar_year');
    limit(`holidays:${demoId || user.id}`, 30, 3600000);
    const calendar = demoId ? calendarSnapshot(year) : await holidayProvider(year);
    return send(200, { calendar });
  }

  async function handleDashboard({ demoId, user, currentWeek, url, mode, scenario, demoWeek, send }) {
    return await withLock(demoId || user.id, async () => {
      let old = currentWeek();
      const locationId =
        old?.settings.locationId ||
        url.searchParams.get('location') ||
        (!demoId && store.profile(user.id)?.locationId) ||
        'centar';
      if (old) old = refreshView(user, demoId, { ...old, approval: null, checkedAt: null, checkedDate: null });
      const years = old ? [...new Set(old.days.map((day) => Number(day.date.slice(0, 4))))] : [];
      const [conditions, calendars] = await Promise.all([
        conditionsProvider({ locationId, mode, scenario, demoWeek, fresh: url.searchParams.get('fresh') === '1' }),
        calendarsForYears(years, demoId)
      ]);
      const week = old
        ? refreshView(user, demoId, adaptWeek({ ...old, holidayCalendars: calendars }, conditions))
        : null;
      if (demoId) demoRecord(demoId).scenario = scenario;
      return send(200, present(week, conditions, user, demoId));
    });
  }

  async function handleWeekGenerate({ demoId, user, body, currentWeek, mode, scenario, demoWeek, send }) {
    return await withLock(demoId || user.id, async () => {
      if (!demoId) limit(`ai-week:${user.id}`, 6, 3600000);
      const settings = validateGenerationSettings(body.settings);
      const old = currentWeek();
      if (old ? body.revision !== old.revision : body.revision) throw invalid('plan_changed', 409);
      const conditions = await conditionsProvider({ locationId: settings.locationId, mode, scenario, demoWeek });
      const dates = planningWeekDates(conditions.clock);
      const years = [...new Set(dates.map((date) => Number(date.slice(0, 4))))];
      const calendars = await calendarsForYears(years, demoId);
      const curriculum = await curriculumProvider(dates, settings, {
        useAI: !demoId,
        calendars,
        variant: demoId ? 0 : randomInt(1000000),
        planningDays: dailyPlanningContext(dates, settings, conditions, old),
        outdoorContext: outdoorPlanningContext(dates, settings, conditions),
        today: skopjeParts(new Date(conditions.clock)).date
      });
      // An explicit AI retry must never replace the saved week with another fallback.
      if (
        !demoId &&
        (body.requireAI === true || dailyTopics(settings.teacherPrompt).length) &&
        curriculum.source !== 'ai'
      )
        return send(503, {
          error: 'ai_retry_failed',
          generationIssue: curriculum.generationIssue || 'ai_unavailable',
          generationError: curriculum.generationError ?? null
        });
      let generated = createWeek(settings, curriculum, conditions, calendars, old);
      if (demoId) generated = prepareDemoWeek(generated, conditions, demoWeekById(demoWeek));
      const week = save(user, demoId, generated, old?.revision || 0, true);
      return send(201, present(week, conditions, user, demoId));
    });
  }

  async function handleWeekShare({ currentWeek, body, demoId, user, send }) {
    // This synchronous access-setting change does not edit the plan. A
    // background conditions refresh must not make its revision stale.
    const week = currentWeek();
    if (!week) throw invalid('no_plan', 404);
    if (!['enable', 'revoke'].includes(body.action)) throw invalid('invalid_plan');
    if (demoId) {
      const record = demoRecord(demoId);
      if (body.action === 'revoke') record.parentToken = null;
      else if (!record.parentToken) record.parentToken = randomBytes(32).toString('hex');
    } else if (body.action === 'revoke') store.revokeShare(user.id, week.weekStart);
    else store.shareWeek(user.id, week.weekStart);
    return send(200, { week, share: sharing(user, demoId, week) });
  }

  async function handleWeekDayEdit({ demoId, user, currentWeek, body, mode, scenario, demoWeek, send }) {
    return await withLock(demoId || user.id, async () => {
      const week = currentWeek();
      if (!week) throw invalid('no_plan', 404);
      if (body.revision !== week.revision) throw invalid('plan_changed', 409);
      const conditions = await conditionsProvider({
        locationId: week.settings.locationId,
        mode,
        scenario,
        demoWeek,
        fresh: true
      });
      const day = manualDayEdit(
        week.days.find((item) => item.date === body.date),
        week.settings,
        body,
        conditions.clock
      );
      const next = adaptWeek(
        { ...week, days: week.days.map((item) => (item.date === day.date ? day : item)) },
        conditions
      );
      return send(200, present(save(user, demoId, next, week.revision), conditions, user, demoId));
    });
  }

  async function handleWeekChangeSuggest({ demoId, user, currentWeek, body, url, send, mode, scenario, demoWeek }) {
    return await withLock(demoId || user.id, async () => {
      const week = currentWeek();
      if (!week) throw invalid('no_plan', 404);
      if (body.revision !== week.revision) throw invalid('plan_changed', 409);
      const owner = demoId || user.id;
      if (url.pathname.endsWith('/suggest')) {
        return await suggestDayChange({ body, week, demoId, limit, owner, dayPlanProvider, send, proposals });
      }
      const proposal = proposals.get(body.proposalId);
      if (
        proposal?.type !== 'change' ||
        proposal.owner !== owner ||
        proposal.revision !== week.revision ||
        proposal.expiresAt <= Date.now()
      )
        throw invalid('proposal_expired', 409);
      const conditions = await conditionsProvider({
        locationId: week.settings.locationId,
        mode,
        scenario,
        demoWeek,
        fresh: true
      });
      const next = save(user, demoId, applyDayChange(week, proposal, conditions), week.revision);
      proposals.delete(body.proposalId);
      return send(200, present(next, conditions, user, demoId));
    });
  }

  async function handleWeekDaySuggest({ demoId, user, currentWeek, body, url, send, mode, scenario, demoWeek }) {
    return await withLock(demoId || user.id, async () => {
      const week = currentWeek();
      if (!week) throw invalid('no_plan', 404);
      if (body.revision !== week.revision) throw invalid('plan_changed', 409);
      const owner = demoId || user.id;
      if (url.pathname.endsWith('/suggest')) {
        return await suggestDayTheme({ week, body, demoId, limit, owner, dayCurriculumProvider, send, proposals });
      }
      const proposal = proposals.get(body.proposalId);
      if (
        !proposal ||
        proposal.type === 'change' ||
        proposal.owner !== owner ||
        proposal.expiresAt <= Date.now() ||
        proposal.revision !== week.revision
      )
        throw invalid('proposal_expired', 409);
      const conditions = await conditionsProvider({
        locationId: week.settings.locationId,
        mode,
        scenario,
        demoWeek,
        fresh: true
      });
      const next = save(
        user,
        demoId,
        replaceDayTheme(week, proposal.date, proposal.theme, proposal.source, conditions),
        week.revision
      );
      proposals.delete(body.proposalId);
      return send(200, present(next, conditions, user, demoId));
    });
  }

  async function handleWeekDelete({ demoId, user, currentWeek, body, send }) {
    return await withLock(demoId || user.id, async () => {
      const old = currentWeek();
      if (!old) throw invalid('no_plan', 404);
      if (old.revision !== body.revision) throw invalid('plan_changed', 409);
      if (demoId) {
        const record = demoRecord(demoId);
        record.week = null;
        record.parentToken = null;
        record.notes = [];
        record.revision++;
      } else if (!store.deleteWeek(user.id, old.weekStart, old.revision)) throw invalid('plan_changed', 409);
      return send(200, { week: null, settings: old.settings });
    });
  }

  async function handleWeekEdit({ demoId, user, currentWeek, body, url, mode, send, scenario, demoWeek }) {
    return await withLock(demoId || user.id, async () => {
      let old = currentWeek();
      if (!old) throw invalid('no_plan', 404);
      if (old.revision !== body.revision) throw invalid('plan_changed', 409);
      if (url.pathname.endsWith('/approve')) {
        return approveNotice({ mode, old, save, user, demoId, send });
      }
      let settings;
      if (url.pathname.endsWith('/location')) {
        settings = validateSettings({
          ...old.settings,
          locationId: body.locationId
        });
      } else if (url.pathname.endsWith('/edit')) {
          settings = validateSettings(body.settings);
        } else {
          settings = old.settings;
        }
      if (!url.pathname.endsWith('/edit'))
        old = save(user, demoId, { ...old, approval: null, checkedAt: null, checkedDate: null }, old.revision);
      const conditions = await conditionsProvider({
        locationId: settings.locationId,
        mode,
        scenario,
        demoWeek,
        fresh: url.pathname.endsWith('/recheck')
      });
      let next = url.pathname.endsWith('/edit')
        ? editWeek(old, body, conditions)
        : adaptWeek({ ...old, settings }, conditions);
      if (url.pathname.endsWith('/recheck')) {
        next.checkedAt = new Date().toISOString();
        next.checkedDate = skopjeParts(new Date(conditions.clock)).date;
        next.checkedObservation = conditions.assessment.oldestObservation;
      }
      const week = save(user, demoId, next, old.revision, !url.pathname.endsWith('/recheck'));
      return send(200, present(week, conditions, user, demoId));
    });
  }

  const publicRoutes = {
    'GET /api/auth/me': handleAuthMe,
    'GET /api/config': handleConfig,
    'POST /api/auth/register': handleAuthRegister,
    'POST /api/auth/login': handleAuthRegister,
    'POST /api/auth/logout': handleAuthLogout,
    'POST /api/demo': handleDemo
  };
  const privateRoutes = {
    'GET /api/parent-notes': handleParentNotes,
    'POST /api/parent-notes/read': handleParentNotesRead,
    'POST /api/parent-notes/suggest': handleParentNotesRead,
    'POST /api/parent-notes/apply': handleParentNotesRead,
    'GET /api/holidays': handleHolidays,
    'GET /api/dashboard': handleDashboard,
    'POST /api/week/generate': handleWeekGenerate,
    'POST /api/week/share': handleWeekShare,
    'POST /api/week/day/edit': handleWeekDayEdit,
    'POST /api/week/change/suggest': handleWeekChangeSuggest,
    'POST /api/week/change/apply': handleWeekChangeSuggest,
    'POST /api/week/day/suggest': handleWeekDaySuggest,
    'POST /api/week/day/apply': handleWeekDaySuggest,
    'POST /api/week/delete': handleWeekDelete,
    'POST /api/week/edit': handleWeekEdit,
    'POST /api/week/location': handleWeekEdit,
    'POST /api/week/recheck': handleWeekEdit,
    'POST /api/week/approve': handleWeekEdit
  };
  async function privateRequestContext(request, url, user) {
    const body = request.method === 'POST' ? await jsonBody(request) : {};
    const demoId = body.demoId || url.searchParams.get('demoId');
    if (demoId && (typeof demoId !== 'string' || demoId.length > 40)) throw invalid('demo_expired', 404);
    if (!demoId && !user) throw invalid('sign_in_required', 401);
    const mode = demoId ? 'demo' : 'live';
    const realWeekStart = planningWeekDates(new Date().toISOString())[0];
    const currentWeek = () => (demoId ? demoRecord(demoId).week : store.week(user.id, realWeekStart));
    const scenario = demoId
      ? body.scenario || url.searchParams.get('scenario') || demoRecord(demoId).scenario || 'normal'
      : 'normal';
    if (!SCENARIOS.includes(scenario)) throw invalid('invalid_scenario');
    const demoWeek = demoId ? demoRecord(demoId).demoWeek : undefined;
    return { body, demoId, mode, currentWeek, scenario, demoWeek };
  }
  async function calendarsForYears(years, demoId) {
    if (demoId) return years.map(year => calendarSnapshot(year));
    return Promise.all(years.map(year => Promise.resolve(holidayProvider(year))));
  }
  const server = http.createServer(async (request, response) => {
    securityHeaders(response);
    const send = (status, body) => {
      response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
      response.end(JSON.stringify(body));
    };
    try {
      const host = request.headers.host ?? '';
      if (!/^(?:127\.0\.0\.1|localhost)(?::\d+)?$/.test(host)) throw invalid('local_only', 403);
      const url = new URL(request.url, `http://${host}`);
      if (!url.pathname.startsWith('/api/')) {
        return await serveFrontend({ request, url, response });
      }
      limit(request.socket.remoteAddress);
      if (!['GET', 'POST'].includes(request.method)) throw invalid('method_not_allowed', 405);
      if (
        request.method === 'POST' &&
        ((request.headers.origin && request.headers.origin !== `http://${host}`) ||
          request.headers['sec-fetch-site'] === 'cross-site')
      )
        throw invalid('cross_origin', 403);
      const cookie = readSessionCookie(request);
      const user = cookie ? store.session(tokenHash(cookie)) : null;

      if (url.pathname.startsWith('/api/parents/')) return await serveParentLink({ response, url, request, send });

      const routeKey = request.method + ' ' + url.pathname;
      const publicHandler = publicRoutes[routeKey];
      if (publicHandler) return await publicHandler({ request, response, send, url, cookie, user });
      const { body, demoId, mode, currentWeek, scenario, demoWeek } = await privateRequestContext(request, url, user);
      const handler = privateRoutes[routeKey];
      if (handler)
        return await handler({
          request,
          response,
          send,
          url,
          cookie,
          user,
          body,
          demoId,
          mode,
          scenario,
          demoWeek,
          currentWeek
        });

      throw invalid('not_found', 404);
    } catch (error) {
      sendRequestError({ response, send, error });
    }
  });
  server.requestTimeout = 60000;
  server.headersTimeout = 15000;
  const automatic =
    autoRefreshMs > 0 ? startAutoRefresh({ store, refreshWeek: refreshStoredWeek, intervalMs: autoRefreshMs }) : null;
  server.on('listening', () => {
    automatic?.tick().catch(() => {});
  });
  server.on('close', () => automatic?.stop());
  server.on('close', () => store.close());
  return server;
}

async function applyParentNote({
  proposals,
  body,
  owner,
  week,
  notesFor,
  user,
  demoId,
  conditionsProvider,
  mode,
  scenario,
  demoWeek,
  save,
  updateNote,
  send,
  present
}) {
  const proposal = proposals.get(body.proposalId);
  if (
    proposal?.type !== 'parent-note' ||
    proposal.owner !== owner ||
    proposal.expiresAt <= Date.now() ||
    proposal.revision !== week.revision ||
    body.revision !== week.revision
  )
    throw invalid('proposal_expired', 409);
  const note = notesFor(user, demoId, week).find((note) => note.id === proposal.noteId);
  if (!note || note.weekStart !== week.weekStart || note.status === 'applied') throw invalid('proposal_expired', 409);
  const conditions = await conditionsProvider({
    locationId: week.settings.locationId,
    mode,
    scenario,
    demoWeek,
    fresh: true
  });
  let next;
  if (['inside', 'outside'].includes(proposal.scope)) {
    const day = week.days.find((day) => day.date === proposal.date);
    assertUpcoming(
      day,
      conditions.clock,
      day.timeline.find((row) => row.kind === 'eco')
    );
    next = editWeek(
      week,
      {
        settings: week.settings,
        days: week.days.map((day) => (day.date === proposal.date ? { ...day, outdoorPreference: proposal.scope } : day))
      },
      conditions
    );
  } else next = applyDayChange(week, proposal, conditions);
  next = save(user, demoId, next, week.revision);
  updateNote(user, demoId, week, note, 'applied', proposal.advice);
  proposals.delete(body.proposalId);
  return send(200, present(next, conditions, user, demoId));
}

async function suggestDayChange({ body, week, demoId, limit, owner, dayPlanProvider, send, proposals }) {
  if (!['activity', 'schedule'].includes(body.scope)) throw invalid('invalid_plan');
  const day = week.days.find((item) => item.date === body.date);
  const clock = demoId ? week.clock : new Date().toISOString();
  const row = day?.timeline.find((item) => item.id === body.rowId);
  if (body.scope === 'activity' && !row) throw invalid('invalid_timeline');
  assertUpcoming(day, clock, body.scope === 'activity' ? row : undefined);
  const instruction = teacherInstruction(body.instruction);
  if (!instruction) throw invalid('invalid_instruction');
  limit(`ai-day:${owner}`, 12, 3600000);
  const result = await dayPlanProvider(day, week.settings, {
    scope: body.scope,
    rowId: body.rowId,
    instruction,
    clock,
    useAI: !demoId,
    weekDays: week.days
  });
  if (!result.change) return send(503, { error: 'ai_day_failed', generationIssue: result.generationIssue });
  const preview = validateDayChange(
    day,
    week.settings,
    { ...body, timingTargets: result.timingTargets },
    result.change,
    clock
  );
  for (const [id, proposal] of proposals)
    if (proposal.expiresAt <= Date.now() || proposals.size >= 100) proposals.delete(id);
  const proposalId = randomUUID();
  const proposal = {
    type: 'change',
    owner,
    revision: week.revision,
    date: day.date,
    scope: body.scope,
    rowId: body.rowId,
    change: result.change,
    timingTargets: result.timingTargets || [],
    source: result.source,
    expiresAt: Date.now() + 10 * 60000
  };
  proposals.set(proposalId, proposal);
  return send(200, {
    proposalId,
    scope: proposal.scope,
    rowId: proposal.rowId,
    date: day.date,
    timeline: preview.timeline,
    theme: preview.theme,
    timingTargets: proposal.timingTargets,
    source: proposal.source,
    expiresAt: proposal.expiresAt
  });
}

function approveNotice({ mode, old, save, user, demoId, send }) {
  const now = Date.now();
  const today = mode === 'demo' ? old.today : skopjeParts(new Date(now)).date;
  const day = old.days.find((d) => d.date === today);
  if (
    !day?.theme ||
    day.closed ||
    old.checkedDate !== today ||
    !old.checkedAt ||
    now - Date.parse(old.checkedAt) > POLICY.maxPlanAgeMinutes * 60000
  )
    throw invalid('recheck_required', 409);
  if (
    day.mode === 'outside' &&
    mode === 'live' &&
    (!old.checkedObservation || now - Date.parse(old.checkedObservation) > POLICY.freshnessMinutes * 60000)
  )
    throw invalid('recheck_required', 409);
  if (
    day.mode === 'outside' &&
    mode === 'live' &&
    !day.timeline.some(row => row.kind === 'eco' && minutes(row.end) > skopjeParts(new Date(now)).minutes)
  )
    throw invalid('recheck_required', 409);
  old.approval = { at: new Date(now).toISOString(), date: today, messages: old.messages.daily[today] };
  const week = save(user, demoId, old, old.revision);
  return send(200, { week });
}

async function receiveParentNote({ request, noteMatch, limit, demos, send, store }) {
  const input = await jsonBody(request);
  const token = noteMatch[1];
  limit(`parent-note:${token}`, 30, 3600000);
  for (const record of demos.values()) {
    if (record.parentToken !== token) continue;
    assertParentRecord(record, token);
    const fields = validateParentNote(input, record.week);
    record.notes ||= [];
    const duplicate = record.notes.some((note) => note.nonce === fields.nonce);
    if (duplicate) return send(200, { received: true });
    if (record.notes.length >= 250) throw invalid('parent_note_limit', 429);
    record.notes.push({
      ...fields,
      weekStart: record.week.weekStart,
      id: randomUUID(),
      createdAt: new Date().toISOString(),
      readAt: null,
      status: 'new',
      advice: null
    });
    return send(201, { received: true });
  }
  const owner = store.sharedWeek(token);
  const week = owner && store.week(owner.userId, owner.weekStart);
  if (!owner || !week) throw invalid('parent_link_unavailable', 404);
  store.addParentNote(owner.userId, owner.weekStart, validateParentNote(input, week));
  return send(201, { received: true });
}

async function suggestDayTheme({ week, body, demoId, limit, owner, dayCurriculumProvider, send, proposals }) {
  const day = week.days.find((day) => day.date === body.date);
  const local = skopjeParts(new Date(demoId ? week.clock : new Date().toISOString()));
  const slot = day?.timeline.find((row) => row.kind === 'eco');
  if (slot) assertUpcoming(day, demoId ? week.clock : new Date().toISOString(), slot);
  if (
    !day?.theme ||
    day.closed ||
    !slot ||
    day.date < local.date ||
    (day.date === local.date && day.timeline.some(row => row.kind === 'eco' && minutes(row.start) <= local.minutes))
  )
    throw invalid('activity_finished', 409);
  const instruction = teacherInstruction(body.instruction);
  if (!instruction) throw invalid('invalid_instruction');
  limit(`ai-day:${owner}`, 12, 3600000);
  const result = await dayCurriculumProvider(day, week.settings, { instruction, useAI: !demoId });
  if (!result.theme)
    return send(503, {
      error: 'ai_day_failed',
      generationIssue: result.generationIssue,
      generationError: result.generationError || null
    });
  for (const [key, proposal] of proposals)
    if (proposal.expiresAt < Date.now() || proposals.size >= 100) proposals.delete(key);
  const proposalId = randomUUID();
  const proposal = {
    ...result,
    owner,
    date: day.date,
    revision: week.revision,
    expiresAt: Date.now() + 10 * 60000
  };
  proposals.set(proposalId, proposal);
  return send(200, {
    proposalId,
    date: day.date,
    theme: result.theme,
    source: result.source,
    expiresAt: proposal.expiresAt
  });
}

async function serveFrontend({ request, url, response }) {
  if (!['GET', 'HEAD'].includes(request.method)) throw invalid('method_not_allowed', 405);
  const pathname = decodeURIComponent(url.pathname);
  if (pathname !== '/' && pathname !== '/index.html' && !/^\/(?:src|styles|assets|vendor)\//.test(pathname))
    throw invalid('not_found', 404);
  const file = resolve(FRONTEND, `.${pathname === '/' ? '/index.html' : pathname}`);
  if (!file.startsWith(FRONTEND.endsWith(sep) ? FRONTEND : FRONTEND + sep) || !MIME[extname(file)])
    throw invalid('not_found', 404);
  let content;
  try {
    content = await readFile(file);
  } catch {
    throw invalid('not_found', 404);
  }
  response.writeHead(200, { 'Content-Type': MIME[extname(file)], 'Cache-Control': 'no-cache' });
  return response.end(request.method === 'HEAD' ? undefined : content);
}

function sendRequestError({ response, send, error }) {
  if (!response.headersSent)
    send(error.status || 500, {
      error: error.code || 'unexpected_error',
      ...(error.code === 'timing_conflict' && error.timing ? { timing: error.timing } : {})
    });
  else response.end();
}

async function suggestParentNoteAction({
  week,
  advice,
  clock,
  dayPlanProvider,
  demoId,
  send,
  proposals,
  owner,
  note,
  publicAdvice,
  updateNote,
  user
}) {
  const day = week.days.find((day) => day.date === advice.date);
  if (!['activity', 'schedule', 'inside', 'outside'].includes(advice.scope)) throw invalid('invalid_note_advice');
  const row = day?.timeline.find(
    row => ['inside', 'outside'].includes(advice.scope) ? row.kind === 'eco' &&
      (day.date > skopjeParts(new Date(clock)).date || minutes(row.start) > skopjeParts(new Date(clock)).minutes) : row.id === advice.rowId
  );
  if (advice.scope === 'activity' && !row) throw invalid('invalid_timeline');
  assertUpcoming(day, clock, advice.scope === 'schedule' ? undefined : row);
  let result;
  let preview;
  if (['inside', 'outside'].includes(advice.scope)) preview = day;
  else {
    result = await dayPlanProvider(day, week.settings, {
      scope: advice.scope,
      rowId: advice.rowId,
      instruction: teacherInstruction(advice.instruction),
      clock,
      useAI: !demoId,
      weekDays: week.days
    });
    if (!result.change) return send(503, { error: 'ai_day_failed', generationIssue: result.generationIssue });
    preview = validateDayChange(
      day,
      week.settings,
      { ...advice, timingTargets: result.timingTargets },
      result.change,
      clock
    );
  }
  for (const [id, pending] of proposals)
    if (pending.expiresAt <= Date.now() || proposals.size >= 100) proposals.delete(id);
  const proposalId = randomUUID();
  const proposal = {
    type: 'parent-note',
    owner,
    noteId: note.id,
    revision: week.revision,
    date: day.date,
    scope: advice.scope,
    rowId: advice.rowId,
    change: result?.change,
    timingTargets: result?.timingTargets || [],
    source: result?.source || 'teacher',
    advice: publicAdvice,
    expiresAt: Date.now() + 10 * 60000
  };
  proposals.set(proposalId, proposal);
  updateNote(user, demoId, week, note, 'suggested', publicAdvice);
  return send(200, {
    advice: publicAdvice,
    proposal: {
      proposalId,
      date: day.date,
      scope: proposal.scope,
      timeline: preview.timeline,
      theme: preview.theme,
      timingTargets: proposal.timingTargets
    }
  });
}

function assertParentRecord(record, token) {
  if (record.parentToken !== token || Date.now() - record.at > 3600000 || !record.week)
    throw invalid('parent_link_unavailable', 404);
}

async function handleAuthMe({ send, user }) {
    return send(200, { user });
  }
async function handleConfig({ send }) {
    return send(200, {
      locations: LOCATIONS,
      defaults: DEFAULT_SETTINGS,
      preferenceBounds: PREFERENCE_BOUNDS,
      materials: MATERIALS,
      ai: aiStatus(),
      demoWeeks: demoWeekOptions(),
      defaultDemoWeek: DEFAULT_DEMO_WEEK,
      demoScenarios: SCENARIOS,
      version: '1.0.0'
    });
  }
