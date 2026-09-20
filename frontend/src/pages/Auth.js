import { html, useState } from '../lib/ui.js';
import { t } from '../locales/index.js';
import { Icon } from '../components/Icon.js';
export function Auth({ lang, setLang, onAuth, onDemo, busy, error }) {
  const [signup, setSignup] = useState(false);
  return html`<main class="auth-page"><div class="auth-top"><a class="brand" href="#home"><span class="brand-mark"><${Icon} name="leaf" size=${23}/></span>${t('brand', lang)}<span class="brand-period">.</span></a><button class="language-switch" onClick=${() => setLang(lang === 'mk' ? 'en' : 'mk')}>${lang === 'mk' ? 'EN' : 'МК'}</button></div>
    <div class="auth-layout"><section class="auth-story"><span class="eyebrow">${lang === 'mk' ? 'ЗА СЕКОЈ МАЛ ИСТРАЖУВАЧ' : 'FOR EVERY LITTLE EXPLORER'}</span><h1>${t('welcome', lang)}</h1><p>${t('authSubtitle', lang)}</p><img src="/assets/little-gardeners.svg" alt="" width="530" height="330" class="auth-illustration"/><div class="handwritten">${lang === 'mk' ? 'Да растеме со добри навики.' : 'Growing good habits, together.'}</div></section>
      <section class="auth-card"><span class="eyebrow teacher-auth-label">${t("teacherAccess",lang)}</span><div class="auth-tabs"><button aria-pressed=${!signup} class=${!signup ? 'active' : ''} onClick=${() => setSignup(false)}>${t('teacherSignIn', lang)}</button><button aria-pressed=${signup} class=${signup ? 'active' : ''} onClick=${() => setSignup(true)}>${t('teacherSignUp', lang)}</button></div>
        <h2>${signup ? lang === 'mk' ? 'Добредојдовте во ЕкоЧувар.' : 'Welcome to EkoCuvar.' : lang === 'mk' ? 'Убаво е што сте тука.' : 'Lovely to have you here.'}</h2>
        <form onSubmit=${event => { event.preventDefault(); const form = new FormData(event.currentTarget); onAuth(signup ? 'register' : 'login', Object.fromEntries(form)); }}>
          ${signup && html`<label>${t('name', lang)}<input name="displayName" autoComplete="name" required maxlength="60" placeholder=${lang === 'mk' ? 'Вашето име' : 'Your name'}/></label>`}
          <label>${t('username', lang)}<input name="username" autoComplete="username" autoCapitalize="none" required minlength=${signup ? 8 : 1} spellcheck="false"/></label>
          <label>${t('password', lang)}<input name="password" type="password" autoComplete=${signup ? 'new-password' : 'current-password'} required minlength=${signup ? 10 : 1} maxlength="128"/>${signup && html`<small>${t('signupHelp', lang)}</small>`}</label>
          ${error && html`<p class="form-error" role="alert">${error}</p>`}
          <button type="submit" class="button primary wide" disabled=${busy}>${busy ? t('loading', lang) : t(signup ? 'signUp' : 'signIn', lang)}<${Icon} name="arrow" size=${18}/></button>
        </form><aside class="teacher-auth-help"><b>${t("parentEntry",lang)}</b><p>${t("parentLinkOnly",lang)}</p></aside><div class="auth-divider"><span>${lang === 'mk' ? 'или прво разгледајте' : 'or have a look around first'}</span></div>

        <button class="button secondary wide" disabled=${busy} onClick=${onDemo}>${t('tryDemo', lang)}<${Icon} name="leaf" size=${18}/></button>
      </section></div></main>`;
}
