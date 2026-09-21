import test from 'node:test';
import assert from 'node:assert/strict';
import { parseHTML } from 'linkedom';
import { html, render, localizedDate } from '../src/lib/ui.js';
import { InlineText } from '../src/components/InlineText.js';
import { DayAssistant } from '../src/components/DayAssistant.js';
import { WeekActions } from '../src/components/WeekActions.js';
import { PairInput, SettingsForm } from '../src/components/SettingsForm.js';
import { ParentNoteForm } from '../src/components/ParentNoteForm.js';
import { ParentShare } from '../src/components/ParentShare.js';
import { AirCard } from '../src/components/AirCard.js';
import { Calendar } from '../src/components/Calendar.js';
import { Auth } from '../src/pages/Auth.js';
import { focusPlanField } from '../src/lib/plan-form.js';
import { LOCATIONS } from '../../backend/config/index.js';
import { ActivityEditor } from '../src/components/ActivityEditor.js';
import { ScheduleEditor } from '../src/components/ScheduleEditor.js';
import { DayPlan } from '../src/components/DayPlan.js';
import { DEFAULT_SETTINGS, MATERIALS } from '../../backend/domain/settings.js';
import { localCurriculum } from '../../backend/domain/curriculum.js';
import { PREFERENCE_BOUNDS } from '../../backend/domain/preferences.js';
import { validateParentNote } from '../../backend/domain/parent-notes.js';

function dom(t) {
  const { window } = parseHTML('<html><body><div id="root"></div></body></html>');
  globalThis.window = window; globalThis.document = window.document;
  globalThis.requestAnimationFrame = callback => setTimeout(callback, 0); globalThis.cancelAnimationFrame = clearTimeout;
  const root = document.getElementById('root');
  t.after(() => render(null, root));
  const fire = (node, name, properties = {}) => {
    assert.ok(node, `target for ${name}`);
    const event = new window.Event(name, { bubbles: true, cancelable: true });
    Object.assign(event, properties); node.dispatchEvent(event); return event;
  };
  const wait = async predicate => {
    for (let i = 0; i < 200; i++) { if (predicate()) return; await new Promise(resolve => setTimeout(resolve, 5)); }
    throw new Error('Component expectation timed out');
  };
  return { root, fire, wait };
}

test('inline editing preserves typing, supports cancel and distinguishes multiline Enter from commit', async t => {
  const { root, fire } = dom(t); let begins = 0; let commits = 0; let cancels = 0; let draft;
  const props = { value: 'Original', label: 'Edit title', draft: 'Draft', onBegin: () => begins++, onCommit: () => commits++, onCancel: () => cancels++, onInput: value => { draft = value; } };
  render(html`<${InlineText} ...${props}/>`, root);
  fire(root.querySelector('button'), 'click'); assert.equal(begins, 1);
  render(html`<${InlineText} ...${props} active=${true}/>`, root);
  const input = root.querySelector('input'); input.value = 'Changed'; fire(input, 'input'); assert.equal(draft, 'Changed');
  fire(input, 'keydown', { key: 'Escape' }); assert.equal(cancels, 1);
  fire(input, 'keydown', { key: 'Enter' }); assert.equal(commits, 1);
  render(html`<${InlineText} ...${props} active=${true} multiline=${true}/>`, root);
  const textarea = root.querySelector('textarea');
  fire(textarea, 'keydown', { key: 'Enter' }); assert.equal(commits, 1);
  fire(textarea, 'keydown', { key: 'Enter', ctrlKey: true }); assert.equal(commits, 2);
  fire(textarea, 'keydown', { key: 'Enter', metaKey: true }); assert.equal(commits, 3);
  fire(textarea, 'blur'); assert.equal(commits, 4);
});

