import { randomBytes, randomUUID, scrypt as scryptCallback, timingSafeEqual, createHash } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCallback);
const OPTIONS = { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
const DUMMY_SALT = '6217a6f5c9037d4209d48c94c29a3e11';
export const SESSION_SECONDS = 7 * 24 * 3600;
export const authError = (code, status = 400) => Object.assign(new Error(code), { status, code });
export const tokenHash = value => createHash('sha256').update(value).digest('hex');
export const publicUser = row => ({ id: row.id, username: row.username, displayName: row.displayName ?? row.display_name });

export function credentials(body, signup = false) {
  if (typeof body.username !== 'string' || typeof body.password !== 'string') throw authError('invalid_credentials');
  const username = body.username.normalize('NFKC').trim().toLowerCase();
  // Apply the new minimum on registration without locking out existing short usernames.
  if (!username || (signup && username.length < 8)) throw authError('username_format');
  if (body.password.length > 128 || body.password.length < (signup ? 10 : 1)) throw authError('password_length');
  const displayName = typeof body.displayName === 'string' ? body.displayName.trim() : username;
  if (signup && (!displayName || displayName.length > 60 || /[<>\p{Cc}]/u.test(displayName))) throw authError('name_format');
  return { username, password: body.password, displayName };
}
export async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const key = await scrypt(password, salt, 64, OPTIONS);
  return `scrypt-v1:${salt}:${key.toString('hex')}`;
}
export async function verifyPassword(password, encoded) {
  const [version, salt, key] = (encoded || '').split(':');
  const valid = version === 'scrypt-v1' && /^[a-f0-9]{32}$/.test(salt) && /^[a-f0-9]{128}$/.test(key);
  // Unknown usernames do the same expensive work to avoid an obvious timing oracle.
  const actual = await scrypt(password, valid ? salt : DUMMY_SALT, 64, OPTIONS);
  return valid && timingSafeEqual(actual, Buffer.from(key, 'hex'));
}
export async function register(store, body) {
  const input = credentials(body, true);
  const hash = await hashPassword(input.password);
  const user = { id: randomUUID(), username: input.username, displayName: input.displayName, hash };
  try { store.addUser(user); } catch (error) {
    if (error.code === 'ERR_SQLITE_ERROR' && /UNIQUE/.test(error.message)) throw authError('username_taken', 409);
    throw error;
  }
  return publicUser(user);
}
export async function login(store, body) {
  const input = credentials(body); const row = store.userByName(input.username);
  if (!await verifyPassword(input.password, row?.password_hash)) throw authError('login_failed', 401);
  return publicUser(row);
}
export function readSessionCookie(request) {
  const match = (request.headers.cookie ?? '').match(/(?:^|;\s*)eko_session=([a-f0-9]{64})(?:;|$)/);
  return match?.[1] ?? null;
}
export function createSession(store, user, previousToken) {
  if (previousToken) store.deleteSession(tokenHash(previousToken));
  const token = randomBytes(32).toString('hex');
  store.createSession(tokenHash(token), user.id, Date.now() + SESSION_SECONDS * 1000);
  return `eko_session=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${SESSION_SECONDS}`;
}
