import { BrandMark } from '../components/BrandMark.js';
import { html, useState } from '../lib/ui.js';
import { t } from '../locales/index.js';
import { Icon } from '../components/Icon.js';
export function Auth({ lang, setLang, onAuth, onDemo, busy, error, config }) {
  const [signup, setSignup] = useState(false);
  return html`
    <main class="auth-page">
      <div class="auth-top">
        <a class="brand" href="#home"
          ><${BrandMark} />${t('brand', lang)}<span
            class="brand-period"
            >.</span
          ></a
        ><button class="language-switch" onClick=${() => setLang(lang === 'mk' ? 'en' : 'mk')}>
          ${lang === 'mk' ? 'EN' : 'МК'}
        </button>
      </div>
      <div class="auth-layout">
        <section class="auth-story">
          <span class="eyebrow">${lang === 'mk' ? 'ЗА СЕКОЈ МАЛ ИСТРАЖУВАЧ' : 'FOR EVERY LITTLE EXPLORER'}</span>
          <h1>${t('welcome', lang)}</h1>
          <p>${t('authSubtitle', lang)}</p>
          <img src="/assets/little-gardeners.svg" alt="" width="530" height="330" class="auth-illustration" />
          <div class="handwritten">
            ${lang === 'mk' ? 'Да растеме со добри навики.' : 'Growing good habits, together.'}
          </div>
        </section>
        <section class="auth-card">
          <span class="eyebrow teacher-auth-label">${t('teacherAccess', lang)}</span>
          <div class="auth-tabs">
            <button aria-pressed=${!signup} class=${!signup ? 'active' : ''} onClick=${() => setSignup(false)}>
              ${t('teacherSignIn', lang)}</button
            ><button aria-pressed=${signup} class=${signup ? 'active' : ''} onClick=${() => setSignup(true)}>
              ${t('teacherSignUp', lang)}
            </button>
          </div>
          <h2>${welcomeHeading({ signup, lang })}</h2>
          <form
            onSubmit=${(event) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              onAuth(signup ? 'register' : 'login', Object.fromEntries(form));
            }}
          >
            ${
              signup &&
              html`
                <label
                  >${t('kindergartenName', lang)}<input
                    name="kindergarten"
                    required
                    maxlength="100"
                    placeholder=${t('kindergartenPlaceholder', lang)}
                /></label>
                <label
                  >${t('teacherName', lang)}<input
                    name="displayName"
                    autocomplete="name"
                    required
                    maxlength="60"
                    placeholder=${lang === 'mk' ? 'Вашето име' : 'Your name'}
                /></label>
                <label
                  >${t('age', lang)}<select name="ageGroup" required>
                    ${['3-4', '4-5', '5-6', 'mixed'].map(
                      (age) => html`
                        <option value=${age} selected=${age === '4-5'}>
                          ${age === 'mixed' ? t('mixed', lang) : '' + age + ' ' + t('years', lang)}
                        </option>

`
                    )}</select
                  ><small>${t('ageHelp', lang)}</small></label
                >
                <label
                  >${t('city', lang)}<select name="locationId" required>
                    ${config.locations.map(
                      (l) => html`
                        <option key=${l.id} value=${l.id} selected=${l.id === 'centar'}>
                          ${lang === 'mk' ? l.name : l.nameEn}
                        </option>

`
                    )}</select
                  ><small>${t('locationHelp', lang)}</small></label
                >

`
            }
            <label
              >${t('email', lang)}<input
                name="email"
                type="email"
                autocomplete="email"
                autocapitalize="none"
                required
                maxlength="254"
                spellcheck="false"
            /></label>
            <label
              >${t('password', lang)}<input
                name="password"
                type="password"
                autocomplete=${signup ? 'new-password' : 'current-password'}
                required
                minlength=${signup ? 10 : 1}
                maxlength="128"
              />${signup && html`
 <small>${t('signupHelp', lang)}</small>
`}</label
            >
            ${error && html`
 <p class="form-error" role="alert">${error}</p>
`}
            <button type="submit" class="button primary wide" disabled=${busy}>
              ${authButtonLabel({ busy, lang, signup })}<${Icon} name="arrow" size=${18} />
            </button>
          </form>
          <aside class="teacher-auth-help">
            <b>${t('parentEntry', lang)}</b>
            <p>${t('parentLinkOnly', lang)}</p>
          </aside>
          <div class="auth-divider">
            <span>${lang === 'mk' ? 'или прво разгледајте' : 'or have a look around first'}</span>
          </div>
          <button class="button secondary wide" disabled=${busy} onClick=${onDemo}>
            ${t('tryDemo', lang)}<${Icon} name="arrow" size=${18} />
          </button>
        </section>
      </div>
    </main>

`;
}

function authButtonLabel({ busy, lang, signup }) {
  if (busy) {
    return t('loading', lang);
  }
  return t(signup ? 'signUp' : 'signIn', lang);
}

function welcomeHeading({ signup, lang }) {
  if (signup) {
    if (lang === 'mk') {
      return 'Добредојдовте во Неделко.';
    }
    return 'Welcome to Nedelko.';
  }
  if (lang === 'mk') {
    return 'Убаво е што сте тука.';
  }
  return 'Lovely to have you here.';
}
