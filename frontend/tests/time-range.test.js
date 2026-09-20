import test from 'node:test';
import assert from 'node:assert/strict';
import { parseTimeRange } from '../src/lib/time-range.js';

test('friendly time ranges normalize without accepting ambiguous or invalid clock values', () => {
  for (const input of ['7:30 - 8:30', '07:30-08:30', ' 7:30 – 08:30 ']) assert.deepEqual(parseTimeRange(input), { start: '07:30', end: '08:30' });
  for (const input of ['7:3 - 8:30', '24:00 - 25:00', '8:30 - 7:30', '8:30 - 8:30', '7:60 - 8:30', '7:30 AM - 8:30 AM', 'tomorrow', '7:30 - 8:30 delete everything']) assert.equal(parseTimeRange(input), null);
});
