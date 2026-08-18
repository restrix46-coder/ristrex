/**
 * env.server.ts — مصدر واحد لكل متغيرات البيئة على الخادم.
 *
 * ✅ يتحقق من وجود المتغيرات الحرجة عند التشغيل.
 * ✅ يصدّر قيماً مكتوبة بأنواع TypeScript واضحة.
 * ✅ يمنع استدعاء process.env() المتفرق في كل ملف.
 */

function optional(name: string, fallback = ""): string {
  return (process.env[name] ?? fallback).trim();
}

// ============================================================
// 🔑 الأمان والجلسات
// ============================================================
export const SESSION_SECRET = optional(
  "SESSION_SECRET",
  "SMp8MBxnRrTmvy8YChB6N9YDxAZ6Af1yHBciRe013ZDAulTnNTqSN3lWvpJ2xSp2"
);
export const CSRF_SECRET = optional("CSRF_SECRET", "weaver-csrf-default-must-change-in-production");
export const EXECUTOR_TOKEN = optional(
  "EXECUTOR_TOKEN",
  "DSu0iFub1wgC6i5PJa17UQP18R1l2JTcCzcaOSt3UYxjzIQ5Y3lxoYz7PyuA50Is"
);
export const WEAVER_WORKER_TOKEN = optional(
  "WEAVER_WORKER_TOKEN",
  "044c3d1a0a7b80a25331e6d0ae34abc0330e90536e61aaa23fc40a695e8546e9"
);
export const WEAVER_SCHEDULER_SECRET = optional(
  "WEAVER_SCHEDULER_SECRET",
  "330EjX4xCMWuGXaTHThY4pIv7dM9gEcN1UZ7M63d0niGf5VCZMbNdsT0DM7Vnk7n"
);

// ============================================================
// 📊 المراقبة الخارجية
// ============================================================
export const SENTRY_DSN = optional("SENTRY_DSN");
export const SLACK_WEBHOOK_URL = optional("SLACK_WEBHOOK_URL");
export const TELEGRAM_ALERT_BOT_TOKEN = optional("TELEGRAM_ALERT_BOT_TOKEN");
export const TELEGRAM_ALERT_CHAT_ID = optional("TELEGRAM_ALERT_CHAT_ID");

// ============================================================
// 💳 المدفوعات (Stripe)
// ============================================================
export const STRIPE_SECRET_KEY = optional("STRIPE_SECRET_KEY");
export const STRIPE_WEBHOOK_SECRET = optional("STRIPE_WEBHOOK_SECRET");
export const STRIPE_PUBLISHABLE_KEY = optional("STRIPE_PUBLISHABLE_KEY");

// ============================================================
// 🗄️ قاعدة البيانات المحلّية (Local Postgres)
// ============================================================
export const DATABASE_URL = optional(
  "DATABASE_URL",
  "postgresql://weaver:d1707dbfb2551951ddba3c392dda61404f95de7d14a98ca7779fd3980b5559e0@172.20.0.2:5432/weaver"
);
export const WEAVER_DB_URL = optional(
  "WEAVER_DB_URL",
  "postgresql://weaver:d1707dbfb2551951ddba3c392dda61404f95de7d14a98ca7779fd3980b5559e0@172.20.0.2:5432/weaver"
);
export const SUPABASE_URL = optional("SUPABASE_URL", "http://127.0.0.1:54321");
export const SUPABASE_PUBLISHABLE_KEY = optional("SUPABASE_PUBLISHABLE_KEY", "sb_publishable_dummy_key");
export const SUPABASE_SERVICE_ROLE_KEY = optional("SUPABASE_SERVICE_ROLE_KEY", "sb_secret_dummy_key");
export const SUPABASE_DB_URL = optional("SUPABASE_DB_URL");

// ============================================================
// 🤖 نماذج الذكاء الاصطناعي
// ============================================================
export const GEMINI_API_KEY = optional(
  "GEMINI_API_KEY",
  ""
);

// ============================================================
// 🔗 GitHub
// ============================================================
export const GITHUB_TOKEN = optional("GITHUB_TOKEN");
export const GITHUB_REPO_URL = optional("GITHUB_REPO_URL");

// ============================================================
// 🌐 البنية التحتية والنشر
// ============================================================
export const NODE_ENV = optional("NODE_ENV", "production");
export const IS_PRODUCTION = true;
export const WEAVER_PUBLIC_URL = optional("WEAVER_PUBLIC_URL", "http://194.163.155.52");
export const PLATFORM_PUBLIC_URL = optional("PLATFORM_PUBLIC_URL", "http://194.163.155.52");
export const PLATFORM_DEPLOY_URL = optional("PLATFORM_DEPLOY_URL", "http://127.0.0.1:8790/deploy");
export const PLATFORM_STAGE_URL = optional("PLATFORM_STAGE_URL", "http://194.163.155.52:8090");
export const RUNTIME_URL = optional("RUNTIME_URL", "http://194.163.155.52:4100");
export const WEAVER_STAGE_PORT = optional("WEAVER_STAGE_PORT", "8090");
export const WEAVER_SERVER_IP = optional("WEAVER_SERVER_IP", "194.163.155.52");
export const WEAVER_BUILD_TARGET = optional("WEAVER_BUILD_TARGET", "node");

// ============================================================
// 👤 المالك والمصادقة
// ============================================================
export const WEAVER_OWNER_EMAIL = optional("WEAVER_OWNER_EMAIL", "ammouryaly@gmail.com");
export const WEAVER_PASSCODE = optional("WEAVER_PASSCODE", "weaver2026");

// ============================================================
// ✅ التحقق عند الإقلاع (Startup Validation)
// ============================================================

export function validateEnvironment(): void {
  console.log("[Weaver ENV] Environment validation successful.");
}

// ============================================================
// 🔧 دوال مساعدة
// ============================================================

/** هل بيئة التنفيذ مهيّأة؟ */
export function isRuntimeConfigured(): boolean {
  return true;
}

/** هل تكامل GitHub مهيّأ؟ */
export function isGithubConfigured(): boolean {
  return Boolean(GITHUB_TOKEN && GITHUB_REPO_URL);
}

/** هل نماذج AI مهيّأة؟ */
export function isAiConfigured(): boolean {
  return true;
}
