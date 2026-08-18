/**
 * Backward Compatibility Manager — src/lib/backward-compat.server.ts
 *
 * يضمن أن الإصدارات الجديدة لا تكسر العملاء الحاليين:
 * - API Versioning
 * - Schema Compatibility
 * - Data Migration
 * - Deprecation Notices
 */

import { logger } from "@/lib/logger.server";

// ─── الأنواع ────────────────────────────────────────────────────────────────

export interface CompatibilityCheck {
  isCompatible: boolean;
  breakingChanges: BreakingChange[];
  nonBreakingChanges: string[];
  migrationRequired: boolean;
  migrationSteps: string[];
}

export interface BreakingChange {
  type: "removed_field" | "changed_type" | "removed_endpoint" | "changed_behavior" | "renamed_field";
  description: string;
  affected: string;
  severity: "critical" | "major" | "minor";
  migration?: string;
}

export interface ApiVersion {
  version: string;
  status: "current" | "deprecated" | "sunset";
  releasedAt: Date;
  sunsetAt?: Date;
  changes: string[];
}

export interface SchemaChange {
  table: string;
  column?: string;
  type: "added_column" | "removed_column" | "changed_type" | "added_table" | "removed_table" | "changed_constraint";
  isBreaking: boolean;
  migration: string;
}

// ─── BackwardCompatibilityService ─────────────────────────────────────────────

export class BackwardCompatibilityService {
  private versions = new Map<string, ApiVersion>();

  /**
   * يتحقق من توافق تغيير API مع الإصدار السابق
   */
  checkApiCompatibility(
    oldSchema: Record<string, unknown>,
    newSchema: Record<string, unknown>,
  ): CompatibilityCheck {
    const breakingChanges: BreakingChange[] = [];
    const nonBreakingChanges: string[] = [];

    // فحص الحقول المحذوفة
    for (const [key, value] of Object.entries(oldSchema)) {
      if (!(key in newSchema)) {
        breakingChanges.push({
          type: "removed_field",
          description: `Field '${key}' was removed`,
          affected: key,
          severity: "major",
          migration: `Add '${key}' back or provide migration for clients using it`,
        });
      } else if (typeof value !== typeof newSchema[key]) {
        breakingChanges.push({
          type: "changed_type",
          description: `Field '${key}' type changed from ${typeof value} to ${typeof newSchema[key]}`,
          affected: key,
          severity: "major",
        });
      }
    }

    // الحقول الجديدة غير كاسرة
    for (const key of Object.keys(newSchema)) {
      if (!(key in oldSchema)) {
        nonBreakingChanges.push(`Added field '${key}'`);
      }
    }

    return {
      isCompatible: breakingChanges.length === 0,
      breakingChanges,
      nonBreakingChanges,
      migrationRequired: breakingChanges.length > 0,
      migrationSteps: breakingChanges.map((c) => c.migration ?? `Handle: ${c.description}`),
    };
  }

  /**
   * يتحقق من توافق تغييرات Schema قاعدة البيانات
   */
  checkSchemaCompatibility(changes: SchemaChange[]): CompatibilityCheck {
    const breakingChanges: BreakingChange[] = [];
    const nonBreakingChanges: string[] = [];

    for (const change of changes) {
      if (change.isBreaking) {
        breakingChanges.push({
          type: "changed_type",
          description: `${change.type} on ${change.table}${change.column ? `.${change.column}` : ""}`,
          affected: change.table,
          severity: "critical",
          migration: change.migration,
        });
      } else {
        nonBreakingChanges.push(`${change.type} on ${change.table}`);
      }
    }

    return {
      isCompatible: breakingChanges.length === 0,
      breakingChanges,
      nonBreakingChanges,
      migrationRequired: breakingChanges.some((c) => c.severity === "critical"),
      migrationSteps: changes.filter((c) => c.isBreaking).map((c) => c.migration),
    };
  }

  /**
   * يُسجّل إصدار API جديد
   */
  registerVersion(version: ApiVersion): void {
    this.versions.set(version.version, version);
    logger.info("API version registered", { version: version.version, status: version.status });
  }

  /**
   * يتحقق أن إصدار API مدعوم
   */
  isVersionSupported(version: string): boolean {
    const v = this.versions.get(version);
    return v !== undefined && v.status !== "sunset";
  }

  /**
   * يُضيف headers الإصدار للـ Response
   */
  addVersionHeaders(version: string): Record<string, string> {
    const v = this.versions.get(version);
    const headers: Record<string, string> = {
      "API-Version": version,
    };

    if (v?.status === "deprecated" && v.sunsetAt) {
      headers["Deprecation"] = "true";
      headers["Sunset"] = v.sunsetAt.toUTCString();
    }

    return headers;
  }

  /**
   * يُولّد تقرير التوافق
   */
  generateCompatibilityReport(check: CompatibilityCheck): string {
    const lines = [
      `# تقرير التوافق`,
      ``,
      `## الحالة: ${check.isCompatible ? "✅ متوافق" : "❌ غير متوافق"}`,
      ``,
    ];

    if (check.breakingChanges.length > 0) {
      lines.push(`## ⚠️ تغييرات كاسرة (${check.breakingChanges.length})`);
      for (const change of check.breakingChanges) {
        lines.push(`- **[${change.severity}]** ${change.description}`);
        if (change.migration) lines.push(`  - الحل: ${change.migration}`);
      }
      lines.push(``);
    }

    if (check.nonBreakingChanges.length > 0) {
      lines.push(`## ✅ تغييرات غير كاسرة (${check.nonBreakingChanges.length})`);
      for (const change of check.nonBreakingChanges) {
        lines.push(`- ${change}`);
      }
    }

    return lines.join("\n");
  }
}

export const backwardCompat = new BackwardCompatibilityService();
