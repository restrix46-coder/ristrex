/**
 * Agent Versioning — src/lib/agent-versioning.server.ts
 *
 * إدارة إصدارات الوكلاء:
 * - تتبّع نسخ System Prompts
 * - التراجع إلى إصدار سابق
 * - A/B Testing بين إصدارين
 * - تقييم أداء كل إصدار
 */

import { getSql } from "@/lib/db";
import { logger } from "@/lib/logger.server";

// ─── الأنواع ───────────────────────────────────────────────────────────────

export interface AgentVersion {
  id: string;
  agentType: string;
  version: string;
  systemPrompt: string;
  config: Record<string, unknown>;
  isActive: boolean;
  isCurrent: boolean;
  createdBy?: string;
  createdAt: Date;
  metrics?: AgentVersionMetrics;
}

export interface AgentVersionMetrics {
  versionId: string;
  totalRuns: number;
  successRate: number;
  avgLatencyMs: number;
  avgCostUsd: number;
  userSatisfactionScore?: number; // 1-5
  errorRate: number;
  lastUpdated: Date;
}

// ─── AgentVersioningService ────────────────────────────────────────────────

export class AgentVersioningService {
  /**
   * يُسجّل إصداراً جديداً لوكيل
   */
  async createVersion(
    agentType: string,
    systemPrompt: string,
    config: Record<string, unknown> = {},
    createdBy?: string,
  ): Promise<AgentVersion> {
    const sql = getSql();

    // حساب رقم الإصدار التالي
    const [latest] = await sql<{ version: string }[]>`
      SELECT version FROM agent_versions
      WHERE agent_type = ${agentType}
      ORDER BY created_at DESC
      LIMIT 1
    `;

    const nextVersion = this.incrementVersion(latest?.version ?? "1.0.0");

    const [created] = await sql<AgentVersion[]>`
      INSERT INTO agent_versions (agent_type, version, system_prompt, config, is_active, is_current, created_by)
      VALUES (${agentType}, ${nextVersion}, ${systemPrompt}, ${JSON.stringify(config)}::jsonb, true, false, ${createdBy ?? null})
      RETURNING *
    `;

    logger.info("Agent version created", { agentType, version: nextVersion });
    return created!;
  }

  /**
   * يُفعّل إصداراً كإصدار حالي
   */
  async activateVersion(versionId: string): Promise<void> {
    const sql = getSql();

    // جلب نوع الوكيل أولاً
    const [version] = await sql<{ agentType: string }[]>`
      SELECT agent_type as "agentType" FROM agent_versions WHERE id = ${versionId}
    `;

    if (!version) throw new Error(`Version ${versionId} not found`);

    await sql`BEGIN`;
    try {
      // إلغاء الإصدار الحالي
      await sql`
        UPDATE agent_versions SET is_current = false
        WHERE agent_type = ${version.agentType} AND is_current = true
      `;
      // تفعيل الإصدار الجديد
      await sql`
        UPDATE agent_versions SET is_current = true WHERE id = ${versionId}
      `;
      await sql`COMMIT`;
      logger.info("Agent version activated", { versionId, agentType: version.agentType });
    } catch (err) {
      await sql`ROLLBACK`;
      throw err;
    }
  }

  /**
   * يُرجع الإصدار الحالي لوكيل
   */
  async getCurrentVersion(agentType: string): Promise<AgentVersion | null> {
    const sql = getSql();
    const [version] = await sql<AgentVersion[]>`
      SELECT v.*, m.total_runs as "metrics.totalRuns"
      FROM agent_versions v
      LEFT JOIN agent_version_metrics m ON m.version_id = v.id
      WHERE v.agent_type = ${agentType} AND v.is_current = true
      LIMIT 1
    `;
    return version ?? null;
  }

