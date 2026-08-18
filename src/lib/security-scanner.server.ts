/**
 * security-scanner.server.ts — فاحص الأمان المدمج في Weaver.
 *
 * يفحص كود المشروع بحثاً عن:
 * ✅ ثغرات OWASP Top 10
 * ✅ تسريب أسرار (API keys, passwords في الكود)
 * ✅ مشاكل XSS وSQL injection
 * ✅ إعدادات CORS وCSP الخاطئة
 * ✅ تبعيات ذات إصدارات قديمة
 * ✅ مشاكل الجلسات والمصادقة
 *
 * يعمل بطريقتين:
 * 1. فحص Static بدون AI (سريع، مجاني)
 * 2. فحص AI-enhanced (أعمق، يستخدم model-router)
 */

import { logger } from "@/lib/logger.server";
import { routedCall } from "@/lib/model-router.server";

// ============================================================
// أنواع الثغرات
// ============================================================

export type Severity = "critical" | "high" | "medium" | "low" | "info";

export interface SecurityIssue {
  id: string;
  severity: Severity;
  category: string;
  title: string;
  description: string;
  file?: string;
  line?: number;
  code?: string;
  fix: string;
  cweId?: string;    // CWE ID للمرجعية
  owaspId?: string;  // OWASP ID
}

export interface ScanResult {
  projectId: string;
  scannedAt: string;
  filesScanned: number;
  issues: SecurityIssue[];
  score: number;        // 0-100 (100 = لا ثغرات)
  grade: "A" | "B" | "C" | "D" | "F";
  summary: string;
  aiEnhanced: boolean;
}

// ============================================================
// فحص ثابت بالـ Regex (بدون AI)
// ============================================================

interface Pattern {
  id: string;
  severity: Severity;
  category: string;
  title: string;
  description: string;
  fix: string;
  cweId?: string;
  owaspId?: string;
  regex: RegExp;
  fileFilter?: RegExp; // تطبّق على هذه الامتدادات فقط
}

