/**
 * Forensics & Audit Engine — src/lib/forensics.server.ts
 *
 * نظام التحقيق الجنائي الرقمي — يُجيب على:
 * - ماذا حدث؟
 * - من فعل ماذا؟
 * - أي Agent؟
 * - أي Tool استُخدم؟
 * - ما النتيجة؟
 * - ما الملفات المتأثرة؟
 */

import { getSql } from "@/lib/db";
import { logger } from "@/lib/logger.server";

// ─── الأنواع ───────────────────────────────────────────────────────────────

export interface ForensicEvent {
  id: string;
  projectId?: string;
  userId?: string;
  agentType?: string;
  action: string;
  tool?: string;
  target?: string;
  result: "success" | "failure" | "partial";
  risk: "none" | "low" | "medium" | "high" | "critical";
  metadata: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  timestamp: Date;
  durationMs?: number;
  filesAffected?: string[];
  apisCallled?: string[];
}

export interface ForensicQuery {
  projectId?: string;
  userId?: string;
  agentType?: string;
  action?: string;
  risk?: string;
  from?: Date;
  to?: Date;
  limit?: number;
}

export interface ForensicTimeline {
  events: ForensicEvent[];
  summary: {
    totalEvents: number;
    criticalEvents: number;
    failedEvents: number;
    uniqueAgents: string[];
    uniqueUsers: string[];
    timespan: { from: Date; to: Date };
  };
}

// ─── ForensicsEngine ──────────────────────────────────────────────────────

export class ForensicsEngine {
  /**
   * يُسجّل حدثاً جنائياً
   */
  async record(event: Omit<ForensicEvent, "id" | "timestamp">): Promise<string> {
    try {
      const sql = getSql();
      const [result] = await sql<{ id: string }[]>`
        INSERT INTO forensic_events (
          project_id, user_id, agent_type, action, tool, target,
          result, risk, metadata, ip_address, user_agent,
          duration_ms, files_affected, apis_called
        ) VALUES (
          ${event.projectId ?? null},
          ${event.userId ?? null},
          ${event.agentType ?? null},
          ${event.action},
          ${event.tool ?? null},
          ${event.target ?? null},
          ${event.result},
          ${event.risk},
          ${JSON.stringify(event.metadata)}::jsonb,
          ${event.ipAddress ?? null},
          ${event.userAgent ?? null},
          ${event.durationMs ?? null},
          ${event.filesAffected ?? null},
          ${event.apisCallled ?? null}
        )
        RETURNING id
      `;
      return result?.id ?? "";
    } catch (err) {
      // لا تفشل التطبيق بسبب فشل تسجيل الجنائيات
      logger.error("Failed to record forensic event", { error: err, action: event.action });
      return "";
    }
  }

  /**
   * يُرجع الجدول الزمني للأحداث
   */
  async getTimeline(query: ForensicQuery): Promise<ForensicTimeline> {
    const sql = getSql();
    const limit = query.limit ?? 100;

    const events = await sql<ForensicEvent[]>`
      SELECT
        id, project_id as "projectId", user_id as "userId",
        agent_type as "agentType", action, tool, target, result, risk,
        metadata, ip_address as "ipAddress", timestamp,
        duration_ms as "durationMs", files_affected as "filesAffected"
      FROM forensic_events
      WHERE
        (${query.projectId ?? null}::text IS NULL OR project_id = ${query.projectId ?? null})
        AND (${query.userId ?? null}::text IS NULL OR user_id = ${query.userId ?? null})
        AND (${query.agentType ?? null}::text IS NULL OR agent_type = ${query.agentType ?? null})
        AND (${query.risk ?? null}::text IS NULL OR risk = ${query.risk ?? null})
        AND (${query.from ?? null}::timestamptz IS NULL OR timestamp >= ${query.from ?? null})
        AND (${query.to ?? null}::timestamptz IS NULL OR timestamp <= ${query.to ?? null})
      ORDER BY timestamp DESC
      LIMIT ${limit}
    `;

    const uniqueAgents = [...new Set(events.map((e) => e.agentType).filter(Boolean))] as string[];
    const uniqueUsers = [...new Set(events.map((e) => e.userId).filter(Boolean))] as string[];
    const timestamps = events.map((e) => new Date(e.timestamp));

    return {
      events,
      summary: {
        totalEvents: events.length,
        criticalEvents: events.filter((e) => e.risk === "critical").length,
        failedEvents: events.filter((e) => e.result === "failure").length,
        uniqueAgents,
        uniqueUsers,
        timespan: {
          from: timestamps.length ? new Date(Math.min(...timestamps.map((t) => t.getTime()))) : new Date(),
          to: timestamps.length ? new Date(Math.max(...timestamps.map((t) => t.getTime()))) : new Date(),
        },
      },
    };
  }

