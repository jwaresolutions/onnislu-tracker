# Implementation Plan

- [x] 1. Set up project structure and development environment
  - Create Docker configuration with multi-stage build for React + Node.js application
  - Set up TypeScript configuration for both frontend and backend
  - Configure package.json files with required dependencies (React, Material-UI, Express, SQLite, Puppeteer)
  - Create directory structure for frontend components, backend services, and shared types
  - _Requirements: 5.1, 5.4_

- [x] 2. Implement database schema and data models
  - Create SQLite database initialization script with tables for buildings, floor_plans, price_history, alerts, and settings
  - Write TypeScript interfaces for all data models (Building, FloorPlan, PriceHistory, Alert, AlertSettings)
  - Implement database connection utilities with error handling and transaction support
  - Create database migration system for schema updates
  - Write unit tests for database operations
  - _Requirements: 9.1, 9.2, 9.3_

- [x] 3. Build core backend API structure
  - Create Express.js server with TypeScript configuration and middleware setup
  - Implement basic API endpoints structure for floor plans, prices, alerts, export, and status
  - Add request validation middleware and error handling
  - Create logging system with Winston for structured JSON logging
  - Write integration tests for API endpoints
  - _Requirements: 5.3, 5.1_

- [-] 4. Implement web scraping service
  - Create ScraperService class using Puppeteer to extract data from ONNISLU websites
  - Implement data extraction logic for floor plan details (name, bedrooms, bathrooms, den, square footage, position, price, availability)
  - Add error handling for website structure changes and network failures
  - Implement rate limiting and respectful scraping practices
  - Write unit tests with mock websites for scraper validation
  - _Requirements: 3.1, 3.3, 3.4, 2.2, 2.5_

- [ ] 5. Create data collection and scheduling system
  - Implement SchedulerService using node-cron for twice-daily data collection
  - Create DataService for database operations and price history management
  - Add logic to store only the lowest daily price as specified
  - Implement data collection status tracking and next collection time display
  - Write tests for scheduling and data collection logic
  - _Requirements: 3.1, 3.2, 3.6_

- [ ] 6. Build alert system for price changes
  - Create AlertService to detect significant price drops and lowest price records
  - Implement configurable alert thresholds (dollar amount or percentage)
  - Add alert generation logic with proper data validation
  - Create API endpoints for alert management and settings configuration
  - Write unit tests for alert detection and threshold configuration
  - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

- [ ] 7. Implement data export and import functionality
  - Create ExportService to generate CSV files with historical pricing data
  - Create ImportService to process and validate CSV file uploads
  - Add API endpoints for both CSV export and import with proper data formatting
  - Include all required fields (floor plan name, building, date, price, availability, square footage)
  - Implement data validation and conflict resolution for imports
  - Implement error handling for empty datasets and invalid import data
  - Write tests for both export and import functionality
  - _Requirements: 8.1, 8.2, 8.3, 8.4_

- [ ] 8. Create React application foundation
  - Set up React application with TypeScript and Material-UI theme configuration
  - Implement routing structure with React Router
  - Create main App component with navigation header
  - Add global error boundary and loading states
  - Configure Axios for API communication with error interceptors
  - _Requirements: 6.1, 6.2, 6.4_

- [ ] 9. Build floor plan display components
  - Create FloorPlanCard component to display individual floor plan information
  - Implement FloorPlanGrid component to show multiple floor plans
  - Add building identification and floor plan specifications display
  - Include lowest price and date information for each floor plan
  - Create responsive layout that adapts to different screen sizes
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 4.4_

- [ ] 10. Implement price visualization and charting
  - Create PriceChart component using Recharts for historical price display
  - Add interactive features for selecting date ranges and comparing floor plans
  - Implement comparative pricing graphs for multiple floor plans
  - Include building identification in chart legends and tooltips
  - Write tests for chart data processing and display logic
  - _Requirements: 1.1, 1.2, 1.3, 4.2_

- [ ] 11. Build filtering and search functionality
  - Create FilterPanel component with Material-UI form controls
  - Implement filtering by bedrooms, bathrooms, building, and special features
  - Add search functionality for floor plan names
  - Create filter state management and URL parameter synchronization
  - Include proper handling for no results scenarios
  - _Requirements: 4.1, 4.3, 4.5_

- [ ] 12. Implement alert display and management
  - Create AlertPanel component to display active price alerts
  - Add alert dismissal functionality with API integration
  - Implement alert type indicators (price drop vs lowest price)
  - Create settings panel for configuring alert thresholds
  - Add visual indicators for significant price changes
  - _Requirements: 7.3, 7.4, 7.5_

- [ ] 13. Add system status and data collection indicators
  - Create status display showing next data collection time
  - Add indicators for system health and last successful collection
  - Implement real-time updates for collection status
  - Create loading states during data collection periods
  - Add error messaging for collection failures
  - _Requirements: 3.6, 5.3_

- [ ] 14. Implement CSV export and import functionality in frontend
  - Create ExportDialog component with Material-UI dialog for data export
  - Add export button and download functionality
  - Create ImportDialog component with file upload and validation
  - Implement CSV import with data validation and conflict resolution
  - Add progress indicators for both export and import operations
  - Add error handling for export/import failures with detailed feedback
  - Create user feedback for successful operations
  - _Requirements: 8.3, 8.4_

- [ ] 15. Add comprehensive error handling and user feedback
  - Implement global error handling with user-friendly messages
  - Add retry mechanisms for failed API requests
  - Create offline detection and graceful degradation
  - Add loading spinners and skeleton screens for better UX
  - Implement proper error boundaries for component failures
  - _Requirements: 6.1, 6.4_

- [ ] 16. Create Docker deployment configuration
  - Write Dockerfile with multi-stage build for production optimization
  - Create docker-compose.yml for development and production environments
  - Configure volume mounts for database persistence and backups
  - Add health checks and container restart policies
  - Create startup scripts for database initialization
  - _Requirements: 5.1, 5.2, 5.4, 9.2, 9.3_

- [ ] 17. Implement backup and data persistence strategy
  - Create automated backup system for SQLite database
  - Add data integrity checks on application startup
  - Implement recovery mechanisms for corrupted data
  - Create backup scheduling and retention policies
  - Write tests for backup and recovery functionality
  - _Requirements: 9.1, 9.2, 9.3, 9.4_

- [ ] 18. Add comprehensive testing suite
  - Write unit tests for all React components using Jest and React Testing Library
  - Create integration tests for API endpoints using Supertest
  - Add end-to-end tests for critical user flows using Cypress
  - Implement performance tests for large datasets
  - Create test coverage reporting and CI/CD integration
  - _Requirements: All requirements through comprehensive testing_

- [ ] 19. Optimize performance and add monitoring
  - Implement database query optimization and indexing
  - Add performance monitoring for API response times
  - Create memory usage monitoring for long-running processes
  - Implement caching strategies for frequently accessed data
  - Add application health checks and metrics collection
  - _Requirements: 5.2, 5.3_

- [ ] 20. Final integration and deployment testing
  - Test complete application flow from data collection to user interface
  - Verify Docker container startup and data persistence across restarts
  - Test backup and recovery procedures
  - Validate all alert scenarios and export functionality
  - Perform load testing with simulated long-term operation
  - _Requirements: All requirements integrated and validated_