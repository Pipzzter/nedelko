import { html, useEffect, useRef } from '../lib/ui.js';
import { t } from '../locales/index.js';
import { BrandMark } from './BrandMark.js';
import { Icon } from './Icon.js';

export function DemoIntro({ lang, onClose, onLeave }) {
  const panel = useRef(null);
  useEffect(() => {
    const previous = document.activeElement;
    const siblings = [...panel.current.parentElement.children].filter(node => node !== panel.current);
    const saved = siblings.map(node => [node, node.getAttribute('inert'), node.getAttribute('aria-hidden')]);
    for (const node of siblings) { node.setAttribute('inert', ''); node.setAttribute('aria-hidden', 'true'); }
    panel.current.querySelector('button').focus();
    return () => {
      for (const [node, inert, hidden] of saved) {
        if (inert === null) node.removeAttribute('inert'); else node.setAttribute('inert', inert);
        if (hidden === null) node.removeAttribute('aria-hidden'); else node.setAttribute('aria-hidden', hidden);
      }
      if (previous?.isConnected) previous.focus();
    };
  }, []);
  return html`
    <div ref=${panel} class="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="demo-intro-title"
      onClick=${event => { if (event.target === event.currentTarget) onClose(); }}
      onKeyDown=${event => {
        if (event.key === 'Escape') { event.preventDefault(); onClose(); }
        if (event.key !== 'Tab') return;
        const buttons = [...panel.current.querySelectorAll('button')];
        const index = buttons.indexOf(document.activeElement);
        if (index < 0 || (event.shiftKey && index === 0) || (!event.shiftKey && index === buttons.length - 1)) {
          event.preventDefault(); buttons[event.shiftKey ? buttons.length - 1 : 0].focus();
        }
      }}>
      <div class="modal-card">
        <span class="modal-mascot"><${BrandMark} size=${88} /></span>
        <h2 id="demo-intro-title">${t('demoIntroTitle', lang)}</h2>
        <p>${t('demoIntroBody', lang)}</p><p class="soft-note">${t('demoIntroToggle', lang)}</p>
        <div class="modal-actions">
          <button class="button primary" onClick=${event => { event.stopPropagation(); onClose(); }}>${t('demoIntroExplore', lang)}<${Icon} name="arrow" size=${18} /></button>
          <button class="button secondary" onClick=${event => { event.stopPropagation(); onLeave(); }}>${t('demoIntroLeave', lang)}</button>
        </div>
      </div>
    </div>`;
}
