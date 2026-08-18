import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
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
  model: ReturnType<ReturnType<typeof createOpenAICompatible>>;
}

export function resolveBuildModel(_preferredModel: string | null, _origin?: string): BuildModel {
  const geminiKey = process.env["GEMINI_API_KEY"] || GEMINI_API_KEY;

  if (!geminiKey) {
    throw new Error("مفتاح GEMINI_API_KEY غير مضبوط!");
  }

  const customFetch = async (url: string, init?: RequestInit) => {
    let retries = 3;
    let delay = 2000;
    while (true) {
      const response = await fetch(url, init);
      if (response.status === 503 && retries > 0) {
        retries--;
        await new Promise(resolve => setTimeout(resolve, delay));
        delay += 1500;
        continue;
      }
      return response;
    }
  };

  const provider = createOpenAICompatible({
    name: "gemini",
    baseURL: "https://generativelanguage.googleapis.com/v1beta/openai",
    apiKey: geminiKey,
    fetch: customFetch,
  });
  
  const modelId = _preferredModel ?? "gemini-pro-latest";
  
  let finalModelId = modelId;
  if (modelId.includes("1.5-flash") || modelId.includes("2.0-flash")) {
    finalModelId = "gemini-flash-latest";
  } else if (modelId.includes("1.5-pro") || modelId.includes("2.0-pro") || modelId === "gemini-pro") {
    finalModelId = "gemini-pro-latest";
  }

  return { provider: "gemini", modelId: finalModelId, model: provider(finalModelId) };
}
