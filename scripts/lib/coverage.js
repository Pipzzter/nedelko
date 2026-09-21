import { relative, isAbsolute } from 'node:path';

export const MINIMUM_LINES = 91;
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
  return { groups, passed: groups.every(group => group.passed) };
}

export function relativeLcov(lcov, root) {
  return lcov.replace(/^SF:(.+)$/gm, (_match, path) =>
    `SF:${(isAbsolute(path.trim()) ? relative(root, path.trim()) : path.trim()).replaceAll('\\', '/')}`);
}
