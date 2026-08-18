/**
 * اختبارات CSRF Protection
 */
import { describe, it, expect, beforeEach } from "vitest";
import { generateCsrfToken, verifyCsrfToken, requireCsrf } from "@/lib/csrf.server";

describe("CSRF Token Generation", () => {
  it("يُنشئ رمزاً غير فارغ", () => {
    const token = generateCsrfToken();
    expect(token).toBeTruthy();
    expect(typeof token).toBe("string");
    expect(token.length).toBeGreaterThan(20);
  });

  it("ينشئ رموزاً مختلفة في كل مرة", () => {
    const t1 = generateCsrfToken();
    const t2 = generateCsrfToken();
    expect(t1).not.toBe(t2);
  });
});

describe("CSRF Token Verification", () => {
  it("يتحقق من رمز صالح", () => {
    const token = generateCsrfToken();
    expect(verifyCsrfToken(token)).toBe(true);
  });

  it("يرفض null", () => {
    expect(verifyCsrfToken(null)).toBe(false);
  });

  it("يرفض undefined", () => {
    expect(verifyCsrfToken(undefined)).toBe(false);
  });

  it("يرفض رمزاً مزوّراً", () => {
    expect(verifyCsrfToken("invalid-token")).toBe(false);
  });

  it("يرفض رمزاً مُعدَّلاً", () => {
    const token = generateCsrfToken();
    const tampered = token.slice(0, -5) + "XXXXX";
    expect(verifyCsrfToken(tampered)).toBe(false);
  });

  it("يرفض رمزاً بتوقيع خاطئ", () => {
    const token = generateCsrfToken();
    const decoded = Buffer.from(token, "base64url").toString("utf8");
    const parts = decoded.split(".");
    parts[2] = "a".repeat(64); // توقيع خاطئ
    const fakeToken = Buffer.from(parts.join(".")).toString("base64url");
    expect(verifyCsrfToken(fakeToken)).toBe(false);
  });
});

describe("requireCsrf middleware", () => {
  it("يتجاوز GET requests", () => {
    const req = new Request("http://localhost/api/test", { method: "GET" });
    expect(() => requireCsrf(req)).not.toThrow();
  });

  it("يرفض POST بدون token", () => {
    const req = new Request("http://localhost/api/test", { method: "POST" });
    expect(() => requireCsrf(req)).toThrow();
  });

  it("يقبل POST مع token صالح", () => {
    const token = generateCsrfToken();
    const req = new Request("http://localhost/api/test", {
      method: "POST",
      headers: { "x-csrf-token": token },
    });
    expect(() => requireCsrf(req)).not.toThrow();
  });

  it("يرفض POST مع token منتهي الصلاحية", () => {
    const req = new Request("http://localhost/api/test", {
      method: "POST",
      headers: { "x-csrf-token": "expired.token.here" },
    });
    expect(() => requireCsrf(req)).toThrow();
  });
});
