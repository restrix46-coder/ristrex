import { getSql } from '@/lib/db.server';
import { logger } from '@/lib/logger.server';
import crypto from 'crypto';

export interface EditConflict {
  file: string;
  agents: string[];
  conflictType: 'simultaneous_write' | 'dependency_violation' | 'resource_contention';
}

export class ConflictDetector {
  /**
   * Calculates a 32-bit integer lock ID for a given string (file path).
   */
  private getLockId(str: string): number {
    const hash = crypto.createHash('md5').update(str).digest('hex');
    return parseInt(hash.substring(0, 8), 16);
  }

  /**
   * Acquires a file lock using PostgreSQL advisory locks.
   * يكتسب قفلًا لملف باستخدام أقفال PostgreSQL الاستشارية.
   */
  async lockFile(filePath: string, agentId: string): Promise<boolean> {
    const sql = getSql();
    const lockId = this.getLockId(filePath);
    logger.info(`Attempting to lock file ${filePath} for agent ${agentId}`);
    
    const [result] = await sql`
      SELECT pg_try_advisory_lock(${lockId}) as locked
    `;
    
    if (result.locked) {
      await sql`
        INSERT INTO active_locks (file_path, agent_id, locked_at)
        VALUES (${filePath}, ${agentId}, NOW())
        ON CONFLICT (file_path) DO UPDATE SET agent_id = ${agentId}, locked_at = NOW()
      `;
    }
    return result.locked;
  }

  /**
   * Releases a file lock.
   * يحرر قفل الملف.
   */
  async unlockFile(filePath: string, agentId: string): Promise<boolean> {
    const sql = getSql();
    const lockId = this.getLockId(filePath);
    logger.info(`Unlocking file ${filePath} for agent ${agentId}`);
    
    const [result] = await sql`
      SELECT pg_advisory_unlock(${lockId}) as unlocked
    `;

    if (result.unlocked) {
      await sql`DELETE FROM active_locks WHERE file_path = ${filePath} AND agent_id = ${agentId}`;
    }
    return result.unlocked;
  }

  /**
   * Checks if a file is locked by another agent.
   * يتحقق مما إذا كان الملف مقفلاً من قبل وكيل آخر.
   */
  async checkConflict(filePath: string, agentId: string): Promise<EditConflict | null> {
    const sql = getSql();
    const locks = await sql`SELECT agent_id FROM active_locks WHERE file_path = ${filePath} AND agent_id != ${agentId}`;
    
    if (locks.length > 0) {
      return {
        file: filePath,
        agents: locks.map(l => l.agent_id),
        conflictType: 'simultaneous_write',
      };
    }
    return null;
  }

  /**
   * Detects dependency violations between tasks.
   * يكتشف انتهاكات التبعية بين المهام.
   */
  detectDependencyViolation(taskA: any, taskB: any, dependencyGraph: Record<string, string[]>): EditConflict | null {
    if (dependencyGraph[taskB.id]?.includes(taskA.id)) {
      return {
        file: 'Task Dependency',
        agents: [taskA.agentId, taskB.agentId],
        conflictType: 'dependency_violation'
      };
    }
    return null;
  }

  /**
   * Returns all active locks.
   * يرجع جميع الأقفال النشطة حالياً.
   */
  async getActiveLocks(): Promise<Array<{filePath: string, agentId: string}>> {
    const sql = getSql();
    const locks = await sql`SELECT file_path as "filePath", agent_id as "agentId" FROM active_locks`;
    return locks as any;
  }
}

/**
 * SQL MIGRATION (Documented):
 * 
 * CREATE TABLE IF NOT EXISTS active_locks (
 *   file_path TEXT PRIMARY KEY,
 *   agent_id TEXT NOT NULL,
 *   locked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
 * );
 */