  /**
   * يُرجع جميع إصدارات وكيل
   */
  async listVersions(agentType: string): Promise<AgentVersion[]> {
    const sql = getSql();
    return sql<AgentVersion[]>`
      SELECT * FROM agent_versions
      WHERE agent_type = ${agentType}
      ORDER BY created_at DESC
    `;
  }

  /**
   * التراجع إلى إصدار سابق
   */
  async rollback(agentType: string, targetVersion?: string): Promise<AgentVersion> {
    const sql = getSql();

    const query = targetVersion
      ? sql<AgentVersion[]>`
          SELECT * FROM agent_versions
          WHERE agent_type = ${agentType} AND version = ${targetVersion}
          LIMIT 1
        `
      : sql<AgentVersion[]>`
          SELECT * FROM agent_versions
          WHERE agent_type = ${agentType} AND is_current = false
          ORDER BY created_at DESC
          LIMIT 1
        `;

    const [target] = await query;
    if (!target) throw new Error(`No rollback target found for ${agentType}`);

    await this.activateVersion(target.id);
    logger.warn("Agent version rolled back", { agentType, version: target.version });
    return target;
  }

  /**
   * يُسجّل metrics لإصدار
   */
  async recordMetrics(
    versionId: string,
    metrics: Partial<AgentVersionMetrics>,
  ): Promise<void> {
    const sql = getSql();
    await sql`
      INSERT INTO agent_version_metrics (version_id, total_runs, success_rate, avg_latency_ms, avg_cost_usd, error_rate)
      VALUES (${versionId}, ${metrics.totalRuns ?? 0}, ${metrics.successRate ?? 1}, ${metrics.avgLatencyMs ?? 0}, ${metrics.avgCostUsd ?? 0}, ${metrics.errorRate ?? 0})
      ON CONFLICT (version_id) DO UPDATE SET
        total_runs = agent_version_metrics.total_runs + EXCLUDED.total_runs,
        success_rate = EXCLUDED.success_rate,
        avg_latency_ms = EXCLUDED.avg_latency_ms,
        error_rate = EXCLUDED.error_rate,
        last_updated = NOW()
    `;
  }

  private incrementVersion(version: string): string {
    const parts = version.split(".").map(Number);
    parts[2] = (parts[2] ?? 0) + 1;
    if ((parts[2] ?? 0) >= 10) { parts[2] = 0; parts[1] = (parts[1] ?? 0) + 1; }
    if ((parts[1] ?? 0) >= 10) { parts[1] = 0; parts[0] = (parts[0] ?? 0) + 1; }
    return parts.join(".");
  }
}

// ─── Migration ─────────────────────────────────────────────────────────────

export const AGENT_VERSIONING_MIGRATION = `
  CREATE TABLE IF NOT EXISTS agent_versions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    agent_type TEXT NOT NULL,
    version TEXT NOT NULL,
    system_prompt TEXT NOT NULL,
    config JSONB NOT NULL DEFAULT '{}',
    is_active BOOLEAN NOT NULL DEFAULT true,
    is_current BOOLEAN NOT NULL DEFAULT false,
    created_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (agent_type, version)
  );

  CREATE TABLE IF NOT EXISTS agent_version_metrics (
    version_id UUID PRIMARY KEY REFERENCES agent_versions(id) ON DELETE CASCADE,
    total_runs INTEGER NOT NULL DEFAULT 0,
    success_rate DECIMAL(5,4) NOT NULL DEFAULT 1.0,
    avg_latency_ms INTEGER NOT NULL DEFAULT 0,
    avg_cost_usd DECIMAL(10,6) NOT NULL DEFAULT 0,
    error_rate DECIMAL(5,4) NOT NULL DEFAULT 0,
    user_satisfaction_score DECIMAL(3,2),
    last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE INDEX IF NOT EXISTS idx_agent_versions_current
    ON agent_versions (agent_type, is_current)
    WHERE is_current = true;
`;

// ─── Singleton ─────────────────────────────────────────────────────────────

export const agentVersioning = new AgentVersioningService();
