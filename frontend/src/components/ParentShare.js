import { html, useState } from '../lib/ui.js';
import { t } from '../locales/index.js';
import { Icon } from './Icon.js';

export function ParentShare({ share, lang, busy, onShare }) {
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);
  const url = share ? new URL(share.path, window.location.href).href : '';
  const copy = async () => {
    try { await navigator.clipboard.writeText(url); setCopied(true); setFailed(false); }
    catch { setFailed(true); }
  };
  return html`<section class="card parent-share">
    <div class="parent-share-icon"><${Icon} name="home" size=${25}/></div>
    <div class="parent-share-body"><span class="eyebrow">${t('parents', lang)}</span><h2>${t('parentLink', lang)}</h2><p>${t('parentLinkHelp', lang)}</p>
      ${share ? html`<label class="share-url-label">${t('parentLink', lang)}<input class="share-url" readOnly value=${url} onFocus=${e => e.currentTarget.select()}/></label>
        <div class="share-actions"><button class="button primary" type="button" onClick=${copy}>${t(copied ? 'copied' : 'copyParentLink', lang)}</button>
          <a class="button secondary" href=${url} target="_blank" rel="noreferrer">${t('openParentView', lang)}</a>
          <button class="button quiet" type="button" disabled=${busy} onClick=${() => { setCopied(false); onShare('revoke'); }}>${t('revokeParentLink', lang)}</button></div>
        <p class="soft-note">${t('parentLinkPrivacy', lang)} ${t('linkExpires', lang)}: ${new Date(share.expiresAt).toLocaleDateString(lang === 'mk' ? 'mk-MK' : 'en-GB')}.</p>
        ${failed && html`<p role="status">${t('copyFailed', lang)}</p>`}
      ` : html`<button class="button primary" type="button" disabled=${busy} onClick=${() => onShare('enable')}>${t('createParentLink', lang)}</button>`}
      ${['localhost', '127.0.0.1'].includes(window.location.hostname) && html`<p class="local-link-note">${t('localParentLink', lang)}</p>`}
    </div>
  </section>`;
}
