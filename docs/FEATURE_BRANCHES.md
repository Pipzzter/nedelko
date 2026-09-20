# Feature branches and merge guide

This document records the original feature stack based on `495c3b8` (`initial commit`). Those features are now reachable from local `main` through merge commits `0bed381`, `5f57669` and `938697a`. The original descriptions and commands below are historical, not instructions for the current branches. Remote freshness is not asserted.

The follow-up `refactor/align-demo-with-live` removes the classroom simulation from the current product and aligns the demo with account planning and read-only parent sharing. Its review base is `main` at `938697a`. Review the new change separately from the original feature history.

## Branches

| Order | Branch | Feature commit | Review title |
| --- | --- | --- | --- |
| 1 | `feat/guided-ai-planning` | `c9c9da6` | Guide teacher setup and support day-specific AI edits |
| 2 | `feat/parent-plan-sharing` | `a183ac3` | Share parent plans by URL and refresh daily indoor changes |
| 3 | `feat/connected-classroom-demo` | `8ce8a07` | Connect a 30-child classroom with a two-child family |

The final branch also includes a documentation commit covering operation, decision rules, product research and this merge guide. Branch descriptions are saved in local Git configuration and repeated below so they remain available after publishing.

These branches are stacked: branch 2 includes branch 1, and branch 3 includes both. Review each branch against its preceding branch. They are not three independent alternatives.

### 1. Guided AI planning

**Base:** `main`

Teachers complete three guided sections before creating a plan: group details, learning ideas and daily rhythm. Required fields, linked validation messages, timetable confirmation and larger clickable controls explain the first-use workflow. Kindergarten and group settings become a reusable profile.

Teachers can preview and apply a replacement for one upcoming day's lesson. Owner/revision checks prevent stale or cross-account application, other days and fixed timetable times are preserved, and failed AI responses leave the saved lesson intact. The interface distinguishes AI output from library fallback.

**Validated:** 117 tests; syntax checks for 66 JavaScript files in this branch's exact staged source tree.

### 2. Parent plan sharing

**Base:** `feat/guided-ai-planning`

Parents open an expiring URL with daily/weekly navigation and no login. Teacher briefs, account identifiers and AI diagnostics are excluded. Teachers can rotate or revoke the link; weekly message copying uses only its URL.

A running server refreshes active weeks every five minutes. Poor or uncertain air selects an existing indoor alternative and rebuilds the parent draft. No additional model request or external message delivery is needed for this adaptation.

**Validated:** 120 tests; syntax checks for 70 JavaScript files, including link privacy, access boundaries, revocation and automatic adaptation.

### 3. Connected classroom demo

**Base:** `feat/parent-plan-sharing`

The fictional Sunflowers classroom contains 30 children. Teacher Elena sees the roster and daily records; parent Ana's URL shows only her twins Mila and Luka. Attendance, absences, meal/rest records, observations, packing lists, acknowledgements and local messages work across the two views.

Six dated scenarios, visible-state synchronization, distinct morning/afternoon records, responsive layouts and persistent demo routes support repeatable walkthroughs. Parent pages have no teacher switch or login controls. Demo records remain isolated from real-account storage and AI requests.

**Validated:** 126 tests; syntax checks for 77 JavaScript files. Browser checks covered the guided form on desktop and 390px mobile, both languages, generation and parent daily navigation. A regression check verifies switching between demo URLs in the same tab loads the correct classroom.

## Review the changes

```sh
git log --oneline main..feat/connected-classroom-demo
git diff --stat main...feat/guided-ai-planning
git diff --stat feat/guided-ai-planning...feat/parent-plan-sharing
git diff --stat feat/parent-plan-sharing...feat/connected-classroom-demo
```

## Merge locally with a linear history

With `main` still at the base above and a clean working tree:

```sh
git switch main
git merge --ff-only feat/guided-ai-planning
git merge --ff-only feat/parent-plan-sharing
git merge --ff-only feat/connected-classroom-demo
npm test
npm run check
```

Fast-forward merges preserve the focused feature commits without creating merge commits. Do not squash the earlier stacked branches if you intend to merge the later branches unchanged. If `main` has advanced independently, update the stack against the new base before using these commands.

## Publish when ready

To publish the prepared branches yourself:

```sh
git push -u origin feat/guided-ai-planning
git push -u origin feat/parent-plan-sharing
git push -u origin feat/connected-classroom-demo
```

For stacked pull requests, use each branch's base and review title above, with its description as the PR body. If the repository uses GitHub merge commits, history will include those merges; the local fast-forward sequence above produces a linear history. Push `main` only after you choose to merge and verify it.

`.env`, local SQLite accounts/plans, caches and dependencies remain ignored. None are included in these commits. The local demo runs at http://127.0.0.1:4173; demo sessions expire after an hour or a server restart.
