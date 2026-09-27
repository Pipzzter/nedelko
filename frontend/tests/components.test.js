import test from 'node:test';
import assert from 'node:assert/strict';
import { parseHTML } from 'linkedom';
import { html, render, localizedDate } from '../src/lib/ui.js';
import { WeekActions } from '../src/components/WeekActions.js';
import { PairInput, SettingsForm, MaterialPicker } from '../src/components/SettingsForm.js';
import { ParentNoteForm } from '../src/components/ParentNoteForm.js';
import { ParentShare } from '../src/components/ParentShare.js';
import { AirCard } from '../src/components/AirCard.js';
import { Calendar } from '../src/components/Calendar.js';
import { Occasions } from '../src/components/Holidays.js';
import { PlanChanges } from '../src/components/PlanChanges.js';
import { Auth } from '../src/pages/Auth.js';
import { focusPlanField } from '../src/lib/plan-form.js';
import { LOCATIONS } from '../../backend/config/index.js';
import { ActivityEditor } from '../src/components/ActivityEditor.js';
import { DayPlan } from '../src/components/DayPlan.js';
import { DEFAULT_SETTINGS, MATERIALS } from '../../backend/domain/settings.js';
import { localCurriculum } from '../../backend/domain/curriculum.js';
import { PREFERENCE_BOUNDS } from '../../backend/domain/preferences.js';
import { validateParentNote } from '../../backend/domain/parent-notes.js';
import { ParentNotes } from '../src/components/ParentNotes.js';
import { DemoIntro } from '../src/components/DemoIntro.js';
import { AppBoundary } from '../src/components/AppBoundary.js';

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

test('a rendering failure offers a bilingual recovery control without exposing raw exception text', async t => {
  const { root, fire, wait } = dom(t); let broken = true;
  const Child = () => { if (broken) throw new Error('PRIVATE-RESPONSE'); return html`<p>Recovered</p>`; };
  render(html`<${AppBoundary}><${Child}/></${AppBoundary}>`, root);
  await wait(() => root.querySelector('[role=alert]'));
  assert.doesNotMatch(root.textContent, /PRIVATE/);
  broken = false; fire(root.querySelector('button'), 'click');
  await wait(() => root.textContent.includes('Recovered'));
});

test('live AQI expires without a refresh, keeps its measurement time, and demo readings use the example clock', async t => {
  const { root, fire, wait } = dom(t);
  const instant = Date.parse('2026-09-21T06:45:00Z');
  t.mock.timers.enable({ apis: ['Date'], now: instant });
  const environment = { mode: 'live', clock: new Date().toISOString(), freshnessMinutes: 60,
    assessment: { valid: true, aqi: 72, pm25: 20, oldestObservation: new Date(instant - 59 * 60000).toISOString() },
    location: LOCATIONS[0] };
  const paint = e => render(html`<${AirCard} environment=${e} lang="en"/>`, root);
  paint(environment); await wait(() => root.querySelector('.air-moderate'));
  const stamp = root.querySelector('.data-label').textContent;
  t.mock.timers.setTime(instant + 60001); fire(document, 'visibilitychange');
  await wait(() => root.querySelector('.air-unknown'));
  assert.doesNotMatch(root.querySelector('.air-reading').textContent, /72/);
  assert.equal(root.querySelector('.data-label').textContent, stamp);
  paint({ ...environment, mode: 'demo' });
  assert.ok(root.querySelector('.air-moderate'));
  paint({ ...environment, mode: 'demo', failedRefresh: true });
  assert.ok(root.querySelector('.air-unknown'));
});

test('an older inbox poll cannot undo marking a note read or populate another demo inbox', async t => {
  const { root, fire, wait } = dom(t); let poll; let release; let hold = false;
  const note = { id: 'note-1', text: 'Please bring paper', createdAt: '2026-09-21T06:00:00Z', readAt: null };
  const unread = { notes: [note], unread: 1 }; const read = { notes: [{ ...note, readAt: note.createdAt }], unread: 0 };
  t.mock.method(globalThis, 'setInterval', callback => { poll = callback; return 100; });
  t.mock.method(globalThis, 'clearInterval', () => {});
  t.mock.method(globalThis, 'fetch', async path => {
    if (path.endsWith('/read')) return Response.json(read);
    if (hold) { hold = false; return new Promise(resolve => { release = () => resolve(Response.json(unread)); }); }
    return Response.json(path.includes('second') ? { notes: [], unread: 0 } : unread);
  });
  const paint = id => render(html`<${ParentNotes} demoId=${id} week=${{ weekStart: '2026-09-21' }} lang="en"/>`, root);
  paint('first'); await wait(() => root.querySelector('.inbox-note.unread'));
  hold = true; poll(); await wait(() => release);
  fire(root.querySelector('.note-summary'), 'click');
  await wait(() => root.querySelector('.unread-count').textContent === '0');
  release(); release = null; await new Promise(resolve => setTimeout(resolve, 20));
  assert.equal(root.querySelector('.unread-count').textContent, '0');
  hold = true; poll(); await wait(() => release);
  paint('second'); await wait(() => root.querySelector('.notes-empty'));
  release(); await new Promise(resolve => setTimeout(resolve, 20));
  assert.equal(root.querySelector('.inbox-note'), null);
});

