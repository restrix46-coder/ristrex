/**
 * Autoscaling Engine — src/lib/autoscaling.server.ts
 *
 * يوسّع الموارد تلقائياً بحسب الحمل
 * ويقلّصها عند انخفاضه توفيراً للتكلفة.
 */

import { logger } from "@/lib/logger.server";
import { eventBus } from "@/lib/event-bus.server";

// ─── الأنواع ────────────────────────────────────────────────────────────────

export type ScalableResource = "workers" | "browser_sessions" | "ai_agents" | "queue_consumers" | "db_connections";

export interface ScalingPolicy {
  resource: ScalableResource;
  minInstances: number;
  maxInstances: number;
  scaleUpThreshold: number;   // % utilization to trigger scale up
  scaleDownThreshold: number; // % utilization to trigger scale down
  scaleUpStep: number;
  scaleDownStep: number;
  cooldownMs: number;         // wait between scaling events
}

export interface ScalingEvent {
  resource: ScalableResource;
  direction: "up" | "down";
  from: number;
  to: number;
  reason: string;
  timestamp: Date;
}

export interface ResourceMetrics {
  resource: ScalableResource;
  currentInstances: number;
  utilization: number; // 0-100%
  queueDepth?: number;
  avgLatencyMs?: number;
}

// ─── AutoscalingEngine ────────────────────────────────────────────────────────

export class AutoscalingEngine {
  private policies: Map<ScalableResource, ScalingPolicy> = new Map();
  private currentInstances: Map<ScalableResource, number> = new Map();
  private lastScalingTime: Map<ScalableResource, number> = new Map();
  private scalingHistory: ScalingEvent[] = [];

  constructor() {
    // سياسات افتراضية
    this.addPolicy({
      resource: "workers",
      minInstances: 1,
      maxInstances: 20,
      scaleUpThreshold: 75,
      scaleDownThreshold: 25,
      scaleUpStep: 2,
      scaleDownStep: 1,
      cooldownMs: 60_000,
    });

    this.addPolicy({
      resource: "ai_agents",
      minInstances: 1,
      maxInstances: 10,
      scaleUpThreshold: 80,
      scaleDownThreshold: 20,
      scaleUpStep: 1,
      scaleDownStep: 1,
      cooldownMs: 30_000,
    });

    this.addPolicy({
      resource: "browser_sessions",
      minInstances: 1,
      maxInstances: 5,
      scaleUpThreshold: 90,
      scaleDownThreshold: 30,
      scaleUpStep: 1,
      scaleDownStep: 1,
      cooldownMs: 15_000,
    });

    this.addPolicy({
      resource: "queue_consumers",
      minInstances: 1,
      maxInstances: 15,
      scaleUpThreshold: 70,
      scaleDownThreshold: 20,
      scaleUpStep: 2,
      scaleDownStep: 1,
      cooldownMs: 45_000,
    });
  }

  /**
   * يُضيف سياسة تحجيم
   */
  addPolicy(policy: ScalingPolicy): void {
    this.policies.set(policy.resource, policy);
    this.currentInstances.set(policy.resource, policy.minInstances);
    logger.info("Autoscaling policy added", { resource: policy.resource });
  }

  /**
   * يُقيّم الحالة ويتخذ قرار التحجيم
   */
  evaluate(metrics: ResourceMetrics): ScalingEvent | null {
    const policy = this.policies.get(metrics.resource);
    if (!policy) return null;

    const lastScale = this.lastScalingTime.get(metrics.resource) ?? 0;
    const now = Date.now();

    // فترة التهدئة
    if (now - lastScale < policy.cooldownMs) return null;

    const current = this.currentInstances.get(metrics.resource) ?? policy.minInstances;

    // Scale Up
    if (metrics.utilization >= policy.scaleUpThreshold && current < policy.maxInstances) {
      const newCount = Math.min(current + policy.scaleUpStep, policy.maxInstances);
      return this.scale(metrics.resource, current, newCount, `High utilization: ${metrics.utilization}%`);
    }

    // Scale Down
    if (metrics.utilization <= policy.scaleDownThreshold && current > policy.minInstances) {
      const newCount = Math.max(current - policy.scaleDownStep, policy.minInstances);
      return this.scale(metrics.resource, current, newCount, `Low utilization: ${metrics.utilization}%`);
    }

    return null;
  }

  /**
   * يُنفّذ عملية التحجيم
   */
  private scale(
    resource: ScalableResource,
    from: number,
    to: number,
    reason: string,
  ): ScalingEvent {
    const event: ScalingEvent = {
      resource,
      direction: to > from ? "up" : "down",
      from,
      to,
      reason,
      timestamp: new Date(),
    };

    this.currentInstances.set(resource, to);
    this.lastScalingTime.set(resource, Date.now());
    this.scalingHistory.push(event);

    logger.info("Autoscaling event", event);

    // إرسال حدث للنظام
    eventBus.emit({
      type: "TaskCreated",
      payload: {
        taskId: crypto.randomUUID(),
        projectId: "platform",
        description: `Autoscaling ${resource}: ${from} → ${to}`,
      },
    } as never);

    return event;
  }

  /**
   * يُقيّم جميع الموارد دفعة واحدة
   */
  evaluateAll(metricsMap: ResourceMetrics[]): ScalingEvent[] {
    const events: ScalingEvent[] = [];
    for (const m of metricsMap) {
      const event = this.evaluate(m);
      if (event) events.push(event);
    }
    return events;
  }

  getCurrentInstances(resource: ScalableResource): number {
    return this.currentInstances.get(resource) ?? 1;
  }

  getScalingHistory(limit = 50): ScalingEvent[] {
    return this.scalingHistory.slice(-limit);
  }

  /**
   * يُولّد تقرير التحجيم
   */
  generateReport(): string {
    const lines = [
      `# Autoscaling Report`,
      `**Generated:** ${new Date().toISOString()}`,
      ``,
      `## Current Instances`,
      `| Resource | Current | Min | Max |`,
      `|---------|---------|-----|-----|`,
    ];

    for (const [resource, count] of this.currentInstances) {
      const policy = this.policies.get(resource);
      lines.push(`| ${resource} | ${count} | ${policy?.minInstances} | ${policy?.maxInstances} |`);
    }

    const recent = this.scalingHistory.slice(-10);
    if (recent.length > 0) {
      lines.push(``, `## Recent Scaling Events (last 10)`);
      for (const e of recent) {
        const icon = e.direction === "up" ? "⬆️" : "⬇️";
        lines.push(`- ${icon} **${e.resource}**: ${e.from}→${e.to} | ${e.reason}`);
      }
    }

    return lines.join("\n");
  }
}

export const autoscalingEngine = new AutoscalingEngine();
