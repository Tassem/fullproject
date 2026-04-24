# MediaFlow — Local Docker Setup

## Requirements
- Docker Engine 24+
- Docker Compose v2+
- 4 GB RAM minimum

## Quick Start

```bash
# 1. Extract the archive
tar -xzf mediaflow_project.tar.gz
cd workspace   # or whatever the extracted folder is named

# 2. Start everything
docker compose up --build

# 3. Open the app
# Platform UI  → http://localhost:3000
# API Server   → http://localhost:8080
# PostgreSQL   → localhost:5432
```

## Services

| Service  | Port | Description              |
|----------|------|--------------------------|
| platform | 3000 | React/Vite frontend (nginx) |
| api      | 8080 | Express API server       |
| db       | 5432 | PostgreSQL 16            |

## Environment Variables

Edit `docker-compose.yml` to change:
- `SESSION_SECRET` — JWT signing secret (change for production!)
- `VITE_API_URL` — API URL visible to the browser

## Database

- The API server runs Drizzle `push` migrations automatically on first start.
- Data is persisted in the `postgres_data` Docker volume.
- To reset the DB: `docker compose down -v`

## Admin Account

After first run, register a user via the UI then promote to admin:

```bash
docker compose exec db psql -U mediaflow -c \
  "UPDATE users SET is_admin = true WHERE email = 'your@email.com';"
```

## Stopping

```bash
docker compose down          # stop (keep data)
docker compose down -v       # stop + delete all data
```