test('welcome dialog traps keyboard focus, dismisses with Escape and restores the underlying control', async t => {
  const { root, fire, wait } = dom(t); let active = document.body; let closed = 0; let left = 0;
  Object.defineProperty(document, 'activeElement', { configurable: true, get: () => active });
  t.mock.method(window.HTMLElement.prototype, 'focus', function () { active = this; });
  const paint = open => render(html`<main><button>Underlying control</button></main>${open && html`<${DemoIntro} lang="en"
    onClose=${() => { closed++; paint(false); }} onLeave=${() => { left++; paint(false); }}/>`}`, root);
  paint(false); const previous = root.querySelector('main button'); previous.focus();
  paint(true); await wait(() => root.querySelector('main').hasAttribute('inert'));
  const buttons = [...root.querySelectorAll('.modal-actions button')];
  const dialog = root.querySelector('.modal-overlay');
  assert.equal(document.activeElement, buttons[0]);
  assert.equal(fire(dialog, 'keydown', { key: 'Tab', shiftKey: true }).defaultPrevented, true);
  assert.equal(document.activeElement, buttons[1]);
  fire(dialog, 'keydown', { key: 'Tab' }); assert.equal(document.activeElement, buttons[0]);
  fire(dialog, 'keydown', { key: 'Escape' });
  assert.equal(closed, 1); assert.equal(document.activeElement, previous);
  assert.equal(root.querySelector('main').hasAttribute('inert'), false);
  paint(true); await wait(() => document.activeElement !== previous);
  fire(root.querySelector('.modal-actions .secondary'), 'click'); assert.equal(left, 1);
});

