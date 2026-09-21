import { html } from '../lib/ui.js';

// The adjacent brand or heading supplies the accessible name.
export function BrandMark({ size = 56 }) {
  return html`<img class="brand-mark" src="/assets/nedelko-mascot.png" alt="" aria-hidden="true"
    width=${size} height=${size} decoding="async" />`;
}
