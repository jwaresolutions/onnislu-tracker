import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';
import fs from 'fs/promises';
import path from 'path';
import { DatabaseResult, TransactionResult } from '../../shared/types/database';

export class DatabaseConnection {
  private db: Database<sqlite3.Database, sqlite3.Statement> | null = null;
  private readonly dbPath: string;
  private readonly schemaPath: string;

  constructor(dbPath: string = 'data/onnislu_tracker.db') {
    this.dbPath = dbPath;
    this.schemaPath = path.join(__dirname, 'schema.sql');
  }

  /**
   * Initialize database connection and create tables if they don't exist
   */
  async initialize(): Promise<DatabaseResult> {
    try {
      // Ensure data directory exists
      const dbDir = path.dirname(this.dbPath);
      await fs.mkdir(dbDir, { recursive: true });

      // Open database connection
      this.db = await open({
        filename: this.dbPath,
        driver: sqlite3.Database
      });

      // Enable foreign key constraints
      await this.db.exec('PRAGMA foreign_keys = ON');
      
      // Enable WAL mode for better concurrent access
      await this.db.exec('PRAGMA journal_mode = WAL');

      // Initialize schema
      await this.initializeSchema();

      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown database initialization error';
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Initialize database schema from SQL file
   */
  private async initializeSchema(): Promise<void> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    try {
      const schemaSQL = await fs.readFile(this.schemaPath, 'utf-8');
      await this.db.exec(schemaSQL);
    } catch (error) {
      throw new Error(`Failed to initialize schema: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get database instance
   */
  getDatabase(): Database<sqlite3.Database, sqlite3.Statement> {
    if (!this.db) {
      throw new Error('Database not initialized. Call initialize() first.');
    }
    return this.db;
  }

  /**
   * Execute a transaction with automatic rollback on error
   */
  async executeTransaction<T>(
    operations: (db: Database<sqlite3.Database, sqlite3.Statement>) => Promise<T>
  ): Promise<TransactionResult<T>> {
    if (!this.db) {
      return { success: false, error: 'Database not initialized' };
    }

    try {
      await this.db.exec('BEGIN TRANSACTION');
      const result = await operations(this.db);
      await this.db.exec('COMMIT');
      return { success: true, data: result };
    } catch (error) {
      try {
        await this.db.exec('ROLLBACK');
      } catch (rollbackError) {
        console.error('Failed to rollback transaction:', rollbackError);
      }
      
      const errorMessage = error instanceof Error ? error.message : 'Unknown transaction error';
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Execute a query with error handling
   */
  async executeQuery<T = any>(
    sql: string, 
    params: any[] = []
  ): Promise<DatabaseResult> {
    if (!this.db) {
      return { success: false, error: 'Database not initialized' };
    }

    try {
      const result = await this.db.all(sql, params);
      return { success: true, data: result };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown query error';
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Execute a single row query
   */
  async executeQuerySingle<T = any>(
    sql: string, 
    params: any[] = []
  ): Promise<DatabaseResult> {
    if (!this.db) {
      return { success: false, error: 'Database not initialized' };
    }

    try {
      const result = await this.db.get(sql, params);
      return { success: true, data: result };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown query error';
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Execute an insert/update/delete query
   */
  async executeUpdate(
    sql: string, 
    params: any[] = []
  ): Promise<DatabaseResult> {
    if (!this.db) {
      return { success: false, error: 'Database not initialized' };
    }

    try {
      const result = await this.db.run(sql, params);
      return { 
        success: true, 
        data: { 
          lastID: result.lastID, 
          changes: result.changes 
        } 
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown update error';
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Check database health and integrity
   */
  async checkHealth(): Promise<DatabaseResult> {
    if (!this.db) {
      return { success: false, error: 'Database not initialized' };
    }

    try {
      // Check if we can query the database
      await this.db.get('SELECT 1');
      
      // Check integrity
      const integrityResult = await this.db.get('PRAGMA integrity_check');
      const isHealthy = integrityResult && integrityResult.integrity_check === 'ok';
      
      return { 
        success: true, 
        data: { 
          connected: true, 
          integrity: isHealthy ? 'ok' : 'corrupted' 
        } 
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown health check error';
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Close database connection
   */
  async close(): Promise<void> {
    if (this.db) {
      await this.db.close();
      this.db = null;
    }
  }

  /**
   * Get database statistics
   */
  async getStats(): Promise<DatabaseResult> {
    if (!this.db) {
      return { success: false, error: 'Database not initialized' };
    }

    try {
      const stats = await Promise.all([
        this.db.get('SELECT COUNT(*) as count FROM buildings'),
        this.db.get('SELECT COUNT(*) as count FROM floor_plans'),
        this.db.get('SELECT COUNT(*) as count FROM price_history'),
        this.db.get('SELECT COUNT(*) as count FROM alerts WHERE is_dismissed = FALSE')
      ]);

      return {
        success: true,
        data: {
          buildings: stats[0]?.count || 0,
          floor_plans: stats[1]?.count || 0,
          price_records: stats[2]?.count || 0,
          active_alerts: stats[3]?.count || 0
        }
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown stats error';
      return { success: false, error: errorMessage };
    }
  }
}

// Singleton instance
let dbInstance: DatabaseConnection | null = null;

/**
 * Get singleton database connection instance
 */
export function getDatabaseConnection(dbPath?: string): DatabaseConnection {
  if (!dbInstance) {
    dbInstance = new DatabaseConnection(dbPath);
  }
  return dbInstance;
}

/**
 * Initialize database connection (should be called once at app startup)
 */
export async function initializeDatabase(dbPath?: string): Promise<DatabaseResult> {
  const db = getDatabaseConnection(dbPath);
  return await db.initialize();
}