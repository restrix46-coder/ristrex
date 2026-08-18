/**
 * Policy as Code — src/lib/policy-as-code.server.ts
 *
 * يُحوّل قواعد Security/Architecture/Compliance/Infrastructure
 * إلى Policies قابلة للتنفيذ والتحقق الآلي.
 */

import { logger } from "@/lib/logger.server";

// ─── الأنواع ────────────────────────────────────────────────────────────────

export type PolicyDomain = "security" | "architecture" | "compliance" | "governance" | "data" | "deployment";
export type PolicyEffect = "allow" | "deny" | "require" | "warn";
export type PolicyResult = "pass" | "fail" | "warn" | "skip";

export interface Policy {
  id: string;
  name: string;
  domain: PolicyDomain;
  description: string;
  effect: PolicyEffect;
  condition: PolicyCondition;
  severity: "critical" | "high" | "medium" | "low";
  enabled: boolean;
  tags: string[];
}

export interface PolicyCondition {
  type: "rule" | "composite";
  field?: string;
  operator?: "eq" | "ne" | "gt" | "lt" | "contains" | "matches" | "exists" | "not_exists";
  value?: unknown;
  logic?: "and" | "or" | "not";
  conditions?: PolicyCondition[];
}

export interface PolicyEvaluation {
  policyId: string;
  policyName: string;
  result: PolicyResult;
  message: string;
  evidence?: unknown;
}

export interface PolicyReport {
  context: string;
  evaluatedAt: Date;
  totalPolicies: number;
  passed: number;
  failed: number;
  warned: number;
  evaluations: PolicyEvaluation[];
  blocked: boolean;
  summary: string;
}

// ─── Built-in Policies ────────────────────────────────────────────────────────

