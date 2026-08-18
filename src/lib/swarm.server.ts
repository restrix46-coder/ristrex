/**
 * swarm.server.ts — نظام Agent Swarms لتشغيل مهام متوازية متخصصة.
 *
 * بدلاً من وكيل واحد يعمل تسلسلياً:
 *   USER → ORCHESTRATOR → [Agent A] → [Agent B] → [Agent C] → MERGE
 *
 * يُقسّم الأوركستراتور المهام الكبيرة إلى مهام فرعية متخصصة تعمل بالتوازي،
 * ثم يدمج نتائجها في مخرج موحّد.
 *
 * ✅ تسريع: مهام مستقلة تعمل بالتوازي بدلاً من التسلسل
 * ✅ جودة: كل وكيل متخصص في مجال محدد (UI, Logic, Tests, Security)
 * ✅ مرونة: قابل للتوسع بإضافة أنواع وكلاء جديدة
 */

import { routedCall, type TaskKind } from "@/lib/model-router.server";
import { logger } from "@/lib/logger.server";

// ============================================================
// أنواع الوكلاء المتخصصة
// ============================================================

export type AgentRole =
  | "ui"          // مصمم واجهات — HTML/CSS/Animations
  | "logic"       // مطور منطق — JS/TS/APIs
  | "tests"       // مهندس اختبارات — Unit/Integration/E2E
  | "security"    // محلل أمني — Vulnerabilities/Best Practices
  | "seo"         // خبير SEO — Meta/Schema/Performance
  | "review"      // مراجع كود — Code Quality/Patterns
  | "docs";       // كاتب توثيق — README/Comments/Specs

export interface SwarmAgent {
  role: AgentRole;
  name: string;
  description: string;
  systemPrompt: string;
  taskKind: TaskKind;
  /** متوسط الوقت المتوقع بالثواني */
  estimatedSeconds: number;
}

export interface SwarmTask {
  /** المحتوى المرسل للوكيل */
  prompt: string;
  /** السياق المشترك بين كل الوكلاء */
  context?: string;
  /** أدوار الوكلاء المطلوب تشغيلها */
  roles: AgentRole[];
  /** عنوان المهمة للعرض */
  title?: string;
}

export interface SwarmAgentResult {
  role: AgentRole;
  name: string;
  output: string;
  durationMs: number;
  success: boolean;
  error?: string;
}

export interface SwarmResult {
  title: string;
  agents: SwarmAgentResult[];
  merged: string;
  totalDurationMs: number;
  successCount: number;
  failureCount: number;
}

// ============================================================
// تعريف الوكلاء
// ============================================================

const SWARM_AGENTS: Record<AgentRole, SwarmAgent> = {
  ui: {
    role: "ui",
    name: "وكيل الواجهة",
    description: "متخصص في HTML/CSS والتصميم البصري والرسوم المتحركة",
    taskKind: "coding",
    estimatedSeconds: 30,
    systemPrompt: `أنت مصمم واجهات متخصص. مهمتك:
- كتابة HTML دلالي (semantic) نظيف
- تصميم CSS احترافي مع متغيرات CSS وتصميم متجاوب
- رسوم متحركة سلسة باستخدام CSS transitions/keyframes
- أنماط تصميم حديثة (glassmorphism, neumorphism, gradients)
- تجربة مستخدم ممتازة مع مؤشرات hover وfocus
أخرج فقط الكود المطلوب بدون شرح إضافي.`,
  },
  logic: {
    role: "logic",
    name: "وكيل المنطق",
    description: "متخصص في TypeScript/JavaScript والـ APIs والحالة",
    taskKind: "coding",
    estimatedSeconds: 35,
    systemPrompt: `أنت مطور منطق متخصص. مهمتك:
- كتابة TypeScript نظيف مع أنواع صارمة
- إدارة الحالة بكفاءة (Zustand/Context/useReducer)
- معالجة الأخطاء الشاملة مع try/catch
- تحسين الأداء (useMemo/useCallback/lazy loading)
- دوال نقية قابلة للاختبار
أخرج فقط الكود المطلوب بدون شرح إضافي.`,
  },
  tests: {
    role: "tests",
    name: "وكيل الاختبارات",
    description: "متخصص في كتابة اختبارات شاملة",
    taskKind: "coding",
    estimatedSeconds: 25,
    systemPrompt: `أنت مهندس اختبارات متخصص. مهمتك:
- كتابة اختبارات وحدة (Unit) بـ Vitest/Jest
- اختبارات تكاملية للـ APIs
- اختبارات E2E بـ Playwright للتدفقات الحرجة
- تغطية ≥80% للمسارات الرئيسية
- اختبار حالات الحافة والأخطاء
أخرج اختبارات جاهزة للتنفيذ بدون شرح إضافي.`,
  },
  security: {
    role: "security",
    name: "وكيل الأمان",
    description: "متخصص في تحليل الثغرات والتشفير",
    taskKind: "reasoning",
    estimatedSeconds: 20,
    systemPrompt: `أنت محلل أمني متخصص. مهمتك:
- كشف ثغرات OWASP Top 10 (XSS, SQLi, CSRF, etc.)
- التحقق من صحة المدخلات وتطهيرها
- فحص إدارة الجلسات والمصادقة
- التحقق من CORS وCSP والرؤوس الأمنية
- اقتراح إصلاحات محددة مع كود مثال
أخرج تقرير أمني منظّم بالمشكلة والخطورة والإصلاح.`,
  },
  seo: {
    role: "seo",
    name: "وكيل SEO",
    description: "متخصص في تحسين محركات البحث",
    taskKind: "fast",
    estimatedSeconds: 15,
    systemPrompt: `أنت خبير SEO متخصص. مهمتك:
- تحسين العناوين والأوصاف والـ meta tags
- إضافة Schema.org markup المناسب
- تحسين بنية الروابط والـ heading hierarchy
- تحسين Core Web Vitals (LCP, FID, CLS)
- إنشاء sitemap.xml وrobots.txt
أخرج تحسينات محددة قابلة للتطبيق فوراً.`,
  },
  review: {
    role: "review",
    name: "وكيل مراجعة الكود",
    description: "متخصص في جودة الكود والأنماط",
    taskKind: "reasoning",
    estimatedSeconds: 20,
    systemPrompt: `أنت مراجع كود خبير. مهمتك:
- تقييم جودة الكود والالتزام بـ SOLID/DRY/KISS
- الكشف عن code smells والـ anti-patterns
- اقتراح تحسينات الأداء والقراءة
- مراجعة اتفاقيات التسمية والهيكل
- تقييم قابلية الصيانة والتوسع
أخرج تقرير مراجعة منظّم بالأولوية.`,
  },
  docs: {
    role: "docs",
    name: "وكيل التوثيق",
    description: "متخصص في كتابة التوثيق الشامل",
    taskKind: "fast",
    estimatedSeconds: 15,
    systemPrompt: `أنت كاتب توثيق تقني. مهمتك:
- كتابة JSDoc/TSDoc لكل دالة وكلاس
- README شامل مع أمثلة استخدام
- توثيق الـ API endpoints
- شرح القرارات المعمارية (ADRs)
- أمثلة كود عملية وقابلة للتشغيل
أخرج توثيقاً احترافياً وواضحاً.`,
  },
};

