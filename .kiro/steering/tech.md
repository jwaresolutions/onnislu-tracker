# Technology Stack

## Backend

- **Runtime**: Node.js 18+
- **Framework**: Express.js with TypeScript
- **Database**: SQLite3 with WAL mode
- **Web Scraping**: Puppeteer
- **Scheduling**: node-cron
- **Validation**: Joi
- **Logging**: Winston
- **Security**: Helmet, CORS

## Frontend

- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite
- **UI Library**: Material-UI (MUI) v5
- **Routing**: React Router v6
- **HTTP Client**: Axios
- **Charts**: Recharts
- **Date Utilities**: date-fns

## Development Tools

- **TypeScript**: v5.2+ with strict mode enabled
- **Testing**: Jest with ts-jest
- **Linting**: ESLint with TypeScript plugins
- **Process Management**: Nodemon, Concurrently

## Build System

TypeScript compilation with separate configs:
- `tsconfig.json` - Server code (CommonJS, ES2020)
- `tsconfig.server.json` - Server-specific overrides
- `src/client/tsconfig.json` - Client code (ESNext, React JSX)

Path aliases configured:
- `@shared/*` - Shared types and constants
- `@server/*` - Server modules (backend only)
- `@/*` - Client source (frontend only)

## Common Commands

```bash
# Development
npm run dev                 # Run both server and client concurrently
npm run dev:server          # Server only (nodemon + ts-node)
npm run dev:client          # Client only (Vite dev server)

# Build
npm run build               # Build server and client for production
npm run build:server        # Compile TypeScript to dist/
npm run build:client        # Build client to src/client/dist/

# Start
npm start                   # Run production build

# Testing & Quality
npm test                    # Run Jest tests
npm run test:watch          # Jest in watch mode
npm run lint                # ESLint check
npm run lint:fix            # ESLint auto-fix

# Database
npm run migrate             # Run database migrations
npm run seed                # Seed initial data
npm run download:plans      # Download floor plan images

# Docker
docker-compose up -d --build                      # Development (unminified)
docker-compose -f docker-compose.prod.yml up -d   # Production (minified)
docker-compose -f docker-compose.dev.yml up       # Live reload
```

## Environment Configuration

Copy `.env.example` to `.env` and configure:
- Server: PORT, CORS_ORIGIN, LOG_LEVEL
- Scraping: SECURECAFE_URL, DEFAULT_WINGS, SCRAPER_* settings
- Buildings: BUILDING_FAIRVIEW_URL, BUILDING_BOREN_URL

Database file defaults to `data/onnislu_tracker.db`.