test('legacy day assistant previews before apply, discards proposals and shows failures without applying', async t => {
  const { root, fire, wait } = dom(t); const calls = []; let failure = false;
  const pair = { mk: 'Пример', en: 'Example' };
  const props = { lang: 'en', day: { date: '2026-09-22' }, demo: true, onApply: id => calls.push(id),
    onSuggest: async (date, instruction) => { assert.equal(date, '2026-09-22'); assert.equal(instruction, 'More music'); if (failure) throw { code: 'ai_day_failed', generationIssue: 'ai_timeout' }; return { proposalId: 'fixture', source: 'library', theme: { title: pair, goal: pair, inside: pair, outside: pair } }; } };
  render(html`<${DayAssistant} ...${props}/>`, root);
  assert.equal(root.querySelector('button').disabled, true);
  const field = root.querySelector('textarea'); field.value = 'More music'; fire(field, 'input');
  await wait(() => !root.querySelector('button').disabled); fire(root.querySelector('button'), 'click');
  await wait(() => root.querySelector('.day-proposal')); assert.deepEqual(calls, []);
  fire(root.querySelector('.day-proposal .primary'), 'click'); assert.deepEqual(calls, ['fixture']);
  fire(root.querySelector('.day-proposal .quiet'), 'click'); await wait(() => !root.querySelector('.day-proposal'));
  failure = true; fire(root.querySelector('button'), 'click'); await wait(() => root.querySelector('[role="alert"]'));
  assert.deepEqual(calls, ['fixture']); assert.equal(root.querySelector('.day-proposal'), null);
  render(html`<${DayAssistant} ...${props} dirty=${true}/>`, root);
  assert.equal(root.querySelector('button').disabled, true); assert.ok(root.querySelector('[role="status"]'));
});

test('week deletion requires confirmation and cancellation preserves the plan', async t => {
  const { root, fire, wait } = dom(t); let deleted = 0; let regenerated = 0;
  render(html`<${WeekActions} lang="en" onDelete=${() => deleted++} onRegenerate=${() => regenerated++}/>`, root);
  fire(root.querySelector('.secondary'), 'click'); assert.equal(regenerated, 1);
  fire(root.querySelector('.quiet'), 'click'); await wait(() => root.querySelector('.delete-week-confirm'));
  assert.equal(deleted, 0); fire(root.querySelector('.delete-week-confirm .secondary'), 'click');
  await wait(() => !root.querySelector('.delete-week-confirm')); assert.equal(deleted, 0);
  fire(root.querySelector('.quiet'), 'click'); await wait(() => root.querySelector('.delete-week-confirm'));
  fire(root.querySelector('.danger'), 'click'); assert.equal(deleted, 1);
});

test('bilingual inputs preserve the other translation and form errors expand nested details before focus', t => {
  const { root, fire } = dom(t); let changed;
  const value = { mk: 'Игра', en: 'Game' };
  for (const multiline of [false, true]) {
    render(html`<${PairInput} value=${value} label="Activity" multiline=${multiline} onChange=${pair => { changed = pair; }}/>`, root);
    const field = root.querySelectorAll(multiline ? 'textarea' : 'input')[1]; field.value = 'Music'; fire(field, 'input');
    assert.deepEqual(changed, { mk: 'Игра', en: 'Music' });
  }
  render(html`<details id="outer"><details id="inner"><div id="plan-routines"><input/></div></details></details>`, root);
  let focused = false; root.querySelector('input').focus = () => { focused = true; };
  focusPlanField('routines'); assert.equal(focused, true);
  assert.equal(document.getElementById('outer').open, true); assert.equal(document.getElementById('inner').open, true);
  assert.doesNotThrow(() => focusPlanField('missing'));
});

test('teacher registration requires kindergarten details while parents receive link-only guidance', async t => {
  const { root, fire, wait } = dom(t); let selectedLanguage; let demos = 0;
  const props = { lang: 'en', config: { locations: LOCATIONS }, setLang: value => { selectedLanguage = value; }, onDemo: () => demos++, onAuth: () => {} };
  render(html`<${Auth} ...${props}/>`, root);
  assert.equal(root.querySelector('[name="kindergarten"]'), null);
  assert.equal(root.querySelector('[name="password"]').getAttribute('minlength'), '1');
  fire(root.querySelectorAll('.auth-tabs button')[1], 'click'); await wait(() => root.querySelector('[name="kindergarten"]'));
  for (const name of ['kindergarten', 'displayName', 'ageGroup', 'locationId', 'email', 'password']) assert.ok(root.querySelector(`[name="${name}"]`).hasAttribute('required'));
  assert.equal(root.querySelector('[name="password"]').getAttribute('minlength'), '10');
  assert.match(root.querySelector('.teacher-auth-help').textContent, /link/i);
  fire(root.querySelector('.language-switch'), 'click'); assert.equal(selectedLanguage, 'mk');
  fire(root.querySelector('.auth-card > .secondary'), 'click'); assert.equal(demos, 1);
  render(html`<${Auth} ...${props} lang="mk" error="Fixture error" busy=${true}/>`, root);
  assert.equal(root.querySelector('[type="submit"]').disabled, true); assert.equal(root.querySelector('[role="alert"]').textContent, 'Fixture error');
});

