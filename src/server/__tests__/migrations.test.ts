import { DatabaseConnection } from '../database/connection';
import { MigrationManager, Migration } from '../database/migrations';

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
      const version = await migrationManager.getCurrentVersion();
      expect(typeof version).toBe('number');
      expect(version).toBeGreaterThanOrEqual(0);
    });

    test('should get current version', async () => {
      const version = await migrationManager.getCurrentVersion();
      expect(version).toBe(0); // Fresh database should be at version 0
    });

    test('should get migration status', async () => {
      const status = await migrationManager.getStatus();
      
      expect(status.success).toBe(true);
      expect(status.data).toHaveProperty('currentVersion');
      expect(status.data).toHaveProperty('pendingCount');
      expect(status.data).toHaveProperty('appliedMigrations');
      expect(status.data).toHaveProperty('pendingMigrations');
    });
  });

  describe('Migration Execution', () => {
    test('should run pending migrations', async () => {
      const result = await migrationManager.runMigrations();
      
      expect(result.success).toBe(true);
      
      // Check that version was updated
      const newVersion = await migrationManager.getCurrentVersion();
      expect(newVersion).toBeGreaterThan(0);
    });

    test('should handle no pending migrations', async () => {
      // Run migrations first
      await migrationManager.runMigrations();
      
      // Run again - should report no pending migrations
      const result = await migrationManager.runMigrations();
      
      expect(result.success).toBe(true);
      expect(result.data.message).toContain('No pending migrations');
    });

    test('should track applied migrations', async () => {
      await migrationManager.runMigrations();
      
      const status = await migrationManager.getStatus();
      expect(status.success).toBe(true);
      expect(status.data.appliedMigrations.length).toBeGreaterThan(0);
      expect(status.data.pendingCount).toBe(0);
    });
  });

  describe('Migration Rollback', () => {
    beforeEach(async () => {
      // Apply migrations first
      await migrationManager.runMigrations();
    });

    test('should rollback to previous version', async () => {
      const currentVersion = await migrationManager.getCurrentVersion();
      expect(currentVersion).toBeGreaterThan(0);
      
      const result = await migrationManager.rollbackTo(0);
      expect(result.success).toBe(true);
      
      const newVersion = await migrationManager.getCurrentVersion();
      expect(newVersion).toBe(0);
    });

    test('should prevent rollback to higher version', async () => {
      const currentVersion = await migrationManager.getCurrentVersion();
      
      const result = await migrationManager.rollbackTo(currentVersion + 1);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Target version must be lower');
    });

    test('should handle rollback to same version', async () => {
      const currentVersion = await migrationManager.getCurrentVersion();
      
      const result = await migrationManager.rollbackTo(currentVersion);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Target version must be lower');
    });
  });

  describe('Custom Migration Addition', () => {
    test('should add new migration', async () => {
      const newMigration: Migration = {
        version: 2,
        name: 'test_migration',
        up: 'CREATE TABLE test_table (id INTEGER PRIMARY KEY);',
        down: 'DROP TABLE test_table;'
      };

      expect(() => {
        migrationManager.addMigration(newMigration);
      }).not.toThrow();
    });

    test('should prevent adding migration with duplicate version', async () => {
      const duplicateMigration: Migration = {
        version: 1, // This version already exists
        name: 'duplicate_migration',
        up: 'SELECT 1;',
        down: 'SELECT 1;'
      };

      expect(() => {
        migrationManager.addMigration(duplicateMigration);
      }).toThrow('Migration version 1 must be greater than');
    });

    test('should run newly added migration', async () => {
      // First run existing migrations
      await migrationManager.runMigrations();
      
      // Add new migration
      const newMigration: Migration = {
        version: 2,
        name: 'add_test_table',
        up: 'CREATE TABLE test_migration_table (id INTEGER PRIMARY KEY, test_data TEXT);',
        down: 'DROP TABLE test_migration_table;'
      };
      
      migrationManager.addMigration(newMigration);
      
      // Run the new migration
      const result = await migrationManager.runMigrations();
      expect(result.success).toBe(true);
      
      // Verify the table was created
      const tableCheck = await db.executeQuery(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='test_migration_table'"
      );
      expect(tableCheck.success).toBe(true);
      expect(tableCheck.data).toHaveLength(1);
      
      // Verify version was updated
      const version = await migrationManager.getCurrentVersion();
      expect(version).toBe(2);
    });
  });

  describe('Migration Error Handling', () => {
    test('should handle migration with invalid SQL', async () => {
      const invalidMigration: Migration = {
        version: 3,
        name: 'invalid_migration',
        up: 'INVALID SQL STATEMENT;',
        down: 'SELECT 1;'
      };
      
      migrationManager.addMigration(invalidMigration);
      
      const result = await migrationManager.runMigrations();
      expect(result.success).toBe(false);
      expect(result.error).toContain('Migration 3 failed');
    });

    test('should handle rollback with invalid SQL', async () => {
      // Add and run a migration first
      const testMigration: Migration = {
        version: 4,
        name: 'test_for_rollback',
        up: 'CREATE TABLE rollback_test (id INTEGER);',
        down: 'INVALID ROLLBACK SQL;'
      };
      
      migrationManager.addMigration(testMigration);
      await migrationManager.runMigrations();
      
      // Try to rollback with invalid SQL
      const rollbackResult = await migrationManager.rollbackTo(1);
      expect(rollbackResult.success).toBe(false);
      expect(rollbackResult.error).toContain('Rollback of migration 4 failed');
    });
  });

  describe('Migration Integrity', () => {
    test('should maintain database consistency during failed migration', async () => {
      // Get initial state
      const initialStats = await db.getStats();
      expect(initialStats.success).toBe(true);
      
      // Add migration that will fail
      const failingMigration: Migration = {
        version: 5,
        name: 'failing_migration',
        up: `
          CREATE TABLE temp_table (id INTEGER);
          INSERT INTO temp_table VALUES (1);
          INVALID SQL HERE;
        `,
        down: 'DROP TABLE temp_table;'
      };
      
      migrationManager.addMigration(failingMigration);
      
      // Run migration (should fail)
      const result = await migrationManager.runMigrations();
      expect(result.success).toBe(false);
      
      // Verify temp_table was not created (transaction rolled back)
      const tableCheck = await db.executeQuery(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='temp_table'"
      );
      expect(tableCheck.success).toBe(true);
      expect(tableCheck.data).toHaveLength(0);
      
      // Verify migration was not recorded as applied
      const version = await migrationManager.getCurrentVersion();
      expect(version).toBeLessThan(5);
    });

    test('should maintain referential integrity during rollback', async () => {
      // Create a migration that adds a table with foreign key
      const migrationWithFK: Migration = {
        version: 6,
        name: 'add_table_with_fk',
        up: `
          CREATE TABLE test_parent (id INTEGER PRIMARY KEY);
          CREATE TABLE test_child (
            id INTEGER PRIMARY KEY,
            parent_id INTEGER,
            FOREIGN KEY (parent_id) REFERENCES test_parent(id)
          );
          INSERT INTO test_parent (id) VALUES (1);
          INSERT INTO test_child (parent_id) VALUES (1);
        `,
        down: `
          DROP TABLE test_child;
          DROP TABLE test_parent;
        `
      };
      
      migrationManager.addMigration(migrationWithFK);
      
      // Apply migration
      const applyResult = await migrationManager.runMigrations();
      expect(applyResult.success).toBe(true);
      
      // Verify tables exist
      const parentCheck = await db.executeQuery(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='test_parent'"
      );
      expect(parentCheck.data).toHaveLength(1);
      
      // Rollback
      const rollbackResult = await migrationManager.rollbackTo(1);
      expect(rollbackResult.success).toBe(true);
      
      // Verify tables were removed
      const parentCheckAfter = await db.executeQuery(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='test_parent'"
      );
      expect(parentCheckAfter.data).toHaveLength(0);
    });
  });
});