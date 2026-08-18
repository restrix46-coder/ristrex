/**
 * اختبارات Security Scanner
 */
import { describe, it, expect } from "vitest";
import { scanProject } from "@/lib/security-scanner.server";

const makeFile = (path: string, content: string) => ({ path, content });

describe("Security Scanner — اكتشاف تسريب الأسرار", () => {
  it("يكتشف API key مكشوفاً", async () => {
    const files = [
      makeFile("config.ts", 'const API_KEY = "sk-1234567890abcdef1234567890abcdef";'),
    ];
    const result = await scanProject("proj-1", files);
    expect(result.vulnerabilities.some((v) => v.type === "exposed_secret")).toBe(true);
  });

  it("يكتشف كلمة مرور مكتوبة مباشرة", async () => {
    const files = [
      makeFile("db.ts", 'const password = "my-super-secret-password-123";'),
    ];
    const result = await scanProject("proj-1", files);
    expect(result.vulnerabilities.length).toBeGreaterThan(0);
  });

  it("لا يُبلّغ عن ملفات نظيفة", async () => {
    const files = [
      makeFile("utils.ts", 'export const add = (a: number, b: number) => a + b;'),
    ];
    const result = await scanProject("proj-1", files);
    const critical = result.vulnerabilities.filter((v) => v.severity === "critical");
    expect(critical).toHaveLength(0);
  });
});

describe("Security Scanner — اكتشاف SQL Injection", () => {
  it("يكتشف SQL Injection عبر template literal", async () => {
    const files = [
      makeFile("users.ts", 'const q = `SELECT * FROM users WHERE id = ${userId}`;'),
    ];
    const result = await scanProject("proj-1", files);
    expect(result.vulnerabilities.some((v) => v.type === "sql_injection")).toBe(true);
  });
});

describe("Security Scanner — اكتشاف XSS", () => {
  it("يكتشف dangerouslySetInnerHTML", async () => {
    const files = [
      makeFile("Component.tsx", '<div dangerouslySetInnerHTML={{ __html: userInput }} />'),
    ];
    const result = await scanProject("proj-1", files);
    expect(result.vulnerabilities.some((v) => v.type === "xss")).toBe(true);
  });
});

describe("Security Scanner — الدرجة والتقييم", () => {
  it("يُرجع score صحيح", async () => {
    const files = [makeFile("clean.ts", "export const x = 1;")];
    const result = await scanProject("proj-1", files);
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
  });

  it("يُرجع grade صحيح", async () => {
    const files = [makeFile("clean.ts", "export const x = 1;")];
    const result = await scanProject("proj-1", files);
    expect(["A", "B", "C", "D", "F"]).toContain(result.grade);
  });
});