const pair = { mk: 'Пример', en: 'Example' };
const editableDay = () => ({ date: '2026-09-22', mode: 'inside', reason: 'teacher_inside', outdoorPreference: 'inside',
  theme: localCurriculum(['2026-09-22'], DEFAULT_SETTINGS)[0],
  timeline: [{ id: 'meal', kind: 'meal', start: '08:00', end: '09:00', label: pair }, { id: 'eco', kind: 'eco', start: '09:00', end: '09:45', label: pair }, { id: 'play', kind: 'activity', start: '09:45', end: '11:00', label: pair, note: pair }],
});

test('pencil editor saves bilingual meal details without time fields and retains a draft after errors', async t => {
  const { root, fire, wait } = dom(t); let saved; let cancelled = 0; let fail = true;
  const day = editableDay(); const props = { day, row: day.timeline[0], lang: 'en', materials: MATERIALS, revision: 3,
    onCancel: () => cancelled++, onSave: async value => { if (fail) throw { code: 'plan_changed' }; saved = value; } };
  render(html`<${ActivityEditor} ...${props}/>`, root);
  assert.equal(root.querySelector('[type="time"]'), null);
  const englishTitle = root.querySelectorAll('textarea')[1]; englishTitle.value = 'Breakfast with friends'; fire(englishTitle, 'input');
  await wait(() => root.querySelectorAll('textarea')[1].value === 'Breakfast with friends');
  fire(root.querySelector('form'), 'submit'); await wait(() => root.querySelector('[role="alert"]'));
  assert.equal(cancelled, 0); fail = false;
  render(html`<${ActivityEditor} ...${props} revision=${4}/>`, root);
  fire(root.querySelector('form'), 'submit'); await wait(() => saved);
  assert.equal(saved.content.label.en, 'Breakfast with friends'); assert.equal(saved.content.label.mk, pair.mk);
  assert.ok(saved.content.note.mk && saved.content.note.en); assert.equal(saved.content.start, undefined); assert.equal(cancelled, 1);
  assert.equal(saved.revision, 3, 'a refresh cannot silently authorize saving an older draft against a newer revision');
});

test('eco detail editing exposes both alternatives, goals, materials and holiday discussion', async t => {
  const { root, fire, wait } = dom(t); let saved;
  const day = editableDay(); const row = { ...day.timeline[1], occasionDiscussion: pair };
  render(html`<${ActivityEditor} day=${day} row=${row} lang="mk" materials=${MATERIALS} onCancel=${() => {}} onSave=${value => { saved = value; }}/>`, root);
  assert.equal(root.querySelectorAll('textarea').length, 12);
  assert.ok(root.textContent.includes('Навика за дома'));
  const checkbox = root.querySelector('[type="checkbox"]'); const id = MATERIALS[0].id;
  checkbox.checked = false; fire(checkbox, 'change'); await new Promise(resolve => setTimeout(resolve, 0));
  const inside = root.querySelectorAll('textarea')[2]; inside.value = 'Нова игра во занималната.'; fire(inside, 'input');
  await new Promise(resolve => setTimeout(resolve, 0));
  fire(root.querySelector('form'), 'submit'); await wait(() => saved);
  assert.equal(saved.content.theme.inside.mk, 'Нова игра во занималната.'); assert.ok(!saved.content.theme.materials.includes(id));
  assert.deepEqual(saved.content.occasionDiscussion, pair);
  render(html`<${ActivityEditor} day=${day} row=${row} lang="en" materials=${MATERIALS} onCancel=${() => {}} onSave=${value => { saved = value; }}/>`, root);
  assert.ok(root.textContent.includes('A habit for home'));
});

test('schedule time edits show propagated boundaries and require review before saving', async t => {
  const { root, fire, wait } = dom(t); let saved;
  render(html`<${ScheduleEditor} day=${editableDay()} clock="2026-09-21T06:00:00Z" lang="en" onSave=${value => { saved = value; }}/>`, root);
  assert.equal(root.querySelector('input').disabled, true);
  const field = root.querySelectorAll('input')[2]; field.value = '09:30'; fire(field, 'input');
  await wait(() => !root.querySelector('button').disabled);
  assert.match(root.querySelectorAll('li')[1].textContent, /09:30/);
  fire(root.querySelector('button'), 'click'); await wait(() => root.querySelector('.schedule-review'));
  assert.equal(saved, undefined); fire(root.querySelector('.primary'), 'click'); await wait(() => saved);
  assert.deepEqual(saved.starts, ['08:00', '09:00', '09:30']); assert.equal(saved.action, 'timing');
});

