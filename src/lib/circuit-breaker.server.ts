/**
 * Circuit Breaker Pattern — src/lib/circuit-breaker.server.ts
 *
 * يحمي استدعاءات الخدمات الخارجية من الفشل المتكرر.
 *
 * الحالات:
 *   CLOSED   → يعمل طبيعياً
 *   OPEN     → يرفض الطلبات فوراً بعد تجاوز حد الأخطاء
 *   HALF_OPEN → يسمح بطلب واحد للاختبار
 *
 * الاستخدام:
 *   const breaker = new CircuitBreaker("gemini", { failureThreshold: 5 });
 *   const result = await breaker.execute(() => callGemini(...));
 */

import { logger } from "@/lib/logger.server";

type State = "CLOSED" | "OPEN" | "HALF_OPEN";

interface CircuitBreakerOptions {
  /** عدد الأخطاء المتتالية قبل الفتح */
  failureThreshold: number;
  /** مدة انتظار قبل المحاولة مرة أخرى (ms) */
  recoveryTimeout: number;
  /** عدد النجاحات المطلوبة للإغلاق من HALF_OPEN */
  successThreshold: number;
}

interface BreakerStats {
  state: State;
  failures: number;
  successes: number;
  lastFailureAt: number | null;
  totalRequests: number;
  totalFailures: number;
}

const DEFAULT_OPTIONS: CircuitBreakerOptions = {
  failureThreshold: 5,
  recoveryTimeout: 60_000,
  successThreshold: 2,
};

// خريطة عالمية للـ breakers — مشترك بين الطلبات
const registry = new Map<string, CircuitBreaker>();

export class CircuitBreaker {
  private state: State = "CLOSED";
  private failures = 0;
  private successes = 0;
  private lastFailureAt: number | null = null;
  private totalRequests = 0;
  private totalFailures = 0;
  private readonly opts: CircuitBreakerOptions;

  constructor(
    public readonly name: string,
    opts: Partial<CircuitBreakerOptions> = {},
  ) {
    this.opts = { ...DEFAULT_OPTIONS, ...opts };
    registry.set(name, this);
  }

  /** ينفّذ الدالة عبر الـ circuit breaker */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    this.totalRequests++;

    if (this.state === "OPEN") {
      if (this.shouldAttemptReset()) {
        this.state = "HALF_OPEN";
        logger.info("Circuit breaker HALF_OPEN", { name: this.name });
      } else {
        throw new CircuitOpenError(this.name, this.opts.recoveryTimeout);
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (err) {
      this.onFailure(err);
      throw err;
    }
  }

  private onSuccess(): void {
    this.failures = 0;
    if (this.state === "HALF_OPEN") {
      this.successes++;
      if (this.successes >= this.opts.successThreshold) {
        this.successes = 0;
        this.state = "CLOSED";
        logger.info("Circuit breaker CLOSED (recovered)", { name: this.name });
      }
    }
  }

  private onFailure(err: unknown): void {
    this.failures++;
    this.totalFailures++;
    this.lastFailureAt = Date.now();
    this.successes = 0;
    logger.warn("Circuit breaker failure", {
      name: this.name,
      failures: this.failures,
      threshold: this.opts.failureThreshold,
      error: err instanceof Error ? err.message : String(err),
    });

    if (
      this.state === "HALF_OPEN" ||
      this.failures >= this.opts.failureThreshold
    ) {
      this.state = "OPEN";
      logger.error("Circuit breaker OPEN", {
        name: this.name,
        failures: this.failures,
      });
    }
  }

  private shouldAttemptReset(): boolean {
    return (
      this.lastFailureAt !== null &&
      Date.now() - this.lastFailureAt >= this.opts.recoveryTimeout
    );
  }

  getStats(): BreakerStats {
    return {
      state: this.state,
      failures: this.failures,
      successes: this.successes,
      lastFailureAt: this.lastFailureAt,
      totalRequests: this.totalRequests,
      totalFailures: this.totalFailures,
    };
  }

  reset(): void {
    this.state = "CLOSED";
    this.failures = 0;
    this.successes = 0;
  }
}

export class CircuitOpenError extends Error {
  constructor(name: string, recoveryMs: number) {
    super(
      `Circuit breaker "${name}" مفتوح — سيُعاد المحاولة بعد ${recoveryMs / 1000}ث`,
    );
    this.name = "CircuitOpenError";
  }
}

/** يُرجع إحصائيات كل الـ circuit breakers */
export function getAllBreakerStats(): Record<string, BreakerStats> {
  const result: Record<string, BreakerStats> = {};
  for (const [name, breaker] of registry.entries()) {
    result[name] = breaker.getStats();
  }
  return result;
}

/** Breakers جاهزة للخدمات الرئيسية */
export const geminiBreaker = new CircuitBreaker("gemini", {
  failureThreshold: 3,
  recoveryTimeout: 30_000,
});
export const dbBreaker = new CircuitBreaker("database", {
  failureThreshold: 3,
  recoveryTimeout: 15_000,
});
