/**
 * Network Egress Control — src/lib/network-policy.server.ts
 *
 * يُحدّد المجالات والخدمات التي يُسمح للـ Sandbox بالوصول إليها.
 * يمنع التسرّب غير المقصود للبيانات أو الاتصال بخوادم خارجية غير مصرّح بها.
 */

import { logger } from "@/lib/logger.server";

// ─── الأنواع ───────────────────────────────────────────────────────────────

export type EgressPolicy = "allow" | "deny" | "audit";

export interface NetworkRule {
  id: string;
  name: string;
  pattern: RegExp | string;
  policy: EgressPolicy;
  reason: string;
  allowedMethods?: string[];
}

export interface EgressCheckResult {
  allowed: boolean;
  rule?: NetworkRule;
  reason: string;
  url: string;
}

// ─── القواعد الافتراضية ────────────────────────────────────────────────────

const DEFAULT_RULES: NetworkRule[] = [
  // ✅ مسموح — خدمات AI الأساسية
  { id: "gemini", name: "Google Gemini", pattern: "generativelanguage.googleapis.com", policy: "allow", reason: "AI model provider" },

  // ✅ مسموح — قاعدة البيانات والتخزين
  { id: "supabase", name: "Supabase", pattern: /.*\.supabase\.co/, policy: "allow", reason: "Database provider" },
  { id: "supabase-db", name: "Supabase DB", pattern: /.*\.supabase\.com/, policy: "allow", reason: "Database provider" },

  // ✅ مسموح — الدفع والمراقبة
  { id: "stripe", name: "Stripe", pattern: "api.stripe.com", policy: "allow", reason: "Payment provider" },
  { id: "sentry", name: "Sentry", pattern: /.*\.ingest\.sentry\.io/, policy: "allow", reason: "Error monitoring" },

  // ✅ مسموح — التحديثات ومصادر npm
  { id: "npm", name: "NPM Registry", pattern: "registry.npmjs.org", policy: "allow", reason: "Package management" },
  { id: "github", name: "GitHub", pattern: /.*\.github\.com/, policy: "allow", reason: "Version control" },
  { id: "ghcr", name: "GitHub Container Registry", pattern: "ghcr.io", policy: "allow", reason: "Container registry" },

  // ✅ مسموح — CDN والأصول
  { id: "cdn", name: "CDN", pattern: /unpkg\.com|cdn\.jsdelivr\.net|fonts\.googleapis\.com|fonts\.gstatic\.com/, policy: "allow", reason: "Public CDN" },

  // 🔍 مراقبة — طلبات HTTP عامة
  { id: "http-audit", name: "General HTTP", pattern: /^http:\/\//, policy: "audit", reason: "Unencrypted traffic requires review" },

  // ❌ محظور — أي طلب غير مسمّى
  { id: "default-deny", name: "Default Deny", pattern: /.*/, policy: "deny", reason: "Unlisted destinations require explicit allowance" },
];

// ─── NetworkPolicyEngine ───────────────────────────────────────────────────

export class NetworkPolicyEngine {
  private rules: NetworkRule[];
  private auditLog: Array<{ url: string; result: EgressCheckResult; timestamp: Date }> = [];

  constructor(customRules: NetworkRule[] = []) {
    // القواعد المخصصة لها الأولوية
    this.rules = [...customRules, ...DEFAULT_RULES];
  }

  /**
   * يتحقق إن كان الـ URL مسموحاً به
   */
  check(url: string, method = "GET"): EgressCheckResult {
    for (const rule of this.rules) {
      const matches = typeof rule.pattern === "string"
        ? url.includes(rule.pattern)
        : rule.pattern.test(url);

      if (!matches) continue;

      if (rule.allowedMethods && !rule.allowedMethods.includes(method.toUpperCase())) {
        const result: EgressCheckResult = {
          allowed: false,
          rule,
          reason: `HTTP method ${method} not allowed for this destination`,
          url,
        };
        this.recordAudit(url, result);
        return result;
      }

      const result: EgressCheckResult = {
        allowed: rule.policy === "allow" || rule.policy === "audit",
        rule,
        reason: rule.reason,
        url,
      };

      this.recordAudit(url, result);

      if (rule.policy === "audit") {
        logger.warn("Network egress audit", { url, rule: rule.name });
      } else if (rule.policy === "deny") {
        logger.warn("Network egress DENIED", { url, rule: rule.name });
      }

      return result;
    }

    // Default deny
    const result: EgressCheckResult = { allowed: false, reason: "No matching rule", url };
    this.recordAudit(url, result);
    return result;
  }

  /**
   * يُنفّذ fetch مع فحص السياسة
   */
  async safeFetch(url: string, init?: RequestInit): Promise<Response> {
    const check = this.check(url, init?.method ?? "GET");
    if (!check.allowed) {
      throw new NetworkPolicyError(url, check.reason);
    }
    return fetch(url, init);
  }

  /**
   * يُضيف قاعدة مخصصة
   */
  addRule(rule: NetworkRule, position: "start" | "end" = "start"): void {
    if (position === "start") {
      this.rules.unshift(rule);
    } else {
      this.rules.push(rule);
    }
  }

  /**
   * يُرجع سجل التدقيق
   */
  getAuditLog() {
    return this.auditLog;
  }

  /**
   * يُمسح سجل التدقيق
   */
  clearAuditLog() {
    this.auditLog = [];
  }

  private recordAudit(url: string, result: EgressCheckResult) {
    this.auditLog.push({ url, result, timestamp: new Date() });
    if (this.auditLog.length > 1000) {
      this.auditLog.splice(0, 100); // احتفظ بآخر 900
    }
  }
}

// ─── خطأ خاص بالسياسة ────────────────────────────────────────────────────

export class NetworkPolicyError extends Error {
  public readonly statusCode = 403;
  constructor(url: string, reason: string) {
    super(`Network egress blocked: ${url} — ${reason}`);
    this.name = "NetworkPolicyError";
  }
}

// ─── Singleton ─────────────────────────────────────────────────────────────

export const networkPolicy = new NetworkPolicyEngine();
