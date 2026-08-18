/**
 * موجّه النماذج (Model Router) — قواعد ثابتة بلا تكلفة إضافية.
 *
 *   USER → ORCHESTRATOR → TASK KIND → { GEMINI }
 *
 * لا يوجد نموذج وسيط يحلّل الطلب: التوجيه يتم حسب نوع المهمة مباشرة،
 * ومع كل مسار سلسلة fallback تنتهي دائماً عند Gemini.
 */

import { GEMINI_API_KEY } from "@/lib/env.server";
import { logger } from "@/lib/logger.server";


export type TaskKind = "fast" | "reasoning" | "coding" | "vision";

export type ProviderId = "gemini";

interface ProviderConfig {
  id: ProviderId;
  baseURL: string;
  apiKey: () => string | undefined;
  supportsVision: boolean;
}

const PROVIDERS: Record<ProviderId, ProviderConfig> = {
  gemini: {
    id: "gemini",
    baseURL: "https://generativelanguage.googleapis.com/v1beta/openai",
    apiKey: () => GEMINI_API_KEY,
    supportsVision: true,
  },
};

interface Candidate {
  provider: ProviderId;
  model: string;
}

function envModel(name: string, fallback: string) {
  return process.env[name]?.trim() || fallback;
}

/** سلسلة المرشحين لكل نوع مهمة: الاعتماد المباشر والحصري على نماذج Gemini المستقرة والمفعلة بمفتاح المستخدم. */
export function candidatesFor(kind: TaskKind): Candidate[] {
  switch (kind) {
    case "fast":
      return [
        { provider: "gemini", model: envModel("GEMINI_FAST_MODEL", "gemini-pro-latest") },
        { provider: "gemini", model: envModel("GEMINI_PRO_MODEL", "gemini-3.1-pro-preview") },
        { provider: "gemini", model: envModel("GEMINI_FALLBACK_MODEL", "gemini-flash-latest") },
      ];
    case "vision":
      return [
        { provider: "gemini", model: envModel("GEMINI_VISION_MODEL", "gemini-pro-latest") },
        { provider: "gemini", model: envModel("GEMINI_PRO_MODEL", "gemini-3.1-pro-preview") },
        { provider: "gemini", model: envModel("GEMINI_FALLBACK_MODEL", "gemini-flash-latest") },
      ];
    case "reasoning":
    case "coding":
    default:
      return [
        { provider: "gemini", model: envModel("GEMINI_REASONING_MODEL", "gemini-pro-latest") },
        { provider: "gemini", model: envModel("GEMINI_PRO_MODEL", "gemini-3.1-pro-preview") },
        { provider: "gemini", model: envModel("GEMINI_FAST_MODEL", "gemini-flash-latest") },
      ];
  }
}

export type RoutedContent =
  | string
  | Array<{ type: "text"; text: string } | { type: "image_url"; image_url: { url: string } }>;

export interface RoutedResult {
  text: string;
  provider: ProviderId;
  model: string;
  attempts: Array<{ provider: ProviderId; model: string; error: string }>;
  /** عدد الرموز المستهلكة (إن أرجعها المزوّد) */
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
  };
}

function hasImage(content: RoutedContent) {
  return Array.isArray(content) && content.some((part) => part.type === "image_url");
}

