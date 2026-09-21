# Postman API tests

The standalone [api-tests package](../../api-tests/package.json) contains a [Postman v2.1 collection](../../api-tests/postman/ekocuvar.postman_collection.json) and a [local environment](../../api-tests/postman/local.postman_environment.json). It exercises the real HTTP API with response assertions and chained session cookies, demo IDs, plan revisions, proposals and parent links.

## Run an isolated test

Requires Node.js 24+ and the package's pinned Postman CLI development dependency. From the repository root:

```sh
npm --prefix api-tests ci
npm run test:api
```

Alternatively, run `npm test` from `api-tests/`. The runner starts the application on an available loopback port with in-memory SQLite, runs the collection once, and closes the server/database even after an assertion failure. It does not load `.env`. Planning requests use synthetic demo conditions and local library suggestions; the isolated provider rejects live-condition requests. No provider keys, Docker, existing accounts or persisted plans are needed.

The CLI runs the local collection file without a Postman login or cloud collection ID and disables analytics with `--no-report-events`. A request/script failure returns a nonzero process exit code. Request, script and total-run timeouts bound the test. The environment JSON is never rewritten with generated credentials.

## Run against a native or Docker app

Start the application with `npm start` or `docker compose up --build -d --wait app`, then run:

```sh
npm --prefix api-tests run test:local
```

The default target is `http://127.0.0.1:4173`. To use a different local port:

```sh
npm --prefix api-tests run test:local -- --base-url http://127.0.0.1:4174
```

The runner accepts only loopback HTTP origins, matching the application's Host/origin restrictions. Each complete run creates one disposable `api-tests-…@example.test` account. The API has no account-deletion route, so this account remains in a persistent app database. All plan writes use the newly generated demo ID. Successful cleanup revokes its parent link, deletes its demo week, logs out and clears runtime variables. An interrupted run can leave its demo until expiry; the isolated command discards everything when its process ends.

## Import into Postman

1. Import both JSON files linked above.
2. Select **EkoCuvar local** as the environment and confirm `baseUrl` matches your running app.
3. Run **EkoCuvar local API regression tests** with all six folders in order, one iteration.
4. For individual requests, first run their setup requests. The first configuration request resets the collection's runtime values. Later requests depend on captured IDs and the latest revision.

Each request disables Postman's shared cookie jar and explicitly sends this run's `sessionCookie`. Anonymous parent requests send an empty cookie. This keeps an existing browser/Postman account out of the suite. Do not replace the generated credentials with a real teacher account. Runtime credentials and parent tokens are marked secret in the environment and cleared by successful cleanup; do not export populated runtime values after an interrupted run.

| Variable | Purpose |
| --- | --- |
| `baseUrl` | Running local API origin; defaults to port 4173 |
| `locationId` | Initial supported location, `centar` |
| `demoWeek` | Fixed synthetic example, `independence` |
| `email`, `password`, `sessionCookie`, `revokedCookie` | Generated account/session data; initially blank |
| `demoId`, `week`, `settings`, `revision`, `previousRevision` | Server-returned demo state and revision checks |
| `editDate`, `mealRowId`, `activityRowId` | Future open demo day and editable timeline rows |
| `proposalId`, `parentToken`, `noteId`, `noteNonce`, `ownerId` | Chained suggestion, sharing, note and account identifiers |

Keep one iteration per run. The API deliberately limits authentication attempts to 12 per 15 minutes per client address; repeated runs against the same persistent server can reach that limit. The isolated command starts with fresh limiter state every time.

## Scope and maintenance

The six folders cover public configuration and request boundaries; registration/login/logout and session revocation; demo generation, holidays, pollution refresh, city changes, recheck and approval; weekly/direct edits, drag/arrow reorder requests, reviewed time boundaries, persistence after refresh and reviewed suggestions; anonymous sharing, note deduplication, teacher review and revocation; and cleanup. Assertions verify bilingual messages, explicit demo provenance, stale-revision rejection, preserved row durations and order, contiguous times, single-use proposals, approval invalidation, and separation of demo notes from the account inbox.

These are HTTP workflow checks with synthetic data, not live-provider or model-quality validation. Account-owned plan persistence and cross-account isolation remain covered by the deterministic backend tests. `npm run verify` continues to enforce backend/frontend source coverage; `npm run test:api` is an additional explicit collection run. The root syntax check and Sonar scan include the API runner as tooling, with the same coverage treatment as other scripts. No application source is removed from coverage.

Edit the checked-in collection directly, preserving setup order and exact expected status/error codes. Run `npm run test:api` after collection changes, and `npm run verify` plus Sonar after code changes. Dependency versions are locked in the package's own lockfile and do not add server runtime dependencies.

Official references: [Postman CLI installation](https://learning.postman.com/docs/postman-cli/postman-cli-installation), [running local collections](https://learning.postman.com/docs/postman-cli/postman-cli-run-collection), and [collection schemas](https://schema.postman.com/).
