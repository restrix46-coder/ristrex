import { logger } from '@/lib/logger';
import { getSql } from '@/lib/db';

export interface TemporalPermission {
  id: string;
  agentId: string;
  resource: string;
  action: string;
  grantedAt: Date;
  expiresAt: Date;
  grantedBy: string;
  reason: string;
  usageCount: number;
  maxUsages?: number;
  autoRevoke: boolean;
}

export const TEMPORAL_PERMISSIONS_MIGRATION = `
CREATE TABLE IF NOT EXISTS temporal_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id VARCHAR(255) NOT NULL,
  resource VARCHAR(255) NOT NULL,
  action VARCHAR(50) NOT NULL,
  granted_at TIMESTAMP NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMP NOT NULL,
  granted_by VARCHAR(255) NOT NULL,
  reason TEXT NOT NULL,
  usage_count INT NOT NULL DEFAULT 0,
  max_usages INT,
  auto_revoke BOOLEAN NOT NULL DEFAULT TRUE
);
`;

/**
 * Temporal Permissions — auto-expiring access rights.
 */
export class TemporalPermissionsManager {
  /**
   * Grants a time-limited permission.
   */
  public async grant(agentId: string, resource: string, action: string, durationMs: number, reason: string): Promise<string> {
    const sql = getSql();
    const expiresAt = new Date(Date.now() + durationMs);
    try {
      const [record] = await sql`
        INSERT INTO temporal_permissions (agent_id, resource, action, expires_at, granted_by, reason, auto_revoke)
        VALUES (${agentId}, ${resource}, ${action}, ${expiresAt}, 'system', ${reason}, true)
        RETURNING id
      `;
      logger.info(`Granted temporal permission to ${agentId} for ${resource}`);
      return record.id;
    } catch (e) {
      logger.error('Failed to grant temporal permission', { error: e });
      throw e;
    }
  }

  /**
   * Checks if a permission is valid and auto-revokes if expired.
   */
  public async check(agentId: string, resource: string, action: string): Promise<boolean> {
    const sql = getSql();
    const [perm] = await sql`
      SELECT * FROM temporal_permissions 
      WHERE agent_id = ${agentId} AND resource = ${resource} AND action = ${action} 
      ORDER BY expires_at DESC LIMIT 1
    `;

    if (!perm) return false;

    if (new Date() > perm.expires_at || (perm.max_usages && perm.usage_count >= perm.max_usages)) {
      if (perm.auto_revoke) {
        await this.revoke(perm.id);
      }
      return false;
    }

    await sql`UPDATE temporal_permissions SET usage_count = usage_count + 1 WHERE id = ${perm.id}`;
    return true;
  }

  /**
   * Immediate revocation of a permission.
   */
  public async revoke(permissionId: string): Promise<void> {
    const sql = getSql();
    await sql`DELETE FROM temporal_permissions WHERE id = ${permissionId}`;
    logger.info(`Revoked permission ${permissionId}`);
  }

  /**
   * Revoke all permissions for an agent.
   */
  public async revokeAll(agentId: string): Promise<void> {
    const sql = getSql();
    await sql`DELETE FROM temporal_permissions WHERE agent_id = ${agentId}`;
    logger.info(`Revoked all permissions for agent ${agentId}`);
  }

  /**
   * Returns all active permissions for an agent.
   */
  public async getActive(agentId: string): Promise<TemporalPermission[]> {
    const sql = getSql();
    const records = await sql<TemporalPermission[]>`
      SELECT * FROM temporal_permissions 
      WHERE agent_id = ${agentId} AND expires_at > NOW() AND (max_usages IS NULL OR usage_count < max_usages)
    `;
    return records;
  }

  /**
   * Returns expired permissions (audit trail).
   */
  public async getExpired(agentId: string): Promise<TemporalPermission[]> {
    const sql = getSql();
    const records = await sql<TemporalPermission[]>`
      SELECT * FROM temporal_permissions 
      WHERE agent_id = ${agentId} AND (expires_at <= NOW() OR (max_usages IS NOT NULL AND usage_count >= max_usages))
    `;
    return records;
  }

  /**
   * Periodic cleanup job.
   */
  public async cleanupExpired(): Promise<void> {
    const sql = getSql();
    const result = await sql`
      DELETE FROM temporal_permissions 
      WHERE auto_revoke = TRUE AND (expires_at <= NOW() OR (max_usages IS NOT NULL AND usage_count >= max_usages))
    `;
    logger.info(`Cleaned up ${result.count} expired temporal permissions`);
  }
}

export const temporalPermissions = new TemporalPermissionsManager();
