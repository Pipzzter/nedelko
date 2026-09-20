import { h, render, Fragment } from '../../vendor/preact.js';
import htm from '../../vendor/htm.js';
export { useState, useEffect, useRef, useMemo } from '../../vendor/hooks.js';
export { render, Fragment };
export const html = htm.bind(h);
export const text = (value, lang) => typeof value === 'string' ? value : value?.[lang] || '';
export const localizedDate = (date, lang, options = {}) => new Intl.DateTimeFormat(lang === 'mk' ? 'mk-MK' : 'en-GB', { timeZone: 'Europe/Skopje', ...options }).format(new Date(date.length === 10 ? `${date}T12:00:00Z` : date));
const MK_DAYS = ['недела', 'понеделник', 'вторник', 'среда', 'четврток', 'петок', 'сабота'];
const MK_SHORT_DAYS = ['нед', 'пон', 'вто', 'сре', 'чет', 'пет', 'саб'];
const MK_MONTHS = ['јануари', 'февруари', 'март', 'април', 'мај', 'јуни', 'јули', 'август', 'септември', 'октомври', 'ноември', 'декември'];
// Some browsers fall back to English for mk-MK. Calendar labels must not do that.
export const dayName = (date, lang) => lang === 'mk' ? MK_DAYS[new Date(`${date}T12:00:00Z`).getUTCDay()] : localizedDate(date, lang, { weekday: 'long' });
export const shortDay = (date, lang) => lang === 'mk' ? MK_SHORT_DAYS[new Date(`${date}T12:00:00Z`).getUTCDay()] : localizedDate(date, lang, { weekday: 'short' }).replace('.', '');
export const monthLabel = (date, lang) => lang === 'mk' ? `${MK_MONTHS[Number(date.slice(5, 7)) - 1]} ${date.slice(0, 4)}` : localizedDate(date, lang, { month: 'long', year: 'numeric' });
export const degrees = value => Number.isFinite(value) ? `${Math.round(value)}°` : '··';
export function localTime(clock) {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Skopje', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(clock));
  const p = Object.fromEntries(parts.map(x => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}` };
}
