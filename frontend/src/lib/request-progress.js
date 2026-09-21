const requests = new Map(); const listeners = new Set(); let sequence = 0;
const phases = {
  '/week/generate': 'generation', '/week/day/suggest': 'suggestion', '/week/change/suggest': 'suggestion',
  '/parent-notes/suggest': 'noteSuggestion', '/week/day/apply': 'applying', '/week/change/apply': 'applying', '/parent-notes/apply': 'applying',
};
// Dashboard, notes inbox and parent-view polls use the default loading phase.
const backgroundPhases = new Set(['loading']);
export function requestProgress() {
  const active = [...requests.values()];
  const foreground = active.filter(request => !request.background);
  return { count: active.length, blockingCount: foreground.length, backgroundCount: active.length - foreground.length, foreground: foreground[0] || null };
}
export const blockingCount = (progress = requestProgress()) => progress.blockingCount;
export const backgroundActive = (progress = requestProgress()) => progress.backgroundCount > 0;
const notify = () => { const snapshot = requestProgress(); for (const listener of listeners) listener(snapshot); };
export function watchRequests(listener) { listeners.add(listener); listener(requestProgress()); return () => listeners.delete(listener); }
export function beginRequest(path, demo = false, { background = false } = {}) {
  const id = ++sequence;
  const phase = phases[path.split('?')[0]] || 'loading';
  // Keep no URL, token, prompt or note text in progress state.
  requests.set(id, { id, phase, background: background || backgroundPhases.has(phase), demo, startedAt: performance.now() }); notify();
  return () => { requests.delete(id); notify(); };
}