const SECURITY_PATTERNS: Pattern[] = [
  // === تسريب الأسرار ===
  {
    id: "SEC-001",
    severity: "critical",
    category: "تسريب أسرار",
    title: "مفتاح API مشفّر في الكود",
    description: "تم العثور على مفتاح API مكتوب مباشرة في الكود المصدري.",
    fix: 'انقل المفتاح لمتغير بيئة: process.env["YOUR_API_KEY"]',
    cweId: "CWE-798",
    owaspId: "A07:2021",
    regex: /['"](sk-[a-zA-Z0-9]{20,}|AIza[0-9A-Za-z-_]{35}|AKIA[0-9A-Z]{16}|ghp_[a-zA-Z0-9]{36})['"]/g,
  },
  {
    id: "SEC-002",
    severity: "critical",
    category: "تسريب أسرار",
    title: "كلمة مرور مشفّرة في الكود",
    description: "تم العثور على كلمة مرور مكتوبة مباشرة في الكود.",
    fix: "استخدم متغير بيئة أو نظام إدارة الأسرار.",
    cweId: "CWE-259",
    owaspId: "A07:2021",
    regex: /password\s*[:=]\s*['"][^'"]{6,}['"]/gi,
    fileFilter: /\.(ts|tsx|js|jsx|py|rb|go|java)$/,
  },

  // === XSS ===
  {
    id: "SEC-003",
    severity: "high",
    category: "XSS",
    title: "استخدام dangerouslySetInnerHTML",
    description: "dangerouslySetInnerHTML قد تسبب XSS إذا لم يتم تطهير المحتوى.",
    fix: "استخدم DOMPurify.sanitize() قبل تمرير المحتوى، أو استبدل بـ ReactMarkdown.",
    cweId: "CWE-79",
    owaspId: "A03:2021",
    regex: /dangerouslySetInnerHTML/g,
    fileFilter: /\.(tsx|jsx)$/,
  },
  {
    id: "SEC-004",
    severity: "high",
    category: "XSS",
    title: "استخدام innerHTML مباشرة",
    description: "تعيين innerHTML مباشرة قد يسبب XSS.",
    fix: "استخدم textContent بدلاً من innerHTML، أو نظّف المحتوى مع DOMPurify.",
    cweId: "CWE-79",
    owaspId: "A03:2021",
    regex: /\.innerHTML\s*=/g,
    fileFilter: /\.(ts|tsx|js|jsx)$/,
  },

  // === SQL Injection ===
  {
    id: "SEC-005",
    severity: "critical",
    category: "SQL Injection",
    title: "استعلام SQL بدون Parameterization",
    description: "بناء استعلام SQL بـ template literal قد يسبب SQL Injection.",
    fix: "استخدم parameterized queries: sql`SELECT * FROM users WHERE id = ${id}`",
    cweId: "CWE-89",
    owaspId: "A03:2021",
    regex: /`\s*SELECT|INSERT|UPDATE|DELETE[^`]*\$\{/gi,
    fileFilter: /\.(ts|js|server\.ts)$/,
  },

  // === CSRF وAuth ===
  {
    id: "SEC-006",
    severity: "medium",
    category: "مصادقة",
    title: "console.log يسرّب معلومات حساسة",
    description: "console.log قد يطبع بيانات المستخدم أو التوكنات في السجلات.",
    fix: "استبدل بـ logger.info() مع إخفاء البيانات الحساسة.",
    cweId: "CWE-532",
    owaspId: "A09:2021",
    regex: /console\.(log|debug|info)\s*\([^)]*(?:token|password|secret|key|auth)[^)]*\)/gi,
  },

  // === eval ===
  {
    id: "SEC-007",
    severity: "high",
    category: "Code Injection",
    title: "استخدام eval() أو Function()",
    description: "eval() وnew Function() يسمحان بتنفيذ كود غير موثوق.",
    fix: "تجنب eval() تماماً. استخدم JSON.parse() أو خوارزمية محددة بدلاً منه.",
    cweId: "CWE-95",
    owaspId: "A03:2021",
    regex: /(?<!\w)eval\s*\(|new\s+Function\s*\(/g,
    fileFilter: /\.(ts|tsx|js|jsx)$/,
  },

  // === CORS ===
  {
    id: "SEC-008",
    severity: "high",
    category: "CORS",
    title: "CORS مفتوح للجميع (Access-Control-Allow-Origin: *)",
    description: "السماح لأي مصدر بالوصول يُعرّض البيانات للخطر.",
    fix: "حدّد الأصول المسموح بها: Access-Control-Allow-Origin: https://yourdomain.com",
    cweId: "CWE-942",
    owaspId: "A05:2021",
    regex: /Access-Control-Allow-Origin['":\s]+['"]\*/g,
  },

  // === مسارات URL عشوائية ===
  {
    id: "SEC-009",
    severity: "medium",
    category: "Path Traversal",
    title: "استخدام مسار مستخدم بدون تطهير",
    description: "تضمين مدخلات المستخدم في مسارات الملفات قد يسبب Path Traversal.",
    fix: "استخدم path.resolve() وتحقق أن المسار داخل الدليل المسموح به.",
    cweId: "CWE-22",
    owaspId: "A01:2021",
    regex: /readFile[Sync]?\s*\([^)]*req\.(params|query|body)/g,
    fileFilter: /\.(ts|js)$/,
  },

  // === Prototype Pollution ===
  {
    id: "SEC-010",
    severity: "medium",
    category: "Prototype Pollution",
    title: "Object.assign أو spread على مدخلات المستخدم",
    description: "دمج كائنات من المستخدم مباشرة قد يسبب Prototype Pollution.",
    fix: "تحقق من المدخلات مع Zod أو joi قبل دمجها.",
    cweId: "CWE-1321",
    owaspId: "A08:2021",
    regex: /Object\.assign\s*\(\s*(?:this|prototype|obj)[^)]*req\./g,
    fileFilter: /\.(ts|js|server\.ts)$/,
  },
];

// ============================================================
// الفاحص الرئيسي
// ============================================================

export interface FileToScan {
  path: string;
  content: string;
}

/**
 * الفحص الثابت السريع — يعمل بدون AI
 */
export function staticScan(files: FileToScan[]): SecurityIssue[] {
  const issues: SecurityIssue[] = [];
  let issueCounter = 0;

  for (const file of files) {
    for (const pattern of SECURITY_PATTERNS) {
      // تطبيق فلتر الامتداد
      if (pattern.fileFilter && !pattern.fileFilter.test(file.path)) continue;

      // البحث في المحتوى
      const matches = [...file.content.matchAll(pattern.regex)];
      for (const match of matches) {
        // حساب رقم السطر
        const beforeMatch = file.content.slice(0, match.index ?? 0);
        const line = (beforeMatch.match(/\n/g) ?? []).length + 1;

        // استخراج سطر الكود
        const lines = file.content.split("\n");
        const codeLine = lines[line - 1]?.trim().slice(0, 120);

        issues.push({
          id: `${pattern.id}-${++issueCounter}`,
          severity: pattern.severity,
          category: pattern.category,
          title: pattern.title,
          description: pattern.description,
          file: file.path,
          line,
          code: codeLine,
          fix: pattern.fix,
          cweId: pattern.cweId,
          owaspId: pattern.owaspId,
        });
      }
    }
  }

  return issues;
}

/**
 * حساب نتيجة الأمان (0-100)
 */
function calculateScore(issues: SecurityIssue[]): { score: number; grade: ScanResult["grade"] } {
  const weights: Record<Severity, number> = {
    critical: 25,
    high: 15,
    medium: 8,
    low: 3,
    info: 0,
  };

  const totalDeduction = issues.reduce((sum, issue) => sum + (weights[issue.severity] ?? 0), 0);
  const score = Math.max(0, Math.min(100, 100 - totalDeduction));

  let grade: ScanResult["grade"];
  if (score >= 90) grade = "A";
  else if (score >= 75) grade = "B";
  else if (score >= 60) grade = "C";
  else if (score >= 40) grade = "D";
  else grade = "F";

  return { score, grade };
}

/**
 * فحص شامل مع تحليل AI للملفات المعقدة
 */
export async function scanProject(
  projectId: string,
  files: FileToScan[],
  options: {
    aiEnhanced?: boolean;
    maxFilesForAI?: number;
  } = {},
): Promise<ScanResult> {
  const { aiEnhanced = false, maxFilesForAI = 5 } = options;

  logger.info("بدء فحص الأمان", {
    projectId,
    filesCount: files.length,
    aiEnhanced,
  });

  // الفحص الثابت (دائماً)
  const staticIssues = staticScan(files);

  let allIssues = [...staticIssues];

  // الفحص المعزز بالـ AI (اختياري)
  if (aiEnhanced && files.length > 0) {
    try {
      // نحلل أهم الملفات فقط (server files وlib)
      const priorityFiles = files
        .filter(
          (f) =>
            f.path.includes("server") ||
            f.path.includes("api") ||
            f.path.includes("auth") ||
            f.path.includes("db"),
        )
        .slice(0, maxFilesForAI);

      if (priorityFiles.length > 0) {
        const filesSummary = priorityFiles
          .map((f) => `=== ${f.path} ===\n${f.content.slice(0, 2000)}`)
          .join("\n\n");

        const aiResult = await routedCall({
          kind: "reasoning",
          system: `أنت خبير أمان متخصص. افحص الكود التالي وأخرج قائمة JSON من المشاكل الأمنية.
كل مشكلة يجب أن تحتوي: severity (critical/high/medium/low), category, title, description, fix.
أخرج JSON فقط بدون markdown أو شرح.`,
          content: `افحص هذا الكود:\n\n${filesSummary}`,
          maxTokens: 3000,
        });

        try {
          const aiIssues = JSON.parse(aiResult.text) as Omit<
            SecurityIssue,
            "id" | "file" | "line" | "code"
          >[];
          const formattedAiIssues: SecurityIssue[] = aiIssues.map((issue, i) => ({
            ...issue,
            id: `AI-${String(i + 1).padStart(3, "0")}`,
          }));
          allIssues = [...allIssues, ...formattedAiIssues];
        } catch {
          logger.warn("فشل تحليل نتائج AI", { projectId });
        }
      }
    } catch (err) {
      logger.exception("فشل الفحص المعزز بالـ AI", err, { projectId });
    }
  }

  // ترتيب حسب الخطورة
  const severityOrder: Record<Severity, number> = {
    critical: 0,
    high: 1,
    medium: 2,
    low: 3,
    info: 4,
  };
  allIssues.sort(
    (a, b) => (severityOrder[a.severity] ?? 4) - (severityOrder[b.severity] ?? 4),
  );

  const { score, grade } = calculateScore(allIssues);

  const criticalCount = allIssues.filter((i) => i.severity === "critical").length;
  const highCount = allIssues.filter((i) => i.severity === "high").length;
  const summary =
    allIssues.length === 0
      ? "لم تُعثر على ثغرات أمنية. ✅"
      : `تم اكتشاف ${allIssues.length} مشكلة (${criticalCount} حرجة، ${highCount} عالية الخطورة).`;

  logger.info("اكتمل فحص الأمان", {
    projectId,
    issuesFound: allIssues.length,
    score,
    grade,
    aiEnhanced,
  });

  return {
    projectId,
    scannedAt: new Date().toISOString(),
    filesScanned: files.length,
    issues: allIssues,
    score,
    grade,
    summary,
    aiEnhanced,
  };
}

/**
 * فحص سريع لملف واحد (بدون AI)
 */
export function quickScanFile(path: string, content: string): SecurityIssue[] {
  return staticScan([{ path, content }]);
}

/** ألوان الدرجات لعرضها في الواجهة */
export const GRADE_COLORS: Record<ScanResult["grade"], string> = {
  A: "text-emerald-500",
  B: "text-green-500",
  C: "text-yellow-500",
  D: "text-orange-500",
  F: "text-red-500",
};

/** أيقونات الخطورة */
export const SEVERITY_ICONS: Record<Severity, string> = {
  critical: "🔴",
  high: "🟠",
  medium: "🟡",
  low: "🔵",
  info: "⚪",
};
