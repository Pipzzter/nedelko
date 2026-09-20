import { h, render, Fragment } from '../../vendor/preact.js';
import htm from '../../vendor/htm.js';
export { useState, useEffect, useRef, useMemo } from '../../vendor/hooks.js';
export { render, Fragment };
export const html = htm.bind(h);
export const text = (value, lang) => typeof value === 'string' ? value : value?.[lang] || '';
const MK_DAYS = ['недела', 'понеделник', 'вторник', 'среда', 'четврток', 'петок', 'сабота'];
const MK_SHORT_DAYS = ['нед', 'пон', 'вто', 'сре', 'чет', 'пет', 'саб'];
const MK_MONTHS = ['јануари', 'февруари', 'март', 'април', 'мај', 'јуни', 'јули', 'август', 'септември', 'октомври', 'ноември', 'декември'];
export function localizedDate(date, lang, options = {}) {
  const instant = new Date(date.length === 10 ? `${date}T12:00:00Z` : date);
  if (lang !== 'mk') return new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Skopje', ...options }).format(instant);
  // WebViews without Macedonian ICU data silently format mk-MK in English.
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: options.timeZone || 'Europe/Skopje', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(instant).map(part => [part.type, part.value]));
  const day = options.day === '2-digit' ? p.day : String(Number(p.day));
  const month = options.month === 'long' ? MK_MONTHS[Number(p.month)-1] : options.month === 'short' ? MK_MONTHS[Number(p.month)-1].slice(0,3) + '.' : options.month === '2-digit' ? p.month : String(Number(p.month));
  const year = options.year === '2-digit' ? p.year.slice(-2) : p.year;
  const defaultDate = Object.keys(options).length === 0;
  const numericMonth = !['long','short'].includes(options.month);
  let result = [options.day || defaultDate ? day : '', options.month || defaultDate ? month : '', options.year || defaultDate ? year : ''].filter(Boolean).join(numericMonth ? '.' : ' ');
  if (options.weekday) {
    const weekday = new Date(`${p.year}-${p.month}-${p.day}T12:00:00Z`).getUTCDay();
    result = `${(options.weekday === 'short' ? MK_SHORT_DAYS : MK_DAYS)[weekday]}${result ? ', ' + result : ''}`;
  }
  if (options.hour || options.minute) result += `${result ? ', ' : ''}${options.hour ? p.hour : ''}${options.hour && options.minute ? ':' : ''}${options.minute ? p.minute : ''}`;
  return result;
}
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