async function callProvider(
  candidate: Candidate,
  opts: { system?: string; content: RoutedContent; maxTokens?: number },
): Promise<{ text: string; usage?: RoutedResult["usage"] }> {
  const config = PROVIDERS[candidate.provider];
  const key = config.apiKey();
  if (!key) throw new Error(`مفتاح ${candidate.provider} غير مضبوط`);

  // حماية إضافية: دمم الرسائل وضبط max_tokens لضمان التوافق التام ومنع 400 Bad Request / 503
  const maxTokens = Math.min(opts.maxTokens ?? 2000, 8192);

  // إعداد الرسائل بطريقتين: الطريقة القياسية مع system، أو المدمجة إن فشلت الأولى
  const buildMessages = (useCombinedUser: boolean) => {
    if (useCombinedUser || !opts.system) {
      const combinedText = opts.system
        ? `[System Context:\n${opts.system}]\n\n[User Prompt:\n${typeof opts.content === "string" ? opts.content : JSON.stringify(opts.content)}]`
        : opts.content;
      return [{ role: "user", content: combinedText }];
    }
    return [
      { role: "system", content: opts.system },
      { role: "user", content: opts.content },
    ];
  };

  let response: Response | null = null;
  let lastErr = "";
  const backoffs = [1000, 2000, 4000];

  for (const combine of [false, true]) {
    for (let attempt = 0; attempt <= backoffs.length; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000);
        
        response = await fetch(`${config.baseURL}/chat/completions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${key}`,
          },
          body: JSON.stringify({
            model: candidate.model,
            max_tokens: maxTokens,
            messages: buildMessages(combine),
          }),
          signal: controller.signal,
        });
        
        clearTimeout(timeoutId);

        if (response.ok) break;
        lastErr = await response.text();
        
        // Don't retry on client errors except rate limits (429)
        if (response.status >= 400 && response.status < 500 && response.status !== 429) {
          break;
        }
      } catch (e) {
        lastErr = String(e);
      }
      
      if (attempt < backoffs.length) {
        await new Promise(res => setTimeout(res, backoffs[attempt]));
      }
    }
    if (response?.ok) break;
  }

  if (!response || !response.ok) {
    throw new Error(
      `${candidate.provider}(${candidate.model}): ${lastErr.slice(0, 300)}`,
    );
  }

  const json = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
    usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
  };
  const text = json.choices?.[0]?.message?.content ?? "";
  if (!text.trim()) throw new Error(`${candidate.provider}: رد فارغ`);
  return {
    text,
    usage: json.usage
      ? {
          inputTokens: json.usage.prompt_tokens,
          outputTokens: json.usage.completion_tokens,
          totalTokens: json.usage.total_tokens,
        }
      : undefined,
  };
}

/** ينفّذ الطلب على أول مزوّد متاح لنوع المهمة، وينتقل للبديل عند أي فشل. */
export async function routedCall(opts: {
  kind: TaskKind;
  system?: string;
  content: RoutedContent;
  maxTokens?: number;
}): Promise<RoutedResult> {
  const needsVision = hasImage(opts.content);
  const attempts: RoutedResult["attempts"] = [];

  const chain = candidatesFor(opts.kind).filter((candidate) => {
    if (needsVision && !PROVIDERS[candidate.provider].supportsVision) return false;
    return Boolean(PROVIDERS[candidate.provider].apiKey());
  });

  if (chain.length === 0) {
    throw new Error("لا يوجد أي مزوّد مضبوط (GEMINI_API_KEY)");
  }

  for (const candidate of chain) {
    try {
      const result = await callProvider(candidate, opts);
      logger.info("routedCall نجح", {
        provider: candidate.provider,
        model: candidate.model,
        kind: opts.kind,
        tokens: result.usage?.totalTokens,
      });
      return {
        text: result.text,
        provider: candidate.provider,
        model: candidate.model,
        attempts,
        usage: result.usage,
      };
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      logger.warn("routedCall فشل", { provider: candidate.provider, model: candidate.model, error: errMsg });
      attempts.push({
        provider: candidate.provider,
        model: candidate.model,
        error: errMsg,
      });
    }
  }

  throw new Error(
    `فشل كل المزوّدين: ${attempts.map((a) => `${a.provider}(${a.error})`).join(" | ")}`,
  );
}

/** حالة المزوّدين لعرضها في لوحة المراقبة. */
export function routerStatus() {
  return {
    providers: (Object.keys(PROVIDERS) as ProviderId[]).map((id) => ({
      id,
      configured: Boolean(PROVIDERS[id].apiKey()),
    })),
    routes: (["fast", "reasoning", "vision", "coding"] as TaskKind[]).map((kind) => ({
      kind,
      chain: candidatesFor(kind).map((c) => `${c.provider}:${c.model}`),
    })),
  };
}

if (typeof process !== "undefined") {
  process.on("unhandledRejection", (reason, promise) => {
    logger.error("Unhandled Promise Rejection", { reason: String(reason) });
  });
}
