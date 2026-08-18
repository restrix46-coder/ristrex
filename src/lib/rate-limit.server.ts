/**
 * rate-limit.server.ts — نظام Rate Limiting خفيف في الذاكرة.
 *
 * ✅ يحمي مسارات المصادقة من هجمات Brute Force.
 * ✅ يستخدم Sliding Window algorithm.
 * ✅ لا يعتمد على Redis — مناسب للنشر الفردي (single-node).
 *
 * ملاحظة: في بيئة متعددة الحاويات استخدم Redis بدلاً من هذا.
 */

interface RateLimitEntry {
  requests: number[];
  blocked?: boolean;
  blockedUntil?: number;
}

const store = new Map<string, RateLimitEntry>();

// تنظيف دوري للإدخالات القديمة منع تسرّب الذاكرة
let cleanupInterval: ReturnType<typeof setInterval> | undefined;
function startCleanup() {
  if (cleanupInterval) return;
  cleanupInterval = setInterval(
    () => {
      const now = Date.now();
      for (const [key, entry] of store.entries()) {
        const fresh = entry.requests.filter((t) => now - t < 60_000);
        if (fresh.length === 0 && (!entry.blockedUntil || now > entry.blockedUntil)) {
          store.delete(key);
        } else {
          store.set(key, { ...entry, requests: fresh });
        }
      }
    },
    5 * 60 * 1000,
  ); // كل 5 دقائق
}

export interface RateLimitOptions {
  /** عدد الطلبات المسموح بها */
  maxRequests: number;
  /** النافذة الزمنية بالثواني */
  windowSeconds: number;
  /** مدة الحجب بعد تجاوز الحد بالثواني (افتراضي: 0 = لا حجب إضافي) */
  blockSeconds?: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number; // Unix timestamp بالميلي ثانية
  retryAfter?: number; // ثواني حتى السماح مجدداً
}

/**
 * تحقق من أن الطلب ضمن حدود Rate Limit.
 *
 * @param key المفتاح المميّز (عادة: IP أو user ID أو `ip:route`)
 * @param options إعدادات الحد
 */
export function checkRateLimit(key: string, options: RateLimitOptions): RateLimitResult {
  startCleanup();

  const { maxRequests, windowSeconds, blockSeconds = 0 } = options;
  const windowMs = windowSeconds * 1000;
  const now = Date.now();

  let entry = store.get(key) ?? { requests: [] };

  // إذا كان المفتاح محجوباً
  if (entry.blocked && entry.blockedUntil && now < entry.blockedUntil) {
    const retryAfter = Math.ceil((entry.blockedUntil - now) / 1000);
    return {
      allowed: false,
      remaining: 0,
      resetAt: entry.blockedUntil,
      retryAfter,
    };
  }

  // تصفية الطلبات خارج النافذة الزمنية (Sliding Window)
  const windowStart = now - windowMs;
  entry = {
    ...entry,
    requests: entry.requests.filter((t) => t >= windowStart),
    blocked: false,
  };

  const count = entry.requests.length;

  if (count >= maxRequests) {
    // تجاوز الحد — هل نُطبّق حجباً مؤقتاً؟
    if (blockSeconds > 0) {
      entry.blocked = true;
      entry.blockedUntil = now + blockSeconds * 1000;
    }
    store.set(key, entry);

    const oldestRequest = entry.requests[0] ?? now;
    const resetAt = oldestRequest + windowMs;
    const retryAfter = Math.ceil((resetAt - now) / 1000);

    return {
      allowed: false,
      remaining: 0,
      resetAt,
      retryAfter: blockSeconds > 0 ? blockSeconds : Math.max(0, retryAfter),
    };
  }

  // الطلب مسموح — تسجيله
  entry.requests.push(now);
  store.set(key, entry);

  return {
    allowed: true,
    remaining: maxRequests - entry.requests.length,
    resetAt: (entry.requests[0] ?? now) + windowMs,
  };
}

/**
 * إنشاء Limiter مُخصَّص جاهز للاستخدام المتكرر.
 *
 * @example
 * const authLimiter = createLimiter({ maxRequests: 5, windowSeconds: 60, blockSeconds: 300 });
 * const result = authLimiter(clientIp);
 */
export function createLimiter(options: RateLimitOptions) {
  return (key: string): RateLimitResult => checkRateLimit(key, options);
}

/** Rate Limiter جاهز لمسار المصادقة (5 محاولات/دقيقة، حجب 5 دقائق) */
export const authRateLimiter = createLimiter({
  maxRequests: 5,
  windowSeconds: 60,
  blockSeconds: 300,
});

/** Rate Limiter عام لـ API (100 طلب/دقيقة) */
export const apiRateLimiter = createLimiter({
  maxRequests: 100,
  windowSeconds: 60,
});

/**
 * بناء رأس `Retry-After` بالثواني للاستجابة 429.
 */
export function retryAfterHeaders(result: RateLimitResult): Record<string, string> {
  return {
    "X-RateLimit-Remaining": String(result.remaining),
    "X-RateLimit-Reset": String(Math.floor(result.resetAt / 1000)),
    ...(result.retryAfter !== undefined ? { "Retry-After": String(result.retryAfter) } : {}),
  };
}
