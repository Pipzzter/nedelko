# Third-party code

The browser ships local ES modules, without runtime CDN requests:

| Package | Version | Vendored paths | License |
|---|---|---|---|
| Preact | 10.29.8 | `frontend/vendor/preact.js`, `frontend/vendor/hooks.js` | [MIT](licenses/preact.txt) |
| HTM | 3.1.1 | `frontend/vendor/htm.js` | [Apache 2.0](licenses/htm.txt) |

Files were obtained from version-pinned npm distributions through jsDelivr on 2026-09-20. Preact hooks’ bare `preact` import is rewritten to the adjacent `./preact.js`; source-map references are removed. Together the three JavaScript files are approximately 16.5 KB before compression. No React compatibility layer or bundler is included.

`linkedom` 0.18.12 is a development-only dependency for repeatable DOM integration tests; it is not imported by the app. Exact dependency versions are recorded in package-lock.json. Illustrations in frontend/assets are original code-native SVGs.
