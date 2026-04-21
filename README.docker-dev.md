# Docker dev mode

`docker-compose.dev.yml` starts the local development stack without building custom Docker images:

- `postgres` uses the official `postgres:16-alpine` image
- `backend` uses the official `node:22-bookworm` image
- `realtime` uses the official `node:22-bookworm` image
- `frontend` uses the official `node:22-bookworm` image

Source code is not copied into images. The repository is mounted into containers with a bind mount at `.:/workspace`.

That means:

- containers always run the current code from the working tree;
- file changes on the host are visible inside containers immediately;
- `docker build` is not required for the dev workflow.

Each Node service uses its own named volume for `node_modules`. This avoids mixing Linux container dependencies with host-side Windows dependencies while keeping each service isolated from partially broken installs in sibling packages.

The frontend also keeps its `.next` directory in a dedicated Docker volume instead of the Windows bind mount. That reduces file-watcher churn and avoids aggressive rebuild loops caused by thousands of generated files under `frontend/.next`.

In Docker dev mode, the frontend uses `next dev --webpack` instead of Turbopack. This is intentionally more conservative on Windows bind mounts and avoids the extra child-process churn that can make the machine feel like it is spawning Node.js processes endlessly.

## Start

```bash
docker compose -f docker-compose.dev.yml up
```

Detached mode:

```bash
docker compose -f docker-compose.dev.yml up -d
```

## Stop

```bash
docker compose -f docker-compose.dev.yml down
```

Remove volumes as well:

```bash
docker compose -f docker-compose.dev.yml down -v
```

## Ports

- `frontend`: `http://localhost:5173`
- `backend`: `http://localhost:3000`
- `realtime`: `ws://localhost:2567`
- `postgres`: `localhost:5433`

## Runtime behavior

On startup, the `deps` service checks the root `package-lock.json` hash and verifies the expected package entrypoints in the per-workspace `node_modules` volumes. If the volumes are missing or stale, it runs a root `npm ci` once before the application services start.

The `shared` service builds `@mmorpg/shared`, writes `shared/.docker-dev-ready`, and then runs TypeScript in watch mode. `backend`, `realtime`, and `frontend` wait for the shared build before starting through their normal npm workspace scripts.

The frontend container also receives `BACKEND_INTERNAL_URL=http://backend:3000` so its server-side admin routes can validate bearer tokens against the backend instead of trusting client-side role checks.

If you already created Docker volumes before this dependency flow, recreate them once so the per-service `node_modules` and frontend `.next` volumes are attached cleanly:

```bash
docker compose -f docker-compose.dev.yml down -v
docker compose -f docker-compose.dev.yml up
```

The first startup can take longer because dependencies are installed into volumes. Later restarts should be faster.

If you change the Node.js Docker image tag, recreate the dependency volumes once so packages are reinstalled under the new runtime:

```bash
docker compose -f docker-compose.dev.yml down -v
docker compose -f docker-compose.dev.yml up
```

The frontend service intentionally does not use an automatic restart policy in dev mode. If `next dev` crashes, Compose now leaves the container stopped so you can inspect the error instead of getting a silent restart loop that repeatedly spawns new Node.js processes.

If you already have a large host-side `frontend/.next` directory from earlier runs, it is no longer used by Docker after this change. You can remove it manually when convenient to reclaim disk space.
