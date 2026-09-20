import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, sep, extname } from 'node:path';
import { randomUUID, randomInt, randomBytes } from 'node:crypto';
import { LOCATIONS, skopjeParts, POLICY, SCENARIOS } from '../config/index.js';
import { demoWeekById, demoWeekOptions, DEFAULT_DEMO_WEEK } from '../config/demo.js';
import { prepareDemoWeek } from '../domain/demo-week.js';
import { DEFAULT_SETTINGS, MATERIALS, validateSettings, validateGenerationSettings, invalid, minutes, teacherInstruction } from '../domain/settings.js';
import { planningWeekDates } from '../domain/planner.js';
import { createWeek, adaptWeek, editWeek, dashboard, outdoorPlanningContext, dailyPlanningContext, replaceDayTheme } from '../domain/week.js';
import { getConditions } from '../services/conditions.js';
import { createCurriculum, createDayCurriculum } from '../services/curriculum.js';
import { aiStatus } from '../services/ai.js';
import { parentView } from '../domain/parent-view.js';
import { dailyTopics } from '../domain/teaching-brief.js';
import { startAutoRefresh } from '../services/auto-refresh.js';
import { getHolidayCalendar } from '../services/holidays.js';
import { calendarSnapshot } from '../domain/holidays.js';
import { register, login, tokenHash, readSessionCookie, createSession } from '../services/auth.js';
import { openStore } from '../storage/database.js';
import { securityHeaders, jsonBody, rateLimiter } from './security.js';

const FRONTEND = fileURLToPath(new URL('../../frontend/', import.meta.url));
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };

export function createApp({ store = openStore(), conditionsProvider = getConditions, curriculumProvider = createCurriculum,
  dayCurriculumProvider = createDayCurriculum, holidayProvider = getHolidayCalendar, autoRefreshMs = 0 } = {}) {
  const limit = rateLimiter(); const demos = new Map(); const locks = new Map(); const proposals = new Map();
  const withLock = async (key, operation) => {
    if (locks.has(key)) throw invalid('operation_pending', 409);
    locks.set(key, true); try { return await operation(); } finally { locks.delete(key); }
  };
  function demoRecord(id) {
    const record = demos.get(id);
    if (!record || Date.now() - record.at > 3600000) { demos.delete(id); throw invalid('demo_expired', 404); }
    return record;
  }
  function save(user, demoId, week, expected, updateProfile = false) {
    if (demoId) {
      const record = demoRecord(demoId);
      if ((record.week?.revision || 0) !== expected) throw invalid('plan_changed', 409);
      record.revision = (record.revision || 0) + 1;
      record.week = { ...week, revision: record.revision }; return record.week;
    }
    const result = store.saveWeek(user.id, week, expected);
    if (!result) throw invalid('plan_changed', 409);
    if (updateProfile) store.saveProfile(user.id, result.settings);
    return result;
  }
  function sharing(user, demoId, week) {
    if (!week) return null;
    if (!demoId) return store.sharing(user.id, week.weekStart);
    const record = demoRecord(demoId);
    return record.parentToken ? { path: `/#parents/${record.parentToken}`, expiresAt: new Date(record.at + 3600000).toISOString() } : null;
  }
  function present(week, conditions, user, demoId) {
    return { ...dashboard(week, conditions), demoId, share: sharing(user, demoId, week),
      profile: !demoId && user ? store.profile(user.id) : null,
      ...(demoId ? { demoScenario: demoRecord(demoId).scenario || 'normal' } : {}) };
  }
  async function refreshStoredWeek(userId, start) {
    return withLock(userId, async () => {
      let old = store.week(userId, start);
      if (!old) throw invalid('parent_link_unavailable', 404);
      const today = skopjeParts(new Date()).date;
      if (Date.now() - Date.parse(old.conditionsCheckedAt) < 300000 && old.today === today) return old;
      old = save({ id: userId }, null, { ...old, approval: null, checkedAt: null, checkedDate: null }, old.revision);
      const conditions = await conditionsProvider({ locationId: old.settings.locationId, mode: 'live', fresh: true });
      return save({ id: userId }, null, adaptWeek(old, conditions), old.revision);
    });
  }
  const server = http.createServer(async (request, response) => {
    securityHeaders(response);
    const send = (status, body) => { response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); response.end(JSON.stringify(body)); };
    try {
      const host = request.headers.host ?? '';
      if (!/^(?:127\.0\.0\.1|localhost)(?::\d+)?$/.test(host)) throw invalid('local_only', 403);
      const url = new URL(request.url, `http://${host}`);
      if (!url.pathname.startsWith('/api/')) {
        if (!['GET', 'HEAD'].includes(request.method)) throw invalid('method_not_allowed', 405);
        const pathname = decodeURIComponent(url.pathname);
        if (pathname !== '/' && pathname !== '/index.html' && !/^\/(?:src|styles|assets|vendor)\//.test(pathname)) throw invalid('not_found', 404);
        const file = resolve(FRONTEND, `.${pathname === '/' ? '/index.html' : pathname}`);
        if (!file.startsWith(FRONTEND.endsWith(sep) ? FRONTEND : FRONTEND + sep) || !MIME[extname(file)]) throw invalid('not_found', 404);
        let content; try { content = await readFile(file); } catch { throw invalid('not_found', 404); }
        response.writeHead(200, { 'Content-Type': MIME[extname(file)], 'Cache-Control': 'no-cache' }); return response.end(request.method === 'HEAD' ? undefined : content);
      }
      limit(request.socket.remoteAddress);
      if (!['GET', 'POST'].includes(request.method)) throw invalid('method_not_allowed', 405);
      if (request.method === 'POST' && ((request.headers.origin && request.headers.origin !== `http://${host}`) || request.headers['sec-fetch-site'] === 'cross-site')) throw invalid('cross_origin', 403);
      const cookie = readSessionCookie(request); const user = cookie ? store.session(tokenHash(cookie)) : null;
      if (request.method === 'GET' && url.pathname === '/api/auth/me') return send(200, { user });
      if (request.method === 'GET' && url.pathname === '/api/config') return send(200, { locations: LOCATIONS, defaults: DEFAULT_SETTINGS, materials: MATERIALS, ai: aiStatus(), demoWeeks: demoWeekOptions(), defaultDemoWeek: DEFAULT_DEMO_WEEK, demoScenarios: SCENARIOS, version: '1.0.0' });
      if (url.pathname.startsWith('/api/parents/')) {
        response.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive');
        if (request.method !== 'GET') throw invalid('method_not_allowed', 405);
        const token = url.pathname.slice('/api/parents/'.length);
        if (!/^[a-f0-9]{64}$/.test(token)) throw invalid('parent_link_unavailable', 404);
        for (const [id, record] of demos) {
          if (record.parentToken !== token) continue;
          if (Date.now() - record.at > 3600000 || !record.week) throw invalid('parent_link_unavailable', 404);
          return send(200, parentView(record.week, sharing(null, id, record.week).expiresAt));
        }
        const owner = store.sharedWeek(token);
        if (!owner) throw invalid('parent_link_unavailable', 404);
        let week = store.week(owner.userId, owner.weekStart);
        if (!week) throw invalid('parent_link_unavailable', 404);
        const today = skopjeParts(new Date()).date;
        if (today >= week.weekStart && today <= week.days.at(-1).date) week = await refreshStoredWeek(owner.userId, owner.weekStart);
        // Re-check revocation after any awaited refresh.
        if (!store.sharedWeek(token)) throw invalid('parent_link_unavailable', 404);
        return send(200, parentView(week, store.sharing(owner.userId, owner.weekStart).expiresAt));
      }
      if (request.method === 'POST' && ['/api/auth/register', '/api/auth/login'].includes(url.pathname)) {
        limit(`auth:${request.socket.remoteAddress}`, 12, 15 * 60000);
        const body = await jsonBody(request);
        const account = await (url.pathname.endsWith('/register') ? register(store, body) : login(store, body));
        response.setHeader('Set-Cookie', createSession(store, account, cookie)); return send(200, { user: account });
      }
      if (request.method === 'POST' && url.pathname === '/api/auth/logout') {
        await jsonBody(request); if (cookie) store.deleteSession(tokenHash(cookie));
        response.setHeader('Set-Cookie', 'eko_session=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0'); return send(200, { ok: true });
      }
      if (request.method === 'POST' && url.pathname === '/api/demo') {
        const body = await jsonBody(request); const settings = validateSettings({ ...DEFAULT_SETTINGS, locationId: body.locationId || 'centar',
          gradinka: { name: 'Сончева градина' }, groupName: 'Сончогледи', ageGroup: 'mixed', teacherPrompt: 'Eco activities with movement, shared creations and care for nature.' });
        const profile = demoWeekById(body.demoWeek);
        const conditions = await conditionsProvider({ locationId: settings.locationId, mode: 'demo', scenario: 'normal', demoWeek: profile.id });
        const curriculum = await curriculumProvider(planningWeekDates(conditions.clock), settings, { useAI: false });
        const week = { ...prepareDemoWeek(createWeek(settings, curriculum, conditions), conditions, profile), revision: 1 }; const demoId = randomUUID();
        for (const [id, record] of demos) if (Date.now() - record.at > 3600000 || demos.size >= 50) demos.delete(id);
        demos.set(demoId, { week, revision: 1, demoWeek: profile.id, at: Date.now(), parentToken: null });
        return send(201, present(week, conditions, user, demoId));
      }
      const body = request.method === 'POST' ? await jsonBody(request) : {};
      const demoId = body.demoId || url.searchParams.get('demoId');
      if (demoId && (typeof demoId !== 'string' || demoId.length > 40)) throw invalid('demo_expired', 404);
      if (!demoId && !user) throw invalid('sign_in_required', 401);
      const mode = demoId ? 'demo' : 'live';
      const realWeekStart = planningWeekDates(new Date().toISOString())[0];
      const currentWeek = () => demoId ? demoRecord(demoId).week : store.week(user.id, realWeekStart);
      const scenario = demoId ? body.scenario || url.searchParams.get('scenario') || demoRecord(demoId).scenario || 'normal' : 'normal';
      if (!SCENARIOS.includes(scenario)) throw invalid('invalid_scenario');
      const demoWeek = demoId ? demoRecord(demoId).demoWeek : undefined;
      if (request.method === 'GET' && url.pathname === '/api/holidays') {
        if (demoId) demoRecord(demoId);
        const year = Number(url.searchParams.get('year'));
        if (!Number.isInteger(year) || year < 2024 || year > 2100) throw invalid('invalid_calendar_year');
        const calendar = demoId ? calendarSnapshot(year) : await holidayProvider(year);
        return send(200, { calendar });
      }
      if (request.method === 'GET' && url.pathname === '/api/dashboard') {
        return await withLock(demoId || user.id, async () => {
          let old = currentWeek(); const locationId = old?.settings.locationId || url.searchParams.get('location') || (!demoId && store.profile(user.id)?.locationId) || 'centar';
          if (old) old = save(user, demoId, { ...old, approval: null, checkedAt: null, checkedDate: null }, old.revision);
          const years = old ? [...new Set(old.days.map(day => Number(day.date.slice(0, 4))))] : [];
          const [conditions, calendars] = await Promise.all([
            conditionsProvider({ locationId, mode, scenario, demoWeek, fresh: url.searchParams.get('fresh') === '1' }),
            Promise.all(years.map(year => demoId ? calendarSnapshot(year) : holidayProvider(year))),
          ]);
          const week = old ? save(user, demoId, adaptWeek({ ...old, holidayCalendars: calendars }, conditions), old.revision) : null;
          if (demoId) demoRecord(demoId).scenario = scenario;
          return send(200, present(week, conditions, user, demoId));
        });
      }
      if (request.method === 'POST' && url.pathname === '/api/week/generate') {
        return await withLock(demoId || user.id, async () => {
          const settings = validateGenerationSettings(body.settings); const old = currentWeek();
          if (old ? body.revision !== old.revision : body.revision) throw invalid('plan_changed', 409);
          const conditions = await conditionsProvider({ locationId: settings.locationId, mode, scenario, demoWeek });
          const dates = planningWeekDates(conditions.clock);
          const years = [...new Set(dates.map(date => Number(date.slice(0, 4))))];
          const calendars = await Promise.all(years.map(year => demoId ? calendarSnapshot(year) : holidayProvider(year)));
          const curriculum = await curriculumProvider(dates, settings, { useAI: !demoId, calendars, variant: demoId ? 0 : randomInt(1000000),
            planningDays: dailyPlanningContext(dates, settings, conditions), outdoorContext: outdoorPlanningContext(dates, settings, conditions), today: skopjeParts(new Date(conditions.clock)).date });
          // An explicit AI retry must never replace the saved week with another fallback.
          if (!demoId && (body.requireAI === true || dailyTopics(settings.teacherPrompt).length) && curriculum.source !== 'ai') return send(503, {
            error: 'ai_retry_failed', generationIssue: curriculum.generationIssue || 'ai_unavailable',
            generationError: curriculum.generationError ?? null,
          });
          let generated = createWeek(settings, curriculum, conditions, calendars);
          if (demoId) generated = prepareDemoWeek(generated, conditions, demoWeekById(demoWeek));
          const week = save(user, demoId, generated, old?.revision || 0, true);
          return send(201, present(week, conditions, user, demoId));
        });
      }
      if (request.method === 'POST' && url.pathname === '/api/week/share') {
        return await withLock(demoId || user.id, async () => {
          const week = currentWeek();
          if (!week) throw invalid('no_plan', 404);
          if (body.revision !== week.revision) throw invalid('plan_changed', 409);
          if (!['enable', 'rotate', 'revoke'].includes(body.action)) throw invalid('invalid_plan');
          if (demoId) {
            const record = demoRecord(demoId);
            if (body.action === 'revoke') record.parentToken = null;
            else if (!record.parentToken || body.action === 'rotate') record.parentToken = randomBytes(32).toString('hex');
          } else if (body.action === 'revoke') store.revokeShare(user.id, week.weekStart);
          else store.shareWeek(user.id, week.weekStart, body.action === 'rotate');
          return send(200, { week, share: sharing(user, demoId, week) });
        });
      }
      if (request.method === 'POST' && ['/api/week/day/suggest', '/api/week/day/apply'].includes(url.pathname)) {
        return await withLock(demoId || user.id, async () => {
          const week = currentWeek();
          if (!week) throw invalid('no_plan', 404);
          if (body.revision !== week.revision) throw invalid('plan_changed', 409);
          const owner = demoId || user.id;
          if (url.pathname.endsWith('/suggest')) {
            const day = week.days.find(day => day.date === body.date);
            const local = skopjeParts(new Date(demoId ? week.clock : new Date().toISOString()));
            const slot = day?.timeline.find(row => row.kind === 'eco');
            if (!day?.theme || day.closed || !slot || day.date < local.date || day.date === local.date && minutes(slot.start) <= local.minutes) throw invalid('activity_finished', 409);
            const instruction = teacherInstruction(body.instruction);
            if (!instruction) throw invalid('invalid_instruction');
            limit(`ai-day:${owner}`, 12, 3600000);
            const result = await dayCurriculumProvider(day, week.settings, { instruction, useAI: !demoId });
            if (!result.theme) return send(503, { error: 'ai_day_failed', generationIssue: result.generationIssue, generationError: result.generationError || null });
            for (const [key, proposal] of proposals) if (proposal.expiresAt < Date.now() || proposals.size >= 100) proposals.delete(key);
            const proposalId = randomUUID();
            const proposal = { ...result, owner, date: day.date, revision: week.revision, expiresAt: Date.now() + 10 * 60000 };
            proposals.set(proposalId, proposal);
            return send(200, { proposalId, date: day.date, theme: result.theme, source: result.source, expiresAt: proposal.expiresAt });
          }
          const proposal = proposals.get(body.proposalId);
          if (!proposal || proposal.owner !== owner || proposal.expiresAt <= Date.now() || proposal.revision !== week.revision) throw invalid('proposal_expired', 409);
          const conditions = await conditionsProvider({ locationId: week.settings.locationId, mode, scenario, demoWeek, fresh: true });
          const next = save(user, demoId, replaceDayTheme(week, proposal.date, proposal.theme, proposal.source, conditions), week.revision);
          proposals.delete(body.proposalId);
          return send(200, present(next, conditions, user, demoId));
        });
      }
      if (request.method === 'POST' && url.pathname === '/api/week/delete') {
        return await withLock(demoId || user.id, async () => {
          const old = currentWeek();
          if (!old) throw invalid('no_plan', 404);
          if (old.revision !== body.revision) throw invalid('plan_changed', 409);
          if (demoId) { const record = demoRecord(demoId); record.week = null; record.parentToken = null; record.revision++; }
          else if (!store.deleteWeek(user.id, old.weekStart, old.revision)) throw invalid('plan_changed', 409);
          return send(200, { week: null, settings: old.settings });
        });
      }
      if (request.method === 'POST' && ['/api/week/edit', '/api/week/location', '/api/week/recheck', '/api/week/approve'].includes(url.pathname)) {
        return await withLock(demoId || user.id, async () => {
          let old = currentWeek(); if (!old) throw invalid('no_plan', 404);
          if (old.revision !== body.revision) throw invalid('plan_changed', 409);
          if (url.pathname.endsWith('/approve')) {
            const now = Date.now(); const today = mode === 'demo' ? old.today : skopjeParts(new Date(now)).date;
            const day = old.days.find(d => d.date === today);
            if (!day?.theme || day.closed || old.checkedDate !== today || !old.checkedAt || now - Date.parse(old.checkedAt) > POLICY.maxPlanAgeMinutes * 60000) throw invalid('recheck_required', 409);
            if (day.mode === 'outside' && mode === 'live' && (!old.checkedObservation || now - Date.parse(old.checkedObservation) > POLICY.freshnessMinutes * 60000)) throw invalid('recheck_required', 409);
            if (day.mode === 'outside' && mode === 'live' && day.timeline.some(row => row.kind === 'eco' && minutes(row.end) <= skopjeParts(new Date(now)).minutes)) throw invalid('recheck_required', 409);
            old.approval = { at: new Date(now).toISOString(), date: today, messages: old.messages.daily[today] };
            const week = save(user, demoId, old, old.revision); return send(200, { week });
          }
          const settings = url.pathname.endsWith('/location') ? validateSettings({ ...old.settings, locationId: body.locationId }) : url.pathname.endsWith('/edit') ? validateSettings(body.settings) : old.settings;
          if (!url.pathname.endsWith('/edit')) old = save(user, demoId, { ...old, approval: null, checkedAt: null, checkedDate: null }, old.revision);
          const conditions = await conditionsProvider({ locationId: settings.locationId, mode, scenario, demoWeek, fresh: url.pathname.endsWith('/recheck') });
          let next = url.pathname.endsWith('/edit') ? editWeek(old, body, conditions) : adaptWeek({ ...old, settings }, conditions);
          if (url.pathname.endsWith('/recheck')) {
            next.checkedAt = new Date().toISOString(); next.checkedDate = skopjeParts(new Date(conditions.clock)).date;
            next.checkedObservation = conditions.assessment.oldestObservation;
          }
          const week = save(user, demoId, next, old.revision, !url.pathname.endsWith('/recheck')); return send(200, present(week, conditions, user, demoId));
        });
      }
      throw invalid('not_found', 404);
    } catch (error) {
      if (!response.headersSent) send(error.status || 500, { error: error.code || 'unexpected_error' }); else response.end();
    }
  });
  server.requestTimeout = 60000; server.headersTimeout = 15000;
  const automatic = autoRefreshMs > 0 ? startAutoRefresh({ store, refreshWeek: refreshStoredWeek, intervalMs: autoRefreshMs }) : null;
  server.on('listening', () => { automatic?.tick().catch(() => {}); });
  server.on('close', () => automatic?.stop());
  server.on('close', () => store.close());
  return server;
}