test('top-level dragging and keyboard movement send complete row order; parent view exposes neither', async t => {
  const { root, fire, wait } = dom(t); const changes = []; const day = editableDay();
  const props = { day, data: { today: '2026-09-21', week: { settings: DEFAULT_SETTINGS } }, clock: '2026-09-21T06:00:00Z', lang: 'en', materials: MATERIALS, onEdit: request => changes.push(request) };
  render(html`<${DayPlan} ...${props}/>`, root);
  const first = root.querySelector('.timeline li'); fire(first, 'dragstart', { dataTransfer: { setData() {} } });
  await new Promise(resolve => setTimeout(resolve, 0));
  fire(root.querySelector('.timeline li:last-child'), 'drop'); await wait(() => changes.length === 1);
  assert.deepEqual(changes[0].rowIds, ['eco', 'play', 'meal']);
  fire(root.querySelector('.reorder-controls button:last-child'), 'click'); await wait(() => changes.length === 2);
  assert.deepEqual(changes[1].rowIds, ['eco', 'meal', 'play']);
  fire(first.querySelector('.timeline-activity'), 'click'); await wait(() => /08:00/.test(root.querySelector('.activity-detail-time').textContent));
  fire(root.querySelector('.edit-activity'), 'click'); await wait(() => root.querySelector('.activity-editor'));
  render(html`<${DayPlan} ...${props} onEdit=${undefined} readOnly=${true}/>`, root);
  assert.equal(root.querySelector('.edit-activity, .activity-editor, .reorder-controls, [draggable="true"]'), null);
});

test('parent notes mount without randomUUID and preserve a valid nonce when retrying a failed submission', async t => {
  const { root, fire, wait } = dom(t); const submitted = [];
  t.mock.method(crypto, 'randomUUID', () => { throw new Error('Insecure origin'); });
  t.mock.method(globalThis, 'fetch', async (_url, options) => {
    submitted.push(JSON.parse(options.body));
    return submitted.length === 1 ? Response.json({ error: 'unexpected_error' }, { status: 503 }) : Response.json({ ok: true });
  });
  const days = [{ date: '2026-09-22' }];
  render(html`<${ParentNoteForm} token="fixture-token" days=${days} selected=${days[0].date} lang="en"/>`, root);
  fire(root.querySelector('.note-launcher'), 'click'); await wait(() => root.querySelector('textarea'));
  const textarea = root.querySelector('textarea'); textarea.value = 'Please include more music.'; fire(textarea, 'input');
  await wait(() => !root.querySelector('[type="submit"]').disabled);
  fire(root.querySelector('form'), 'submit'); await wait(() => root.querySelector('[role="alert"]'));
  assert.doesNotThrow(() => validateParentNote(submitted[0], { days }));
  fire(root.querySelector('form'), 'submit'); await wait(() => root.querySelector('.note-sent'));
  assert.equal(submitted[0].nonce, submitted[1].nonce, 'retries identify the same note');
  assert.equal(root.querySelector('textarea').value, '');
});

