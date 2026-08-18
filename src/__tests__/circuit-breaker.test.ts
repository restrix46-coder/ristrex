/**
 * اختبارات Circuit Breaker
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { CircuitBreaker, CircuitOpenError } from "@/lib/circuit-breaker.server";

describe("CircuitBreaker — الحالة العادية (CLOSED)", () => {
  it("يُنفّذ الدالة ويُرجع النتيجة", async () => {
    const breaker = new CircuitBreaker("test-closed", { failureThreshold: 3 });
    const result = await breaker.execute(async () => "نجح");
    expect(result).toBe("نجح");
  });

  it("يُعيد تشغيل الأخطاء", async () => {
    const breaker = new CircuitBreaker("test-rethrow", { failureThreshold: 5 });
    await expect(
      breaker.execute(async () => { throw new Error("فشل خارجي"); })
    ).rejects.toThrow("فشل خارجي");
  });
});

describe("CircuitBreaker — الفتح (OPEN)", () => {
  it("يفتح بعد تجاوز حد الأخطاء", async () => {
    const breaker = new CircuitBreaker("test-open", { failureThreshold: 2, recoveryTimeout: 60_000 });
    const fail = async () => { throw new Error("x"); };
    await expect(breaker.execute(fail)).rejects.toThrow();
    await expect(breaker.execute(fail)).rejects.toThrow();
    // الآن OPEN
    await expect(breaker.execute(fail)).rejects.toThrow(CircuitOpenError);
  });

  it("يرفض الطلبات فوراً في حالة OPEN", async () => {
    const breaker = new CircuitBreaker("test-fast-fail", { failureThreshold: 1, recoveryTimeout: 60_000 });
    await expect(breaker.execute(async () => { throw new Error(); })).rejects.toThrow();
    const slowFn = vi.fn(async () => "slow");
    await expect(breaker.execute(slowFn)).rejects.toThrow(CircuitOpenError);
    expect(slowFn).not.toHaveBeenCalled(); // لم يُستدعَ أصلاً
  });
});

describe("CircuitBreaker — الإغلاق (HALF_OPEN)", () => {
  it("يُغلق بعد النجاح في HALF_OPEN", async () => {
    const breaker = new CircuitBreaker("test-half", {
      failureThreshold: 1,
      recoveryTimeout: 0, // فوري
      successThreshold: 1,
    });
    await expect(breaker.execute(async () => { throw new Error(); })).rejects.toThrow();
    // الآن يجب أن يسمح بمحاولة (recoveryTimeout=0)
    const result = await breaker.execute(async () => "recovered");
    expect(result).toBe("recovered");
    expect(breaker.getStats().state).toBe("CLOSED");
  });
});

describe("CircuitBreaker — الإحصائيات", () => {
  it("يتتبع الطلبات والأخطاء", async () => {
    const breaker = new CircuitBreaker("test-stats", { failureThreshold: 10 });
    await breaker.execute(async () => "ok");
    await expect(breaker.execute(async () => { throw new Error(); })).rejects.toThrow();
    const stats = breaker.getStats();
    expect(stats.totalRequests).toBe(2);
    expect(stats.totalFailures).toBe(1);
  });
});
