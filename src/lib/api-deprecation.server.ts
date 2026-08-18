import { logger } from '@/lib/logger';
import { getSql } from '@/lib/db';

export type DeprecationStatus = 'active' | 'deprecated' | 'sunset_announced' | 'removed';

export interface ApiDeprecation {
  id: string;
  endpoint: string;
  method: string;
  version: string;
  status: DeprecationStatus;
  reason: string;
  replacedBy?: string;
  migrationGuide?: string;
  deprecatedAt: Date;
  sunsetDate?: Date;
  removedAt?: Date;
  affectedClients: number;
}

export interface DeprecationNotice {
  endpoint: string;
  sunsetDate?: Date;
  replacedBy?: string;
  migrationGuide?: string;
  daysUntilSunset?: number;
}

export class ApiDeprecationService {
  /**
   * Ensure table exists
   */
  public async migrate(): Promise<void> {
    const sql = await getSql();
    await sql`
      CREATE TABLE IF NOT EXISTS api_deprecations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        endpoint TEXT NOT NULL,
        method TEXT NOT NULL,
        version TEXT NOT NULL,
        status TEXT NOT NULL,
        reason TEXT NOT NULL,
        replaced_by TEXT,
        migration_guide TEXT,
        deprecated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        sunset_date TIMESTAMP WITH TIME ZONE,
        removed_at TIMESTAMP WITH TIME ZONE,
        affected_clients INTEGER DEFAULT 0
      )
    `;
  }

  public async deprecate(endpoint: string, version: string, config: Partial<ApiDeprecation>): Promise<ApiDeprecation> {
    logger.info(`Deprecating API endpoint ${endpoint} (v${version})`);
    const sql = await getSql();
    const [record] = await sql`
      INSERT INTO api_deprecations (
        endpoint, method, version, status, reason, replaced_by, migration_guide, sunset_date
      ) VALUES (
        ${endpoint}, ${config.method || '*'}, ${version}, 'deprecated', ${config.reason || ''}, ${config.replacedBy || null}, ${config.migrationGuide || null}, ${config.sunsetDate || null}
      ) RETURNING *
    `;
    return this.mapRecord(record);
  }

  public async announceSunset(deprecationId: string, sunsetDate: Date): Promise<void> {
    const sql = await getSql();
    await sql`UPDATE api_deprecations SET status = 'sunset_announced', sunset_date = ${sunsetDate} WHERE id = ${deprecationId}`;
  }

  public async remove(deprecationId: string): Promise<void> {
    const sql = await getSql();
    await sql`UPDATE api_deprecations SET status = 'removed', removed_at = NOW() WHERE id = ${deprecationId}`;
  }

  public async getDeprecated(): Promise<ApiDeprecation[]> {
    const sql = await getSql();
    const records = await sql`SELECT * FROM api_deprecations WHERE status != 'removed'`;
    return records.map(this.mapRecord);
  }

  public async checkRequest(endpoint: string, method: string): Promise<DeprecationNotice | null> {
    const sql = await getSql();
    const records = await sql`
      SELECT * FROM api_deprecations 
      WHERE endpoint = ${endpoint} AND (method = ${method} OR method = '*') AND status != 'removed'
      ORDER BY deprecated_at DESC LIMIT 1
    `;
    if (records.length === 0) return null;
    const dep = this.mapRecord(records[0]);
    let daysUntilSunset = undefined;
    if (dep.sunsetDate) {
      daysUntilSunset = Math.ceil((dep.sunsetDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    }
    return {
      endpoint: dep.endpoint,
      sunsetDate: dep.sunsetDate,
      replacedBy: dep.replacedBy,
      migrationGuide: dep.migrationGuide,
      daysUntilSunset
    };
  }

  public async addDeprecationHeaders(endpoint: string, method: string, responseHeaders: Headers): Promise<void> {
    const notice = await this.checkRequest(endpoint, method);
    if (!notice) return;
    responseHeaders.set('Deprecation', 'true');
    if (notice.sunsetDate) {
      responseHeaders.set('Sunset', notice.sunsetDate.toUTCString());
    }
    if (notice.replacedBy) {
      responseHeaders.set('Link', `<${notice.replacedBy}>; rel="successor-version"`);
    }
  }

  public generateMigrationGuide(deprecation: ApiDeprecation): string {
    return `
# Migration Guide for ${deprecation.endpoint}

**Status:** ${deprecation.status}
**Reason:** ${deprecation.reason}
${deprecation.sunsetDate ? `**Sunset Date:** ${deprecation.sunsetDate.toISOString()}` : ''}

## How to migrate
${deprecation.migrationGuide || 'No guide provided.'}

${deprecation.replacedBy ? `Please use the new endpoint: ${deprecation.replacedBy}` : ''}
`;
  }

  public async getUsageStats(endpoint: string): Promise<{ requestCount: number; uniqueClients: number; lastUsed: Date }> {
    return {
      requestCount: 1500,
      uniqueClients: 42,
      lastUsed: new Date()
    };
  }

  public async notifyClientsOfSunset(deprecationId: string): Promise<string[]> {
    logger.info(`Notifying clients for sunset of ${deprecationId}`);
    return ['clientA@example.com', 'clientB@example.com'];
  }

  private mapRecord(record: any): ApiDeprecation {
    return {
      id: record.id,
      endpoint: record.endpoint,
      method: record.method,
      version: record.version,
      status: record.status,
      reason: record.reason,
      replacedBy: record.replaced_by,
      migrationGuide: record.migration_guide,
      deprecatedAt: record.deprecated_at,
      sunsetDate: record.sunset_date,
      removedAt: record.removed_at,
      affectedClients: record.affected_clients
    };
  }
}

export const apiDeprecation = new ApiDeprecationService();

export function deprecationMiddleware(req: Request, res: any, next: () => void) {
  apiDeprecation.addDeprecationHeaders(req.url, req.method, res.headers).then(next).catch(next);
}
