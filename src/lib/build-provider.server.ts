import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { GEMINI_API_KEY } from "@/lib/env.server";

export type BuildProviderId = "gemini";

export function buildProviderStatus() {
  return {
    keys: {
      gemini: Boolean(process.env["GEMINI_API_KEY"] || GEMINI_API_KEY),
    },
  };
}

export interface BuildModel {
  provider: BuildProviderId;
  modelId: string;
  model: ReturnType<ReturnType<typeof createGoogleGenerativeAI>>;
}

/** تطبيع أسماء النماذج للنماذج الموثوقة */
function pickModel(preferred: string | null): string {
  if (!preferred || preferred === "auto") return "gemini-flash-latest";
  if (preferred.includes("1.5-flash") || preferred.includes("2.0-flash") || preferred.includes("3.6")) return "gemini-flash-latest";
  if (preferred.includes("1.5-pro") || preferred.includes("2.0-pro") || preferred === "gemini-pro") return "gemini-pro-latest";
  if (preferred.includes("2.5-flash")) return "gemini-flash-latest";
  return preferred;
}

export function resolveBuildModel(_preferredModel: string | null, _origin?: string): BuildModel {
  const geminiKey = process.env["GEMINI_API_KEY"] || GEMINI_API_KEY;

  if (!geminiKey) {
    throw new Error("مفتاح GEMINI_API_KEY غير مضبوط!");
  }

  // @ai-sdk/google الأصلي — يدعم tools بشكل كامل مع Gemini
  // OpenAI-compat كان يعيد empty content ويسبب "model output must contain output text or tool calls"
  const provider = createGoogleGenerativeAI({
    apiKey: geminiKey,
  });

  const finalModelId = pickModel(_preferredModel);

  return { provider: "gemini", modelId: finalModelId, model: provider(finalModelId) };
}