  /**
   * يُحلّل تسلسل الأحداث المتعلقة بعملية معينة
   */
  async traceOperation(operationId: string): Promise<ForensicEvent[]> {
    const sql = getSql();
    return sql<ForensicEvent[]>`
      SELECT * FROM forensic_events
      WHERE metadata->>'operationId' = ${operationId}
      ORDER BY timestamp ASC
    `;
  }

  /**
   * يكشف الأنماط المشبوهة
   */
  async detectAnomalies(projectId: string): Promise<{
    type: string;
    description: string;
    events: ForensicEvent[];
    severity: "low" | "medium" | "high" | "critical";
  }[]> {
    const sql = getSql();
    const anomalies = [];

    // كشف: عمليات فاشلة متكررة
    const repeatedFailures = await sql<{ action: string; count: string }[]>`
      SELECT action, COUNT(*) as count
      FROM forensic_events
      WHERE project_id = ${projectId}
        AND result = 'failure'
        AND timestamp > NOW() - INTERVAL '1 hour'
      GROUP BY action
      HAVING COUNT(*) > 5
    `;

    for (const failure of repeatedFailures) {
      anomalies.push({
        type: "repeated_failures",
        description: `العملية '${failure.action}' فشلت ${failure.count} مرات في آخر ساعة`,
        events: [],
        severity: "high" as const,
      });
    }

    // كشف: وصول في أوقات غير مألوفة
    const offHoursAccess = await sql<ForensicEvent[]>`
      SELECT * FROM forensic_events
      WHERE project_id = ${projectId}
        AND EXTRACT(HOUR FROM timestamp) NOT BETWEEN 6 AND 22
        AND risk IN ('high', 'critical')
        AND timestamp > NOW() - INTERVAL '24 hours'
      ORDER BY timestamp DESC
      LIMIT 10
    `;

    if (offHoursAccess.length > 0) {
      anomalies.push({
        type: "off_hours_critical_access",
        description: `${offHoursAccess.length} عملية حرجة تمّت خارج ساعات العمل`,
        events: offHoursAccess,
        severity: "medium" as const,
      });
    }

    return anomalies;
  }
}

// ─── Migration ─────────────────────────────────────────────────────────────

export const FORENSICS_MIGRATION = `
  CREATE TABLE IF NOT EXISTS forensic_events (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    project_id UUID,
    user_id UUID,
    agent_type TEXT,
    action TEXT NOT NULL,
    tool TEXT,
    target TEXT,
    result TEXT NOT NULL DEFAULT 'success'
      CHECK (result IN ('success', 'failure', 'partial')),
    risk TEXT NOT NULL DEFAULT 'none'
      CHECK (risk IN ('none', 'low', 'medium', 'high', 'critical')),
    metadata JSONB NOT NULL DEFAULT '{}',
    ip_address TEXT,
    user_agent TEXT,
    duration_ms INTEGER,
    files_affected TEXT[],
    apis_called TEXT[],
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE INDEX IF NOT EXISTS idx_forensic_project
    ON forensic_events (project_id, timestamp DESC);
  CREATE INDEX IF NOT EXISTS idx_forensic_user
    ON forensic_events (user_id, timestamp DESC);
  CREATE INDEX IF NOT EXISTS idx_forensic_risk
    ON forensic_events (risk, timestamp DESC)
    WHERE risk IN ('high', 'critical');
`;

// ─── Singleton ─────────────────────────────────────────────────────────────

export const forensics = new ForensicsEngine();
