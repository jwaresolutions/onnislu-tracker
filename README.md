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

**Development Mode Features:**
- The client automatically uses mock data when running in development mode (via Vite's dev server)
- Mock data includes populated floor plans, price history, alerts, and system status
- A "DEV MODE - Mock Data" badge appears in the UI header
- This allows UI development without requiring a running backend or database
- To use real data in development, run the backend server and the client will connect via proxy

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

### Development
- `npm run dev` - Run API and client concurrently
- `npm run dev:server` - Start API only (ts-node + nodemon)
- `npm run dev:client` - Start Vite dev server only

### Build & Start
- `npm run build` - Build server and client for production
- `npm start` - Start built server (production mode)

### Testing & Quality
- `npm test` - Run all tests
- `npm test -- <filename>` - Run specific test file
- `npm run test:watch` - Run tests in watch mode
- `npm run lint` - Check code style
- `npm run lint:fix` - Auto-fix linting issues

### Database & Assets
- `npm run migrate` - Run database migrations
- `npm run seed` - Seed initial data
- `npm run download:plans` - Download/copy floor plan images

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
```bash
# Run all tests
npm test

# Run specific test file
npm test -- final-integration.test.ts

# Run tests in watch mode
npm run test:watch

# Run linting
npm run lint

# Auto-fix linting issues
npm run lint:fix
```

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

Production (minified, optimized) - **Recommended**:
```bash
docker-compose up -d --build
```

Development (unminified, easier debugging):
```bash
docker-compose -f docker-compose.dev.yml up -d --build
```

Live development with hot reload:
```bash
docker-compose -f docker-compose.dev.yml up --build --profile dev
```

Stop and remove containers:
```bash
docker-compose down
```

View logs:
```bash
docker-compose logs -f
```

Notes:
- Default `docker-compose.yml` uses `Dockerfile.prod` (minified production build)
- `docker-compose.dev.yml` uses `Dockerfile.dev` (unminified build with source maps)
- Development profile in `docker-compose.dev.yml` mounts source code for live reload
- Volumes map `./data` to `/app/data` and `./backups` to `/app/backups`
- Healthcheck hits `http://localhost:3001/api/status`
- Ports: 3001 (API), 3000 (dev client when using dev profile)

## Production Deployment (Single Docker Image)

Build development image (unminified, with source maps):
- bash
  docker build -f Dockerfile.dev -t onnislu:dev .

Build production image (minified, optimized):
- bash
  docker build -f Dockerfile.prod -t onnislu:latest .

Run development image:
- bash
  docker run -d \
    -p 3001:3001 \
    -e NODE_ENV=development \
    -e PORT=3001 \
    -v "$(pwd)/data:/app/data" \
    --name onnislu-dev \
    onnislu:dev

Run production image:
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