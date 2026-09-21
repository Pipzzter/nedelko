---
name: ekocuvar-pr-workflow
description: "Continue or reopen an EkoCuvar pull request, or create a focused branch and PR, using this repository's commit conventions and quality gates. Use for requests to publish changes, follow the same PR pattern, merge into main, and pull the result locally."
---

# EkoCuvar PR workflow

Carry the requested change through the authorized parts of the branch, commit, push, PR, merge, and local-sync cycle. Run commands from the repository root; project paths below are relative to that root, regardless of the skill's installation location. Use Git and an authenticated GitHub CLI (`gh`), or an available GitHub integration with equivalent operations.

## Scope and authorization

- Read the root and applicable scoped `AGENTS.md` files. Follow the current `docs/development/quality-gates.md`; historical branch documents are context, not current instructions or test evidence.
- An explicit request to use this skill for the full cycle, or to follow the quoted pattern of pushing, creating PRs, merging and pulling, authorizes those steps for the requested changes. Continue without asking again for authorization already given in the conversation.
- Automatic skill selection, a request to prepare a PR, or a request to create/edit this skill does not itself authorize publishing or merging. Respect narrower instructions such as local-only, draft-only, or do not merge. If authorization is missing, finish the locally reviewable result before asking only about the missing action.
- Preserve unrelated edits and staged files. Do not use blanket staging, discard work, stash another person's changes, force-push, delete branches, or bypass a gate to complete this workflow. An environmental permission error requires an allowed environment, not a different way around the restriction.

## Inspect the current state

1. Inspect `git status --short`, staged and unstaged diffs, `git branch -vv`, `git worktree list`, and `git remote -v`. Identify the task's files before changing branches or committing.
2. Read recent history with `git log -30 --format='%h %s'` and `git log -15 --no-merges --format='%h %s%n%b'`. Derive the target repository from the remotes and confirm the GitHub repository/base branch; do not hardcode a teammate's username or assume a fork is upstream.
3. Fetch the chosen remote and inspect its current `main`. Local remote-tracking refs alone do not establish current remote state. Check GitHub authentication without displaying tokens.
4. Find PRs for the relevant branch, including closed ones: `gh pr list --repo OWNER/REPO --state all --head BRANCH`. Inspect candidate PRs with `gh pr view` for state, merge time, base, head repository/branch/SHA, diff, and reviews. Match the change's purpose as well as the branch name.
5. If unrelated work makes the checkout unsuitable, use an isolated worktree and transfer only the requested changes. Preserve the original checkout and index. If ownership of an overlapping edit is unclear, ask a focused scope question while continuing independent preparation.

## Choose a branch and PR

| Observed state | Action |
| --- | --- |
| Matching PR is open | Continue its branch and update that PR. Do not create a duplicate. |
| Matching PR is closed and unmerged | Reopen it with `gh pr reopen NUMBER --repo OWNER/REPO` when its purpose still matches. Verify its head exists; restore a deleted head only from a verified commit/history and through the required push gate. If reopening is unavailable, create a replacement PR and reference the old one. |
| Matching PR was merged | Create a fresh branch from current remote `main` and a follow-up PR. A merged PR cannot be reopened. |
| No matching PR, or old PR has a different scope | Create a focused branch from current remote `main`, then open a new PR. |

Use lowercase, hyphenated branch names such as `feat/parent-message-format`, `fix/duration-aware-schedule-edits`, and `refactor/trim-planning-copy`. These names occur in the repository's merge history. For documentation-only work, use a descriptive `docs/...` name; this is a useful extension of the naming pattern, not a claim about an existing branch.

Keep one coherent behavior change per branch/PR. The history also contains stacked branches: if a change genuinely depends on an unmerged predecessor, base its PR on that predecessor, make the dependency explicit, and merge the oldest dependency first. After each merge, retarget the next PR to `main`, inspect its remaining diff, and recheck it. Do not impose a stack on independent changes.

When an existing shared branch needs updates from `main`, prefer merging the current base into it to rewriting published history. Resolve routine conflicts, review the resulting behavior, and rerun affected checks; ask only when a conflict requires a product decision that the task does not establish.

## Commit in the repository's style

