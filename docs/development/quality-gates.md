# Tests, coverage and local push gates

## Test strategy

Use Node 24+ and `npm ci`. The runtime has no npm dependencies; `linkedom` supports rendered UI tests. `npm test` discovers backend, frontend and tooling tests. Domain tests validate evidence, scheduling and messages; API tests use real loopback HTTP and SQLite; storage tests reopen a real temporary database; DOM tests render Preact. Providers use synthetic fixtures and injected clocks rather than paid/live requests. These are regression tests, not proof of actual teacher use.

```sh
npm test
npm run test:coverage
npm run verify
```

`verify` also checks JavaScript syntax and local documentation links. A machine must permit loopback listeners for the API/DOM suite. The scripts never load application `.env` for tests.

## Coverage contract

The minimum is **91% lines for backend and frontend independently**, strictly above 90%. Native V8 coverage measures every authored `.js` in `backend/` (except tests) and `frontend/src/`. Startup, providers, UI and locale modules are included. Node only reports loaded files, so a second source-inventory check rejects missing modules. Do not exclude low-coverage source just to pass.

LCOV is written to `coverage/lcov.info` with repository-relative paths for the scanner. After successful tests and complete source inventory, `coverage/summary.json` records each scope’s hit/found lines and pass status. Reports are deleted before a new coverage run; failed tests cannot reuse an old summary. Branches and functions are reported by Node without a separate local percentage floor. V8 counts lines differently from some other tools, including non-executable source lines; assess assertions as well as the metric.

Tooling regression tests cover threshold boundaries, missing source, ref matching, token handling and weakened Sonar configuration. Tooling is scanned by Sonar but excluded from application line coverage. Third-party browser vendor code is excluded from both application coverage and source analysis. No current coverage result should be inferred from the configured threshold; see [verification status](verification-status.md).

## Analysis package

Sonar tooling lives in `static-analysis/`, including its private environment file, Compose services, scanner configuration and policy tests. The root `sonar:configure` and `sonar:scan` commands delegate to this package. The application Compose stack starts only the application. Analysis keeps the existing `ekocuvar` Compose project/volume names and Sonar project key so local history and data remain available. Never use `--remove-orphans` across the two stacks.

For an existing checkout, move the private `.env.sonar` file to `static-analysis/.env` without overwriting a configured destination. Move any custom `SONAR_PORT` or `SONAR_DB_PASSWORD` settings from the root environment into that analysis environment. Keep `APP_PORT` in the root `.env`.

## One-time SonarQube setup

```sh
npm --prefix static-analysis start
```

1. Open `http://127.0.0.1:9000`, sign in as `admin` / `admin`, and change the password.
2. Under **My Account → Security**, generate a **user token** with permission to create a project and administer quality gates.
3. Copy `static-analysis/.env.example` to `static-analysis/.env` if the destination does not exist. Add the token and local Sonar URL. Never commit or print this file.
4. Run `npm run sonar:configure`. It creates a private `ekocuvar` project and an `EkoCuvar` quality gate copied from Sonar way. It sets overall `line_coverage` and `new_coverage` to at least 91% and assigns the gate to the project. Re-running reconciles these conditions without resetting Sonar data.
5. For routine scans, create a non-admin local scanner account with Browse and Execute Analysis permissions on `ekocuvar`, generate a **user token** for that account, and replace the setup token in `static-analysis/.env`. Revoke the temporary admin setup token after verifying the scanner account. The pinned SonarQube 26.9 server rejects project analysis tokens on `qualitygates/get_by_project` with HTTP 403, so this wrapper needs a user token to read and validate the gate before scanning. Keep administration credentials out of routine use; use an admin setup token again when reconciling the project or gate.

Sonar’s new-code metric combines line/condition coverage and can be stricter than the local line threshold. The inherited Sonar way rules also check new issues, duplication and security review. Existing findings must be assessed; a green test suite does not imply a green Sonar gate. No blanket suppressions or silent missing-token skip are configured.

```sh
npm run verify
npm run sonar:scan
# Or run both as one local check:
npm run gate
```

The scanner starts Sonar as needed, verifies that the project’s assigned gate still enforces >=91% overall lines, uploads LCOV and waits up to 300 seconds for the quality-gate verdict. Timeout, authentication errors or a failed verdict return nonzero. `sonar:scan` consumes the most recent successful coverage run; use `gate` to guarantee tests run immediately before analysis.

The Community Build project records the latest local analysis in one project stream. This configuration does not provide separate dashboards for each Git branch. SCM integration is disabled because the scanner receives selected source mounts, not the host Git directory; do not interpret the dashboard as a Git blame/history report.

## Install the pre-push hook

The installer and push gate use the standard Git executable directly: `/usr/bin/git` on Unix, or `C:\Program Files\Git\cmd\git.exe` on Windows. Install Git at that location. This prevents a caller's `PATH` from selecting another executable; a regression test checks installation with a hostile PATH and preservation of an existing custom hook.

```sh
npm run hooks:install
git config --get core.hooksPath
# Expected: .githooks
```

Git does not enable versioned hooks when cloning. Installation sets the repository-local hook path and executable bit; no commit or push occurs. If another `core.hooksPath` exists, installation fails rather than replacing it. Chain this project's `.githooks/pre-push` from that existing hook, forwarding Git's arguments and stdin.

Every push containing source refs requires a clean worktree, including untracked files, and each pushed ref must resolve to checked-out HEAD. Annotated tags at HEAD work; other branch tips must be checked out and pushed separately. Tests, coverage and completed Sonar analysis run before Git transfers refs. The hook rechecks HEAD/worktree after verification to catch edits during a scan. Deletion-only pushes have no source to analyze.

`npm run gate` allows uncommitted changes for iteration; the hook enforces the stricter push policy. Missing tokens or tools fail closed. There is no project-specific skip switch. Git’s `--no-verify` and hook configuration can bypass local hooks; centrally mandatory enforcement needs remote CI or a server policy.

## Troubleshooting

| Failure | Action |
| --- | --- |
| Missing `SONAR_TOKEN` | Complete setup in `static-analysis/.env` |
| Missing `linkedom` | Run `npm ci` with registry access |
| `listen EPERM` | Run in a session that permits local HTTP listeners |
| Coverage omitted source | Add meaningful tests exercising that module |
| Coverage below 91% | Use the uncovered-line report to add behavior assertions |
| Quality gate weakened/missing | Run `npm run sonar:configure` with an admin setup token |
| Sonar quality gate failed | Review the local Sonar project’s issues and coverage |
| Dirty tree/ref mismatch | Commit or stash work; check out the actual source tip |
| Existing custom hook | Chain hooks explicitly; do not silently replace it |

References: [Node test coverage](https://nodejs.org/docs/latest-v24.x/api/test.html#collecting-code-coverage), [Sonar JavaScript LCOV](https://docs.sonarsource.com/sonarqube-community-build/analyzing-source-code/test-coverage/javascript-typescript-test-coverage), [ADR-0005](../architecture/adrs/0005-local-quality-gates.md).
