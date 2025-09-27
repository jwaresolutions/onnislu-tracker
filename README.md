# ONNISLU Price Tracker

A React-based web application that tracks apartment prices at ONNISLU over time for two buildings (Fairview and Boren). The application collects floor plan data, displays pricing trends through interactive graphs, and provides visual representations of floor plans with their specifications.

## Features

- Automated web scraping of apartment pricing data
- Interactive price history visualization
- Floor plan specifications and availability tracking
- Price change alerts and notifications
- Data export functionality
- Responsive Material Design interface
- Docker containerization for easy deployment

## Technology Stack

### Frontend
- React 18 with TypeScript
- Material-UI (MUI) v5
- Recharts for data visualization
- React Router for navigation
- Axios for API communication

### Backend
- Node.js with Express.js
- TypeScript
- Puppeteer for web scraping
- SQLite3 database
- Winston for logging
- node-cron for scheduling

## Getting Started

### Prerequisites
- Node.js 18 or higher
- Docker and Docker Compose (for containerized deployment)

### Development Setup

1. Install dependencies:
```bash
npm install
cd src/client && npm install
```

2. Start development servers:
```bash
npm run dev
```

This will start both the backend server (port 3001) and frontend development server (port 3000).

### Docker Deployment

1. Build and run with Docker Compose:
```bash
docker-compose up --build
```

2. For development with hot reload:
```bash
docker-compose -f docker-compose.dev.yml up --build
```

### Available Scripts

- `npm run dev` - Start development servers
- `npm run build` - Build for production
- `npm start` - Start production server
- `npm test` - Run tests
- `npm run lint` - Run ESLint

## Project Structure

```
├── src/
│   ├── client/          # React frontend application
│   │   ├── src/
│   │   │   ├── components/  # React components
│   │   │   ├── services/    # API service functions
│   │   │   ├── hooks/       # Custom React hooks
│   │   │   └── utils/       # Utility functions
│   │   └── package.json
│   ├── server/          # Node.js backend application
│   │   ├── services/    # Business logic services
│   │   ├── routes/      # API route handlers
│   │   ├── middleware/  # Custom middleware
│   │   └── database/    # Database utilities
│   └── shared/          # Shared types and constants
│       ├── types/       # TypeScript type definitions
│       └── constants/   # Shared constants
├── data/               # SQLite database storage
├── backups/           # Database backups
├── Dockerfile
├── docker-compose.yml
└── package.json
```

## License

MIT