test('teachers add and select a custom classroom tool with Enter without submitting the plan', async t => {
  const { root, fire, wait } = dom(t);
  let value = structuredClone(DEFAULT_SETTINGS);
  const paint = () => render(html`<${MaterialPicker} value=${value} config=${{ materials: MATERIALS }} lang="en"
    onChange=${next => { value = next; paint(); }}/>`, root);
  paint();
  const input = root.querySelector('#new-material');
  assert.equal(root.querySelector('button').disabled, true);
  input.value = 'Magnifying glasses'; fire(input, 'input');
  await wait(() => !root.querySelector('button').disabled);
  const event = fire(input, 'keydown', { key: 'Enter' });
  assert.equal(event.defaultPrevented, true);
  await wait(() => value.customMaterials.length === 1);
  const custom = value.customMaterials[0];
  assert.ok(value.materials.includes(custom.id));
  assert.equal(custom.label.en, 'Magnifying glasses');
  assert.equal(root.querySelector('#new-material').value, '');
  input.value = 'Magnifying glasses'; fire(input, 'input');
  await wait(() => !root.querySelector('button').disabled);
  fire(root.querySelector('button'), 'click');
  assert.equal(value.customMaterials.length, 1, 'adding an existing name selects the same tool');
  const checkbox = root.querySelector(`input[value="${custom.id}"]`);
  checkbox.checked = false; fire(checkbox, 'change');
  assert.equal(value.materials.includes(custom.id), false);
  assert.ok(root.querySelector(`input[value="${custom.id}"]`), 'unselected custom tools stay available');
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
  assert.equal(root.querySelector('input[name=email]').type, 'text');
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

test('teacher and parent activity details select the row variant, including the matching indoor backup', t => {
  const { root } = dom(t); const day = editableDay();
  const row = day.timeline.find(row => row.kind === 'eco');
  row.note = { mk: 'Излегуваме во дворот.', en: 'Go into the yard.' };
  row.variants = { inside: { mk: 'Градиме на масата.', en: 'Build at the table.' },
    outside: { mk: 'Градиме во дворот.', en: 'Build in the yard.' } };
  for (const readOnly of [false, true]) for (const lang of ['mk', 'en']) for (const mode of ['inside', 'outside']) {
    render(html`<${DayPlan} day=${{ ...day, mode }} data=${{ today: '2026-09-21', week: { settings: DEFAULT_SETTINGS } }}
      clock="2026-09-21T06:00:00Z" lang=${lang} materials=${MATERIALS} readOnly=${readOnly}/>`, root);
    assert.equal(root.querySelector('.activity-summary').textContent, row.variants[mode][lang]);
    assert.ok(!root.querySelector('.activity-summary').textContent.includes(row.note[lang]));
    if (mode === 'outside') assert.ok(root.querySelector('.indoor-backup').textContent.includes(row.variants.inside[lang]));
  }
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

test('empty upcoming days retain the prompt so a teacher can add activities again', async t => {
  const { root, fire, wait } = dom(t);
  const day = { ...editableDay(), timeline: [] };
  render(html`<${DayPlan} day=${day} data=${{ today: '2026-09-21', week: { settings: DEFAULT_SETTINGS } }}
    clock="2026-09-21T06:00:00Z" lang="en" materials=${MATERIALS} onSuggest=${async () => ({ proposalId: 'test' })} onApply=${async () => true}/>`, root);
  assert.equal(root.querySelector('.timeline li'), null);
  fire(root.querySelector('.change-schedule button'), 'click');
  await wait(() => root.querySelector('.change-schedule textarea'));
  assert.equal(root.querySelector('.schedule-editor, .place-options'), null);
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

test('calendar shows saved and historical temperatures with bilingual provenance and no false loading state', t => {
  const { root } = dom(t);
  const days = ['21', '22', '23', '24', '25'].map((day, index) => ({ date: `2026-09-${day}`, mode: 'inside',
    summary: { min: null, max: null, kind: 'unknown' },
    weatherDisplay: { min: index === 4 ? null : 0, max: index === 4 ? null : 18, kind: 'cloud',
      status: ['historical', 'cached', 'forecast', 'demo', 'unavailable'][index], fetchedAt: index === 4 ? null : '2026-09-22T05:00:00Z' } }));
  for (const lang of ['en', 'mk']) {
    render(html`<${Calendar} data=${{ week: { days }, mode: 'live' }} lang=${lang} onSelect=${() => {}}/>`, root);
    const tiles = [...root.querySelectorAll('.calendar-day')];
    assert.match(tiles[0].querySelector('.day-temperatures').textContent, /18°\s+0°/);
    assert.equal(tiles[0].querySelector('.weather-status').textContent, lang === 'en' ? 'Past weather' : 'Минати податоци');
    assert.equal(tiles[1].querySelector('.weather-status').textContent, lang === 'en' ? 'Saved weather' : 'Зачувани');
    assert.match(tiles[1].querySelector('.weather-status').title, /07:00/);
    assert.match(tiles[1].getAttribute('aria-label'), lang === 'en' ? /Saved weather/ : /Зачувани/);
    assert.equal(tiles[2].querySelector('.weather-status').textContent, '');
    assert.equal(tiles[2].querySelector('.weather-status').getAttribute('aria-hidden'), 'true');
    assert.equal(tiles[4].querySelector('.weather-status').textContent, lang === 'en' ? 'No forecast' : 'Без прогноза');
  }
  const legacy = days.map(({ weatherDisplay, ...day }) => day);
  render(html`<${Calendar} data=${{ week: { days: legacy }, calendar: days }} lang="en" onSelect=${() => {}}/>`, root);
  assert.match(root.querySelector('.day-temperatures').textContent, /18°/);
});

test('holiday labels distinguish public, community and optional classroom occasions in both languages', t => {
  const { root } = dom(t);
  const date = '2026-09-21';
  const occasions = [
    { id: 'public', date, kind: 'public', name: { mk: 'Државен празник', en: 'Public occasion' } },
    { id: 'community', date, kind: 'community', scope: 'orthodox', name: { mk: 'Верски празник', en: 'Community occasion' } },
    { id: 'classroom', date, kind: 'classroom', name: { mk: 'Ден на играта', en: 'Play day' } }
  ];
  for (const [lang, labels] of [
    ['en', ['Public holiday for all citizens', 'Holiday for: Orthodox Christians', 'Optional theme, not a public holiday']],
    ['mk', ['Неработен ден за сите граѓани', 'Празник за: православни верници', 'Изборна тема, не државен празник']]
  ]) {
    render(html`<${Occasions} day=${{ date, occasions }} lang=${lang}/>`, root);
    const notes = [...root.querySelectorAll('.occasion-note')];
    assert.equal(notes.length, 3);
    notes.forEach((note, index) => {
      assert.equal(note.querySelector('b').textContent, occasions[index].name[lang]);
      assert.ok(note.querySelector('span').textContent.includes(labels[index]));
      assert.ok(note.querySelector('span').textContent.includes(localizedDate(date, lang, { day: 'numeric', month: 'numeric' })));
    });
  }
});

test('holiday preparation identifies the event date and escapes its title without leaving empty badges', t => {
  const { root } = dom(t);
  const event = { id: 'future', date: '2026-09-22', kind: 'classroom', name: { mk: '<b>Игра</b>', en: '<b>Play</b>' } };
  for (const [lang, prefix] of [['mk', 'Подготовка за: '], ['en', 'Preparing for: ']]) {
    for (const day of [
      { date: '2026-09-21', preparationFor: event },
      { date: '2026-09-21', occasions: [event] },
      { date: event.date, preparationFor: event }
    ]) {
      render(html`<${Occasions} day=${day} lang=${lang}/>`, root);
      assert.equal(root.querySelector('.occasion-note b').textContent, prefix + event.name[lang]);
      assert.equal(root.querySelector('.occasion-note b b'), null, 'event text cannot become markup');
      assert.ok(root.querySelector('span').textContent.includes(localizedDate(event.date, lang, { day: 'numeric', month: 'numeric' })));
    }
    for (const day of [{ date: event.date }, { date: event.date, occasions: [] }]) {
      render(html`<${Occasions} day=${day} lang=${lang}/>`, root);
      assert.equal(root.textContent, '');
      assert.equal(root.querySelector('.day-occasions'), null);
    }
  }
});

test('same-day plan changes announce unknown evidence and keep replacement days provisional', t => {
  const { root, fire } = dom(t); const selected = [];
  const changes = [{ from: '2026-09-21', to: '2026-09-23', reason: 'unknown_air' }];
  for (const [lang, expected] of [
    ['en', ['Today is an indoor day.', 'Fresh local readings are unavailable. The plan stays indoors.', 'Suggested outdoor day, provisional', 'A check that morning is still required.', 'Wednesday']],
    ['mk', ['Денес е ден за активности внатре.', 'Нема потврдени свежи мерења. Планот останува внатре.', 'Предлог за друг ден надвор, привремено', 'Потребна е проверка тоа утро.', 'среда']]
  ]) {
    render(html`<${PlanChanges} changes=${changes} today="2026-09-21" lang=${lang} onSelect=${date => selected.push(date)}/>`, root);
    assert.equal(root.querySelector('section').getAttribute('role'), 'alert');
    for (const text of expected) assert.ok(root.textContent.includes(text), text);
    const button = root.querySelector('button');
    assert.equal(button.getAttribute('type'), 'button');
    fire(button, 'click');
    assert.equal(selected.at(-1), changes[0].to);
  }
  assert.equal(selected.length, 2);
});

test('future and read-only plan changes retain the reason and morning-check requirement without edit controls', t => {
  const { root } = dom(t);
  const changes = [
    { from: '2026-09-22', to: '2026-09-23', reason: 'weather' },
    { from: '2026-09-24', to: null, reason: 'unknown_air' }
  ];
  for (const [lang, expected] of [
    ['en', ['Tuesday: Activities have moved indoors.', 'An indoor activity is prepared because of the weather conditions.', 'Wednesday', 'A check that morning is still required.', 'No suitable replacement day is available yet.']],
    ['mk', ['вторник: Активностите се префрлени внатре.', 'Поради временските услови, подготвена е активноста внатре.', 'среда', 'Потребна е проверка тоа утро.', 'Засега нема соодветен заменски ден.']]
  ]) {
    render(html`<${PlanChanges} changes=${changes} today="2026-09-21" lang=${lang}/>`, root);
    assert.equal(root.querySelector('section').getAttribute('role'), 'status');
    assert.equal(root.querySelectorAll('.day-change').length, 2);
    assert.equal(root.querySelector('button, a'), null);
    for (const text of expected) assert.ok(root.textContent.includes(text), text);
    render(html`<${PlanChanges} today="2026-09-21" lang=${lang}/>`, root);
    assert.equal(root.textContent, '');
    assert.equal(root.querySelector('section'), null);
  }
});
