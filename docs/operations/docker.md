# Docker operation

## Start the stack

Use Docker Engine/Desktop with Compose v2.24+, and allocate sufficient memory for the app, PostgreSQL and Sonar’s Elasticsearch process. SonarSource documents a minimum of 4 GB for a small installation; allow additional memory for Docker and other services. On Linux, apply the current [Sonar host requirements](https://docs.sonarsource.com/sonarqube-community-build/server-installation/pre-installation/linux) before startup. The Compose file does not disable Elasticsearch bootstrap checks or require privileged containers.

```sh
docker compose up --build -d --wait
docker compose ps
```

The root stack starts only the application at `http://127.0.0.1:4173`. Start the separate analysis stack with `npm --prefix static-analysis start`; Sonar is at `http://127.0.0.1:9000`. PostgreSQL has no host port. The app and analysis services use separate networks. Start just the app with `docker compose up --build -d --wait app`. Sonar is not an app dependency.

`Dockerfile` copies the native application and vendored browser assets. It runs as the Node user without an installation/build step. Compose makes the root filesystem read-only and provides writable data/cache volumes and a small temporary filesystem. The app health check reads public configuration without querying external providers.

## Configuration and secrets

Root Compose reads `.env` for app substitutions; the analysis stack reads `static-analysis/.env`. Keep existing values; never overwrite a configured file just to follow a setup example. Optional variables:

| Variable | Default | Meaning |
| --- | --- | --- |
| `APP_PORT` | `4173` | Host loopback app port; container stays on 4173 |
| `SONAR_PORT` | `9000` | Host loopback Sonar port |
| `SONAR_DB_PASSWORD` | `ekocuvar-local-development` | Local analysis DB password; set before the first initialization |
| `OPENAI_API_KEY`, `OPENAI_MODEL` | Empty | Optional server-side educational generation |
| `PULSE_USERNAME`, `PULSE_PASSWORD` | Empty | Optional upstream credentials |

Native `PORT` does not control the container port. `BIND_HOST=0.0.0.0` is confined to the image; the published host port remains loopback and the API’s Host/origin checks remain unchanged. Native startup defaults to `127.0.0.1`.

Use `static-analysis/.env` for the scanner token and `SONAR_HOST_URL`. The npm analysis scripts load that file; the app never receives the scanner token. If you change `SONAR_PORT`, update the URL accordingly. The scanner uses the internal `http://sonarqube:9000` address. Avoid printing expanded Compose configuration when `.env` contains keys; `docker compose config --quiet` validates without printing them.

`.dockerignore` allowlists runtime inputs. Scanner mounts contain selected source directories and coverage, excluding `.env`, app databases and cached observations. Container environment variables remain visible to the Docker administrator; this is a local development stack, not a secret-management service.

## Persistence and backups

`app_data` holds `/app/.local/ekocuvar.sqlite` and its SQLite WAL/SHM files. `app_cache` holds provider caches. Sonar has separate `sonar_db`, `sonar_data`, `sonar_extensions`, `sonar_logs` and `scanner_cache` volumes. Native `.local/` and Docker’s `app_data` are separate databases; starting Docker does not import native accounts.

Stop the app before making a simple backup; copy the entire data directory to a private destination:

```sh
docker compose stop app
docker compose cp app:/app/.local ./ekocuvar-backup
docker compose start app
```

Keep backups outside version control and treat them as private. For Sonar metadata, back up its PostgreSQL database using PostgreSQL’s backup tools before upgrades. Changing `SONAR_DB_PASSWORD` after initialization does not rotate the database role password automatically.

`docker compose down` retains volumes. `down -v` deletes persistent data belonging to the selected stack; it is not the routine stop command. Restarting destroys only in-memory demos.

## Analysis and troubleshooting

Follow [quality gate setup](../development/quality-gates.md). A scanner run is a one-shot container, not a background app service. It waits for the server’s quality-gate result.

- **Port busy:** stop the native app or choose another `APP_PORT`.
- **Sonar unhealthy:** inspect `docker compose -f static-analysis/compose.yaml logs sonarqube sonar-db`; check memory and Linux limits.
- **Docker permission denied:** use a host/session that can access the Docker daemon.
- **Scanner permission errors:** scanner UID 1000 needs to read source and coverage mounts; avoid making private files world-readable to fix unrelated mounts.
- **Apple Silicon:** app and Sonar image support depends on the pinned tags. Docker Desktop may emulate scanner images without an ARM variant; account for startup cost.

Version changes are deliberate edits to `Dockerfile`/`compose.yaml`. Validate startup, persistence and the full gate after upgrades; a version tag is not an immutable image digest.

See the [official Sonar Docker example](https://github.com/SonarSource/docker-sonarqube/blob/master/example-compose-files/sq-with-postgres/docker-compose.yml) and [scanner documentation](https://docs.sonarsource.com/sonarqube-community-build/analyzing-source-code/scanners/sonarscanner).
