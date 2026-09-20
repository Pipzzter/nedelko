const requests = new Map(); const listeners = new Set(); let sequence = 0;
const phases = {
  '/week/generate': 'generation', '/week/day/suggest': 'suggestion', '/week/change/suggest': 'suggestion',
  '/parent-notes/suggest': 'noteSuggestion', '/week/day/apply': 'applying', '/week/change/apply': 'applying', '/parent-notes/apply': 'applying',
};
export const requestProgress = () => ({ count: requests.size, foreground: [...requests.values()].find(request => request.phase !== 'loading') || null });
const notify = () => { const snapshot = requestProgress(); for (const listener of listeners) listener(snapshot); };
export function watchRequests(listener) { listeners.add(listener); listener(requestProgress()); return () => listeners.delete(listener); }
export function beginRequest(path, demo = false) {
  const id = ++sequence;
  // Keep no URL, token, prompt or note text in progress state.
  requests.set(id, { id, phase: phases[path] || 'loading', demo, startedAt: performance.now() }); notify();
  return () => { requests.delete(id); notify(); };
}
