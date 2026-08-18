/**
 * Model Evaluation — src/lib/model-evaluation.server.ts
 *
 * قياس Quality/Cost/Latency/Reliability لكل Model،
 * وتتبع الأداء عبر الزمن.
 */

import { logger } from "@/lib/logger.server";

// ─── الأنواع ────────────────────────────────────────────────────────────────

export interface ModelBenchmark {
  modelId: string;
  taskType: "coding" | "reasoning" | "writing" | "fast" | "vision";
  promptTokens: number;
  completionTokens: number;
  latencyMs: number;
  costUsd: number;
  qualityScore?: number; // 0-1
  success: boolean;
  error?: string;
  timestamp: Date;
}

export interface ModelStats {
  modelId: string;
  totalRuns: number;
  successRate: number;
  avgLatencyMs: number;
  p95LatencyMs: number;
  avgCostUsd: number;
  totalCostUsd: number;
  avgQualityScore: number;
  reliability: number; // % successful
  costEfficiency: number; // quality per $
  lastUsed: Date;
}

export interface ModelEvaluationReport {
  generatedAt: Date;
  models: ModelStats[];
  bestForSpeed: string;
  bestForQuality: string;
  bestForCost: string;
  bestOverall: string;
  recommendations: string[];
}

// ─── ModelEvaluator ─────────────────────────────────────────────────────────

export class ModelEvaluator {
  private benchmarks: ModelBenchmark[] = [];

  /**
   * يُسجّل نتيجة استدعاء نموذج
   */
  record(benchmark: ModelBenchmark): void {
    this.benchmarks.push(benchmark);

    // الاحتفاظ بآخر 10,000 قياس فقط
    if (this.benchmarks.length > 10_000) {
      this.benchmarks = this.benchmarks.slice(-10_000);
    }
  }

  /**
   * يحسب إحصائيات نموذج معين
   */
  getStats(modelId: string): ModelStats | null {
    const modelBenchmarks = this.benchmarks.filter((b) => b.modelId === modelId);
    if (modelBenchmarks.length === 0) return null;

    const successful = modelBenchmarks.filter((b) => b.success);
    const latencies = modelBenchmarks.map((b) => b.latencyMs).sort((a, b) => a - b);
    const avgLatency = latencies.reduce((s, l) => s + l, 0) / latencies.length;
    const p95Index = Math.floor(latencies.length * 0.95);
    const avgCost = modelBenchmarks.reduce((s, b) => s + b.costUsd, 0) / modelBenchmarks.length;
    const totalCost = modelBenchmarks.reduce((s, b) => s + b.costUsd, 0);
    const qualityScores = successful.filter((b) => b.qualityScore !== undefined).map((b) => b.qualityScore!);
    const avgQuality = qualityScores.length > 0 ? qualityScores.reduce((s, q) => s + q, 0) / qualityScores.length : 0.5;

    return {
      modelId,
      totalRuns: modelBenchmarks.length,
      successRate: successful.length / modelBenchmarks.length,
      avgLatencyMs: avgLatency,
      p95LatencyMs: latencies[p95Index] ?? avgLatency,
      avgCostUsd: avgCost,
      totalCostUsd: totalCost,
      avgQualityScore: avgQuality,
      reliability: successful.length / modelBenchmarks.length,
      costEfficiency: avgCost > 0 ? avgQuality / avgCost : 0,
      lastUsed: modelBenchmarks[modelBenchmarks.length - 1]!.timestamp,
    };
  }

  /**
   * يُولّد تقرير مقارنة شاملة
   */
  generateReport(): ModelEvaluationReport {
    const modelIds = [...new Set(this.benchmarks.map((b) => b.modelId))];
    const models = modelIds.map((id) => this.getStats(id)!).filter(Boolean);

    const bestForSpeed = models.reduce((best, m) => (m.avgLatencyMs < best.avgLatencyMs ? m : best), models[0] ?? { modelId: "unknown", avgLatencyMs: Infinity } as ModelStats);
    const bestForQuality = models.reduce((best, m) => (m.avgQualityScore > best.avgQualityScore ? m : best), models[0] ?? { modelId: "unknown", avgQualityScore: 0 } as ModelStats);
    const bestForCost = models.reduce((best, m) => (m.avgCostUsd < best.avgCostUsd ? m : best), models[0] ?? { modelId: "unknown", avgCostUsd: Infinity } as ModelStats);

    // الأفضل بشكل عام: weighted score
    const bestOverall = models.reduce(
      (best, m) => {
        const score = m.reliability * 0.3 + m.avgQualityScore * 0.4 + (1 - m.avgCostUsd * 100) * 0.3;
        const bestScore = best.reliability * 0.3 + best.avgQualityScore * 0.4 + (1 - best.avgCostUsd * 100) * 0.3;
        return score > bestScore ? m : best;
      },
      models[0] ?? { modelId: "unknown", reliability: 0, avgQualityScore: 0, avgCostUsd: 1 } as ModelStats,
    );

    const recommendations: string[] = [];
    for (const m of models) {
      if (m.reliability < 0.9) recommendations.push(`${m.modelId} has low reliability (${(m.reliability * 100).toFixed(0)}%) — consider fallback`);
      if (m.p95LatencyMs > 10000) recommendations.push(`${m.modelId} p95 latency is high (${m.p95LatencyMs}ms) — avoid for real-time tasks`);
    }

    return {
      generatedAt: new Date(),
      models,
      bestForSpeed: bestForSpeed.modelId,
      bestForQuality: bestForQuality.modelId,
      bestForCost: bestForCost.modelId,
      bestOverall: bestOverall.modelId,
      recommendations,
    };
  }

  /**
   * يُوّلد تقرير Markdown
   */
  generateMarkdownReport(): string {
    const report = this.generateReport();
    const lines = [
      `# Model Evaluation Report`,
      `Generated: ${report.generatedAt.toISOString()}`,
      ``,
      `## 🏆 Winners`,
      `- ⚡ Fastest: **${report.bestForSpeed}**`,
      `- 🎯 Best Quality: **${report.bestForQuality}**`,
      `- 💰 Most Cost-Efficient: **${report.bestForCost}**`,
      `- 🥇 Best Overall: **${report.bestOverall}**`,
      ``,
      `## Model Comparison`,
      `| Model | Runs | Success% | Avg Latency | P95 Latency | Avg Cost | Quality |`,
      `|-------|------|----------|-------------|-------------|----------|---------|`,
    ];

    for (const m of report.models) {
      lines.push(`| ${m.modelId} | ${m.totalRuns} | ${(m.successRate * 100).toFixed(0)}% | ${m.avgLatencyMs.toFixed(0)}ms | ${m.p95LatencyMs.toFixed(0)}ms | $${m.avgCostUsd.toFixed(4)} | ${(m.avgQualityScore * 100).toFixed(0)}% |`);
    }

    if (report.recommendations.length) {
      lines.push(``, `## Recommendations`);
      for (const r of report.recommendations) lines.push(`- ${r}`);
    }

    return lines.join("\n");
  }
}

export const modelEvaluator = new ModelEvaluator();
