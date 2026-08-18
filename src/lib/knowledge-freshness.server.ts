/**
 * Knowledge Freshness — detect stale Dependencies, Documentation, and Information.
 */

import { getSql } from '@/lib/db';

export interface KnowledgeItem {
  id: string;
  type: 'dependency' | 'documentation' | 'api' | 'pattern' | 'decision' | 'research';
  content: string;
  source: string;
  createdAt: Date;
  expiresAt?: Date;
  lastVerified?: Date;
  isStale: boolean;
  staleness: 'fresh' | 'aging' | 'stale' | 'expired';
}

export interface FreshnessReport {
  totalItems: number;
  freshItems: number;
  agingItems: number;
  staleItems: number;
  expiredItems: number;
  recommendations: string[];
  criticallyStale: KnowledgeItem[];
}

export class KnowledgeFreshnessService {
  /**
   * Registers a knowledge item
   */
  async register(item: Omit<KnowledgeItem, 'id' | 'isStale' | 'staleness'>): Promise<KnowledgeItem> {
    const id = crypto.randomUUID();
    const isStale = false;
    const staleness = 'fresh';
    const fullItem: KnowledgeItem = { ...item, id, isStale, staleness };

    const sql = getSql();
    try {
      await sql`
        INSERT INTO knowledge_freshness (
          id, type, content, source, created_at, expires_at, last_verified, is_stale, staleness
        ) VALUES (
          ${fullItem.id}, ${fullItem.type}, ${fullItem.content}, ${fullItem.source},
          ${fullItem.createdAt}, ${fullItem.expiresAt || null}, ${fullItem.lastVerified || null},
          ${fullItem.isStale}, ${fullItem.staleness}
        )
      `;
      return fullItem;
    } catch (error) {
      console.error('Failed to register knowledge item:', error);
      throw new Error('Database error registering knowledge item');
    }
  }

  /**
   * Determines staleness level
   */
  checkFreshness(item: KnowledgeItem): 'fresh' | 'aging' | 'stale' | 'expired' {
    const now = new Date().getTime();
    const baseDate = item.lastVerified ? item.lastVerified.getTime() : item.createdAt.getTime();
    const daysSince = (now - baseDate) / (1000 * 3600 * 24);

    if (daysSince > 90) return 'expired';
    if (daysSince > 30) return 'stale';
    if (daysSince > 7) return 'aging';
    return 'fresh';
  }

  /**
   * Updates last verified timestamp
   */
  async markVerified(id: string): Promise<void> {
    const sql = getSql();
    try {
      await sql`
        UPDATE knowledge_freshness
        SET last_verified = NOW(), is_stale = false, staleness = 'fresh'
        WHERE id = ${id}
      `;
    } catch (error) {
      console.error('Failed to mark verified:', error);
      throw new Error('Database error marking verified');
    }
  }

  /**
   * Returns items past their freshness date
   */
  async getStaleItems(threshold: number = 30): Promise<KnowledgeItem[]> {
    const sql = getSql();
    try {
      return await sql<KnowledgeItem[]>`
        SELECT * FROM knowledge_freshness
        WHERE is_stale = true OR staleness IN ('stale', 'expired')
      `;
    } catch (error) {
      console.error('Failed to get stale items:', error);
      throw new Error('Database error getting stale items');
    }
  }

  /**
   * Checks if dep versions match npm registry
   */
  async checkDependencyVersions(packageJson: object): Promise<any> {
    // Mock implementation
    return [];
  }

  /**
   * Markdown report of knowledge health
   */
  async generateFreshnessReport(): Promise<string> {
    return '# Freshness Report\nReport data goes here.';
  }

  /**
   * Sets refresh schedule
   */
  async scheduleRefresh(id: string, intervalDays: number): Promise<void> {
    const expiresAt = new Date(Date.now() + intervalDays * 24 * 3600 * 1000);
    const sql = getSql();
    try {
      await sql`
        UPDATE knowledge_freshness
        SET expires_at = ${expiresAt}
        WHERE id = ${id}
      `;
    } catch (error) {
      console.error('Failed to schedule refresh:', error);
      throw new Error('Database error scheduling refresh');
    }
  }
}

export const knowledgeFreshness = new KnowledgeFreshnessService();

/**
 * Migration:
 * CREATE TABLE knowledge_freshness (
 *   id UUID PRIMARY KEY,
 *   type TEXT,
 *   content TEXT,
 *   source TEXT,
 *   created_at TIMESTAMP,
 *   expires_at TIMESTAMP,
 *   last_verified TIMESTAMP,
 *   is_stale BOOLEAN,
 *   staleness TEXT
 * );
 */
