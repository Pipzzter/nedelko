// Test-only legacy parser: application editors use native time inputs.
// Friendly 24-hour typing is stored as canonical HH:MM values.
export function parseTimeRange(value) {
  const match = /^\s*(\d{1,2}):([0-5]\d)\s*[-–]\s*(\d{1,2}):([0-5]\d)\s*$/.exec(value);
  if (!match || Number(match[1]) > 23 || Number(match[3]) > 23) return null;
  const start = `${match[1].padStart(2, '0')}:${match[2]}`;
  const end = `${match[3].padStart(2, '0')}:${match[4]}`;
  return end > start ? { start, end } : null;
}
