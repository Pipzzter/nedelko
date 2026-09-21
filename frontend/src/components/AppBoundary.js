import { Component } from '../../vendor/preact.js';
import { html } from '../lib/ui.js';
import { t, errorText } from '../locales/index.js';

export class AppBoundary extends Component {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render({ children }, { failed }) {
    if (!failed) return children;
    const lang = document.documentElement.lang === 'en' ? 'en' : 'mk';
    return html`<main class="auth-page"><section class="card" role="alert">
      <h1>${t('brand', lang)}</h1><p>${errorText('unexpected_error', lang)}</p>
      <button class="button primary" onClick=${() => this.setState({ failed: false })}>${t('refresh', lang)}</button>
    </section></main>`;
  }
}
