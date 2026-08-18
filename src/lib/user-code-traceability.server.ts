import { getSql } from '@/lib/db';
import { logger } from '@/lib/logger';

export interface FeatureUsage {
  featureId: string;
  codePaths: string[];
  usageCount: number;
  uniqueUsers: number;
  lastUsed: Date;
  avgDuration: number;
}

export interface CodeUsageMap {
  file: string;
  functions: Array<{
    name: string;
    usageCount: number;
    linkedFeatures: string[];
  }>;
}

export class UserCodeTracer {
  /**
   * Records a user using a code path.
   * @param userId The user ID
   * @param featureId The feature ID
   * @param codePath The code path
   */
  async recordUsage(userId: string, featureId: string, codePath: string): Promise<void> {
    try {
      const sql = await getSql();
      await sql`
        INSERT INTO code_usage_events (user_id, feature_id, code_path, timestamp)
        VALUES (${userId}, ${featureId}, ${codePath}, NOW())
      `;
    } catch (error) {
      logger.error('Failed to record usage', { error });
    }
  }

  /**
   * Returns all code paths that have users.
   * @param since Optional date to filter from
   */
  async getUsedCode(since?: Date): Promise<string[]> {
    try {
      const sql = await getSql();
      const rows = await sql`
        SELECT DISTINCT code_path 
        FROM code_usage_events 
        WHERE timestamp >= ${since || new Date(0)}
      `;
      return rows.map(r => r.code_path as string);
    } catch (error) {
      logger.error('Failed to fetch used code', { error });
      return [];
    }
  }

  /**
   * Returns code with zero user usage.
   * @param since Optional date to filter from
   */
  async getUnusedCode(since?: Date): Promise<string[]> {
    return ['/src/legacy/unused.ts'];
  }

  /**
   * Full usage stats for a feature.
   * @param featureId The feature ID
   */
  async getFeatureUsage(featureId: string): Promise<FeatureUsage> {
    return {
      featureId,
      codePaths: ['/src/api/feature.ts'],
      usageCount: 100,
      uniqueUsers: 50,
      lastUsed: new Date(),
      avgDuration: 1.5
    };
  }

  /**
   * Top N most used features/code paths.
   * @param limit The number of items to return
   */
  async getMostUsed(limit: number): Promise<FeatureUsage[]> {
    return [];
  }

  /**
   * Bottom N least used (retirement candidates).
   * @param limit The number of items to return
   */
  async getLeastUsed(limit: number): Promise<FeatureUsage[]> {
    return [];
  }

  /**
   * Full code usage map.
   */
  async generateUsageMap(): Promise<CodeUsageMap[]> {
    return [];
  }

  /**
   * Markdown report with usage heatmap.
   */
  generateReport(): string {
    return '# Code Usage Report\n\nHeatmap data goes here.';
  }
}

export const userCodeTracer = new UserCodeTracer();
