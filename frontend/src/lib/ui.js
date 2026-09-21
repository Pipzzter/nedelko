import { h } from '../../vendor/preact.js';
import htm from '../../vendor/htm.js';
export { useState, useEffect, useRef, useMemo } from '../../vendor/hooks.js';
export { render, Fragment } from '../../vendor/preact.js';
export const html = htm.bind(h);
export const text = (value, lang) => (typeof value === 'string' ? value : value?.[lang] || '');
let uuidSequence = 0;
export function safeUuid() {
  try {
    if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  } catch {
    // Some browsers expose randomUUID but reject it on an insecure origin.
  }
  const bytes = new Uint8Array(16);
  try {
    globalThis.crypto.getRandomValues(bytes);
  } catch {
    // These IDs identify UI rows and note retries; they are not authentication tokens.
    const fallback = Date.now().toString(16).padStart(16, '0') + (++uuidSequence).toString(16).padStart(16, '0');
    for (let i = 0; i < bytes.length; i++) bytes[i] = Number.parseInt(fallback.slice(i * 2, i * 2 + 2), 16);
  }
  bytes[6] = (bytes[6] & 15) | 64;
  bytes[8] = (bytes[8] & 63) | 128;
  const hex = Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
export function safeHref(value) {
  if (typeof value !== 'string' || /[\u0000-\u0020\\]/u.test(value) || !/^(?:https?:\/\/|\/(?!\/)|#)/i.test(value)) return undefined;
  try {
    const parsed = new URL(value, 'https://relative.invalid');
    return value.startsWith('/') || value.startsWith('#') ? value : parsed.href;
  } catch {
    return undefined;
  }
}
const MK_DAYS = ['недела', 'понеделник', 'вторник', 'среда', 'четврток', 'петок', 'сабота'];
const MK_SHORT_DAYS = ['нед', 'пон', 'вто', 'сре', 'чет', 'пет', 'саб'];
const MK_MONTHS = [
  'јануари',
  'февруари',
  'март',
  'април',
  'мај',
  'јуни',
  'јули',
  'август',
  'септември',
  'октомври',
  'ноември',
  'декември'
];
export function localizedDate(date, lang, options = {}) {
  const instant = new Date(date.length === 10 ? `${date}T12:00:00Z` : date);
  if (lang !== 'mk') return new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Skopje', ...options }).format(instant);
  // WebViews without Macedonian ICU data silently format mk-MK in English.
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: options.timeZone || 'Europe/Skopje',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23'
    })
      .formatToParts(instant)
      .map((part) => [part.type, part.value])
  );
  const fields = {
    day: options.day === '2-digit' ? p.day : String(Number(p.day)),
    month: macedonianMonth(p.month, options.month),
    year: options.year === '2-digit' ? p.year.slice(-2) : p.year
  };
  const defaultDate = Object.keys(options).length === 0;
  const separator = ['long', 'short'].includes(options.month) ? ' ' : '.';
  let result = Object.keys(fields)
    .filter((key) => defaultDate || options[key])
    .map((key) => fields[key])
    .join(separator);
  if (options.weekday) {
    const weekday = new Date(`${p.year}-${p.month}-${p.day}T12:00:00Z`).getUTCDay();
    const names = options.weekday === 'short' ? MK_SHORT_DAYS : MK_DAYS;
    result = [names[weekday], result].filter(Boolean).join(', ');
  }
  const time = [options.hour ? p.hour : '', options.minute ? p.minute : ''].filter(Boolean).join(':');
  if (time) result = [result, time].filter(Boolean).join(', ');

  return result;
}
// Some browsers fall back to English for mk-MK. Calendar labels must not do that.
export const dayName = (date, lang) =>
  lang === 'mk' ? MK_DAYS[new Date(`${date}T12:00:00Z`).getUTCDay()] : localizedDate(date, lang, { weekday: 'long' });
export const shortDay = (date, lang) =>
  lang === 'mk'
    ? MK_SHORT_DAYS[new Date(`${date}T12:00:00Z`).getUTCDay()]
    : localizedDate(date, lang, { weekday: 'short' }).replace('.', '');
export const monthLabel = (date, lang) =>
  lang === 'mk'
    ? `${MK_MONTHS[Number(date.slice(5, 7)) - 1]} ${date.slice(0, 4)}`
    : localizedDate(date, lang, { month: 'long', year: 'numeric' });
export const degrees = (value) => (Number.isFinite(value) ? `${Math.round(value)}°` : '··');
export function localTime(clock) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Skopje',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23'
  }).formatToParts(new Date(clock));
  const p = Object.fromEntries(parts.map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}` };
}

function macedonianMonth(month, format) {
  const name = MK_MONTHS[Number(month) - 1];
  if (format === 'long') return name;
  if (format === 'short') return name.slice(0, 3) + '.';
  return format === '2-digit' ? month : String(Number(month));
}
