# ONNISLU Price Tracker

Tracks apartment prices, availability, and floor plans for ONNISLU buildings. Backend scrapes and persists data; frontend visualizes trends and exports data.

See architecture overview in docs/structure.md.

## Features
- Automated scraping with Puppeteer and scheduled runs
- REST API for prices, floor plans, availability, and exports
- Interactive React UI (Vite)
- SQLite persistence with migrations and seed
- Health/status endpoint
- Dockerized production build and Compose recipes

## Project Structure (brief)
- Backend API and scraper: src/server
- Client app (Vite + React): src/client
- Shared types/constants: src/shared
- Detailed layout: docs/structure.md

## Prerequisites
- Node.js 18+
- npm 9+ (or compatible)
- macOS/Linux/Windows
- Optional: Docker 24+ and Docker Compose v2

## Quick Start (Development)
1) Clone and install
- bash
  npm ci
  cd src/client && npm ci

2) Configure environment
- bash
  cp .env.example .env
  # Edit .env as needed (see "Environment Variables" below)

3) Run dev servers (API on 3001, client on 3000)
- bash
  npm run dev

## Environment Variables
Copy .env.example to .env and set values:
- Server
  - PORT: API port (default 3001)
  - CORS_ORIGIN: Frontend origin (e.g., http://localhost:5173)
  - LOG_LEVEL: info | warn | error | debug
- Scraping
  - SECURECAFE_URL: SecureCafe search page URL
  - DEFAULT_WINGS: Filter wings (e.g., D,E)
  - SCRAPER_USER_AGENT: Browser UA string
  - SCRAPER_CRAWL_DELAY_MS: Delay between requests (ms)
  - SCRAPER_TIMEOUT_MS: Request timeout (ms)
  - SCRAPER_MAX_RETRIES: Retry attempts
  - SCRAPER_RESPECT_ROBOTS: true|false
- Buildings
  - BUILDING_FAIRVIEW_URL: Floor plans page URL
  - BUILDING_BOREN_URL: Floor plans page URL

Note: SQLite DB file defaults to data/onnislu_tracker.db. Docker examples mount ./data into the container.

## Scripts
- Dev
  - npm run dev: Run API and client concurrently
  - npm run dev:server: Start API (ts-node + nodemon)
  - npm run dev:client: Start Vite dev server
- Build & Start
  - npm run build: Build server and client
  - npm start: Start built server (production)
- Tests & Lint
  - npm test | npm run test:watch
  - npm run lint | npm run lint:fix
- Database & Assets
  - npm run migrate: Run DB migrations
  - npm run seed: Seed initial data
  - npm run download:plans: Download/copy floor plan images

## Database
- Default DB path: data/onnislu_tracker.db (created on first run)
- WAL mode enabled for reliability
- Migrations: src/server/database/migrations.ts
- Schema: src/server/database/schema.sql

Initialize (development):
- bash
  npm run migrate
  npm run seed

## Running Tests and Lint
- bash
  npm test
  npm run lint
  npm run lint:fix

## Production Deployment (Bare Metal)
1) Build
- bash
  npm ci
  cd src/client && npm ci
  cd ../..
  npm run build

2) Configure env
- bash
  cp .env.example .env
  # Set PORT, CORS_ORIGIN, and scraper/building URLs
  # Ensure data/ exists for SQLite
  mkdir -p data

3) Start
- bash
  NODE_ENV=production node dist/server/index.js

Optionally run migrations/seed before starting:
- bash
  npm run migrate
  npm run seed

## Production Deployment (Docker Compose)
Production (detached):
- bash
  docker-compose up -d --build

Development (live reload):
- bash
  docker-compose -f docker-compose.dev.yml up --build

Notes:
- Volumes map ./data to /app/data and (optionally) ./backups to /app/backups
- Healthcheck hits http://localhost:3001/api/status
- Ports: 3001 (API), 3000 (dev client)

## Production Deployment (Single Docker Image)
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

Optional: add a backups volume:
- bash
  docker run -d \
    -p 3001:3001 \
    -e NODE_ENV=production \
    -e PORT=3001 \
    -v "$(pwd)/data:/app/data" \
    -v "$(pwd)/backups:/app/backups" \
    --name onnislu \
    onnislu:latest

## API and Health
- Health: GET /api/status
- Floor plans: GET /api/floorplans
- Prices: GET /api/prices
- Alerts: GET /api/alerts
- Availability: GET /api/availability
- Export: POST /api/export
- Scraper control: POST /api/scraper/run

## Troubleshooting
- Puppeteer on Linux/macOS: The Docker image installs system Chromium. For bare metal, Puppeteer downloads a compatible browser automatically (first install may take time).
- Ensure data/ directory exists and is writable.
- CORS: Set CORS_ORIGIN to your frontend origin in .env.

## License
MIT