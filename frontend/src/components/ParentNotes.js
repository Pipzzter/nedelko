import { html, useState, useEffect, useRef, text, localizedDate } from '../lib/ui.js';
import { api } from '../lib/api.js';
import { t, errorText } from '../locales/index.js';

export function ParentNotes({ demoId, week, lang, busy, onSuggest, onApply }) {
  const [data, setData] = useState({ notes: [], unread: 0 });
  const [expanded, setExpanded] = useState(null);
  const [proposal, setProposal] = useState(null);
  const [error, setError] = useState('');
  const [working, setWorking] = useState(false);
  const active = useRef(true);
  const load = async () => {
    try {
      const result = await api(`/parent-notes${demoId ? '?demoId=' + demoId : ''}`);
      if (active.current) {
        setData(result);
        setError('');
      }
    } catch (err) {
      if (active.current) setError(errorText(err.code, lang));
    }
  };
  useEffect(() => {
    active.current = true;
    load();
    const refresh = () => {
      if (!document.hidden) load();
    };
    const timer = setInterval(refresh, 10000);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      active.current = false;
      clearInterval(timer);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [demoId, week?.weekStart]);
  const show = async (note) => {
    setExpanded(expanded === note.id ? null : note.id);
    setProposal(null);
    setError('');
    if (!note.readAt)
      try {
        setData(await api('/parent-notes/read', { noteId: note.id, ...(demoId ? { demoId } : {}) }));
      } catch (err) {
        setError(errorText(err.code, lang));
      }
  };
  const suggest = async (note) => {
    setWorking(true);
    setError('');
    setProposal(null);
    try {
      const result = await onSuggest(note.id);
      await load();
      setProposal(result.proposal ? { ...result.proposal, noteId: note.id } : null);
    } catch (err) {
      setError(
        err.generationIssue ? `${errorText(err.code, lang)} ${t(err.generationIssue, lang)}` : errorText(err.code, lang)
      );
    } finally {
      setWorking(false);
    }
  };
  const apply = async () => {
    setWorking(true);
    setError('');
    try {
      await onApply(proposal.proposalId);
      setProposal(null);
      await load();
    } catch (err) {
      setError(errorText(err.code, lang));
    } finally {
      setWorking(false);
    }
  };
  return html`
    <section class="card parent-notes-page">
      <div class="card-heading">
        <h2>${t('parentNotes', lang)}</h2>
        <span class="unread-count" aria-label=${'' + data.unread + ' ' + t('unreadNotes', lang)}>${data.unread}</span>
      </div>
      <div class="notes-inbox" id="parent-notes-list">
        <p class="soft-note">${t('noteChangeRules', lang)}</p>
        ${error && html`
 <p class="form-error" role="alert">${error}</p>
`}${
          !data.notes.length && html`
 <p class="notes-empty">${t('noParentNotes', lang)}</p>
`
        }
        ${data.notes.map(
          (note) => html`
            <article key=${note.id} class=${'inbox-note ' + (!note.readAt ? 'unread' : '')}>
              <button
                type="button"
                class="note-summary"
                aria-expanded=${expanded === note.id}
                disabled=${busy || working}
                onClick=${() => show(note)}
              >
                <span
                  >${
                    !note.readAt && html`
 <b class="note-unread">${t('unread', lang)} · </b>
`
                  }${note.date ? localizedDate(note.date, lang, { weekday: 'long', day: 'numeric', month: 'short' }) : t('wholeWeek', lang)}</span
                >
                <p>${note.text}</p>
                <small
                  >${localizedDate(note.createdAt, lang, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</small
                >
              </button>
              ${
                expanded === note.id &&
                html`
                  <div class="note-review">
                    ${note.advice && html`
 <p>${text(note.advice.explanation, lang)}</p>
`}
                    ${renderNoteAction({ note, lang, busy, working, week, suggest })}
                    ${
                      proposal?.noteId === note.id &&
                      html`
                        <div class="note-proposal">
                          <h3>
                            ${localizedDate(proposal.date, lang, { weekday: 'long', day: 'numeric', month: 'short' })}
                          </h3>
                          ${renderNoteProposal({ proposal, lang, week })}
                          <button type="button" class="button primary" disabled=${busy || working} onClick=${apply}>
                            ${t('applyNoteChange', lang)}</button
                          ><button
                            type="button"
                            class="button quiet"
                            disabled=${busy || working}
                            onClick=${() => setProposal(null)}
                          >
                            ${t('discardSuggestion', lang)}
                          </button>
                        </div>

`
                    }
                  </div>

`
              }
            </article>

`
        )}
      </div>
    </section>

`;
}

function renderNoteAction({ note, lang, busy, working, week, suggest }) {
  if (note.status === 'applied') {
    return html`
 <p class="note-sent">${t('noteChangeApplied', lang)}</p>
`;
  }
  return html`
    <button type="button" class="button secondary" disabled=${busy || working || !week} onClick=${() => suggest(note)}>
      ${t(working ? 'suggestingDay' : 'suggestDay', lang)}
    </button>

`;
}

function renderNoteProposal({ proposal, lang, week }) {
  if (['inside', 'outside'].includes(proposal.scope)) {
    return html`
 <p>${t(proposal.scope === 'outside' ? 'noteOutsideChange' : 'noteInsideChange', lang)}</p>
`;
  }
  return html`
    <details open>
      <summary>${t('reviewSchedule', lang)}</summary>
      <ol>
        ${proposal.timeline
          .filter((row) => {
            const old = week?.days
              .find((day) => day.date === proposal.date)
              ?.timeline.find((item) => item.id === row.id);
            return (
              !old ||
              (row.kind === 'eco' &&
                JSON.stringify(proposal.theme) !==
                  JSON.stringify(week.days.find((day) => day.date === proposal.date)?.theme)) ||
              ['start', 'end', 'label', 'note'].some(
                (key) => JSON.stringify(old[key] || null) !== JSON.stringify(row[key] || null)
              )
            );
          })
          .map(
            (row) => html`
              <li>
                <time>${row.start} - ${row.end}</time><b>${text(row.label, lang)}</b>
                <p>${text(row.kind === 'eco' ? proposal.theme.inside : row.note, lang)}</p>
                ${row.kind === 'eco' && html`
 <p>${t('outside', lang)}: ${text(proposal.theme.outside, lang)}</p>
`}
              </li>

`
          )}
        ${(week?.days.find((day) => day.date === proposal.date)?.timeline || [])
          .filter((row) => !proposal.timeline.some((item) => item.id === row.id))
          .map(
            (row) => html`
              <li>
                <b>${t('removedActivity', lang)}: ${text(row.label, lang)}</b><time>${row.start} - ${row.end}</time>
              </li>

`
          )}
      </ol>
    </details>

`;
}
