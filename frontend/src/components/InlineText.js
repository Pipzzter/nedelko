import { html, useEffect, useRef } from '../lib/ui.js';

export function InlineText({
  value,
  label,
  active,
  draft,
  multiline = false,
  maxLength = 100,
  onBegin,
  onInput,
  onCommit,
  onCancel,
  disabled,
  className = ''
}) {
  const field = useRef(null);
  useEffect(() => {
    if (active) {
      field.current?.focus();
      field.current?.select?.();
    }
  }, [active]);
  const keyboard = (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onCancel();
    }
    if (e.key === 'Enter' && (!multiline || e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      onCommit();
    }
  };
  if (active) {
    return html`
      <span class=${'inline-editing ' + className}>
        ${
          multiline
            ? html`
                <textarea
                  ref=${field}
                  rows="3"
                  aria-label=${label}
                  value=${draft}
                  maxlength=${maxLength}
                  disabled=${disabled}
                  onInput=${(e) => onInput(e.currentTarget.value)}
                  onKeyDown=${keyboard}
                  onBlur=${onCommit}
                />

`
            : html`
                <input
                  ref=${field}
                  type="text"
                  aria-label=${label}
                  value=${draft}
                  maxlength=${maxLength}
                  disabled=${disabled}
                  onInput=${(e) => onInput(e.currentTarget.value)}
                  onKeyDown=${keyboard}
                  onBlur=${onCommit}
                />

`
        }
      </span>

`;
  }
  return html`
    <button
      type="button"
      class=${'inline-text ' + className}
      title=${label}
      aria-label=${label}
      disabled=${disabled}
      onClick=${onBegin}
    >
      ${value}
    </button>

`;
}
