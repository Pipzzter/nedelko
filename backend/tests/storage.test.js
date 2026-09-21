import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, rmdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openStore } from '../storage/database.js';
import { register, createSession, tokenHash } from '../services/auth.js';
import { randomUUID } from 'node:crypto';

test('accounts, session hashes and private plans persist after closing and reopening SQLite', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'ekocuvar-storage-test-'));
  const filename = join(directory, 'test.sqlite'); let store = openStore(filename);
  t.after(async () => {
    store.close();
    // Only the explicit files created by this test are removed, without recursive deletion.
    for (const suffix of ['', '-wal', '-shm']) await rm(filename + suffix, { force: true });
    await rmdir(directory);
  });
  const user = await register(store, { email: 'persistence@test.mk', password: 'OnlyForAutomatedTests23', displayName: 'Test fixture', kindergarten: 'Persistence kindergarten', ageGroup: '4-5', locationId: 'centar' });
  const cookie = createSession(store, user); const token = cookie.match(/eko_session=([a-f0-9]+)/)[1];
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
