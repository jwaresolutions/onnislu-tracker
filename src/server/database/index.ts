// Database module exports
export { DatabaseConnection, getDatabaseConnection, initializeDatabase } from './connection';
export { MigrationManager, Migration } from './migrations';
export { DatabaseUtils } from './utils';

// Re-export types for convenience
export * from '../../shared/types/database';