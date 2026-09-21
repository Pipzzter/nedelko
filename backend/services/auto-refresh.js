import { skopjeParts } from '../config/index.js';

// Runs without a teacher's browser. Uses deterministic adaptation, never model calls.
export function startAutoRefresh({ store, refreshWeek, intervalMs = 60000, now = Date.now,
  onError = code => console.error(`[auto-refresh] ${code}`) }) {
  let running = false;
  let stopped = false;
  const status = { completed: 0, failed: 0, lastFailure: null };
  const failure = code => {
    status.failed++; status.lastFailure = code;
    try { onError(code); } catch { /* A diagnostic sink cannot stop future refreshes. */ }
  };
  const tick = async () => {
    if (running || stopped) return;
    running = true;
    try {
      for (const row of store.weeksToRefresh(skopjeParts(new Date(now())).date)) {
        if (stopped) break;
        try { await refreshWeek(row.userId, row.weekStart); status.completed++; }
        catch { failure('week_refresh_failed'); }
      }
    } catch { failure('refresh_queue_failed');
    } finally { running = false; }
  };
  const timer = setInterval(tick, intervalMs);
  timer.unref();
  return { tick, status: () => ({ ...status, running, stopped }), stop() { stopped = true; clearInterval(timer); } };
}
