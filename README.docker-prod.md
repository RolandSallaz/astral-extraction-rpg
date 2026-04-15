# Docker production mode

`docker-compose.prod.yml` builds production images for `frontend`, `backend`, and `realtime`, then starts PostgreSQL and Kafka alongside them.

## Prepare env

Copy the example env file to `.env.production`:

```powershell
Copy-Item .env.production.example .env.production
```

```bash
cp .env.production.example .env.production
```

Fill in real values before the first start:

- `POSTGRES_PASSWORD`
- `NEXT_PUBLIC_REALTIME_URL`
- `CORS_ORIGINS` if the backend will be called from a browser outside the built-in Next.js proxy

## Start

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml up --build -d
```

## Stop

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml down
```

## What gets published

- `frontend`: `http://HOST:${FRONTEND_PORT}`
- `realtime`: `ws://HOST:${REALTIME_PORT}`
- `backend`: `127.0.0.1:${BACKEND_PORT}` on the Docker host only

`postgres` and `kafka` stay internal to the Compose network.

## Persistent data

- `./game-data` is bind-mounted into `backend`, `frontend`, and `realtime`
- `./frontend/data` is bind-mounted into `frontend`
- PostgreSQL and Kafka keep state in Docker named volumes

## Notes

- `NEXT_PUBLIC_REALTIME_URL` is compiled into the frontend bundle during image build. After changing it, rebuild the frontend image with `docker compose ... up --build`.
- This stack does not include TLS termination or a reverse proxy. Add Nginx/Caddy/Traefik separately if you want HTTPS or a single public port.
- The backend keeps TypeORM `synchronize` disabled in production by default. If you deploy to an empty database and still have no migrations, set `DB_SYNCHRONIZE=true` for the initial bootstrap, then turn it back off.