export const BUILT_IN_POLICIES: Policy[] = [
  // Security Policies
  {
    id: "sec-001", name: "No Hardcoded Secrets", domain: "security", effect: "deny",
    description: "Code must not contain hardcoded passwords, API keys, or secrets",
    condition: { type: "rule", field: "code", operator: "matches", value: /(password|api_key|secret)\s*=\s*["'][^"']{8,}/i },
    severity: "critical", enabled: true, tags: ["security", "secrets"],
  },
  {
    id: "sec-002", name: "SQL Queries Must Use Parameters", domain: "security", effect: "deny",
    description: "Raw SQL string concatenation is forbidden — use parameterized queries",
    condition: { type: "rule", field: "code", operator: "matches", value: /sql\s*\+\s*[^"]/i },
    severity: "critical", enabled: true, tags: ["security", "sql-injection"],
  },
  {
    id: "sec-003", name: "Authentication Required on Protected Routes", domain: "security", effect: "require",
    description: "All non-public API routes must have authentication middleware",
    condition: { type: "rule", field: "route", operator: "exists", value: "auth_middleware" },
    severity: "high", enabled: true, tags: ["security", "auth"],
  },
  // Architecture Policies
  {
    id: "arch-001", name: "Frontend Cannot Import DB Directly", domain: "architecture", effect: "deny",
    description: "Frontend files must not import from db.ts directly — use API layer",
    condition: { type: "rule", field: "import", operator: "matches", value: /from\s+["'].*db["']/ },
    severity: "high", enabled: true, tags: ["architecture", "layers"],
  },
  {
    id: "arch-002", name: "File Size Limit", domain: "architecture", effect: "warn",
    description: "Files over 400 lines should be split into smaller modules",
    condition: { type: "rule", field: "lineCount", operator: "gt", value: 400 },
    severity: "medium", enabled: true, tags: ["architecture", "maintainability"],
  },
  // Compliance Policies
  {
    id: "comp-001", name: "PII Must Be Masked in Logs", domain: "compliance", effect: "require",
    description: "Personal Identifiable Information must never appear in logs",
    condition: { type: "rule", field: "logs", operator: "not_exists", value: "pii_unmasked" },
    severity: "critical", enabled: true, tags: ["compliance", "privacy", "gdpr"],
  },
  {
    id: "comp-002", name: "Data Retention Policy Must Be Set", domain: "compliance", effect: "require",
    description: "All user data must have an explicit retention policy",
    condition: { type: "rule", field: "project", operator: "exists", value: "retention_policy" },
    severity: "high", enabled: true, tags: ["compliance", "data-retention"],
  },
  // Deployment Policies
  {
    id: "dep-001", name: "Tests Must Pass Before Deploy", domain: "deployment", effect: "require",
    description: "All automated tests must pass before production deployment",
    condition: { type: "rule", field: "cicd", operator: "eq", value: "tests_passed" },
    severity: "critical", enabled: true, tags: ["deployment", "quality"],
  },
  {
    id: "dep-002", name: "Security Scan Required", domain: "deployment", effect: "require",
    description: "Security scan must be completed before production deployment",
    condition: { type: "rule", field: "cicd", operator: "eq", value: "security_passed" },
    severity: "critical", enabled: true, tags: ["deployment", "security"],
  },
];

// ─── PolicyEngine ─────────────────────────────────────────────────────────────

export class PolicyEngine {
  private policies: Map<string, Policy> = new Map();

  constructor() {
    // تسجيل السياسات المدمجة
    for (const p of BUILT_IN_POLICIES) {
      this.policies.set(p.id, p);
    }
  }

  /**
   * يُسجّل سياسة جديدة
   */
  register(policy: Policy): void {
    this.policies.set(policy.id, policy);
    logger.info("Policy registered", { id: policy.id, domain: policy.domain });
  }

  /**
   * يُقيّم السياسات على سياق معين
   */
  evaluate(context: Record<string, unknown>, domain?: PolicyDomain): PolicyReport {
    const relevant = [...this.policies.values()].filter(
      (p) => p.enabled && (!domain || p.domain === domain),
    );

    const evaluations: PolicyEvaluation[] = [];
    let passed = 0, failed = 0, warned = 0;

    for (const policy of relevant) {
      const result = this.evaluatePolicy(policy, context);
      evaluations.push(result);

      if (result.result === "pass") passed++;
      else if (result.result === "fail") failed++;
      else if (result.result === "warn") warned++;
    }

    const blocked = evaluations.some(
      (e) => e.result === "fail" && relevant.find((p) => p.id === e.policyId)?.severity === "critical",
    );

    return {
      context: JSON.stringify(context).slice(0, 200),
      evaluatedAt: new Date(),
      totalPolicies: relevant.length,
      passed,
      failed,
      warned,
      evaluations,
      blocked,
      summary: `${passed}/${relevant.length} policies passed. ${failed} failed, ${warned} warnings.`,
    };
  }

  /**
   * يتحقق من توافق التغيير مع جميع السياسات
   */
  checkChange(change: { type: string; files: string[]; code?: string }): PolicyReport {
    return this.evaluate({ ...change, changeType: change.type }, "architecture");
  }

  /**
   * يتحقق من السياسات قبل النشر
   */
  checkDeployment(deploymentInfo: object): PolicyReport {
    return this.evaluate({ ...deploymentInfo }, "deployment");
  }

  /**
   * يُولّد تقرير السياسات
   */
  generateReport(report: PolicyReport): string {
    const lines = [
      `# Policy Evaluation Report`,
      `**Time:** ${report.evaluatedAt.toISOString()}`,
      `**Status:** ${report.blocked ? "🚫 BLOCKED" : report.failed > 0 ? "⚠️ WARNINGS" : "✅ PASSED"}`,
      ``,
      `## Summary`,
      `- ✅ Passed: ${report.passed}`,
      `- ❌ Failed: ${report.failed}`,
      `- ⚠️ Warned: ${report.warned}`,
      ``,
      `## Details`,
    ];

    for (const ev of report.evaluations) {
      const icon = ev.result === "pass" ? "✅" : ev.result === "fail" ? "❌" : ev.result === "warn" ? "⚠️" : "⏭️";
      lines.push(`${icon} **${ev.policyName}**: ${ev.message}`);
    }

    return lines.join("\n");
  }

  private evaluatePolicy(policy: Policy, context: Record<string, unknown>): PolicyEvaluation {
    try {
      const matches = this.evaluateCondition(policy.condition, context);

      let result: PolicyResult;
      let message: string;

      if (policy.effect === "deny") {
        result = matches ? "fail" : "pass";
        message = matches ? `Violation: ${policy.description}` : "OK";
      } else if (policy.effect === "require") {
        result = matches ? "pass" : "fail";
        message = matches ? "Requirement satisfied" : `Missing: ${policy.description}`;
      } else if (policy.effect === "warn") {
        result = matches ? "warn" : "pass";
        message = matches ? `Warning: ${policy.description}` : "OK";
      } else {
        result = "pass";
        message = "Allowed";
      }

      return { policyId: policy.id, policyName: policy.name, result, message };
    } catch {
      return { policyId: policy.id, policyName: policy.name, result: "skip", message: "Evaluation error" };
    }
  }

  private evaluateCondition(condition: PolicyCondition, context: Record<string, unknown>): boolean {
    if (condition.type === "composite") {
      const results = (condition.conditions ?? []).map((c) => this.evaluateCondition(c, context));
      if (condition.logic === "and") return results.every(Boolean);
      if (condition.logic === "or") return results.some(Boolean);
      if (condition.logic === "not") return !results[0];
      return false;
    }

    const fieldValue = context[condition.field ?? ""] as string;
    const targetValue = condition.value;

    switch (condition.operator) {
      case "eq": return fieldValue === targetValue;
      case "ne": return fieldValue !== targetValue;
      case "gt": return Number(fieldValue) > Number(targetValue);
      case "lt": return Number(fieldValue) < Number(targetValue);
      case "contains": return String(fieldValue).includes(String(targetValue));
      case "matches": return targetValue instanceof RegExp ? targetValue.test(String(fieldValue)) : false;
      case "exists": return fieldValue !== undefined && fieldValue !== null;
      case "not_exists": return fieldValue === undefined || fieldValue === null;
      default: return false;
    }
  }

  /**
   * يُرجع جميع السياسات
   */
  list(domain?: PolicyDomain): Policy[] {
    return [...this.policies.values()].filter((p) => !domain || p.domain === domain);
  }
}

export const policyEngine = new PolicyEngine();
