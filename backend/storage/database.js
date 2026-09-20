import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';
import { parentNoteStore } from './parent-notes.js';

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
    CREATE TABLE IF NOT EXISTS parent_links (
      token TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      week_start TEXT NOT NULL, expires_at INTEGER NOT NULL, UNIQUE(user_id, week_start)
    );`);
  return {
    ...parentNoteStore(db),
    db,
    userByName: username => db.prepare('SELECT * FROM users WHERE username = ?').get(username),
    addUser(user) { db.prepare('INSERT INTO users VALUES (?, ?, ?, ?, ?)').run(user.id, user.username, user.displayName, user.hash, Date.now()); },
    createSession(hash, userId, expiresAt) {
      db.prepare('DELETE FROM sessions WHERE expires_at <= ?').run(Date.now());
      db.prepare('INSERT INTO sessions VALUES (?, ?, ?)').run(hash, userId, expiresAt);
    },
    session(hash, now = Date.now()) { return db.prepare(`SELECT u.id, u.username AS email, u.display_name AS displayName
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
    sharing(userId, start, now = Date.now()) {
      const row = db.prepare('SELECT token, expires_at FROM parent_links WHERE user_id = ? AND week_start = ? AND expires_at > ?').get(userId, start, now);
      return row ? { path: `/#parents/${row.token}`, expiresAt: new Date(row.expires_at).toISOString() } : null;
    },
    shareWeek(userId, start) {
      const existing = this.sharing(userId, start);
      if (existing) return existing;
      // Renewal retains the URL. Only explicit revocation/deletion retires a token.
      const saved = db.prepare('SELECT token FROM parent_links WHERE user_id = ? AND week_start = ?').get(userId, start);
      const token = saved?.token || randomBytes(32).toString('hex');
      db.prepare('INSERT INTO parent_links VALUES (?, ?, ?, ?) ON CONFLICT(user_id, week_start) DO UPDATE SET token = excluded.token, expires_at = excluded.expires_at')
        .run(token, userId, start, Date.now() + 14 * 86400000);
      return this.sharing(userId, start);
    },
    revokeShare(userId, start) { db.prepare('DELETE FROM parent_links WHERE user_id = ? AND week_start = ?').run(userId, start); },
    sharedWeek(token, now = Date.now()) {
      return db.prepare('SELECT user_id AS userId, week_start AS weekStart FROM parent_links WHERE token = ? AND expires_at > ?').get(token, now);
    },
    weeksToRefresh(today) {
      return db.prepare("SELECT user_id AS userId, week_start AS weekStart FROM weeks WHERE payload != 'null' AND week_start <= ? AND week_start >= date(?, '-6 days')").all(today, today);
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
      if (removed) { this.revokeShare(userId, start); this.deleteParentNotes(userId, start); }
      return removed;
    },
    close() { db.close(); },
  };
}
