import { html, useState, useEffect, useRef } from '../lib/ui.js';
import { requestProgress, watchRequests } from '../lib/request-progress.js';
import { t } from '../locales/index.js';
import { Icon } from './Icon.js';

export function RequestProgress() {
  const [progress, setProgress] = useState(requestProgress); const [elapsed, setElapsed] = useState(0);
  const panel = useRef(null); const request = progress.foreground;
  const lang = document.documentElement.lang === 'en' ? 'en' : 'mk';
  useEffect(() => watchRequests(setProgress), []);
  useEffect(() => {
    if (!request) return;
    const screen = document.getElementById('app-screen'); const previous = document.activeElement;
    screen?.setAttribute('inert', ''); screen?.setAttribute('aria-hidden', 'true'); screen?.classList.add('waiting-for-response');
    document.body.classList.add('ai-waiting'); panel.current?.focus?.();
    const tick = () => setElapsed(Math.max(0, Math.floor((performance.now() - request.startedAt) / 1000)));
    tick(); const timer = setInterval(tick, 1000);
    return () => {
      clearInterval(timer); screen?.removeAttribute('inert'); screen?.removeAttribute('aria-hidden'); screen?.classList.remove('waiting-for-response');
      document.body.classList.remove('ai-waiting');
      if (previous?.isConnected) previous.focus?.();
    };
  }, [request?.id]);
  if (!progress.count) return null;
  if (!request) return html`<div class="network-progress" role="progressbar" aria-label=${t('loading', lang)}><span/></div>`;
  const duration = `${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2, '0')}`;
  const title = request.phase === 'applying' ? 'applyingChange' : request.phase === 'generation' ? 'generating' : 'suggestingDay';
  return html`<section ref=${panel} class="ai-loading-screen" role="dialog" aria-modal="true" aria-labelledby="ai-loading-title" aria-describedby="ai-loading-description" tabIndex="-1" onKeyDown=${event => { if (event.key === 'Tab') event.preventDefault(); }}>
    <div class="ai-loading-content"><span class="loading-mark"><${Icon} name=${request.phase === 'applying' ? 'check' : 'leaf'} size=${38}/></span><span class="eyebrow">${t('brand', lang)}</span>
      <h1 id="ai-loading-title" role="status">${t(title, lang)}</h1><p id="ai-loading-description">${t(request.phase === 'applying' ? 'applyingChangeHelp' : request.demo ? 'demoLoadingHelp' : 'aiLoadingHelp', lang)}</p>
      <div class="ai-progress-track" role="progressbar" aria-label=${t(title, lang)}><span/></div>
      <p class="elapsed-time">${t('elapsedTime', lang)} <time>${duration}</time></p>
      ${elapsed >= 45 && html`<p class="loading-patience">${t('stillWorking', lang)}</p>`}
    </div>
  </section>`;
}
