/**
 * Idempotency System — src/lib/idempotency.server.ts
 *
 * يضمن أن نفس العملية لا تُنفَّذ أكثر من مرة واحدة.
 *
 * الاستخدام:
 *   1. العميل يُرسل X-Idempotency-Key: uuid-v4
 *   2. الخادم يستدعي withIdempotency(key, fn)
 *   3. إن كانت النتيجة محفوظة تُعاد فوراً بدون تنفيذ fn
 *
 * حالات الاستخدام: المدفوعات، الطلبات الحرجة، إنشاء الموارد
 */

import { getSql } from "@/lib/db";
import { logger } from "@/lib/logger.server";

const CACHE_TTL_HOURS = 24;

interface IdempotencyRecord {
  key: string;
  status: "pending" | "completed" | "failed";
  response: unknown;
  createdAt: Date;
  completedAt?: Date;
}

/**
 * ينفّذ دالة بضمان Idempotency
 *
 * @param key - مفتاح فريد من العميل (UUID v4)
 * @param fn - الدالة المراد تنفيذها
 * @returns النتيجة (محفوظة أو طازجة)
 */
export async function withIdempotency<T>(
  key: string,
  fn: () => Promise<T>,
): Promise<{ result: T; fromCache: boolean }> {
  if (!key || key.length < 10) {
    throw new Error("مفتاح Idempotency غير صالح");
  }

  const sql = getSql();

  // البحث عن نتيجة محفوظة
  const existing = await sql<IdempotencyRecord[]>`
    SELECT key, status, response, created_at, completed_at
    FROM idempotency_keys
    WHERE key = ${key}
      AND created_at > NOW() - INTERVAL '${CACHE_TTL_HOURS} hours'
    LIMIT 1
  `;

  if (existing[0]) {
    const rec = existing[0];

    if (rec.status === "completed") {
      logger.info("Idempotency cache hit", { key });
      return { result: rec.response as T, fromCache: true };
    }

    if (rec.status === "pending") {
      // طلب آخر يعالج نفس المفتاح
      throw new Error(
        `العملية (${key}) قيد التنفيذ بالفعل — انتظر قبل إعادة المحاولة`,
      );
    }

    if (rec.status === "failed") {
      // أُعيد المحاولة بعد فشل سابق — امسح السجل القديم
      await sql`DELETE FROM idempotency_keys WHERE key = ${key}`;
    }
  }

  // تسجيل "pending"
  await sql`
    INSERT INTO idempotency_keys (key, status, created_at)
    VALUES (${key}, 'pending', NOW())
    ON CONFLICT (key) DO NOTHING
  `;

  try {
    const result = await fn();

    // حفظ النتيجة
    await sql`
      UPDATE idempotency_keys
      SET status = 'completed',
          response = ${JSON.stringify(result)}::jsonb,
          completed_at = NOW()
      WHERE key = ${key}
    `;

    return { result, fromCache: false };
  } catch (err) {
    // تسجيل الفشل
    await sql`
      UPDATE idempotency_keys
      SET status = 'failed'
      WHERE key = ${key}
    `;
    throw err;
  }
}

/**
 * يُنظّف السجلات المنتهية الصلاحية
 * شغّله كـ Cron Job يومي
 */
export async function cleanupExpiredKeys(): Promise<number> {
  const sql = getSql();
  const result = await sql<{ count: string }[]>`
    DELETE FROM idempotency_keys
    WHERE created_at < NOW() - INTERVAL '${CACHE_TTL_HOURS} hours'
    RETURNING 1
  `;
  const deleted = result.length;
  logger.info("Idempotency cleanup", { deleted });
  return deleted;
}

/**
 * يُرجع Middleware لاستخراج مفتاح Idempotency من request headers
 */
export function getIdempotencyKey(request: Request): string | null {
  return (
    request.headers.get("x-idempotency-key") ??
    request.headers.get("Idempotency-Key") ??
    null
  );
}
