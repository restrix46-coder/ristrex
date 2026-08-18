/**
 * Feature Flags — src/lib/feature-flags.server.ts
 *
 * نظام Feature Flags بسيط وفعّال يدعم:
 * - Flags عالمية (مفعّلة لجميع المستخدمين)
 * - Flags تدريجية (نسبة مئوية من المستخدمين)
 * - Flags بالمستخدم المحدد (allowlist)
 * - Override من Environment Variables
 *
 * الاستخدام:
 *   const enabled = await isEnabled("agent_swarms", userId);
 */

import { logger } from "@/lib/logger.server";

// ─── أنواع الـ Flags ─────────────────────────────────────────────────────

export type FlagStrategy =
  | { type: "boolean"; value: boolean }
  | { type: "percentage"; rollout: number } // 0-100
  | { type: "allowlist"; userIds: string[] }
  | { type: "env"; envVar: string; default: boolean };

export interface FeatureFlag {
  name: string;
  description: string;
  strategy: FlagStrategy;
  /** تاريخ انتهاء الصلاحية (اختياري) */
  expiresAt?: string;
}

// ─── تعريف الـ Flags ─────────────────────────────────────────────────────

export const FEATURE_FLAGS: FeatureFlag[] = [
  {
    name: "agent_swarms",
    description: "تشغيل وكلاء متخصصة بالتوازي",
    strategy: { type: "env", envVar: "FEATURE_AGENT_SWARMS", default: true },
  },
  {
    name: "security_scanner",
    description: "فاحص الأمان المدمج",
    strategy: { type: "boolean", value: true },
  },
  {
    name: "ai_dashboard",
    description: "لوحة مراقبة الذكاء الاصطناعي",
    strategy: { type: "boolean", value: true },
  },
  {
    name: "realtime_collaboration",
    description: "التعاون الفوري بين المستخدمين",
    strategy: { type: "env", envVar: "FEATURE_REALTIME", default: false },
  },
  {
    name: "payments",
    description: "نظام المدفوعات عبر Stripe",
    strategy: { type: "env", envVar: "FEATURE_PAYMENTS", default: false },
  },
  {
    name: "advanced_analytics",
    description: "تحليلات متقدمة للمشاريع",
    strategy: { type: "percentage", rollout: 50 },
  },
  {
    name: "cost_aware_routing",
    description: "توجيه النماذج بناءً على التكلفة",
    strategy: { type: "boolean", value: true },
  },
  {
    name: "beta_ui",
    description: "واجهة المستخدم التجريبية الجديدة",
    strategy: { type: "percentage", rollout: 10 },
  },
  {
    name: "rbac",
    description: "نظام الصلاحيات المتدرّج",
    strategy: { type: "env", envVar: "FEATURE_RBAC", default: false },
  },
  {
    name: "circuit_breaker",
    description: "حماية الاتصالات الخارجية",
    strategy: { type: "boolean", value: true },
  },
];

// ─── Cache الـ Flags ──────────────────────────────────────────────────────

const flagCache = new Map<string, boolean>();

// ─── الدوال الرئيسية ─────────────────────────────────────────────────────

/**
 * يتحقق من تفعيل Flag لمستخدم معيّن
 */
export async function isEnabled(
  flagName: string,
  userId?: string,
): Promise<boolean> {
  const cacheKey = `${flagName}:${userId ?? "global"}`;
  if (flagCache.has(cacheKey)) {
    return flagCache.get(cacheKey)!;
  }

  const flag = FEATURE_FLAGS.find((f) => f.name === flagName);
  if (!flag) {
    logger.warn("Feature flag غير موجودة", { flagName });
    return false;
  }

  // تحقق من انتهاء الصلاحية
  if (flag.expiresAt && new Date(flag.expiresAt) < new Date()) {
    return false;
  }

  const result = evaluateFlag(flag, userId);
  flagCache.set(cacheKey, result);
  // TTL بسيط — نُفرغ الـ cache بعد دقيقة
  setTimeout(() => flagCache.delete(cacheKey), 60_000);

  return result;
}

/**
 * يُرجع حالة كل الـ Flags
 */
export function getAllFlags(userId?: string): Record<string, boolean> {
  return Object.fromEntries(
    FEATURE_FLAGS.map((flag) => [flag.name, evaluateFlag(flag, userId)]),
  );
}

// ─── دالة التقييم ─────────────────────────────────────────────────────────

function evaluateFlag(flag: FeatureFlag, userId?: string): boolean {
  const { strategy } = flag;

  switch (strategy.type) {
    case "boolean":
      return strategy.value;

    case "env": {
      const val = process.env[strategy.envVar];
      if (val === undefined) return strategy.default;
      return val === "true" || val === "1";
    }

    case "percentage": {
      if (!userId) return false;
      // توزيع ثابت بناءً على hash المستخدم + اسم الـ flag
      const hash = simpleHash(`${userId}:${flag.name}`);
      return (hash % 100) < strategy.rollout;
    }

    case "allowlist":
      return userId ? strategy.userIds.includes(userId) : false;

    default:
      return false;
  }
}

function simpleHash(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}
