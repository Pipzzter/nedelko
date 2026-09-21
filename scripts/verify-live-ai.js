import assert from 'node:assert/strict';
import { once } from 'node:events';
import { randomBytes } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createApp } from '../backend/http/app.js';
import { openStore } from '../backend/storage/database.js';
import { demoConditions } from '../backend/services/conditions.js';
import { aiStatus } from '../backend/services/ai.js';
import { aiFailure } from '../backend/services/ai-errors.js';
import { LOCATIONS } from '../backend/config/index.js';
import { DEFAULT_SETTINGS, pair } from '../backend/domain/settings.js';
import { planningWeekDates } from '../backend/domain/planner.js';
import { calendarSnapshot } from '../backend/domain/holidays.js';
import { cli, isMain } from './lib/process.js';

function verificationConditions(started, dates) {
  return demoConditions(LOCATIONS.find(location => location.id === 'centar'), 'normal', started, {
    clock: `${dates[0]}T06:45:00Z`, temperatures: [20, 20, 20, 20, 20, 20, 20],
    rainy: [], snowy: [], windy: []
  });
}

function verificationSettings(account) {
  return {
    ...structuredClone(DEFAULT_SETTINGS),
    gradinka: { name: account.kindergarten, locationId: 'centar' },
    groupName: account.kindergarten, dayStart: '09:00', dayEnd: '12:00',
    blocks: [
      { id: 'snack', label: pair('Ужинка', 'Snack'), start: '10:30', end: '10:45', kind: 'meal' },
      { id: 'rest', label: pair('Одмор', 'Rest'), start: '11:30', end: '12:00', kind: 'rest' }
    ],
    teacherPrompt: 'Explore reuse with paper, cardboard and crayons through stories, construction and movement. Истражувајте повторна употреба преку приказни, градење и движење.'
  };
}

function verificationClient(server) {
  const origin = `http://127.0.0.1:${server.address().port}`;
  let cookie = '';
  return {
    async post(path, body) {
      const response = await fetch(origin + path, {
        method: 'POST', redirect: 'error', signal: AbortSignal.timeout(270000),
        headers: { 'Content-Type': 'application/json', Cookie: cookie }, body: JSON.stringify(body)
      });
      cookie = response.headers.get('set-cookie')?.split(';')[0] || cookie;
      return { status: response.status, body: await response.json() };
    },
    privateValues: () => [cookie, cookie.slice(cookie.indexOf('=') + 1)]
  };
}

export function assertAiWeek(result, dates) {
  const week = result.body?.week;
  if (result.status !== 201 || week?.source !== 'ai') {
    const details = result.body?.generationError;
    const failure = aiFailure({ providerStatus: details?.httpStatus, providerCode: details?.code });
    const issue = /^ai_[a-z_]{1,40}$/.test(result.body?.generationIssue) ? result.body.generationIssue : 'not_ai';
    throw new Error(`Live AI verification failed: HTTP ${result.status}; issue=${issue}; providerStatus=${failure.details.httpStatus ?? 'unknown'}; code=${failure.details.code ?? 'unknown'}. No successful evidence was written.`);
  }
  assert.equal(week.days.length, 5, 'Expected a Monday-Friday week.');
  const chronological = (left, right) => left.localeCompare(right);
  assert.deepEqual([...week.outdoorOrder].sort(chronological), [...dates].sort(chronological), 'AI outdoor preference must include every server-owned date.');
  assert.deepEqual(week.days.map(day => day.date), dates, 'Generated lessons must retain the server-owned Monday-Friday dates.');
  for (const day of week.days) {
    for (const field of ['title', 'goal', 'inside', 'outside', 'habit']) {
      assert.ok(day.theme?.[field]?.mk && day.theme[field].en,
        'Every verification lesson must contain validated Macedonian and English content.');
    }
    assert.ok(day.timeline.some(row => row.plannedSession), 'Supporting sessions must come from the model.');
  }
  return week;
}

export function buildEvidence(week, model, started) {
  return {
    schemaVersion: 1, verifiedAt: new Date().toISOString(), model, elapsedMs: Date.now() - started,
    source: week.source, tokenUsage: null, tokenUsageNote: 'The curriculum service does not expose provider token usage.',
    scope: {
      authenticated: true, storage: 'isolated in-memory SQLite', conditions: 'fixed synthetic fixtures, not live observations',
      holidays: 'bundled calendar snapshot, not a live ministry fetch', validation: 'real server curriculum, session and decision validators'
    },
    week: {
      weekStart: week.weekStart, source: week.source, outdoorOrder: week.outdoorOrder,
      days: week.days.map(day => ({
        date: day.date, theme: day.theme,
        sessions: day.timeline.filter(row => row.plannedSession).map(row => ({
          start: row.start, end: row.end, title: row.label, description: row.note
        }))
      }))
    }
  };
}

