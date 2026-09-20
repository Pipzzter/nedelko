import { randomUUID } from 'node:crypto';
import { invalid } from '../domain/settings.js';

export function parentNoteStore(db) {
  db.exec(`CREATE TABLE IF NOT EXISTS parent_notes (
    id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    week_start TEXT NOT NULL, day_date TEXT, content TEXT NOT NULL, nonce TEXT NOT NULL,
    created_at INTEGER NOT NULL, read_at INTEGER, status TEXT NOT NULL DEFAULT 'new', advice TEXT,
    UNIQUE(user_id, week_start, nonce)
  ); CREATE INDEX IF NOT EXISTS parent_notes_owner ON parent_notes(user_id, week_start, created_at);`);
  const project = row => row ? { id: row.id, weekStart: row.week_start, date: row.day_date, text: row.content,
    createdAt: new Date(row.created_at).toISOString(), readAt: row.read_at ? new Date(row.read_at).toISOString() : null,
    status: row.status, advice: row.advice ? JSON.parse(row.advice) : null } : null;
  return {
    parentNotes(userId, start) { return (start ? db.prepare('SELECT * FROM parent_notes WHERE user_id = ? AND week_start = ? ORDER BY created_at DESC, id').all(userId, start)
      : db.prepare('SELECT * FROM parent_notes WHERE user_id = ? ORDER BY created_at DESC, id').all(userId)).map(project); },
    parentNote(userId, start, id) { return project(db.prepare('SELECT * FROM parent_notes WHERE user_id = ? AND week_start = ? AND id = ?').get(userId, start, id)); },
    addParentNote(userId, start, note) {
      const duplicate = db.prepare('SELECT id FROM parent_notes WHERE user_id = ? AND week_start = ? AND nonce = ?').get(userId, start, note.nonce);
      if (duplicate) return duplicate.id;
      if (db.prepare('SELECT count(*) AS n FROM parent_notes WHERE user_id = ? AND week_start = ?').get(userId, start).n >= 250) throw invalid('parent_note_limit', 429);
      const id = randomUUID();
      db.prepare('INSERT INTO parent_notes (id, user_id, week_start, day_date, content, nonce, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)').run(id, userId, start, note.date, note.text, note.nonce, Date.now());
      return id;
    },
    readParentNote(userId, start, id) { return db.prepare('UPDATE parent_notes SET read_at = COALESCE(read_at, ?) WHERE user_id = ? AND week_start = ? AND id = ?').run(Date.now(), userId, start, id).changes > 0; },
    updateParentNote(userId, start, id, status, advice) {
      return db.prepare('UPDATE parent_notes SET status = ?, advice = ?, read_at = COALESCE(read_at, ?) WHERE user_id = ? AND week_start = ? AND id = ?').run(status, JSON.stringify(advice), Date.now(), userId, start, id).changes > 0;
    },
    deleteParentNotes(userId, start) { db.prepare('DELETE FROM parent_notes WHERE user_id = ? AND week_start = ?').run(userId, start); },
  };
}
