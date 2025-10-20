# Architecture and Code Structure

This document summarizes the repository layout, runtime components, and data flow. File links point to their locations for quick navigation.

Core applications
- Backend API and scraper: [src/server/index.ts](src/server/index.ts)
- React client: [src/client/src/App.tsx](src/client/src/App.tsx)
- Shared types and constants: [src/shared](src/shared)

Directory layout
- Root
  - Runtime and ops
    - [Dockerfile](Dockerfile)
    - [docker-compose.yml](docker-compose.yml)
    - [docker-compose.dev.yml](docker-compose.dev.yml)
    - [package.json](package.json)
    - [tsconfig.json](tsconfig.json)
    - [tsconfig.server.json](tsconfig.server.json)
    - [jest.config.js](jest.config.js)
    - [.env.example](.env.example)
  - Assets
    - [public/](public)
    - [public/plan-images/](public/plan-images)
- Server: [src/server](src/server)
- Client: [src/client](src/client)
- Shared: [src/shared](src/shared)

Backend (Node.js + Express)
- Entry point: [src/server/index.ts](src/server/index.ts)
  - Loads security middleware (helmet, CORS), request parsing, logging, static file serving, routes, database initialization, and scheduler startup.
  - Serves client build in production; returns 404 for unknown routes in development.
- Routing: [src/server/routes/index.ts](src/server/routes/index.ts)
  - Aggregates feature routers:
    - Floor plans: [src/server/routes/floorPlans.ts](src/server/routes/floorPlans.ts)
    - Prices: [src/server/routes/prices.ts](src/server/routes/prices.ts)
    - Alerts: [src/server/routes/alerts.ts](src/server/routes/alerts.ts)
    - Availability: [src/server/routes/availability.ts](src/server/routes/availability.ts)
    - Export: [src/server/routes/export.ts](src/server/routes/export.ts)
    - Status and health: [src/server/routes/status.ts](src/server/routes/status.ts)
    - Scraper control: [src/server/routes/scraper.ts](src/server/routes/scraper.ts)
- Middleware
  - Request logger: [src/server/middleware/requestLogger.ts](src/server/middleware/requestLogger.ts)
  - Validation helpers: [src/server/middleware/validation.ts](src/server/middleware/validation.ts)
  - Error handling and 404: [src/server/middleware/errorHandler.ts](src/server/middleware/errorHandler.ts)
- Services
  - Scraper orchestration: [src/server/services/ScraperService.ts](src/server/services/ScraperService.ts)
  - Scheduling (cron): [src/server/services/SchedulerService.ts](src/server/services/SchedulerService.ts)
  - Data/core ops: [src/server/services/DataService.ts](src/server/services/DataService.ts)
  - Alerts: [src/server/services/AlertService.ts](src/server/services/AlertService.ts)
  - Export: [src/server/services/ExportService.ts](src/server/services/ExportService.ts)
  - Parsers
    - Floor plan parser: [src/server/services/parsers/floorPlanParser.ts](src/server/services/parsers/floorPlanParser.ts)
- Database
  - Connection and lifecycle: [src/server/database/connection.ts](src/server/database/connection.ts)
  - Entry barrel: [src/server/database/index.ts](src/server/database/index.ts)
  - Schema SQL: [src/server/database/schema.sql](src/server/database/schema.sql)
  - Init SQL (bootstrap): [src/server/database/init.sql](src/server/database/init.sql)
  - Migrations runner: [src/server/database/migrations.ts](src/server/database/migrations.ts)
  - Seeding script: [src/server/database/seed.ts](src/server/database/seed.ts)
  - Utilities: [src/server/database/utils.ts](src/server/database/utils.ts)
- Configuration
  - Scraper runtime defaults: [src/server/config/scraper.ts](src/server/config/scraper.ts)
  - Environment template: [.env.example](.env.example)
- Logging
  - Winston logger: [src/server/utils/logger.ts](src/server/utils/logger.ts)
- Scripts
  - Migrate: [src/server/scripts/migrate.ts](src/server/scripts/migrate.ts)
  - Download floor plan images: [src/server/scripts/downloadPlanImages.ts](src/server/scripts/downloadPlanImages.ts)

API surface (high level)
- GET /api/status — health and version
- GET /api/floorplans — list floor plans and metadata
- GET /api/prices — list price history and latest prices
- GET /api/alerts — active or historical alerts
- POST /api/export — export data sets
- GET /api/availability — unit availability info
- POST /api/scraper/run — trigger a scrape job

Data flow
- Scheduler triggers scraping on an interval via [src/server/services/SchedulerService.ts](src/server/services/SchedulerService.ts)
- Scraper fetches remote pages (Puppeteer) via [src/server/services/ScraperService.ts](src/server/services/ScraperService.ts)
- HTML is parsed into normalized records by [src/server/services/parsers/floorPlanParser.ts](src/server/services/parsers/floorPlanParser.ts)
- Records persist to SQLite through [src/server/database/connection.ts](src/server/database/connection.ts)
- APIs serve aggregated views from the database through route handlers in [src/server/routes](src/server/routes)

Static assets
- Public files served at /static from [public](public).
- Cached plan images reside in [public/plan-images](public/plan-images).

Testing
- Jest setup file: [src/server/__tests__/setup.ts](src/server/__tests__/setup.ts)
- Integration tests: [src/server/__tests__/api-integration.test.ts](src/server/__tests__/api-integration.test.ts)
- Database tests: [src/server/__tests__/database.test.ts](src/server/__tests__/database.test.ts)
- Migrations tests: [src/server/__tests__/migrations.test.ts](src/server/__tests__/migrations.test.ts)
- Middleware tests: [src/server/__tests__/middleware.test.ts](src/server/__tests__/middleware.test.ts)
- Parser tests: [src/server/__tests__/parsers/floorPlanParser.test.ts](src/server/__tests__/parsers/floorPlanParser.test.ts)

Client (React + Vite)
- App shell: [src/client/src/App.tsx](src/client/src/App.tsx)
- Entry: [src/client/src/main.tsx](src/client/src/main.tsx)
- Vite config: [src/client/vite.config.ts](src/client/vite.config.ts)
- Local packages and TypeScript configs in [src/client](src/client)
- Feature structure
  - components: [src/client/src/components](src/client/src/components)
  - hooks: [src/client/src/hooks](src/client/src/hooks)
  - services: [src/client/src/services](src/client/src/services)
  - utils: [src/client/src/utils](src/client/src/utils)

Environment and configuration
- Copy [.env.example](.env.example) to .env and set required variables
- Key variables
  - PORT, CORS_ORIGIN, LOG_LEVEL
  - SECURECAFE_URL, DEFAULT_WINGS
  - SCRAPER_USER_AGENT, SCRAPER_CRAWL_DELAY_MS, SCRAPER_TIMEOUT_MS, SCRAPER_MAX_RETRIES, SCRAPER_RESPECT_ROBOTS
  - BUILDING_FAIRVIEW_URL, BUILDING_BOREN_URL

Build and scripts
- Development: npm run dev (concurrently runs API and client)
- Build: npm run build (server and client)
- Start: npm start (serves built server; client build served in production)
- Database ops
  - Migrate: npm run migrate
  - Seed: npm run seed
  - Download plan images: npm run download:plans

Operations and deployment
- Docker image: [Dockerfile](Dockerfile)
- Compose (prod): [docker-compose.yml](docker-compose.yml)
- Compose (dev): [docker-compose.dev.yml](docker-compose.dev.yml)
- Health endpoint exposed at GET /api/status