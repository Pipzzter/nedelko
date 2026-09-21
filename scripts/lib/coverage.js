import { relative, isAbsolute } from 'node:path';

export const MINIMUM_LINES = 91;
export const CRITICAL_MINIMUM_LINES = 90;
export const CRITICAL_FILES = [
  'backend/services/auth.js', 'backend/http/app.js', 'backend/http/security.js',
  'backend/domain/week.js', 'backend/domain/settings.js', 'backend/domain/constraints.js',
  'backend/domain/preferences.js', 'backend/domain/qc.js', 'backend/domain/aqi.js'
];
export function checkCoverage(lcov, expectedFiles, root) {
  const records = new Map();
  for (const block of lcov.split('end_of_record')) {
    const source = block.match(/^SF:(.+)$/m)?.[1].trim();
    if (!source) continue;
    const path = (isAbsolute(source) ? relative(root, source) : source).replaceAll('\\', '/');
    if (records.has(path)) throw new Error(`Duplicate coverage record: ${path}`);
    const lines = [...block.matchAll(/^DA:(\d+),(\d+)(?:,.*)?$/gm)];
    if (!lines.length) throw new Error(`Empty coverage record: ${path}`);
    records.set(path, { found: lines.length, hit: lines.filter(line => Number(line[2]) > 0).length });
  }
  const expected = expectedFiles.map(path => path.replaceAll('\\', '/'));
  const missing = expected.filter(path => !records.has(path));
  if (missing.length) throw new Error(`Coverage omitted source files:\n${missing.join('\n')}`);
  const groups = ['backend/', 'frontend/src/'].map(prefix => {
    const paths = expected.filter(path => path.startsWith(prefix));
    const found = paths.reduce((sum, path) => sum + records.get(path).found, 0);
    const hit = paths.reduce((sum, path) => sum + records.get(path).hit, 0);
    const percent = found ? 100 * hit / found : 0;
    return { scope: prefix, hit, found, percent, passed: found > 0 && percent >= MINIMUM_LINES };
  });
  const criticalFiles = expected.filter(path => CRITICAL_FILES.includes(path)).map(path => {
    const { hit, found } = records.get(path);
    const percent = 100 * hit / found;
    return { path, hit, found, percent, minimumLines: CRITICAL_MINIMUM_LINES, passed: percent >= CRITICAL_MINIMUM_LINES };
  });
  return { groups, criticalFiles, passed: groups.every(group => group.passed) && criticalFiles.every(file => file.passed) };
}

export function relativeLcov(lcov, root) {
  return lcov.replace(/^SF:(.+)$/gm, (_match, path) =>
    `SF:${(isAbsolute(path.trim()) ? relative(root, path.trim()) : path.trim()).replaceAll('\\', '/')}`);
}