// ============================================================
// محرك Swarm
// ============================================================

/**
 * يُشغّل عدة وكلاء بالتوازي على نفس السياق
 * ثم يدمج نتائجهم في مخرج موحّد.
 */
export async function runSwarm(task: SwarmTask): Promise<SwarmResult> {
  const startTime = Date.now();
  const title = task.title ?? `Swarm: ${task.roles.join(", ")}`;

  logger.info("بدء تشغيل Swarm", {
    title,
    roles: task.roles,
    agentCount: task.roles.length,
  });

  // تشغيل كل الوكلاء بالتوازي
  const agentPromises = task.roles.map(async (role): Promise<SwarmAgentResult> => {
    const agent = SWARM_AGENTS[role];
    const agentStart = Date.now();

    try {
      const content = task.context
        ? `السياق:\n${task.context}\n\nالمهمة:\n${task.prompt}`
        : task.prompt;

      const result = await routedCall({
        kind: agent.taskKind,
        system: agent.systemPrompt,
        content,
        maxTokens: 4000,
      });

      const durationMs = Date.now() - agentStart;
      logger.info(`✅ وكيل ${agent.name} أنهى مهمته`, {
        role,
        durationMs,
        model: result.model,
      });

      return {
        role,
        name: agent.name,
        output: result.text,
        durationMs,
        success: true,
      };
    } catch (error) {
      const durationMs = Date.now() - agentStart;
      const errMsg = error instanceof Error ? error.message : String(error);
      logger.warn(`❌ فشل وكيل ${agent.name}`, { role, error: errMsg, durationMs });

      return {
        role,
        name: agent.name,
        output: "",
        durationMs,
        success: false,
        error: errMsg,
      };
    }
  });

  const agents = await Promise.all(agentPromises);
  const successCount = agents.filter((a) => a.success).length;
  const failureCount = agents.filter((a) => !a.success).length;
  const totalDurationMs = Date.now() - startTime;

  // دمج نتائج الوكلاء الناجحة
  const merged = mergeSwarmResults(agents, title);

  logger.info("اكتمل تشغيل Swarm", {
    title,
    successCount,
    failureCount,
    totalDurationMs,
  });

  return {
    title,
    agents,
    merged,
    totalDurationMs,
    successCount,
    failureCount,
  };
}

/**
 * يدمج مخرجات كل الوكلاء الناجحة في تقرير موحّد
 */
function mergeSwarmResults(agents: SwarmAgentResult[], title: string): string {
  const successful = agents.filter((a) => a.success);
  if (successful.length === 0) {
    return "فشل جميع الوكلاء في إتمام المهمة.";
  }

  const sections = successful.map((agent) => {
    const durationSec = (agent.durationMs / 1000).toFixed(1);
    return `## ${agent.name} (${durationSec}s)\n\n${agent.output}`;
  });

  const failedSection =
    agents
      .filter((a) => !a.success)
      .map((a) => `- ${a.name}: ${a.error ?? "خطأ غير معروف"}`)
      .join("\n") || null;

  return [
    `# ${title}`,
    "",
    ...sections,
    ...(failedSection ? ["\n---\n## ⚠️ وكلاء فاشلة\n\n" + failedSection] : []),
  ].join("\n");
}

// ============================================================
// قوالب Swarm جاهزة
// ============================================================

/** مجموعة Swarm لبناء تطبيق كامل */
export const FULL_APP_SWARM: AgentRole[] = ["ui", "logic", "security", "seo"];

/** مجموعة Swarm لمراجعة كود موجود */
export const CODE_REVIEW_SWARM: AgentRole[] = ["review", "security", "tests"];

/** مجموعة Swarm لتحسين منتج موجود */
export const OPTIMIZATION_SWARM: AgentRole[] = ["ui", "logic", "seo", "docs"];

/** معلومات الوكلاء للعرض في الواجهة */
export function getSwarmAgentInfo(role: AgentRole) {
  return SWARM_AGENTS[role];
}

export function getAllSwarmAgents() {
  return Object.values(SWARM_AGENTS);
}
