import { skopjeParts } from '../config/index.js';

// Runs without a teacher's browser. Uses deterministic adaptation, never model calls.
export function startAutoRefresh({ store, refreshWeek, intervalMs = 300000, now = Date.now }) {
  let running = false;
  let stopped = false;
  const tick = async () => {
    if (running || stopped) return;
    running = true;
    try {
      for (const row of store.weeksToRefresh(skopjeParts(new Date(now())).date)) {
        if (stopped) break;
        try { await refreshWeek(row.userId, row.weekStart); } catch { /* Next tick retries. Never log private plans. */ }
      }
    } finally { running = false; }
  };
  const timer = setInterval(tick, intervalMs);
  timer.unref();
  return { tick, stop() { stopped = true; clearInterval(timer); } };
}
