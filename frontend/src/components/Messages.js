import { html, useState, useEffect } from '../lib/ui.js';
import { t } from '../locales/index.js';
import { Icon } from './Icon.js';
export function Messages({ week, selected, lang, onRecheck, onApprove, busy }) {
  const [tab, setTab] = useState('daily'); const [copied, setCopied] = useState(false); const [copyFailed, setCopyFailed] = useState(false);
  const pair = tab === 'weekly' ? week.messages.weekly : week.messages.daily[selected];
  useEffect(() => { setCopied(false); setCopyFailed(false); }, [tab, selected, lang, pair?.[lang]]);
  const isToday = selected === week.today;
  const approved = tab === 'daily' && week.approval?.date === selected && Date.now() - Date.parse(week.approval.at) < 15 * 60000;
  const checkValid = week.checkedDate === selected && Date.now() - Date.parse(week.checkedAt) < 15 * 60000;
  const copy = async () => {
    try { await navigator.clipboard.writeText(pair[lang]); setCopied(true); setCopyFailed(false); }
    catch { setCopyFailed(true); }
  };
  return html`<section class="card messages-card"><div class="card-heading"><div><span class="eyebrow">${t('parents', lang)}</span><h2>${lang === 'mk' ? 'Мала порака, сè што треба.' : 'A little note, everything they need.'}</h2></div><span class=${`pill ${approved ? 'status-outside' : 'neutral'}`}>${t(approved ? 'approved' : 'draftMessage', lang)}</span></div>
    <div class="message-toolbar"><div class="segmented"><button class=${tab === 'daily' ? 'active' : ''} aria-pressed=${tab === 'daily'} onClick=${() => setTab('daily')}>${t('dailyMessage', lang)}</button><button class=${tab === 'weekly' ? 'active' : ''} aria-pressed=${tab === 'weekly'} onClick=${() => setTab('weekly')}>${t('weeklyMessage', lang)}</button></div><button class="button quiet" onClick=${copy} disabled=${!pair}><${Icon} name=${copied ? 'check' : 'copy'} size=${16}/>${t(copied ? 'copied' : 'copyMessage', lang)}</button></div>
    ${pair ? html`<article class="message-note" lang=${lang}><p>${pair[lang]}</p></article>` : html`<p class="empty-day">${t('noDay', lang)}</p>`}
    ${copyFailed && html`<p class="soft-note" role="status">${lang === 'mk' ? 'Копирањето не е достапно. Означете го текстот и копирајте го рачно.' : 'Clipboard is unavailable. Select the text to copy it manually.'}</p>`}
    <div class="message-footer"><small>${t('notSent', lang)}</small>${tab === 'daily' && isToday && pair && !week.days.find(d => d.date === selected)?.closed && html`<div class="approval-actions"><button class="button secondary" onClick=${onRecheck} disabled=${busy}>${t('recheck', lang)}<${Icon} name="refresh" size=${16}/></button><button class="button primary" onClick=${onApprove} disabled=${busy || !checkValid || approved} title=${!checkValid ? t('awaiting', lang) : ''}>${t(approved ? 'approved' : 'approve', lang)}<${Icon} name="check" size=${16}/></button></div>`}</div>
  </section>`;
}
