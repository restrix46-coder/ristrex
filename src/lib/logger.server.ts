/**
 * logger.server.ts — نظام تسجيل مركزي منظّم (Structured Logging).
 *
 * ✅ يستبدل console.log/error المتفرقة بنظام موحّد.
 * ✅ يدعم مستويات: debug, info, warn, error.
 * ✅ يُخرج JSON في الإنتاج وNST ملوّن في التطوير.
 * ✅ يُخفي القيم الحساسة (token, password, secret, key).
 */

type LogLevel = "debug" | "info" | "warn" | "error";
type LogContext = Record<string, unknown>;

const IS_PRODUCTION = process.env["NODE_ENV"] === "production";
const IS_DEBUG = process.env["LOG_LEVEL"] === "debug";

/** القيم التي يجب إخفاؤها في السجلات */
const SENSITIVE_KEYS = /\b(token|password|secret|key|passcode|auth|credential)\b/i;

function redactSensitive(obj: unknown, depth = 0): unknown {
  if (depth > 5 || obj === null || obj === undefined) return obj;
  if (typeof obj === "string") return obj;
  if (typeof obj !== "object") return obj;
  if (Array.isArray(obj)) return obj.map((v) => redactSensitive(v, depth + 1));
  const result: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    result[k] = SENSITIVE_KEYS.test(k) ? "[REDACTED]" : redactSensitive(v, depth + 1);
  }
  return result;
}

function formatDevMessage(level: LogLevel, message: string, ctx?: LogContext): string {
  const ts = new Date().toISOString().slice(11, 23); // HH:MM:SS.mmm
  const colors: Record<LogLevel, string> = {
    debug: "\x1b[90m", // رمادي
    info: "\x1b[36m",  // سماوي
    warn: "\x1b[33m",  // أصفر
    error: "\x1b[31m", // أحمر
  };
  const reset = "\x1b[0m";
  const prefix = `${colors[level]}[${level.toUpperCase()}]${reset} ${ts}`;
  const ctxStr = ctx && Object.keys(ctx).length > 0 ? ` ${JSON.stringify(redactSensitive(ctx))}` : "";
  return `${prefix} ${message}${ctxStr}`;
}

function log(level: LogLevel, message: string, ctx?: LogContext): void {
  if (level === "debug" && !IS_DEBUG) return;

  if (IS_PRODUCTION) {
    const entry = {
      level,
      ts: new Date().toISOString(),
      msg: message,
      ...(ctx ? (redactSensitive(ctx) as object) : {}),
    };
    if (level === "error" || level === "warn") {
      process.stderr.write(JSON.stringify(entry) + "\n");
    } else {
      process.stdout.write(JSON.stringify(entry) + "\n");
    }
  } else {
    const formatted = formatDevMessage(level, message, ctx);
    if (level === "error") {
      console.error(formatted);
    } else if (level === "warn") {
      console.warn(formatted);
    } else {
      console.log(formatted);
    }
  }
}

export const logger = {
  debug: (message: string, ctx?: LogContext) => log("debug", message, ctx),
  info: (message: string, ctx?: LogContext) => log("info", message, ctx),
  warn: (message: string, ctx?: LogContext) => log("warn", message, ctx),
  error: (message: string, ctx?: LogContext) => log("error", message, ctx),

  /**
   * تسجيل خطأ مع Stack Trace كاملاً.
   * استخدم هذا بدلاً من catch {} الفارغة.
   */
  exception: (message: string, error: unknown, ctx?: LogContext) => {
    const errCtx: LogContext = {
      ...ctx,
      errorMessage: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack?.split("\n").slice(0, 6).join("\n") : undefined,
    };
    log("error", message, errCtx);
  },
};

export type Logger = typeof logger;
