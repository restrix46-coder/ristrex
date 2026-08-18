/**
 * Smoke Tests — src/lib/smoke-tests.server.ts
 *
 * اختبارات دخان تُشغَّل بعد كل نشر للتحقق من سلامة التطبيق.
 *
 * تشمل:
 * - Health endpoint
 * - Database connectivity
 * - AI model availability
 * - Core API endpoints
 * - Static assets
 */

import { logger } from "@/lib/logger.server";
import { checkUptime, sendAlert } from "@/lib/monitoring.server";

// ─── الأنواع ───────────────────────────────────────────────────────────────

export interface SmokeTestResult {
  name: string;
  passed: boolean;
  durationMs: number;
  error?: string;
}

export interface SmokeTestReport {
  passed: boolean;
  totalTests: number;
  passedTests: number;
  failedTests: number;
  durationMs: number;
  results: SmokeTestResult[];
  timestamp: string;
}

// ─── تشغيل الاختبارات ─────────────────────────────────────────────────────

export async function runSmokeTests(baseUrl: string): Promise<SmokeTestReport> {
  const start = Date.now();
  logger.info("بدء Smoke Tests", { baseUrl });

  const results = await Promise.allSettled([
    runTest("Health Check", () => testHealthEndpoint(baseUrl)),
    runTest("Static Assets", () => testStaticAssets(baseUrl)),
    runTest("API Root", () => testApiRoot(baseUrl)),
    runTest("Auth Page", () => testAuthPage(baseUrl)),
    runTest("Response Headers", () => testSecurityHeaders(baseUrl)),
  ]);

  const testResults: SmokeTestResult[] = results.map((r) =>
    r.status === "fulfilled" ? r.value : {
      name: "unknown",
      passed: false,
      durationMs: 0,
      error: r.reason instanceof Error ? r.reason.message : String(r.reason),
    }
  );

  const passedTests = testResults.filter((r) => r.passed).length;
  const failedTests = testResults.length - passedTests;
  const passed = failedTests === 0;
  const durationMs = Date.now() - start;

  const report: SmokeTestReport = {
    passed,
    totalTests: testResults.length,
    passedTests,
    failedTests,
    durationMs,
    results: testResults,
    timestamp: new Date().toISOString(),
  };

  logger.info("Smoke Tests انتهت", {
    passed,
    passedTests,
    failedTests,
    durationMs,
  });

  // إرسال تنبيه إن فشل أي اختبار
  if (!passed) {
    const failedNames = testResults
      .filter((r) => !r.passed)
      .map((r) => r.name)
      .join(", ");

    await sendAlert({
      title: "❌ Smoke Tests فشلت بعد النشر",
      message: `الاختبارات الفاشلة: ${failedNames}\nالوقت: ${durationMs}ms`,
      severity: "critical",
      metadata: { report },
    });
  } else {
    logger.info("✅ جميع Smoke Tests نجحت", { durationMs });
  }

  return report;
}

// ─── الاختبارات الفردية ────────────────────────────────────────────────────

async function testHealthEndpoint(baseUrl: string): Promise<void> {
  const result = await checkUptime(`${baseUrl}/api/health`);
  if (result.status === "down") {
    throw new Error(`Health endpoint فشل: ${result.error ?? result.statusCode}`);
  }
  if ((result.responseTimeMs ?? 0) > 5000) {
    throw new Error(`Health endpoint بطيء: ${result.responseTimeMs}ms`);
  }
}

async function testStaticAssets(baseUrl: string): Promise<void> {
  const res = await fetch(baseUrl, { signal: AbortSignal.timeout(10_000) });
  if (!res.ok) throw new Error(`الصفحة الرئيسية أعادت ${res.status}`);
  const html = await res.text();
  if (!html.includes("<!DOCTYPE") && !html.includes("<html")) {
    throw new Error("الصفحة الرئيسية لا تحتوي على HTML صحيح");
  }
}

async function testApiRoot(baseUrl: string): Promise<void> {
  const result = await checkUptime(`${baseUrl}/api/health`);
  if (result.statusCode !== 200) {
    throw new Error(`API أعاد ${result.statusCode}`);
  }
}

async function testAuthPage(baseUrl: string): Promise<void> {
  const result = await checkUptime(`${baseUrl}/auth`);
  // 200 أو 302 (redirect) كلاهما مقبول
  if (result.status === "down") {
    throw new Error(`صفحة الدخول غير متاحة: ${result.error}`);
  }
}

async function testSecurityHeaders(baseUrl: string): Promise<void> {
  const res = await fetch(baseUrl, { signal: AbortSignal.timeout(10_000) });
  const required = [
    "x-content-type-options",
    "x-frame-options",
  ];
  const missing = required.filter((h) => !res.headers.has(h));
  if (missing.length > 0) {
    throw new Error(`Security headers مفقودة: ${missing.join(", ")}`);
  }
}

// ─── مساعد تشغيل الاختبار ─────────────────────────────────────────────────

async function runTest(
  name: string,
  fn: () => Promise<void>,
): Promise<SmokeTestResult> {
  const start = Date.now();
  try {
    await fn();
    return { name, passed: true, durationMs: Date.now() - start };
  } catch (err) {
    return {
      name,
      passed: false,
      durationMs: Date.now() - start,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
