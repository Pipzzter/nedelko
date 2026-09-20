// EPA Technical Assistance Document, May 2024, Table 6 and PM NowCast.
export const PM25_BREAKPOINTS = [
  [0, 9.0, 0, 50], [9.1, 35.4, 51, 100], [35.5, 55.4, 101, 150],
  [55.5, 125.4, 151, 200], [125.5, 225.4, 201, 300], [225.5, 325.4, 301, 500],
];
export function pm25Aqi(value) {
  if (!Number.isFinite(value) || value < 0) return null;
  const concentration = Math.floor(value * 10 + 1e-10) / 10;
  // EPA extends the highest breakpoint segment for values beyond AQI 500.
  const [lo, hi, ilo, ihi] = PM25_BREAKPOINTS.find(([lo, hi]) => concentration >= lo && concentration <= hi) ?? PM25_BREAKPOINTS.at(-1);
  return Math.round(((ihi - ilo) / (hi - lo)) * (concentration - lo) + ilo);
}
export function nowCast(hourly) {
  const values = hourly.slice(0, 12).map((v) => Number.isFinite(v) && v >= 0 ? v : null);
  if (values.slice(0, 3).filter((v) => v !== null).length < 2) return null;
  const available = values.filter((v) => v !== null);
  const max = Math.max(...available);
  const weight = max === 0 ? 1 : Math.max(0.5, Math.min(...available) / max);
  let sum = 0; let denominator = 0;
  values.forEach((value, index) => {
    if (value !== null) { sum += value * weight ** index; denominator += weight ** index; }
  });
  return Math.floor(sum / denominator * 10 + 1e-10) / 10;
}
export function category(aqi) {
  if (aqi === null) return { key: 'unknown', label: 'Нема процена', color: '#89948f' };
  if (aqi <= 50) return { key: 'good', label: 'Добар', color: '#4d8064' };
  if (aqi <= 100) return { key: 'moderate', label: 'Умерен', color: '#ba8b3b' };
  if (aqi <= 150) return { key: 'sensitive', label: 'За чувствителни групи', color: '#bf743e' };
  if (aqi <= 200) return { key: 'unhealthy', label: 'Нездрав', color: '#ba5e59' };
  if (aqi <= 300) return { key: 'very-unhealthy', label: 'Многу нездрав', color: '#8a6086' };
  return { key: 'hazardous', label: 'Опасен', color: '#81384c' };
}
