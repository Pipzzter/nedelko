import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, rmdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { databaseFilename, openStore } from '../storage/database.js';
import { register, createSession, tokenHash } from '../services/auth.js';
import { randomUUID } from 'node:crypto';

test('Nedelko selects a new database or preserves an existing account store without guessing between files', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'nedelko-database-name-'));
  const previous = join(directory, 'previous.sqlite');
  const second = join(directory, 'second.sqlite');
  const preferred = join(directory, 'nedelko.sqlite');
  t.after(async () => {
    for (const filename of [previous, second, preferred]) {
      for (const suffix of ['', '-wal', '-shm']) await rm(filename + suffix, { force: true });
    }
    await rmdir(directory);
  });
  assert.equal(databaseFilename(join(directory, 'new-installation'), ''), join(directory, 'new-installation', 'nedelko.sqlite'));
  assert.equal(databaseFilename(directory, ''), preferred);
  assert.equal(databaseFilename(directory, `  ${previous}  `), previous);
  let store = openStore(previous);
  store.addUser({ id: 'owner', username: 'owner@example.test', displayName: 'Synthetic owner', hash: 'fixture' });
  store.saveWeek('owner', { weekStart: '2026-09-21', days: [], marker: 'preserved-private-plan' }, 0);
  store.close();
  assert.equal(databaseFilename(directory, ''), previous);
  store = openStore(databaseFilename(directory, ''));
  assert.equal(store.week('owner', '2026-09-21').marker, 'preserved-private-plan');
  assert.equal(store.week('another-owner', '2026-09-21'), null);
  store.close();
  openStore(second).close();
  assert.throws(() => databaseFilename(directory, ''), /NEDELKO_DATABASE_PATH/);
  assert.equal(databaseFilename(directory, previous), previous);
  openStore(preferred).close();
  assert.equal(databaseFilename(directory, ''), preferred);
  assert.throws(() => databaseFilename(previous, ''));
});

test('accounts, session hashes and private plans persist after closing and reopening SQLite', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'nedelko-storage-test-'));
  const filename = join(directory, 'test.sqlite'); let store = openStore(filename);
  t.after(async () => {
    store.close();
    // Only the explicit files created by this test are removed, without recursive deletion.
    for (const suffix of ['', '-wal', '-shm']) await rm(filename + suffix, { force: true });
    await rmdir(directory);
  });
  const user = await register(store, { email: 'persistence@test.mk', password: 'OnlyForAutomatedTests23', displayName: 'Test fixture', kindergarten: 'Persistence kindergarten', ageGroup: '4-5', locationId: 'centar' });
  const cookie = createSession(store, user); const token = cookie.match(/nedelko_session=([a-f0-9]+)/)[1];
  store.saveWeek(user.id, { weekStart: '2026-09-21', days: [], marker: 'private-fixture' }, 0);
  const noteId = store.addParentNote(user.id, '2026-09-21', { date: null, text: 'A synthetic persistent note.', nonce: randomUUID() });
  store.close(); store = openStore(filename);
  assert.equal(store.userByName(user.email).id, user.id);
  assert.equal(store.session(tokenHash(token)).email, user.email);
  assert.equal(store.profile(user.id).groupName, 'Persistence kindergarten');
  assert.equal(store.week(user.id, '2026-09-21').marker, 'private-fixture');
  assert.equal(store.week('another-account', '2026-09-21'), null);
  assert.equal(store.parentNotes(user.id, '2026-09-21')[0].id, noteId);
  assert.equal(store.parentNotes('another-account', '2026-09-21').length, 0);
  assert.equal(store.session(tokenHash(token), Date.now() + 8 * 86400000), undefined);
});

test('read refresh persists notice invalidation without changing revision or crossing owners and tombstones', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'nedelko-refresh-test-'));
  const filename = join(directory, 'test.sqlite'); let store = openStore(filename);
  t.after(async () => {
    store.close();
    for (const suffix of ['', '-wal', '-shm']) await rm(filename + suffix, { force: true });
    await rmdir(directory);
  });
  for (const id of ['owner', 'other']) store.addUser({ id, username: id, displayName: id, hash: 'test-only' });
  const original = { weekStart: '2026-09-21', days: [], approval: { at: '2026-09-21T06:45:00Z' }, checkedAt: '2026-09-21T06:45:00Z' };
  const owned = store.saveWeek('owner', original, 0);
  const other = store.saveWeek('other', { ...original, marker: 'other-account' }, 0);
  const cleared = { ...owned, approval: null, checkedAt: null, checkedDate: null };
  assert.equal(store.refreshWeek('missing', cleared, owned.revision), null);
  assert.equal(store.refreshWeek('owner', { ...cleared, weekStart: '2026-09-28' }, owned.revision), null);
  assert.equal(store.refreshWeek('owner', cleared, owned.revision + 1), null);
  const refreshed = store.refreshWeek('owner', cleared, owned.revision);
  assert.deepEqual(refreshed, cleared); assert.deepEqual(store.week('other', original.weekStart), other);
  store.close(); store = openStore(filename);
  assert.deepEqual(store.week('owner', original.weekStart), cleared, 'cleared approval survives restart');
  const edited = store.saveWeek('owner', { ...cleared, marker: 'teacher-edit' }, owned.revision);
  assert.equal(edited.revision, owned.revision + 1);
  assert.equal(store.refreshWeek('owner', cleared, owned.revision), null);
  assert.deepEqual(store.week('owner', original.weekStart), edited);
  assert.equal(store.deleteWeek('owner', original.weekStart, edited.revision), true);
  assert.equal(store.refreshWeek('owner', cleared, edited.revision + 1), null);
  assert.equal(store.week('owner', original.weekStart), null);
  assert.deepEqual(store.week('other', original.weekStart), other);
});
