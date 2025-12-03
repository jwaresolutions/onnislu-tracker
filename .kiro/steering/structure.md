# Project Structure

## Monorepo Layout

```
├── src/
│   ├── server/          # Backend API and scraper
│   ├── client/          # React frontend (separate package)
│   └── shared/          # Shared TypeScript types
├── public/              # Static assets (floor plan images)
├── data/                # SQLite database files
├── logs/                # Winston log files
├── dist/                # Compiled server output
└── docs/                # Documentation
```

## Backend (`src/server/`)

```
src/server/
├── index.ts                    # Express app entry point
├── routes/                     # API route handlers
│   ├── index.ts               # Route aggregator
│   ├── floorPlans.ts          # GET /api/floorplans
│   ├── prices.ts              # GET /api/prices
│   ├── alerts.ts              # GET /api/alerts
│   ├── availability.ts        # GET /api/availability
│   ├── export.ts              # POST /api/export
│   ├── status.ts              # GET /api/status
│   └── scraper.ts             # POST /api/scraper/run
├── services/                   # Business logic
│   ├── ScraperService.ts      # Puppeteer orchestration
│   ├── SchedulerService.ts    # Cron job management
│   ├── DataService.ts         # Database operations
│   ├── AlertService.ts        # Price alert logic
│   ├── ExportService.ts       # CSV export
│   └── parsers/
│       └── floorPlanParser.ts # HTML parsing
├── database/                   # Database layer
│   ├── connection.ts          # SQLite connection management
│   ├── index.ts               # Exports and types
│   ├── migrations.ts          # Schema migrations
│   ├── utils.ts               # Query helpers
│   ├── schema.sql             # Table definitions
│   └── seed.ts                # Initial data
├── middleware/                 # Express middleware
│   ├── errorHandler.ts        # Error handling and 404
│   ├── requestLogger.ts       # Winston request logging
│   └── validation.ts          # Joi validation helpers
├── config/                     # Configuration
│   └── scraper.ts             # Scraper defaults
├── utils/                      # Utilities
│   └── logger.ts              # Winston logger instance
├── scripts/                    # Standalone scripts
│   ├── migrate.ts             # Run migrations
│   └── downloadPlanImages.ts  # Download images
└── __tests__/                  # Jest tests
    ├── setup.ts               # Test configuration
    ├── api-integration.test.ts
    ├── database.test.ts
    └── parsers/
        └── floorPlanParser.test.ts
```

## Frontend (`src/client/`)

Separate npm package with its own `package.json` and build config.

```
src/client/
├── index.html              # Vite entry HTML
├── vite.config.ts          # Vite configuration
├── package.json            # Client dependencies
├── tsconfig.json           # Client TypeScript config
└── src/
    ├── main.tsx            # React entry point
    ├── App.tsx             # Root component
    ├── components/         # React components
    │   ├── AlertPanel.tsx
    │   ├── AlertSettingsDialog.tsx
    │   ├── ErrorBoundary.tsx
    │   └── FilterPanel.tsx
    ├── hooks/              # Custom React hooks
    │   └── useFilters.ts
    ├── services/           # API client services
    ├── utils/              # Helper functions
    │   └── filterUtils.ts
    └── ...
```

## Shared (`src/shared/`)

TypeScript types and constants used by both frontend and backend.

```
src/shared/
├── types/
│   ├── index.ts           # Core types (Building, FloorPlan, etc.)
│   └── database.ts        # Database-specific types
└── constants/
    └── index.ts           # Shared constants
```

## Key Patterns

### Service Layer
- Services encapsulate business logic and database operations
- Singleton exports for convenience (e.g., `dataService`, `alertService`)
- Services accept optional database connection for testing
- All services call `init()` before operations

### Database Layer
- `DatabaseConnection` class manages SQLite connection lifecycle
- `DatabaseUtils` provides common query patterns
- All queries return `DatabaseResult` with `{ success, data?, error? }`
- Transactions supported via `executeTransaction()`
- WAL mode enabled for concurrent reads

### API Routes
- Routes are thin handlers that delegate to services
- Validation middleware uses Joi schemas
- Consistent response format: `{ success, data?, error?, message? }`
- Error handling middleware catches and formats errors

### Type Safety
- Shared types in `src/shared/types/` used by both frontend and backend
- Path aliases (`@shared/*`, `@server/*`, `@/*`) for clean imports
- Strict TypeScript mode enabled
- Database results typed with generics

### Testing
- Jest with ts-jest for TypeScript support
- Test files colocated in `__tests__/` directories
- `setup.ts` configures test environment
- Integration tests use in-memory SQLite database

## File Naming Conventions

- **Services**: PascalCase with `Service` suffix (e.g., `DataService.ts`)
- **Routes**: camelCase matching endpoint (e.g., `floorPlans.ts`)
- **Components**: PascalCase (e.g., `AlertPanel.tsx`)
- **Hooks**: camelCase with `use` prefix (e.g., `useFilters.ts`)
- **Utils**: camelCase (e.g., `filterUtils.ts`)
- **Tests**: Match source file with `.test.ts` suffix

## Import Patterns

```typescript
// Shared types (available in both frontend and backend)
import type { FloorPlan, Building } from '@shared/types';

// Server imports (backend only)
import { dataService } from '@server/services/DataService';
import logger from '@server/utils/logger';

// Client imports (frontend only)
import { useFilters } from '@/hooks/useFilters';
```

## Static Assets

- Floor plan images stored in `public/plan-images/`
- Served at `/static/plan-images/` by Express
- Downloaded via `npm run download:plans` script
- Naming convention: `{building}-plan_{name}.png`
