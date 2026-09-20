import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export function openStore(filename = fileURLToPath(new URL('../../.local/ekocuvar.sqlite', import.meta.url))) {
  if (filename !== ':memory:') mkdirSync(dirname(filename), { recursive: true });
  const db = new DatabaseSync(filename);
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY, username TEXT NOT NULL UNIQUE, display_name TEXT NOT NULL,
      password_hash TEXT NOT NULL, created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sessions (
      token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS weeks (
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      week_start TEXT NOT NULL, payload TEXT NOT NULL, revision INTEGER NOT NULL,
      PRIMARY KEY(user_id, week_start)
    );
    CREATE TABLE IF NOT EXISTS group_profiles (
      user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE, settings TEXT NOT NULL
    );
`);
  return {
    db,
    userByName: username => db.prepare('SELECT * FROM users WHERE username = ?').get(username),
    addUser(user) { db.prepare('INSERT INTO users VALUES (?, ?, ?, ?, ?)').run(user.id, user.username, user.displayName, user.hash, Date.now()); },
    createSession(hash, userId, expiresAt) {
      db.prepare('DELETE FROM sessions WHERE expires_at <= ?').run(Date.now());
      db.prepare('INSERT INTO sessions VALUES (?, ?, ?)').run(hash, userId, expiresAt);
    },
    session(hash, now = Date.now()) { return db.prepare(`SELECT u.id, u.username, u.display_name AS displayName
      FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ? AND s.expires_at > ?`).get(hash, now); },
    deleteSession(hash) { db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(hash); },
    profile(userId) {
      const row = db.prepare('SELECT settings FROM group_profiles WHERE user_id = ?').get(userId);
      return row ? JSON.parse(row.settings) : null;
    },
    saveProfile(userId, settings) {
      db.prepare('INSERT INTO group_profiles VALUES (?, ?) ON CONFLICT(user_id) DO UPDATE SET settings = excluded.settings')
        .run(userId, JSON.stringify(settings));
    },
    week(userId, start) {
      const row = db.prepare('SELECT payload, revision FROM weeks WHERE user_id = ? AND week_start = ?').get(userId, start);
      return row && row.payload !== 'null' ? { ...JSON.parse(row.payload), revision: row.revision } : null;
    },
    saveWeek(userId, week, expectedRevision) {
      const payload = JSON.stringify({ ...week, revision: undefined });
      if (expectedRevision === 0) {
        const result = db.prepare(`INSERT INTO weeks VALUES (?, ?, ?, 1)
          ON CONFLICT(user_id, week_start) DO UPDATE SET payload = excluded.payload, revision = weeks.revision + 1
          WHERE weeks.payload = 'null' RETURNING revision`).get(userId, week.weekStart, payload);
        return result ? { ...week, revision: result.revision } : null;
      }
      const result = db.prepare('UPDATE weeks SET payload = ?, revision = revision + 1 WHERE user_id = ? AND week_start = ? AND revision = ?')
        .run(payload, userId, week.weekStart, expectedRevision);
      return result.changes ? { ...week, revision: expectedRevision + 1 } : null;
    },
    deleteWeek(userId, start, expectedRevision) {
      // Keep only the revision as a tombstone, so stale tabs cannot edit a regenerated week.
      const removed = !!db.prepare("UPDATE weeks SET payload = 'null', revision = revision + 1 WHERE user_id = ? AND week_start = ? AND revision = ? AND payload != 'null'")
        .run(userId, start, expectedRevision).changes;
      return removed;
    },
    close() { db.close(); },
  };
}
