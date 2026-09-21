import test from 'node:test';
import assert from 'node:assert/strict';
import { localizedDate, safeUuid, safeHref } from '../src/lib/ui.js';

test('Macedonian dates stay translated and use the Skopje date across midnight', () => {
  assert.equal(localizedDate('2026-09-07', 'mk', {day:'numeric',month:'long'}), '7 септември');
  assert.equal(localizedDate('2026-09-06T22:45:00Z', 'mk', {weekday:'long',day:'numeric',month:'long',hour:'2-digit',minute:'2-digit'}), 'понеделник, 7 септември, 00:45');
  assert.equal(localizedDate('2026-01-12T07:45:00Z', 'mk', {day:'numeric',month:'numeric',year:'numeric',hour:'2-digit',minute:'2-digit'}), '12.1.2026, 08:45');
  assert.equal(localizedDate('2026-09-07', 'en', {day:'numeric',month:'long'}), '7 September');
});

test('UI identifiers survive unavailable crypto methods and stay distinct with a frozen clock', t => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'crypto');
  t.after(() => Object.defineProperty(globalThis, 'crypto', descriptor));
  const nativeId = 'a1499dc6-85ec-48ba-8ba0-dbf0a63a0f92';
  Object.defineProperty(globalThis, 'crypto', { configurable: true, value: { randomUUID: () => nativeId } });
  assert.equal(safeUuid(), nativeId);
  Object.defineProperty(globalThis, 'crypto', { configurable: true, value: { getRandomValues: bytes => bytes.fill(171) } });
  assert.equal(safeUuid(), 'abababab-abab-4bab-abab-abababababab');
  Object.defineProperty(globalThis, 'crypto', { configurable: true, value: undefined });
  t.mock.method(Date, 'now', () => 1790078400000);
  const first = safeUuid(); const second = safeUuid();
  assert.match(first, /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/);
  assert.notEqual(first, second);
});

test('server links allow HTTP(S) and same-origin root paths but reject executable and ambiguous URLs', () => {
  for (const url of ['https://example.test/calendar', 'http://example.test/', 'HTTPS://example.test/']) assert.equal(safeHref(url), new URL(url).href);
  for (const url of ['/#parents/token', '/calendar.pdf', '#day']) assert.equal(safeHref(url), url);
  for (const url of ['javascript:alert(1)', 'data:text/html,<script>alert(1)</script>', 'file:///etc/passwd', '//other.test', '/\\other.test', 'https://[bad', 'https://example.test/\npath', ' https://example.test/', 'http:example.test', '', null, {}]) assert.equal(safeHref(url), undefined);
});
