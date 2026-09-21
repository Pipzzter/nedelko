import test from 'node:test';
import assert from 'node:assert/strict';
import { checkCoverage, relativeLcov, CRITICAL_FILES } from '../lib/coverage.js';
import { localLinks } from '../lib/docs.js';
import { pushedCommits, assertPushMatchesHead } from '../lib/push.js';

const record = (source, hit, total = 100) => `SF:${source}\n${Array.from({ length: total }, (_, index) => `DA:${index + 1},${index < hit ? 1 : 0}`).join('\n')}\nend_of_record\n`;
const expected = ['backend/app.js', 'frontend/src/app.js'];
const inventory = [...expected, ...CRITICAL_FILES];
const criticalRecords = (hit = 100) => CRITICAL_FILES.map(path => record(path, hit)).join('');

test('coverage requires strictly above 90% in each layer and cannot hide an unimported file', () => {
  const passing = record(expected[0], 91) + record(expected[1], 91) + criticalRecords(91);
  assert.equal(checkCoverage(passing, inventory, '/repo').passed, true);
  assert.equal(checkCoverage(record(expected[0], 100) + record(expected[1], 90) + criticalRecords(), inventory, '/repo').passed, false);
  assert.equal(checkCoverage(record(expected[0], 90) + record(expected[1], 100) + criticalRecords(90), inventory, '/repo').passed, false);
  assert.throws(() => checkCoverage(passing, [...inventory, 'backend/forgotten.js'], '/repo'), /forgotten/);
  assert.throws(() => checkCoverage('', inventory, '/repo'), /omitted/);
  assert.throws(() => checkCoverage(passing + record(expected[0], 100), inventory, '/repo'), /Duplicate/);
  assert.throws(() => checkCoverage('SF:backend/app.js\nend_of_record', inventory, '/repo'), /Empty/);
  assert.equal(checkCoverage(record(expected[0], 100) + record(expected[1], 90, 99) + criticalRecords(), inventory, '/repo').passed, false, '90.91 cannot round up to 91');
  for (const path of CRITICAL_FILES) {
    assert.throws(() => checkCoverage(passing, inventory.filter(file => file !== path), '/repo'), /omitted critical/);
  }
});

test('coverage paths are relative for scanner containers and Windows separators normalize', () => {
  assert.equal(relativeLcov('SF:/repo/backend/app.js\nDA:1,1\n', '/repo'), 'SF:backend/app.js\nDA:1,1\n');
  const input = record('backend\\app.js', 100) + record('frontend\\src\\app.js', 100) + criticalRecords();
  assert.equal(checkCoverage(input, inventory, '/repo').passed, true);
});

test('critical module coverage cannot be hidden by a passing area total or rounded up', () => {
  const critical = 'backend/services/auth.js';
  const covered = record(expected[0], 2000, 2000) + record(expected[1], 100) + CRITICAL_FILES.filter(path => path !== critical).map(path => record(path, 100)).join('');
  const failed = checkCoverage(covered + record(critical, 89), inventory, '/repo');
  assert.equal(failed.groups.every(group => group.passed), true);
  assert.equal(failed.passed, false);
  assert.equal(failed.criticalFiles[0].path, critical);
  assert.equal(failed.criticalFiles[0].minimumLines, 90);
  assert.equal(checkCoverage(covered + record(critical, 90), inventory, '/repo').passed, true);
  const nearBoundary = checkCoverage(covered + record(critical, 899, 999), inventory, '/repo');
  assert.equal(nearBoundary.groups.every(group => group.passed), true);
  assert.equal(nearBoundary.passed, false, '89.99% must not round up to the critical 90% floor');
  const ordinary = 'backend/ordinary.js';
  assert.equal(checkCoverage(covered + record(critical, 100) + record(ordinary, 70), [...inventory, ordinary], '/repo').passed, true);
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
