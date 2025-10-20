# Deployment Guide

This guide covers deployment options for the ONNISLU server and client. For architecture details, see [docs/structure.md](docs/structure.md). For quick commands, see [README.md](README.md).

## Prerequisites

- Node.js 18+ and npm 9+ (bare metal)
- Docker 24+ and Docker Compose v2 (containers)
- Network access to target sites (for scraping)
- Writable data directory for SQLite (default ./data)

Key files:
- [Dockerfile](Dockerfile)
- [docker-compose.yml](docker-compose.yml)
- [docker-compose.dev.yml](docker-compose.dev.yml)
- [package.json](package.json)
- [src/server/index.ts](src/server/index.ts)

## Environment

Copy .env template and configure:
- bash
  cp .env.example .env
  # Edit values per environment (PORT, CORS_ORIGIN, SECURECAFE_URL, BUILDING_*_URL, etc.)

Notes:
- Default SQLite path is data/onnislu_tracker.db (bare metal).
- Compose maps ./data to /app/data by default.

## Option A: Docker Compose (Production)

Build and run detached:
- bash
  docker-compose up -d --build

What it does:
- Builds multi-stage image (server and client) via [Dockerfile](Dockerfile)
- Exposes API on port 3001
- Mounts ./data to /app/data and (if configured) ./backups to /app/backups
- Healthcheck hits http://localhost:3001/api/status

Check status:
- bash
  docker-compose ps
  docker-compose logs -f

Update:
- bash
  docker-compose pull
  docker-compose up -d --build

Stop:
- bash
  docker-compose down

## Option B: Docker Compose (Development, hot reload)

Run with live reload:
- bash
  docker-compose -f docker-compose.dev.yml up --build

Features:
- Mounts working directory into container
- Installs dependencies as needed
- Runs API (port 3001) and Vite dev (port 3000)
- See [docker-compose.dev.yml](docker-compose.dev.yml)

Stop:
- bash
  docker-compose -f docker-compose.dev.yml down

## Option C: Single Docker Image

Build:
- bash
  docker build -t onnislu:latest .

Run:
- bash
  docker run -d \
    -p 3001:3001 \
    -e NODE_ENV=production \
    -e PORT=3001 \
    -v "$(pwd)/data:/app/data" \
    --name onnislu \
    onnislu:latest

Optional backups volume:
- bash
  docker run -d \
    -p 3001:3001 \
    -e NODE_ENV=production \
    -e PORT=3001 \
    -v "$(pwd)/data:/app/data" \
    -v "$(pwd)/backups:/app/backups" \
    --name onnislu \
    onnislu:latest

Logs:
- bash
  docker logs -f onnislu

## Option D: Bare Metal (Node.js)

Install dependencies:
- bash
  npm ci
  (cd src/client && npm ci)

Build:
- bash
  npm run build

Configure environment:
- bash
  cp .env.example .env
  mkdir -p data

Run database tasks (optional):
- bash
  npm run migrate
  npm run seed

Start:
- bash
  NODE_ENV=production node dist/server/index.js

Stop:
- bash
  pkill -f "dist/server/index.js" || true

## Health and Monitoring

Health endpoint:
- HTTP GET /api/status (port 3001 by default)

Compose healthcheck:
- See [docker-compose.yml](docker-compose.yml) healthcheck section.

Basic curl check:
- bash
  curl -fsS http://localhost:3001/api/status

## Backups

SQLite file location:
- Bare metal: ./data/onnislu_tracker.db (default)
- Docker: /app/data/onnislu.db (via env in compose)

Simple host backup:
- bash
  mkdir -p backups
  cp data/*.db "backups/onnislu_$(date +%F_%H%M%S).db"

With Compose volume mounted:
- bash
  docker cp "$(docker compose ps -q app):/app/data/onnislu.db" "./backups/onnislu_$(date +%F_%H%M%S).db"

## Systemd (Optional, Bare Metal)

Create a service file (example):
- ini
  [Unit]
  Description=ONNISLU Price Tracker
  After=network.target

  [Service]
  Type=simple
  WorkingDirectory=/opt/onnislu
  Environment=NODE_ENV=production
  ExecStart=/usr/bin/node dist/server/index.js
  Restart=always
  RestartSec=10
  StandardOutput=journal
  StandardError=journal
  User=onnislu

  [Install]
  WantedBy=multi-user.target

Commands:
- bash
  sudo systemctl daemon-reload
  sudo systemctl enable onnislu.service
  sudo systemctl start onnislu.service
  sudo systemctl status onnislu.service

## CORS and Frontend

- Set CORS_ORIGIN in .env to point to your frontend origin.
- In production, server serves built client bundle; ensure the client build is output under dist/client.

## Puppeteer Runtime Notes

Docker image (Alpine) installs system Chromium:
- [Dockerfile](Dockerfile) sets PUPPETEER_EXECUTABLE_PATH to /usr/bin/chromium-browser
- PUPPETEER_SKIP_DOWNLOAD=true skips bundled Chromium download

Bare metal:
- Puppeteer downloads a compatible browser on first install (can be slow).
- Alternatively set PUPPETEER_EXECUTABLE_PATH to use a system browser if available.

## Troubleshooting

Port conflicts:
- bash
  lsof -i :3001 || sudo ss -lntp | grep 3001

Permissions:
- Ensure ./data exists and is writable by the runtime user/container.

CORS errors:
- Verify CORS_ORIGIN and that your frontend origin matches.

Healthcheck failing in Compose:
- Check container logs:
- bash
  docker-compose logs -f

TypeScript or runtime errors:
- bash
  npm run lint
  npx tsc -p tsconfig.server.json --noEmit

## Security

- Do not commit .env files or secrets.
- Restrict exposed ports as needed (e.g., bind to localhost or protect behind a reverse proxy).
- Keep dependencies updated and rebuild images after upgrades.
