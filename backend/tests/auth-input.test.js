import test from 'node:test';
import assert from 'node:assert/strict';
import { credentials } from '../services/auth.js';

test('registration normalizes addresses and rejects missing or repeated separators and embedded whitespace', () => {
  const password = 'synthetic-password';
  for (const [email, expected] of [
    [' Teacher+group@School.Example ', 'teacher+group@school.example'],
    ['teacher@sub.school.example', 'teacher@sub.school.example'],
    ['teacher@градинка.мк', 'teacher@градинка.мк'],
    ['ｔｅａｃｈｅｒ＠ｓｃｈｏｏｌ．ｅｘａｍｐｌｅ', 'teacher@school.example']
  ]) assert.equal(credentials({ email, password }, true).email, expected);
  for (const email of [
    'teacher@example', 'teacher@.example', 'teacher@example.', '@example.com',
    'teacher@@example.com', 'teacher name@example.com', 'teacher@exam ple.com',
    'teacher@exam\nple.com', 'x'.repeat(255) + '@example.com'
  ]) assert.throws(() => credentials({ email, password }, true), { code: 'email_format' });
  assert.equal(credentials({ email: 'legacy-teacher', password }, false).email, 'legacy-teacher');
});
