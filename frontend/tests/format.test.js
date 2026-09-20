import test from 'node:test';
import assert from 'node:assert/strict';
import { localizedDate } from '../src/lib/ui.js';

test('Macedonian dates stay translated and use the Skopje date across midnight', () => {
  assert.equal(localizedDate('2026-09-07', 'mk', {day:'numeric',month:'long'}), '7 септември');
  assert.equal(localizedDate('2026-09-06T22:45:00Z', 'mk', {weekday:'long',day:'numeric',month:'long',hour:'2-digit',minute:'2-digit'}), 'понеделник, 7 септември, 00:45');
  assert.equal(localizedDate('2026-01-12T07:45:00Z', 'mk', {day:'numeric',month:'numeric',year:'numeric',hour:'2-digit',minute:'2-digit'}), '12.1.2026, 08:45');
  assert.equal(localizedDate('2026-09-07', 'en', {day:'numeric',month:'long'}), '7 September');
});
