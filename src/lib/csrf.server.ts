/**
 * CSRF Protection Middleware — src/lib/csrf.server.ts
 *
 * يُولّد رمز CSRF مشفّر ويتحقق منه في كل طلب POST/PUT/DELETE/PATCH.
 * يستخدم HMAC-SHA256 مع سرّ ثابت + طابع زمني للحماية من إعادة الاستخدام.
 *
 * الاستخدام:
 *   - في الـ GET handler: أرسل csrfToken() للعميل
 *   - في أي handler POST/mutation: استدعِ verifyCsrf(request) أولاً
 */

import { createHmac, randomBytes, timingSafeEqual } from "crypto";
import { CSRF_SECRET } from "@/lib/env.server";
import { logger } from "@/lib/logger.server";

const TOKEN_TTL_MS = 4 * 60 * 60 * 1000; // 4 ساعات
const HMAC_ALGO = "sha256";

/** يُنشئ رمز CSRF مُوقَّعاً صالحاً لـ TTL_MS */
export function generateCsrfToken(): string {
  const nonce = randomBytes(16).toString("hex");
  const timestamp = Date.now().toString();
  const payload = `${nonce}.${timestamp}`;
  const sig = hmacSign(payload);
  return Buffer.from(`${payload}.${sig}`).toString("base64url");
}

/** يتحقق من رمز CSRF المرسل في header أو body */
export function verifyCsrfToken(token: string | null | undefined): boolean {
  if (!token) return false;
  try {
    const raw = Buffer.from(token, "base64url").toString("utf8");
    const parts = raw.split(".");
    if (parts.length !== 3) return false;
    const [nonce, timestamp, sig] = parts;
    const payload = `${nonce}.${timestamp}`;

    // التحقق من التوقيع بطريقة آمنة من الـ timing attacks
    const expectedSig = hmacSign(payload);
    const sigBuffer = Buffer.from(sig ?? "", "hex");
    const expBuffer = Buffer.from(expectedSig, "hex");
    if (sigBuffer.length !== expBuffer.length) return false;
    if (!timingSafeEqual(sigBuffer, expBuffer)) return false;

    // التحقق من الصلاحية الزمنية
    const ts = parseInt(timestamp ?? "0", 10);
    if (Date.now() - ts > TOKEN_TTL_MS) return false;

    return true;
  } catch (err) {
    logger.warn("CSRF verification error", { err });
    return false;
  }
}

/**
 * Middleware لـ TanStack Start — يرفض الطلبات بدون CSRF token صالح.
 * استخدمه في أي Server Function تُغيّر البيانات.
 */
export function requireCsrf(request: Request): void {
  const method = request.method.toUpperCase();
  // GET/HEAD/OPTIONS لا تحتاج CSRF
  if (["GET", "HEAD", "OPTIONS"].includes(method)) return;

  const token =
    request.headers.get("x-csrf-token") ??
    request.headers.get("X-CSRF-Token");

  if (!verifyCsrfToken(token)) {
    logger.warn("CSRF validation failed", {
      method,
      path: new URL(request.url).pathname,
      hasToken: Boolean(token),
    });
    throw new Response("CSRF token مفقود أو منتهي الصلاحية", { status: 403 });
  }
}

function hmacSign(payload: string): string {
  return createHmac(HMAC_ALGO, CSRF_SECRET ?? "weaver-csrf-fallback-secret")
    .update(payload)
    .digest("hex");
}