test('weather controls use every canonical range, expose precipitation and add routines without randomUUID', t => {
  const { root, fire } = dom(t); let changed;
  const config = { materials: MATERIALS, preferenceBounds: PREFERENCE_BOUNDS };
  const value = structuredClone(DEFAULT_SETTINGS);
  const props = { value, config, lang: 'en', onChange: next => { changed = next; }, onConfirm: () => {} };
  render(html`<${SettingsForm} ...${props}/>`, root);
  const fields = [...root.querySelectorAll('.weather-preferences input')];
  assert.deepEqual(fields.map(field => field.name).sort(), Object.keys(PREFERENCE_BOUNDS).sort());
  for (const field of fields) {
    assert.equal(field.getAttribute('min'), String(PREFERENCE_BOUNDS[field.name].min));
    assert.equal(field.getAttribute('max'), String(PREFERENCE_BOUNDS[field.name].max));
    assert.equal(field.getAttribute('step'), 'any', 'fractional server preferences remain valid in the browser');
  }
  const precipitation = root.querySelector('#plan-maxPrecipitationMm'); let focused = false;
  precipitation.focus = () => { focused = true; };
  focusPlanField('maxPrecipitationMm');
  assert.equal(root.querySelector('.weather-preferences').open, true); assert.equal(focused, true);
  assert.equal(precipitation.value, String(value.preferences.maxPrecipitationMm));
  Object.defineProperty(precipitation, 'valueAsNumber', { value: 1.25 }); fire(precipitation, 'input');
  assert.equal(changed.preferences.maxPrecipitationMm, 1.25);
  t.mock.method(crypto, 'randomUUID', () => { throw new Error('Insecure origin'); });
  fire(root.querySelector('.routines-card > button'), 'click');
  assert.equal(changed.blocks.length, value.blocks.length + 1);
  assert.match(changed.blocks.at(-1).id, /^custom-[a-f0-9-]{36}$/);
  const varied = { ...config, preferenceBounds: { ...PREFERENCE_BOUNDS, maxWindKmh: { min: 7, max: 23 } } };
  render(html`<${SettingsForm} ...${props} config=${varied}/>`, root);
  assert.equal(root.querySelector('#plan-maxWindKmh').getAttribute('min'), '7');
  assert.equal(root.querySelector('#plan-maxWindKmh').getAttribute('max'), '23');
  const invalid = { ...value, preferences: { ...value.preferences, maxPrecipitationMm: PREFERENCE_BOUNDS.maxPrecipitationMm.max + 1 } };
  render(html`<${SettingsForm} ...${props} value=${invalid} issues=${[{ field: 'maxPrecipitationMm', key: 'checkWeatherPreferences' }]}/>`, root);
  const invalidField = root.querySelector('#plan-maxPrecipitationMm');
  assert.equal(invalidField.getAttribute('aria-invalid'), 'true');
  assert.match(invalidField.getAttribute('aria-describedby'), /error-maxPrecipitationMm/);
  assert.match(root.querySelector('#error-maxPrecipitationMm').textContent, /within the displayed range/);
});

test('parent sharing uses Skopje-local expiry dates and omits unsafe server links', t => {
  const { root } = dom(t);
  window.location = { href: 'https://kindergarten.test/#home', hostname: 'kindergarten.test' };
  const share = { path: '/#parents/fixture-token', expiresAt: '2026-09-06T22:45:00Z' };
  for (const lang of ['mk', 'en']) {
    render(html`<${ParentShare} share=${share} lang=${lang} onShare=${() => {}}/>`, root);
    assert.ok(root.textContent.includes(localizedDate(share.expiresAt, lang)));
    assert.equal(root.querySelector('.share-actions a').getAttribute('href'), 'https://kindergarten.test/#parents/fixture-token');
    assert.equal(root.querySelector('.share-actions a').getAttribute('rel'), 'noreferrer');
  }
  for (const path of ['javascript:alert(1)', 'data:text/html,bad', '//other.test']) {
    render(html`<${ParentShare} share=${{ ...share, path }} lang="en" onShare=${() => {}}/>`, root);
    assert.equal(root.querySelector('.share-actions a'), null);
    assert.equal(root.querySelector('.share-actions .primary').disabled, true);
    assert.equal(root.querySelector('.share-url').value, '');
  }
});

test('live air sources retain safe links and the calendar preserves five selectable weekdays and attribution', t => {
  const { root, fire } = dom(t); let selected;
  const environment = { mode: 'live', assessment: { valid: true, aqi: 20, pm25: 4, sensors: [] }, location: { pulseCity: 'skopje', name: 'Скопје', nameEn: 'Skopje' } };
  render(html`<${AirCard} environment=${environment} lang="en"/>`, root);
  assert.equal(root.querySelector('.source-details a').getAttribute('href'), 'https://skopje.pulse.eco/');
  render(html`<${AirCard} environment=${{ ...environment, location: { ...environment.location, pulseCity: '[bad' } }} lang="en"/>`, root);
  assert.equal(root.querySelector('.source-details a').getAttribute('href'), null);
  const days = ['21', '22', '23', '24', '25'].map(day => ({ date: `2026-09-${day}`, summary: { kind: 'clear', min: 12, max: 24 }, mode: 'inside' }));
  const data = { today: days[0].date, week: { days }, mode: 'live' };
  render(html`<${Calendar} data=${data} lang="en" selected=${days[0].date} onSelect=${date => { selected = date; }}/>`, root);
  assert.equal(root.querySelectorAll('.calendar-day').length, 5);
  assert.equal(root.querySelector('.calendar-caption a').getAttribute('href'), 'https://open-meteo.com/');
  fire(root.querySelector('.calendar-day:last-child'), 'click'); assert.equal(selected, days[4].date);
  render(html`<${Calendar} data=${{ ...data, mode: 'demo' }} lang="en" onSelect=${() => {}}/>`, root);
  assert.match(root.querySelector('.calendar-caption').textContent, /Sample forecast/);
});
