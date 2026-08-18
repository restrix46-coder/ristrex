/**
 * اختبارات Feature Flags
 */
import { describe, it, expect } from "vitest";
import { isEnabled, getAllFlags, FEATURE_FLAGS } from "@/lib/feature-flags.server";

describe("Feature Flags — التقييم", () => {
  it("يُرجع false لـ flag غير موجودة", async () => {
    const result = await isEnabled("non_existent_flag");
    expect(result).toBe(false);
  });

  it("يُقيّم Boolean flag صحيح", async () => {
    // security_scanner مُعرَّف كـ boolean: true
    const result = await isEnabled("security_scanner");
    expect(result).toBe(true);
  });

  it("يُقيّم env flag مع default", async () => {
    // cost_aware_routing مُعرَّف كـ boolean: true
    const result = await isEnabled("cost_aware_routing");
    expect(result).toBe(true);
  });

  it("يُرجع false لـ flag env بدون متغيّر", async () => {
    delete process.env["FEATURE_REALTIME"];
    const result = await isEnabled("realtime_collaboration");
    expect(result).toBe(false); // default: false
  });

  it("يُرجع true لـ flag env عند تفعيل المتغيّر", async () => {
    process.env["FEATURE_PAYMENTS"] = "true";
    const result = await isEnabled("payments");
    expect(result).toBe(true);
    delete process.env["FEATURE_PAYMENTS"];
  });
});

describe("Feature Flags — getAllFlags", () => {
  it("يُرجع كل الـ flags", () => {
    const flags = getAllFlags();
    expect(Object.keys(flags).length).toBe(FEATURE_FLAGS.length);
  });

  it("كل القيم boolean", () => {
    const flags = getAllFlags();
    for (const val of Object.values(flags)) {
      expect(typeof val).toBe("boolean");
    }
  });
});

describe("Feature Flags — Percentage Rollout", () => {
  it("يُوزَّع التوزيع بشكل متسق لنفس المستخدم", async () => {
    // advanced_analytics rollout=50%
    const r1 = await isEnabled("advanced_analytics", "user-abc");
    const r2 = await isEnabled("advanced_analytics", "user-abc");
    expect(r1).toBe(r2); // نتيجة متسقة
  });
});