export function evidenceFiles(evidence) {
  const date = evidence.verifiedAt.slice(0, 10);
  const name = `live-ai-${date}.json`;
  const samples = evidence.week.days.slice(0, 3)
    .map(day => `- ${day.date}: ${day.theme.title.mk} / ${day.theme.title.en}`).join('\n');
  const summary = `<!-- live-ai:start -->\nGenerated live by the configured OpenAI model on ${date}; validated by the server before storage.\n\nModel: **${evidence.model}**. Elapsed: ${evidence.elapsedMs} ms. Source: **ai**. Provider token usage is not exposed by this service.\n\n[Validated bilingual lessons and sessions](${name}) came from a real authenticated request with an isolated temporary account and in-memory database. Air and weather were explicitly synthetic; holidays came from the bundled snapshot. This verifies live model generation, not live environmental providers, deployment, or teacher use. Account details, cookies and provider request identifiers are excluded.\n\n${samples}\n<!-- live-ai:end -->`;
  return { name, serialized: JSON.stringify(evidence, null, 2) + '\n', summary };
}

export function assertPrivateEvidence(text, privateValues) {
  const message = 'Evidence must not contain private account or provider data.';
  assert.doesNotMatch(text, /OPENAI_|\bsk-[a-zA-Z0-9_-]{8,}|scrypt-v1|"(?:cookie|password|userId|accountId|requestId|providerRequestId)"|\breq_[a-zA-Z0-9_-]+/, message);
  for (const value of privateValues) assert.ok(typeof value === 'string' && value && !text.includes(value), message);
}

async function saveEvidence(evidence, privateValues) {
  const { name, serialized, summary } = evidenceFiles(evidence);
  const directory = new URL('../docs/evidence/', import.meta.url);
  const index = new URL('README.md', directory);
  const previous = await readFile(index, 'utf8').catch(error => {
    if (error.code === 'ENOENT') return '# Verification evidence\n\n';
    throw error;
  });
  const next = previous.includes('<!-- live-ai:start -->')
    ? previous.replace(/<!-- live-ai:start -->[\s\S]*?<!-- live-ai:end -->/, () => summary)
    : previous.trimEnd() + '\n\n' + summary + '\n\nRun `npm run verify:ai` deliberately: each run makes one paid generation. Normal tests never run this command.\n';
  assertPrivateEvidence(serialized + next, privateValues);
  await mkdir(directory, { recursive: true });
  await writeFile(new URL(name, directory), serialized);
  await writeFile(index, next);
  console.log(`Verified: model=${evidence.model}, elapsedMs=${evidence.elapsedMs}, source=ai, evidence=docs/evidence/${name}`);
}

// Deliberately separate from the hermetic test suite: this command spends API tokens.
export async function verifyLiveAi() {
  if (!process.env.OPENAI_API_KEY?.trim()) throw new Error('Set OPENAI_API_KEY in the private .env file before running verify:ai.');
  const started = Date.now();
  const model = aiStatus().model;
  const dates = planningWeekDates(started);
  const conditions = verificationConditions(started, dates);
  const server = createApp({
    store: openStore(':memory:'), conditionsProvider: async () => structuredClone(conditions),
    holidayProvider: async year => calendarSnapshot(year), autoRefreshMs: 0
  });
  const account = {
    email: 'verification@example.test', password: randomBytes(24).toString('base64url'),
    displayName: 'Verification teacher', kindergarten: 'Isolated verification', ageGroup: '4-5', locationId: 'centar'
  };
  try {
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    const client = verificationClient(server);
    const registered = await client.post('/api/auth/register', account);
    assert.equal(registered.status, 200, 'The isolated verification account could not be registered.');
    assert.ok(registered.body.user?.id, 'The isolated verification account must have a server-issued ID.');
    assert.ok(client.privateValues().every(Boolean), 'The isolated verification account must have a session cookie.');
    console.log(`Running one authenticated generation with ${model}; conditions are synthetic and holidays use the bundled snapshot.`);
    const result = await client.post('/api/week/generate', { settings: verificationSettings(account), requireAI: true });
    const week = assertAiWeek(result, dates);
    await saveEvidence(buildEvidence(week, model, started), [
      process.env.OPENAI_API_KEY, ...client.privateValues(), account.password, account.email,
      account.displayName, account.kindergarten, registered.body.user.id
    ]);
  } finally {
    await new Promise(resolve => { server.close(resolve); server.closeAllConnections(); });
  }
}

if (isMain(import.meta.url)) await cli(verifyLiveAi);
