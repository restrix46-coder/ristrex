/**
 * Resource Scheduler — src/lib/resource-scheduler.server.ts
 *
 * يُوزّع CPU/RAM/Workers/BrowserSessions بشكل عادل وذكي
 * عبر جميع المشاريع والمهام المتزامنة.
 */

import { logger } from "@/lib/logger.server";

// ─── الأنواع ────────────────────────────────────────────────────────────────

export type ResourceType = "cpu_cores" | "memory_mb" | "workers" | "browser_sessions" | "db_connections" | "ai_requests_per_min";

export interface ResourceQuota {
  projectId: string;
  resourceType: ResourceType;
  limit: number;
  priority: 1 | 2 | 3 | 4 | 5; // 1=highest
  allocated: number;
  used: number;
}

export interface ResourceRequest {
  requestId: string;
  projectId: string;
  taskId: string;
  resourceType: ResourceType;
  amount: number;
  priority: 1 | 2 | 3 | 4 | 5;
  maxWaitMs?: number;
}

export interface SchedulerStats {
  totalCapacity: Record<ResourceType, number>;
  totalAllocated: Record<ResourceType, number>;
  utilization: Record<ResourceType, number>;
  pendingRequests: number;
  activeAllocations: number;
}

// ─── ResourceScheduler ───────────────────────────────────────────────────────

export class ResourceScheduler {
  private capacity: Map<ResourceType, number> = new Map([
    ["cpu_cores", 8],
    ["memory_mb", 16384],
    ["workers", 20],
    ["browser_sessions", 5],
    ["db_connections", 50],
    ["ai_requests_per_min", 100],
  ]);

  private allocations: Map<string, ResourceQuota[]> = new Map(); // projectId → quotas
  private activeAllocations: Map<string, ResourceRequest> = new Map(); // requestId → request

  /**
   * يُخصّص موارد لمشروع
   */
  allocate(request: ResourceRequest): { success: boolean; allocated: number; waitMs?: number; reason?: string } {
    const available = this.getAvailable(request.resourceType);

    if (available >= request.amount) {
      // متاح مباشرة
      this.reserveResource(request);
      return { success: true, allocated: request.amount };
    }

    // لا يوجد كافٍ — تقليل بحسب الأولوية
    const canPartial = Math.min(available, request.amount);
    if (canPartial > 0) {
      const partialRequest = { ...request, amount: canPartial };
      this.reserveResource(partialRequest);
      return {
        success: true,
        allocated: canPartial,
        reason: `Partial allocation: only ${canPartial} of ${request.amount} available`,
      };
    }

    return {
      success: false,
      allocated: 0,
      reason: `No ${request.resourceType} available (${available} free, requested ${request.amount})`,
    };
  }

  /**
   * يُحرّر الموارد المخصصة
   */
  release(requestId: string): void {
    const request = this.activeAllocations.get(requestId);
    if (!request) return;

    const projectAllocations = this.allocations.get(request.projectId) ?? [];
    const idx = projectAllocations.findIndex(
      (q) => q.resourceType === request.resourceType,
    );

    if (idx >= 0) {
      projectAllocations[idx]!.used = Math.max(
        0,
        (projectAllocations[idx]!.used ?? 0) - request.amount,
      );
    }

    this.activeAllocations.delete(requestId);
    logger.debug("Resource released", { requestId, resource: request.resourceType, amount: request.amount });
  }

  /**
   * يُرجع الموارد المتاحة
   */
  getAvailable(resourceType: ResourceType): number {
    const total = this.capacity.get(resourceType) ?? 0;
    const used = [...this.activeAllocations.values()]
      .filter((r) => r.resourceType === resourceType)
      .reduce((sum, r) => sum + r.amount, 0);
    return Math.max(0, total - used);
  }

  /**
   * يُعيّن سعة الموارد الكلية
   */
  setCapacity(resourceType: ResourceType, amount: number): void {
    this.capacity.set(resourceType, amount);
  }

  /**
   * يُولّد إحصائيات الجدولة
   */
  getStats(): SchedulerStats {
    const stats: SchedulerStats = {
      totalCapacity: {} as Record<ResourceType, number>,
      totalAllocated: {} as Record<ResourceType, number>,
      utilization: {} as Record<ResourceType, number>,
      pendingRequests: 0,
      activeAllocations: this.activeAllocations.size,
    };

    for (const [type, capacity] of this.capacity) {
      const used = [...this.activeAllocations.values()]
        .filter((r) => r.resourceType === type)
        .reduce((sum, r) => sum + r.amount, 0);

      stats.totalCapacity[type] = capacity;
      stats.totalAllocated[type] = used;
      stats.utilization[type] = capacity > 0 ? Math.round((used / capacity) * 100) : 0;
    }

    return stats;
  }

  /**
   * يُولّد تقرير استخدام الموارد
   */
  generateReport(): string {
    const stats = this.getStats();
    const lines = [
      `# Resource Scheduler Report`,
      `**Active Allocations:** ${stats.activeAllocations}`,
      ``,
      `| Resource | Total | Used | Available | Utilization |`,
      `|---------|-------|------|-----------|-------------|`,
    ];

    for (const type of Object.keys(stats.totalCapacity) as ResourceType[]) {
      const total = stats.totalCapacity[type];
      const used = stats.totalAllocated[type];
      const avail = total - used;
      const util = stats.utilization[type];
      const icon = util > 80 ? "🔴" : util > 60 ? "🟡" : "🟢";
      lines.push(`| ${type} | ${total} | ${used} | ${avail} | ${icon} ${util}% |`);
    }

    return lines.join("\n");
  }

  private reserveResource(request: ResourceRequest): void {
    this.activeAllocations.set(request.requestId, request);

    const projectAllocations = this.allocations.get(request.projectId) ?? [];
    const existing = projectAllocations.find((q) => q.resourceType === request.resourceType);

    if (existing) {
      existing.used += request.amount;
    } else {
      projectAllocations.push({
        projectId: request.projectId,
        resourceType: request.resourceType,
        limit: this.capacity.get(request.resourceType) ?? 999,
        priority: request.priority,
        allocated: request.amount,
        used: request.amount,
      });
    }

    this.allocations.set(request.projectId, projectAllocations);
  }
}

export const resourceScheduler = new ResourceScheduler();
