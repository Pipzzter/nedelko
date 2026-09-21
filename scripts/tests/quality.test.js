import test from 'node:test';
import assert from 'node:assert/strict';
import { checkCoverage, relativeLcov } from '../lib/coverage.js';
import { localLinks } from '../lib/docs.js';
import { pushedCommits, assertPushMatchesHead } from '../lib/push.js';

const record = (source, hit, total = 100) => `SF:${source}\n${Array.from({ length: total }, (_, index) => `DA:${index + 1},${index < hit ? 1 : 0}`).join('\n')}\nend_of_record\n`;
const expected = ['backend/app.js', 'frontend/src/app.js'];

test('coverage requires strictly above 90% in each layer and cannot hide an unimported file', () => {
  const passing = record(expected[0], 91) + record(expected[1], 91);
  assert.equal(checkCoverage(passing, expected, '/repo').passed, true);
  assert.equal(checkCoverage(record(expected[0], 100) + record(expected[1], 90), expected, '/repo').passed, false);
  assert.equal(checkCoverage(record(expected[0], 90) + record(expected[1], 100), expected, '/repo').passed, false);
  assert.throws(() => checkCoverage(passing, [...expected, 'backend/forgotten.js'], '/repo'), /forgotten/);
  assert.throws(() => checkCoverage('', expected, '/repo'), /omitted/);
  assert.throws(() => checkCoverage(passing + record(expected[0], 100), expected, '/repo'), /Duplicate/);
  assert.throws(() => checkCoverage('SF:backend/app.js\nend_of_record', expected, '/repo'), /Empty/);
  assert.equal(checkCoverage(record(expected[0], 90, 99) + record(expected[1], 100), expected, '/repo').passed, false, '90.91 cannot round up to 91');
});

test('coverage paths are relative for scanner containers and Windows separators normalize', () => {
  assert.equal(relativeLcov('SF:/repo/backend/app.js\nDA:1,1\n', '/repo'), 'SF:backend/app.js\nDA:1,1\n');
  const input = record('backend\\app.js', 100) + record('frontend\\src\\app.js', 100);
  assert.equal(checkCoverage(input, expected, '/repo').passed, true);
});

test('pushes validate every source tip, allow annotated tags at HEAD and identify deletion-only pushes', () => {
  const head = 'a'.repeat(40); const other = 'b'.repeat(40); const zero = '0'.repeat(40);
  assert.deepEqual(pushedCommits(`refs/heads/main ${head} refs/heads/main ${zero}\nrefs/heads/old ${zero} refs/heads/old ${other}`), [head]);
  assert.deepEqual(pushedCommits(`(delete) ${zero} refs/heads/old ${other}`), []);
  assert.throws(() => pushedCommits('malformed'), /Invalid/);
  assert.doesNotThrow(() => assertPushMatchesHead([head, other], head, '', () => head));
  assert.throws(() => assertPushMatchesHead([other], head, '', value => value), /checked-out HEAD/);
  for (const status of [' M backend/app.js', '?? new-file.js']) assert.throws(() => assertPushMatchesHead([head], head, status, value => value), /commit or stash/);
});

test('local link checks find Markdown and HTML paths but ignore URLs, anchors and code examples', () => {
  assert.deepEqual(localLinks('[Guide](guide.md#usage) <img src="assets/logo.svg"> [Web](https://example.com) [Here](#anchor) `x [fake](missing)`\n```md\n[x](missing)\n```'), ['guide.md', 'assets/logo.svg']);
});
