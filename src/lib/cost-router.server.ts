/**
 * Cost-aware Model Router — src/lib/cost-router.server.ts
 *
 * يختار النموذج بناءً على:
 * 1. متطلبات المهمة (جودة، سرعة، دعم vision)
 * 2. التكلفة (tokens * سعر النموذج)
 * 3. الـ Circuit Breaker (يتجنب المزوّدين المتعطّلين)
 * 4. Budget المشروع (يمنع التجاوز)
 *
 * مستوى التعقيد: simple → standard → complex → vision
 */

import { routedCall, type TaskKind, type RoutedResult } from "@/lib/model-router.server";
import { geminiBreaker } from "@/lib/circuit-breaker.server";
import { recordMetric } from "@/lib/monitoring.server";
import { logger } from "@/lib/logger.server";

// ─── تكاليف النماذج (USD لكل 1M token) ──────────────────────────────────

const MODEL_COSTS: Record<string, { input: number; output: number }> = {
  // Gemini
  "gemini-flash-latest": { input: 0.075, output: 0.30 },
  "gemini-pro-latest": { input: 1.25, output: 5.0 },
  "gemini-3.1-pro-preview": { input: 1.25, output: 5.0 },
};

// ─── استراتيجيات التوجيه ─────────────────────────────────────────────────

export type RoutingStrategy =
  | "cost_optimized"   // أرخص نموذج يُحقق المتطلبات
  | "quality_first"    // أفضل جودة ضمن الميزانية
  | "balanced"         // توازن بين الجودة والتكلفة
  | "speed_first";     // أسرع استجابة

export interface CostAwareCallOptions {
  kind: TaskKind;
  system?: string;
  content: string;
  maxTokens?: number;
  strategy?: RoutingStrategy;
  /** الحد الأقصى للتكلفة بالدولار لهذا الطلب */
  maxCostUsd?: number;
  model?: string;
}

export interface CostAwareResult extends RoutedResult {
  estimatedCostUsd: number;
  strategy: RoutingStrategy;
}

/**
 * يُنفّذ استدعاء AI مع اختيار ذكي للنموذج بناءً على التكلفة
 */
export async function costAwareCall(opts: CostAwareCallOptions): Promise<CostAwareResult> {
  const strategy = opts.strategy ?? "balanced";
  const start = Date.now();

  // اختيار النموذج بناءً على الاستراتيجية
  const selectedModel = selectModel(opts.kind, strategy, opts.maxCostUsd);

  logger.info("Cost-aware routing", {
    kind: opts.kind,
    strategy,
    selectedModel,
    maxCostUsd: opts.maxCostUsd,
  });

  // تنفيذ الطلب مع Circuit Breaker
  const result = await executeWithBreaker(
    selectedModel.provider,
    () => routedCall({
      kind: opts.kind,
      system: opts.system,
      content: opts.content,
      maxTokens: opts.maxTokens,
    }),
  );

  const latencyMs = Date.now() - start;
  const estimatedCostUsd = estimateCost(
    selectedModel.model,
    result.usage?.inputTokens ?? 0,
    result.usage?.outputTokens ?? 0,
  );

  // تسجيل الـ metrics
  recordMetric("ai.latency", latencyMs, "ms", { model: selectedModel.model, kind: opts.kind });
  recordMetric("ai.cost", estimatedCostUsd * 1000, "count", { model: selectedModel.model });
  recordMetric("ai.tokens", result.usage?.totalTokens ?? 0, "count", { model: selectedModel.model });

  logger.info("Cost-aware call completed", {
    model: result.model,
    latencyMs,
    estimatedCostUsd,
    tokens: result.usage?.totalTokens,
  });

  return {
    ...result,
    estimatedCostUsd,
    strategy,
  };
}

// ─── اختيار النموذج ──────────────────────────────────────────────────────

function selectModel(
  kind: TaskKind,
  strategy: RoutingStrategy,
  maxCostUsd?: number,
): { provider: string; model: string } {
  const candidates = getCandidatesForKind(kind);

  if (strategy === "cost_optimized") {
    return candidates.sort((a, b) =>
      getCostScore(a.model) - getCostScore(b.model)
    )[0] ?? candidates[0]!;
  }

  if (strategy === "speed_first") {
    return candidates.sort((a, b) =>
      getSpeedScore(a.model) - getSpeedScore(b.model)
    )[0] ?? candidates[0]!;
  }

  if (strategy === "quality_first") {
    return candidates.sort((a, b) =>
      getQualityScore(b.model) - getQualityScore(a.model)
    )[0] ?? candidates[0]!;
  }

  // balanced: توازن بين الجودة والتكلفة
  return candidates.sort((a, b) => {
    const scoreA = getQualityScore(a.model) - getCostScore(a.model) * 0.5;
    const scoreB = getQualityScore(b.model) - getCostScore(b.model) * 0.5;
    return scoreB - scoreA;
  })[0] ?? candidates[0]!;
}

function getCandidatesForKind(kind: TaskKind) {
  const map: Record<TaskKind, Array<{ provider: string; model: string }>> = {
    fast: [
      { provider: "gemini", model: "gemini-flash-latest" },
    ],
    reasoning: [
      { provider: "gemini", model: "gemini-3.1-pro-preview" },
      { provider: "gemini", model: "gemini-pro-latest" },
    ],
    coding: [
      { provider: "gemini", model: "gemini-3.1-pro-preview" },
      { provider: "gemini", model: "gemini-pro-latest" },
    ],
    vision: [
      { provider: "gemini", model: "gemini-pro-latest" },
      { provider: "gemini", model: "gemini-flash-latest" },
    ],
  };
  return map[kind];
}

// ─── درجات النماذج ───────────────────────────────────────────────────────

const QUALITY_SCORES: Record<string, number> = {
  "gemini-3.1-pro-preview": 95,
  "gemini-pro-latest": 93,
  "gemini-flash-latest": 70,
};

const COST_SCORES: Record<string, number> = {
  "gemini-flash-latest": 2,
  "gemini-pro-latest": 8,
  "gemini-3.1-pro-preview": 9,
};

const SPEED_SCORES: Record<string, number> = {
  "gemini-flash-latest": 4,
  "gemini-pro-latest": 7,
  "gemini-3.1-pro-preview": 8,
};

function getQualityScore(model: string): number {
  return QUALITY_SCORES[model] ?? 50;
}
function getCostScore(model: string): number {
  return COST_SCORES[model] ?? 5;
}
function getSpeedScore(model: string): number {
  return SPEED_SCORES[model] ?? 5;
}

// ─── تقدير التكلفة ────────────────────────────────────────────────────────

export function estimateCost(model: string, inputTokens: number, outputTokens: number): number {
  const prices = MODEL_COSTS[model];
  if (!prices) return 0;
  return (inputTokens * prices.input + outputTokens * prices.output) / 1_000_000;
}

// ─── Circuit Breaker wrapper ──────────────────────────────────────────────

async function executeWithBreaker<T>(provider: string, fn: () => Promise<T>): Promise<T> {
  const breakerMap: Record<string, { execute: (fn: () => Promise<T>) => Promise<T> }> = {
    gemini: geminiBreaker as unknown as { execute: (fn: () => Promise<T>) => Promise<T> },
  };

  const breaker = breakerMap[provider];
  if (breaker) {
    return breaker.execute(fn);
  }
  return fn();
}
