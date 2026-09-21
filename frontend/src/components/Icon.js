import { html } from '../lib/ui.js';
const paths = {
  people: [
    'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2',
    'M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0',
    'M20 21v-2a4 4 0 0 0-3-3.9M16 3a4 4 0 0 1 0 8'
  ],
  message: ['M21 11a8 8 0 0 1-8 8H5l-3 3V5a3 3 0 0 1 3-3h8a8 8 0 0 1 8 9Z', 'M7 8h9M7 12h6'],
  leaf: ['M20 4C9 2 3 7 5 14c2 7 13 6 15-10Z', 'M5 20 15 10'],
  home: ['m3 10 9-7 9 7', 'M5 9v12h5v-7h4v7h5V9'],
  calendar: ['M4 5h16v16H4z', 'M7 3v4m10-4v4M4 10h16m-12 4h2m4 0h2m-8 4h2'],
  edit: ['m15 4 5 5-11 11H4v-5Z', 'm13 6 5 5'],
  arrow: ['M4 12h16m-6-6 6 6-6 6'],
  plus: ['M12 5v14M5 12h14'],
  close: ['m6 6 12 12M18 6 6 18'],
  check: ['m5 12 4 4L19 6'],
  chevron: ['m6 9 6 6 6-6'],
  pin: ['M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 0 1 14 0Z', 'M14 10a2 2 0 1 1-4 0 2 2 0 0 1 4 0'],
  sun: [
    'M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0',
    'M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5'
  ],
  cloud: ['M6 18a5 5 0 1 1 1-10 6 6 0 0 1 11 2 4 4 0 1 1 0 8Z'],
  rain: ['M6 14a4 4 0 1 1 1-8 5 5 0 0 1 10 2 3 3 0 1 1 1 6', 'M8 17l-1 3m7-3-1 3m7-3-1 3'],
  snow: [
    'M12 2v20M3 7l18 10M3 17 21 7',
    'm9 4 3 3 3-3m-6 16 3-3 3 3M4 10l4-1-1-4m10 14-1-4 4-1M4 14l4 1-1 4M17 5l-1 4 4 1'
  ],
  storm: ['M5 14a4 4 0 1 1 1-8 6 6 0 0 1 11 1 4 4 0 0 1 2 7', 'm13 10-5 7h5l-2 5'],
  fog: ['M5 7h14M3 12h18M5 17h14'],
  unknown: ['M9 8a3 3 0 1 1 5 2c-1 1-2 1-2 3', 'M12 17h.01'],
  wind: ['M3 8h12a3 3 0 1 0-3-3M2 12h17a3 3 0 1 1-3 3M4 17h6'],
  refresh: ['M20 7v5h-5M4 17v-5h5', 'M6 6a8 8 0 0 1 13 2M5 16a8 8 0 0 0 13 2'],
  clock: ['M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0', 'M12 7v5l3 2'],
  meal: ['M5 3v7m3-7v7M3 3v5a3 3 0 0 0 6 0V3M6 11v10M17 3v18m0-18c-5 3-5 9 0 9'],
  rest: ['M20 15A8 8 0 0 1 9 4a9 9 0 1 0 11 11Z'],
  activity: ['m12 3 2.5 5.5L21 9l-5 4.5 1.5 7-5.5-3-5.5 3L8 13.5 3 9l6.5-.5Z'],
  copy: ['M8 8h12v13H8z', 'M4 16V3h12'],
  logout: ['M9 4H4v16h5M10 12h11m-4-4 4 4-4 4'],
  trash: ['M4 6h16M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7m4-7v7'],
  lock: ['M5 10h14v11H5z', 'M8 10V7a4 4 0 0 1 8 0v3']
};
export function Icon({ name = 'leaf', size = 20, className = '' }) {
  return html`
    <svg
      width=${size}
      height=${size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.7"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
      class=${className}
    >
      ${(paths[name] || paths.leaf).map((d, i) => html`
 <path key=${i} d=${d} />
`)}
    </svg>

`;
}
export function WeatherIcon({ kind = 'unknown', size = 36 }) {
  return html`
 <span class=${'weather-icon weather-' + kind}><${Icon} name=${kind} size=${size} /></span>
`;
}
