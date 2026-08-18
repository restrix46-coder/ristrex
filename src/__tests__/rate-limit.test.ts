/**
 * اختبارات Rate Limiting
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { RateLimiter, createRateLimiter } from "@/lib/rate-limit.server";

describe("RateLimiter", () => {
  let limiter: RateLimiter;

  beforeEach(() => {
    limiter = createRateLimiter({ windowMs: 1000, max: 3, keyPrefix: "test" });
  });

  it("يسمح بالطلبات ضمن الحد", async () => {
    const result1 = await limiter.check("user-1");
    expect(result1.allowed).toBe(true);
    expect(result1.remaining).toBe(2);

    const result2 = await limiter.check("user-1");
    expect(result2.allowed).toBe(true);
    expect(result2.remaining).toBe(1);
  });

  it("يرفض الطلبات عند تجاوز الحد", async () => {
    await limiter.check("user-2");
    await limiter.check("user-2");
    await limiter.check("user-2");
    const result = await limiter.check("user-2");
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it("يعزل المستخدمين عن بعضهم", async () => {
    for (let i = 0; i < 3; i++) await limiter.check("user-a");
    const blocked = await limiter.check("user-a");
    const allowed = await limiter.check("user-b");
    expect(blocked.allowed).toBe(false);
    expect(allowed.allowed).toBe(true);
  });

  it("يُرجع resetAt صحيحاً", async () => {
    const result = await limiter.check("user-3");
    expect(result.resetAt).toBeInstanceOf(Date);
    expect(result.resetAt.getTime()).toBeGreaterThan(Date.now());
  });
});
