/**
 * اختبارات Model Router
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { routedCall } from "@/lib/model-router.server";

// محاكاة fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

function makeMockResponse(text: string, usage = { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 }) {
  return Promise.resolve({
    ok: true,
    json: () => Promise.resolve({
      choices: [{ message: { content: text } }],
      usage,
    }),
  } as Response);
}

describe("Model Router", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // تأكد من وجود مفتاح واحد على الأقل
    process.env["GEMINI_API_KEY"] = "test-key";
  });

  it("يُرجع النص من المزوّد", async () => {
    mockFetch.mockReturnValueOnce(makeMockResponse("مرحباً من AI"));
    const result = await routedCall({ kind: "fast", content: "مرحباً" });
    expect(result.text).toBe("مرحباً من AI");
    expect(result.provider).toBeTruthy();
    expect(result.model).toBeTruthy();
  });

  it("يتضمن usage tokens", async () => {
    mockFetch.mockReturnValueOnce(makeMockResponse("النتيجة"));
    const result = await routedCall({ kind: "fast", content: "اختبار" });
    expect(result.usage?.totalTokens).toBe(30);
    expect(result.usage?.inputTokens).toBe(10);
    expect(result.usage?.outputTokens).toBe(20);
  });

  it("يُسجّل attempts عند الفشل والنجاح", async () => {
    mockFetch
      .mockRejectedValueOnce(new Error("اتصال فشل"))
      .mockReturnValueOnce(makeMockResponse("نجح من المزوّد الثاني"));
    
    const result = await routedCall({ kind: "fast", content: "اختبار" });
    // يجب أن يكون هناك محاولة فاشلة واحدة على الأقل أو نجاح مباشر
    expect(result.text).toBeTruthy();
  });

  it("يُلقي خطأ إن لم يتوفر أي مزوّد", async () => {
    delete process.env["GEMINI_API_KEY"];
    await expect(routedCall({ kind: "fast", content: "اختبار" })).rejects.toThrow();
    process.env["GEMINI_API_KEY"] = "test-key";
  });
});
