/**
 * ملف الإعداد المشترك لجميع الاختبارات
 */
import { vi } from "vitest";

// محاكاة متغيّرات البيئة للاختبارات
process.env["NODE_ENV"] = "test";
process.env["DATABASE_URL"] = "postgresql://test:test@localhost:5432/test_db";
process.env["SESSION_SECRET"] = "test-session-secret-32-chars-min-length";
process.env["CSRF_SECRET"] = "test-csrf-secret-32-chars-minimum";
process.env["GEMINI_API_KEY"] = "test-gemini-key";

// إخماد console.error في الاختبارات (يظهر في التقارير فقط)
vi.spyOn(console, "error").mockImplementation(() => {});
