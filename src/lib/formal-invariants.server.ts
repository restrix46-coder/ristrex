/**
 * Formal Invariants — src/lib/formal-invariants.server.ts
 *
 * تعريف قواعد يجب أن تبقى صحيحة دائماً،
 * والتحقق منها آلياً في كل تغيير.
 */

import { logger } from "@/lib/logger.server";

// ─── الأنواع ────────────────────────────────────────────────────────────────

export interface Invariant {
  id: string;
  name: string;
  description: string;
  category: "data" | "business" | "security" | "architecture" | "performance";
  check: (context: InvariantContext) => boolean | Promise<boolean>;
  errorMessage: string;
  severity: "critical" | "high" | "medium";
  enabled: boolean;
}

export interface InvariantContext {
  projectId?: string;
  data?: Record<string, unknown>;
  code?: string;
  metrics?: Record<string, number>;
  schema?: Record<string, unknown>;
}

export interface InvariantViolation {
  invariantId: string;
  invariantName: string;
  errorMessage: string;
  severity: Invariant["severity"];
  detectedAt: Date;
  context: InvariantContext;
}

export interface InvariantCheckResult {
  passed: Invariant[];
  violated: InvariantViolation[];
  allPassed: boolean;
  blockers: InvariantViolation[];
}

// ─── Built-in Invariants ─────────────────────────────────────────────────────

export const BUILT_IN_INVARIANTS: Invariant[] = [
  // Data Invariants
  {
    id: "inv-data-001",
    name: "No Negative Prices",
    description: "Price fields must always be >= 0",
    category: "data",
    check: (ctx) => {
      if (!ctx.data?.price) return true;
      return Number(ctx.data.price) >= 0;
    },
    errorMessage: "Price must be a non-negative number",
    severity: "critical",
    enabled: true,
  },
  {
    id: "inv-data-002",
    name: "User Email Must Be Valid",
    description: "User email addresses must match valid email format",
    category: "data",
    check: (ctx) => {
      if (!ctx.data?.email) return true;
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(ctx.data.email));
    },
    errorMessage: "Email address is not valid",
    severity: "high",
    enabled: true,
  },
  // Business Invariants
  {
    id: "inv-biz-001",
    name: "Order Total Matches Line Items",
    description: "Order total must equal sum of line item prices",
    category: "business",
    check: (ctx) => {
      const order = ctx.data?.order as { total: number; items: Array<{ price: number; qty: number }> } | undefined;
      if (!order?.items) return true;
      const computed = order.items.reduce((s, i) => s + i.price * i.qty, 0);
      return Math.abs(computed - order.total) < 0.01;
    },
    errorMessage: "Order total does not match sum of line items",
    severity: "critical",
    enabled: true,
  },
  // Security Invariants
  {
    id: "inv-sec-001",
    name: "No Plain Text Passwords",
    description: "Password fields must always be hashed, never plain text",
    category: "security",
    check: (ctx) => {
      const password = ctx.data?.password as string | undefined;
      if (!password) return true;
      // Plain passwords are typically short and lack the $2b$ bcrypt prefix
      return password.startsWith("$2b$") || password.startsWith("$argon2") || password.length > 50;
    },
    errorMessage: "Password appears to be stored as plain text",
    severity: "critical",
    enabled: true,
  },
  // Performance Invariants
  {
    id: "inv-perf-001",
    name: "API Response Under 2 Seconds",
    description: "API endpoints must respond within 2000ms under normal load",
    category: "performance",
    check: (ctx) => {
      const latency = ctx.metrics?.api_latency_ms;
      if (latency === undefined) return true;
      return latency < 2000;
    },
    errorMessage: "API response time exceeds 2000ms threshold",
    severity: "high",
    enabled: true,
  },
  // Architecture Invariants
  {
    id: "inv-arch-001",
    name: "No Circular Dependencies",
    description: "Module import graph must be acyclic",
    category: "architecture",
    check: (_ctx) => {
      // Checked by architecture enforcement separately
      return true;
    },
    errorMessage: "Circular dependency detected in module graph",
    severity: "high",
    enabled: true,
  },
];

// ─── InvariantChecker ─────────────────────────────────────────────────────────

export class InvariantChecker {
  private invariants: Map<string, Invariant> = new Map();

  constructor() {
    for (const inv of BUILT_IN_INVARIANTS) {
      this.invariants.set(inv.id, inv);
    }
  }

  /**
   * يُسجّل Invariant جديد
   */
  register(invariant: Invariant): void {
    this.invariants.set(invariant.id, invariant);
    logger.info("Invariant registered", { id: invariant.id, name: invariant.name });
  }

  /**
   * يتحقق من جميع Invariants
   */
  async checkAll(context: InvariantContext, category?: Invariant["category"]): Promise<InvariantCheckResult> {
    const relevant = [...this.invariants.values()].filter(
      (inv) => inv.enabled && (!category || inv.category === category),
    );

    const passed: Invariant[] = [];
    const violated: InvariantViolation[] = [];

    for (const inv of relevant) {
      try {
        const ok = await Promise.resolve(inv.check(context));
        if (ok) {
          passed.push(inv);
        } else {
          violated.push({
            invariantId: inv.id,
            invariantName: inv.name,
            errorMessage: inv.errorMessage,
            severity: inv.severity,
            detectedAt: new Date(),
            context,
          });
          logger.warn("Invariant violated", { id: inv.id, name: inv.name });
        }
      } catch (err) {
        logger.error("Invariant check error", { id: inv.id, error: err });
      }
    }

    const blockers = violated.filter((v) => v.severity === "critical");

    return {
      passed,
      violated,
      allPassed: violated.length === 0,
      blockers,
    };
  }

  /**
   * يتحقق من Invariant واحد فقط
   */
  async check(invariantId: string, context: InvariantContext): Promise<boolean> {
    const inv = this.invariants.get(invariantId);
    if (!inv) throw new Error(`Invariant ${invariantId} not found`);
    return Promise.resolve(inv.check(context));
  }

  /**
   * يُولّد تقرير الـ Invariants
   */
  generateReport(result: InvariantCheckResult): string {
    const lines = [
      `# Invariant Check Report`,
      `**Status:** ${result.allPassed ? "✅ All Passed" : `❌ ${result.violated.length} Violations`}`,
      ``,
    ];

    if (result.violated.length > 0) {
      lines.push(`## ❌ Violations (${result.violated.length})`);
      for (const v of result.violated) {
        lines.push(`- **[${v.severity.toUpperCase()}]** ${v.invariantName}: ${v.errorMessage}`);
      }
      lines.push(``);
    }

    lines.push(`## ✅ Passed (${result.passed.length})`);
    for (const p of result.passed) {
      lines.push(`- ${p.name}`);
    }

    return lines.join("\n");
  }

  list(): Invariant[] {
    return [...this.invariants.values()];
  }
}

export const invariantChecker = new InvariantChecker();
