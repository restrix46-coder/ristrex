import { getSql } from '@/lib/db';
import { logger } from '@/lib/logger';

export interface SchemaChange {
  type: 'add_column' | 'remove_column' | 'add_table' | 'remove_table' | 'add_index' | 'change_type' | 'add_constraint';
  table: string;
  column?: string;
  sql: string;
  isBreaking: boolean;
  migration?: string;
}

export interface SchemaVersion {
  version: string;
  appliedAt: Date;
  changes: SchemaChange[];
  checksum: string;
  isBreaking: boolean;
  rollbackSql?: string;
}

export interface CompatibilityMatrix {
  canUpgrade: boolean;
  canDowngrade: boolean;
  breakingChanges: SchemaChange[];
  requiredMigrations: string[];
}

/**
 * SQL Migration:
 * CREATE TABLE IF NOT EXISTS schema_versions (
 *   version TEXT PRIMARY KEY,
 *   applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
 *   changes JSONB,
 *   checksum TEXT,
 *   is_breaking BOOLEAN,
 *   rollback_sql TEXT
 * );
 */

/**
 * Schema Evolution Service manages Database and Event schema changes without breaking things.
 * خدمة تطور المخطط لإدارة التغييرات في قاعدة البيانات ومخططات الأحداث.
 */
export class SchemaEvolutionService {
  private memoryHistory: SchemaVersion[] = [];

  /**
   * Saves a schema version.
   */
  async recordVersion(version: SchemaVersion): Promise<void> {
    const sql = await getSql();
    try {
      await sql`
        INSERT INTO schema_versions (version, applied_at, changes, checksum, is_breaking, rollback_sql)
        VALUES (${version.version}, ${version.appliedAt}, ${JSON.stringify(version.changes)}, ${version.checksum}, ${version.isBreaking}, ${version.rollbackSql || null})
      `;
      this.memoryHistory.push(version);
    } catch (err) {
      logger.error('Failed to record schema version', err);
    }
  }

  /**
   * Returns compatibility matrix between two versions.
   */
  checkCompatibility(from: string, to: string): CompatibilityMatrix {
    const fromIdx = this.memoryHistory.findIndex(v => v.version === from);
    const toIdx = this.memoryHistory.findIndex(v => v.version === to);
    
    if (fromIdx === -1 || toIdx === -1) {
      throw new Error('Version not found');
    }

    const breakingChanges: SchemaChange[] = [];
    const requiredMigrations: string[] = [];

    const isUpgrade = fromIdx < toIdx;
    const path = isUpgrade ? 
      this.memoryHistory.slice(fromIdx + 1, toIdx + 1) : 
      this.memoryHistory.slice(toIdx, fromIdx).reverse();

    for (const v of path) {
      if (v.isBreaking) {
        breakingChanges.push(...v.changes.filter(c => c.isBreaking));
      }
      requiredMigrations.push(v.version);
    }

    return {
      canUpgrade: isUpgrade && breakingChanges.length === 0,
      canDowngrade: !isUpgrade && breakingChanges.length === 0,
      breakingChanges,
      requiredMigrations
    };
  }

  /**
   * Creates migration SQL for changes between versions.
   */
  generateMigration(fromVersion: string, toVersion: string, changes: SchemaChange[]): string {
    return changes.map(c => c.sql).join('\n');
  }

  /**
   * Applies migration with rollback on failure.
   */
  async applyMigration(migrationSql: string, dryRun: boolean = false): Promise<boolean> {
    const sql = await getSql();
    if (dryRun) {
      logger.info(`Dry run migration: \n${migrationSql}`);
      return true;
    }
    
    try {
      await sql.begin(async (tx) => {
        // Execute unsafe migration text
        await tx.unsafe(migrationSql);
      });
      return true;
    } catch (err) {
      logger.error('Migration failed, rolled back', err);
      return false;
    }
  }

  /**
   * Returns current schema version.
   */
  async getCurrentVersion(): Promise<string | null> {
    const sql = await getSql();
    const result = await sql`SELECT version FROM schema_versions ORDER BY applied_at DESC LIMIT 1`;
    return result.length ? result[0].version : null;
  }

  /**
   * Returns all schema versions.
   */
  async getHistory(): Promise<SchemaVersion[]> {
    const sql = await getSql();
    const result = await sql`SELECT * FROM schema_versions ORDER BY applied_at ASC`;
    this.memoryHistory = result as SchemaVersion[];
    return this.memoryHistory;
  }

  /**
   * Rolls back to specific version.
   */
  async rollback(targetVersion: string): Promise<boolean> {
    const sql = await getSql();
    const current = await this.getCurrentVersion();
    if (!current || current === targetVersion) return false;

    const targetIdx = this.memoryHistory.findIndex(v => v.version === targetVersion);
    if (targetIdx === -1) return false;

    // Execute rollbacks in reverse
    const rollbacks = this.memoryHistory.slice(targetIdx + 1).reverse();
    try {
      await sql.begin(async (tx) => {
        for (const v of rollbacks) {
          if (v.rollbackSql) {
            await tx.unsafe(v.rollbackSql);
          }
          await tx`DELETE FROM schema_versions WHERE version = ${v.version}`;
        }
      });
      return true;
    } catch (err) {
      logger.error('Rollback failed', err);
      return false;
    }
  }
}

export const schemaEvolution = new SchemaEvolutionService();
