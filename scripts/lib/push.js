export function pushedCommits(input) {
  const commits = [];
  for (const line of input.trim().split('\n').filter(Boolean)) {
    const parts = line.trim().split(/\s+/);
    if (parts.length !== 4 || !/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(parts[1])) throw new Error('Invalid Git pre-push input.');
    if (!/^0+$/.test(parts[1])) commits.push(parts[1]);
  }
  return [...new Set(commits)];
}

export function assertPushMatchesHead(commits, head, status, resolveCommit) {
  if (status.trim()) throw new Error('Push blocked: commit or stash tracked and untracked changes so the gate checks exactly what will be pushed.');
  for (const commit of commits) {
    if (resolveCommit(commit) !== head) throw new Error('Push blocked: each pushed ref must resolve to checked-out HEAD. Check out and push other tips separately.');
  }
}
