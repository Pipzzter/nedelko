# Frontend

- Responsive desktop/mobile ES modules with pinned Preact + HTM under vendor/, semantic HTML and CSS custom properties; no build step.
- Macedonian and English copy lives in src/locales/. Preact escapes text; never use dangerouslySetInnerHTML or interpolate user data into HTML.
- Preserve keyboard focus, labelled controls, visible focus rings, reduced-motion preferences, and meaningful loading/error states.
- Every interactive control must work. Do not add decorative fake links, testimonials, account avatars, or claimed metrics.
- Never store API keys, session tokens or passwords in browser storage. Account plans persist server-side; approval is not message delivery.
- Data changes, schedule changes, notice edits, and rechecks invalidate approval.
- Label every weekly result as a draft and every future-day action as awaiting its morning check.
- The server owns all recommendation logic. The browser presents results and collects confirmation.
