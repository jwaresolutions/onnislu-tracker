# Mock Data for Development

## Overview

The application automatically uses mock data when running in development mode, allowing frontend development without requiring a running backend or populated database.

## How It Works

### Detection

The application detects development mode using Vite's built-in environment variables:

```typescript
export const isDevelopmentMode = () => {
  return import.meta.env.MODE === 'development' || import.meta.env.DEV;
};
```

### Mock Data Generators

Located in `src/client/src/utils/mockData.ts`:

- `generateMockFloorPlans(count)` - Creates realistic floor plan data with prices, availability, and metadata
- `generateMockHistory(basePrice, days)` - Generates price history with realistic fluctuations
- `generateMockAvailability()` - Creates available units list
- `generateMockAvailableSoon()` - Generates upcoming availability table
- `generateMockStatus()` - System status and database stats
- `generateMockLatestPrices()` - Latest price collection info
- `generateMockAlerts()` - Price drop and lowest price alerts

### Components Using Mock Data

1. **App.tsx** - Main application component
   - Floor plans list with 20 mock units
   - Available now/soon sections
   - System status and latest prices
   - Scraper simulation (2-second delay)

2. **AlertPanel.tsx** - Price alerts component
   - 3 mock alerts (price drops and lowest price)
   - Dismiss functionality works locally

3. **Price History Charts** - Historical price data
   - 60 days of realistic price fluctuations
   - Sine wave pattern with random variance

## Visual Indicators

When mock data is active, a warning badge appears in the UI header:

```
ONNISLU Availability (D/E)  [DEV MODE - Mock Data]
```

## Switching Between Mock and Real Data

### Use Mock Data (Development)
```bash
npm run dev:client
# or
docker-compose -f docker-compose.dev.yml up
```

The client runs in development mode and automatically uses mock data.

### Use Real Data (Development)
```bash
# Terminal 1: Start backend
npm run dev:server

# Terminal 2: Start client (will proxy to backend)
npm run dev:client
```

The client still runs in dev mode but connects to the real backend via Vite proxy.

### Production (Always Real Data)
```bash
npm run build
npm start
# or
docker-compose -f docker-compose.prod.yml up -d
```

Production builds never use mock data.

## Benefits

1. **Faster Development** - No need to wait for scraper or seed database
2. **Consistent Testing** - Same mock data every time
3. **Offline Development** - Work without backend running
4. **UI Prototyping** - Test layouts with populated data
5. **Demo Mode** - Show features without real data

## Customization

To modify mock data, edit `src/client/src/utils/mockData.ts`:

```typescript
// Change number of floor plans
const mockFloorPlans = generateMockFloorPlans(50); // default: 20

// Adjust price history range
const mockHistory = generateMockHistory(basePrice, 90); // default: 60 days

// Add more alerts
export const generateMockAlerts = () => {
  return [
    // Add your custom alerts here
  ];
};
```

## Docker Compose Environments

- `docker-compose.yml` - Development with unminified build (uses mock data in client)
- `docker-compose.dev.yml` - Live reload development (uses mock data in client)
- `docker-compose.prod.yml` - Production with minified build (never uses mock data)

The `NODE_ENV=development` environment variable in docker-compose files ensures Vite runs in development mode, activating mock data.
