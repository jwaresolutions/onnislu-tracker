import { DatabaseConnection } from '../database/connection';
import { MigrationManager, Migration, migrations } from '../database/migrations';

describe('Migration System', () => {
  let db: DatabaseConnection;
  let migrationManager: MigrationManager;
  const testDbPath = ':memory:';

  beforeEach(async () => {
    db = new DatabaseConnection(testDbPath);
    const result = await db.initialize();
    expect(result.success).toBe(true);
    
    migrationManager = new MigrationManager(db.getDatabase());
  });

  afterEach(async () => {
    await db.close();
  });

  describe('Migration Manager Initialization', () => {
    test('should create migrations table', async () => {
      await migrationManager.initializeMigrationsTable();
      const version = await migrationManager.getCurrentVersion();
      expect(typeof version).toBe('number');
      expect(version).toBeGreaterThanOrEqual(0);
    });

    test('should get current version', async () => {
      // Note: db.initialize() already ran migrations in beforeEach
      const version = await migrationManager.getCurrentVersion();
      expect(version).toBeGreaterThan(0); // Migrations were already applied during initialize
      expect(version).toBe(migrations[migrations.length - 1].version); // Should be at latest version
    });

    test('should get migration history', async () => {
      await migrationManager.initializeMigrationsTable();
      const history = await migrationManager.getMigrationHistory();
      
      expect(history.success).toBe(true);
      expect(Array.isArray(history.data)).toBe(true);
    });
  });

  describe('Migration Execution', () => {
    test('should run pending migrations', async () => {
      const result = await migrationManager.runMigrations(migrations);
      
      expect(result.success).toBe(true);
      
      // Check that version was updated
      const newVersion = await migrationManager.getCurrentVersion();
      expect(newVersion).toBeGreaterThan(0);
    });

    test('should handle no pending migrations', async () => {
      // Run migrations first
      await migrationManager.runMigrations(migrations);
      
      // Run again - should report no pending migrations
      const result = await migrationManager.runMigrations(migrations);
      
      expect(result.success).toBe(true);
      expect(result.data.applied).toBe(0);
    });

    test('should track applied migrations', async () => {
      await migrationManager.runMigrations(migrations);
      
      const history = await migrationManager.getMigrationHistory();
      expect(history.success).toBe(true);
      expect(history.data.length).toBeGreaterThan(0);
      
      const version = await migrationManager.getCurrentVersion();
      expect(version).toBeGreaterThan(0);
    });
  });

  describe('Migration Rollback', () => {
    beforeEach(async () => {
      // Apply migrations first
      await migrationManager.runMigrations(migrations);
    });

    test('should rollback a single migration', async () => {
      const currentVersion = await migrationManager.getCurrentVersion();
      expect(currentVersion).toBeGreaterThan(0);
      
      // Get the last migration
      const lastMigration = migrations[migrations.length - 1];
      
      const result = await migrationManager.rollbackMigration(lastMigration);
      expect(result.success).toBe(true);
      
      const newVersion = await migrationManager.getCurrentVersion();
      expect(newVersion).toBeLessThan(currentVersion);
    });
  });

  describe('Migration Error Handling', () => {
    test('should handle migration with invalid SQL', async () => {
      const invalidMigrations: Migration[] = [
        {
          version: 999,
          name: 'invalid_migration',
          up: 'INVALID SQL STATEMENT;',
          down: 'SELECT 1;'
        }
      ];
      
      const result = await migrationManager.runMigrations(invalidMigrations);
      expect(result.success).toBe(false);
    });
  });

  describe('Migration Integrity', () => {
    test('should maintain database consistency during failed migration', async () => {
      // Add migration that will fail
      const failingMigrations: Migration[] = [
        {
          version: 998,
          name: 'failing_migration',
          up: `
            CREATE TABLE temp_table (id INTEGER);
            INSERT INTO temp_table VALUES (1);
            INVALID SQL HERE;
          `,
          down: 'DROP TABLE temp_table;'
        }
      ];
      
      // Run migration (should fail)
      const result = await migrationManager.runMigrations(failingMigrations);
      expect(result.success).toBe(false);
      
      // Verify temp_table was not created (transaction rolled back)
      const tableCheck = await db.executeQuery(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='temp_table'"
      );
      expect(tableCheck.success).toBe(true);
      expect(tableCheck.data).toHaveLength(0);
    });
  });
});