Use English imperative subjects in the form `type(scope): concrete behavior`, with lowercase types and scopes. Choose `feat`, `fix`, or `refactor` according to the actual change. A plain `docs:` subject is also established here. Existing examples:

- `2d058c5`: `feat(parents): restructure the weekly note and clarify air-pollution days`
- `6527269`: `fix(schedule): enforce requested durations and explain timing conflicts`
- `e80f834`: `refactor(planning): remove parent-account and rhythm copy from the plan form`
- `650ed80`: `docs: document showcase workflow, product roadmap and feature merges`

Scopes include `planning`, `parents`, `schedule`, `conditions`, `sharing`, `auth`, `demo`, `ui`, `home`, and `navigation`. Choose the domain that changed; do not treat this as a closed list. Keep each commit focused. Add a body when it helps explain behavior or constraints, and include a `Validation:` paragraph only with results actually observed for this change. Never copy old test counts from commit bodies.

Stage explicit paths or hunks and review `git diff --cached` before committing. If the existing index contains unrelated work, isolate the task instead of committing that index wholesale. Update `docs/architecture/decision-basis.md` for material decision-rule changes and add an ADR when the project's documentation rules require one.

## Validate and publish

1. Use Node 24+ and install development dependencies with `npm ci` when needed. There is no application build step. On Windows, use `npm.cmd` when required by the shell.
2. Run the appropriate checks while developing. `npm run verify` includes syntax, documentation links, tests, and at least 91% line coverage separately for backend and frontend, including every authored application JS file.
3. Before pushing, install/check the required local hook with `npm run hooks:install`. Preserve any existing custom hook; follow the quality-gate documentation to chain it. Configure Sonar using that documentation, keeping credentials private.
4. Push only from a clean worktree, including untracked files, with the branch being pushed checked out at the exact commit being verified. The pre-push hook runs the full gate, including Sonar, and checks that HEAD and the tree remain unchanged. `npm run gate` runs that gate manually; a successful `verify` alone does not prove that Sonar passed.
5. Push the explicit feature branch to the confirmed remote, setting its upstream if needed. Never bypass the hook or silently skip Sonar. Fix failures within scope and retry after a relevant change; missing access, credentials, or unavailable services remain explicit blockers.
6. Create or update the PR against the intended base. Use a concise title in the same style as the change's commit. Lead the body with the concrete problem and resulting behavior; include current validation and material limitations. Write multiline descriptions to a temporary file and use `--body-file` to preserve newlines and avoid shell interpolation.

For a new PR, the command shape is `gh pr create --repo OWNER/REPO --base BASE --head BRANCH --title 'type(scope): concrete change' --body-file PATH`. Replace placeholders with inspected values; for forks, use the correct head owner. Recheck existing PRs before creating one, particularly after an ambiguous timeout. Respect draft-only requests and do not silently mark a draft ready.

## Merge and sync

1. Inspect the final PR diff, base, head SHA, review requirements, mergeability, and checks. Wait for required checks/reviews. An absence of remote checks does not prove the local gate ran. Confirm the remote head matches the commit that passed the local gate; if it changed, fetch, inspect, and validate the new head.
2. The recent history uses GitHub merge commits (`Merge pull request #24 ...`, for example). Prefer `gh pr merge NUMBER --repo OWNER/REPO --merge --match-head-commit VERIFIED_SHA` when repository rules permit it. Respect protected-branch and merge-queue requirements. Do not use administrator bypasses or silently substitute squash/rebase when that would disrupt an existing stack.
3. Verify GitHub reports the PR as merged and record the merge commit. A queued or auto-merge request is still pending; do not report completion until the merge is confirmed.
4. Once merged, update the local `main` checkout with `git switch main` followed by `git pull --ff-only REMOTE main`. If `main` belongs to another worktree, inspect and update that clean checkout instead. Preserve any dirty checkout or divergent local commits; do not reset them to make the pull succeed.
5. Confirm the merge commit is reachable from local `main`, inspect its relation to remote `main`, and report the PR link, commit(s), checks actually completed, and local sync status. Report any remaining blocker precisely. Delete branches only when separately requested.

If a push, reopen, PR creation, or merge returns an ambiguous result, inspect remote state before retrying. Never create duplicate PRs or claim a merge/pull succeeded from an attempted command alone.
