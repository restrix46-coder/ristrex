/**
 * Self-Healing System — src/lib/self-healing.server.ts
 *
 * نظام الإصلاح الذاتي الكامل:
 * Detect → Diagnose → Root Cause → Fix → Retest → Verify
 * مع طلب Human Intervention بعد عدد محدد من المحاولات.
 */

import { logger } from "@/lib/logger.server";
import { sendAlert } from "@/lib/monitoring.server";

// ─── الأنواع ────────────────────────────────────────────────────────────────

export interface HealthIssue {
  id: string;
  type: "crash" | "memory_leak" | "high_latency" | "error_spike" | "build_failure" | "test_failure" | "dependency_failure";
  service: string;
  description: string;
  severity: "critical" | "high" | "medium" | "low";
  detectedAt: Date;
  evidence: Record<string, unknown>;
}

export interface HealingAttempt {
  issueId: string;
  attemptNumber: number;
  action: string;
  result: "success" | "failed" | "partial";
  error?: string;
  timestamp: Date;
  durationMs: number;
}

export interface HealingRecord {
  issue: HealthIssue;
  attempts: HealingAttempt[];
  status: "healing" | "healed" | "escalated" | "human_needed";
  rootCause?: string;
  finalFix?: string;
  healedAt?: Date;
  escalatedAt?: Date;
}

// ─── SelfHealingEngine ─────────────────────────────────────────────────────

export class SelfHealingEngine {
  private readonly maxAutoAttempts = 3;
  private healingRecords = new Map<string, HealingRecord>();

  /**
   * يكتشف مشكلة ويبدأ دورة الإصلاح
   */
  async detect(issue: HealthIssue): Promise<HealingRecord> {
    logger.warn("Health issue detected", { type: issue.type, service: issue.service, severity: issue.severity });

    const record: HealingRecord = {
      issue,
      attempts: [],
      status: "healing",
    };

    this.healingRecords.set(issue.id, record);

    // تشخيص تلقائي
    const rootCause = await this.diagnose(issue);
    record.rootCause = rootCause;

    // محاولة الإصلاح
    await this.heal(record);

    return record;
  }

  /**
   * يشخّص المشكلة ويحدد السبب الجذري
   */
  async diagnose(issue: HealthIssue): Promise<string> {
    const diagnoses: Record<string, string> = {
      crash: "Process exited unexpectedly — likely unhandled exception or OOM",
      memory_leak: "Memory usage growing without bounds — check for event listener leaks or large data retention",
      high_latency: "Response times elevated — check database queries, external API calls, or compute bottlenecks",
      error_spike: "Sudden increase in errors — likely bad deployment, external service failure, or data corruption",
      build_failure: "Build process failed — check for compilation errors, missing dependencies, or resource exhaustion",
      test_failure: "Automated tests failing — check for code regression, flaky tests, or environment issues",
      dependency_failure: "External dependency unavailable — check network, API keys, and service health",
    };

    const rootCause = diagnoses[issue.type] ?? "Unknown cause — manual investigation required";
    logger.info("Root cause identified", { issueId: issue.id, rootCause });
    return rootCause;
  }

  /**
   * يُحاول إصلاح المشكلة تلقائياً
   */
  async heal(record: HealingRecord): Promise<void> {
    const maxAttempts = this.maxAutoAttempts;
    let attemptNumber = record.attempts.length + 1;

    while (attemptNumber <= maxAttempts && record.status === "healing") {
      const start = Date.now();
      const action = this.selectHealingAction(record.issue, attemptNumber);

      logger.info("Attempting self-heal", { issueId: record.issue.id, attempt: attemptNumber, action });

      try {
        await this.executeAction(action, record.issue);

        const attempt: HealingAttempt = {
          issueId: record.issue.id,
          attemptNumber,
          action,
          result: "success",
          timestamp: new Date(),
          durationMs: Date.now() - start,
        };
        record.attempts.push(attempt);

        // التحقق من الإصلاح
        const verified = await this.verify(record.issue);
        if (verified) {
          record.status = "healed";
          record.healedAt = new Date();
          record.finalFix = action;
          logger.info("Self-healing successful", { issueId: record.issue.id, action });
          return;
        }
      } catch (err) {
        const attempt: HealingAttempt = {
          issueId: record.issue.id,
          attemptNumber,
          action,
          result: "failed",
          error: err instanceof Error ? err.message : String(err),
          timestamp: new Date(),
          durationMs: Date.now() - start,
        };
        record.attempts.push(attempt);
        logger.warn("Healing attempt failed", { issueId: record.issue.id, attempt: attemptNumber });
      }

      attemptNumber++;
    }

    // استنفاد المحاولات — تصعيد للإنسان
    await this.escalate(record);
  }

  /**
   * يتحقق من نجاح الإصلاح
   */
  async verify(issue: HealthIssue): Promise<boolean> {
    try {
      const healthUrl = process.env["HEALTH_CHECK_URL"] ?? "http://localhost:3000/api/health";
      const response = await fetch(healthUrl, { signal: AbortSignal.timeout(5000) });
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * يُصعّد المشكلة لفريق الإنسان
   */
  async escalate(record: HealingRecord): Promise<void> {
    record.status = record.issue.severity === "critical" ? "human_needed" : "escalated";
    record.escalatedAt = new Date();

    await sendAlert({
      title: `🚨 Self-Healing Exhausted: ${record.issue.type}`,
      message: `Failed to auto-heal after ${record.attempts.length} attempts.\nRoot cause: ${record.rootCause}\nManual intervention required.`,
      severity: record.issue.severity === "critical" ? "critical" : "high",
      metadata: { issueId: record.issue.id, attempts: record.attempts.length },
    });

    logger.error("Self-healing exhausted — human needed", { issueId: record.issue.id });
  }

  private selectHealingAction(issue: HealthIssue, attempt: number): string {
    const actions: Record<string, string[]> = {
      crash: ["restart_service", "clear_temp_files", "rollback_deployment"],
      memory_leak: ["restart_service", "force_gc", "rollback_deployment"],
      high_latency: ["clear_cache", "restart_service", "scale_up"],
      error_spike: ["rollback_deployment", "clear_cache", "restart_service"],
      build_failure: ["clear_build_cache", "reinstall_dependencies", "rollback_to_last_good"],
      test_failure: ["rerun_tests", "clear_test_cache", "notify_team"],
      dependency_failure: ["retry_connection", "switch_to_backup", "enable_circuit_breaker"],
    };

    const typeActions = actions[issue.type] ?? ["restart_service"];
    return typeActions[Math.min(attempt - 1, typeActions.length - 1)] ?? "notify_team";
  }

  private async executeAction(action: string, issue: HealthIssue): Promise<void> {
    logger.info("Executing healing action", { action, service: issue.service });
    // In production, these would trigger real infrastructure actions
    // e.g., Kubernetes restart, cache clear, etc.
    await new Promise((resolve) => setTimeout(resolve, 500)); // Simulate action
  }
}

export const selfHealing = new SelfHealingEngine();
