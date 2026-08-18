import { routedCall } from '@/lib/model-router.server';
import { logger } from '@/lib/logger.server';

export class PerformanceAgent {
  /**
   * Analyzes code and metrics for performance bottlenecks.
   * يحلل الكود والمقاييس بحثًا عن اختناقات الأداء.
   */
  async analyzeBottlenecks(code: string, metrics: Record<string, any>): Promise<Record<string, any>> {
    logger.info('PerformanceAgent analyzing bottlenecks...');
    const response = await routedCall({
      kind: 'reasoning',
      systemPrompt: 'You are a Performance Agent. Identify slow paths and performance bottlenecks in the given code and metrics. Return a JSON object with findings.',
      prompt: `Code:\n${code}\n\nMetrics:\n${JSON.stringify(metrics, null, 2)}`,
      responseFormat: 'json',
    });
    return JSON.parse(response);
  }

  /**
   * Optimizes database queries and suggests indexes.
   * يحسن استعلامات قاعدة البيانات ويقترح الفهارس.
   */
  async optimizeDatabase(queries: string[]): Promise<string> {
    logger.info('PerformanceAgent optimizing database queries...');
    return routedCall({
      kind: 'reasoning',
      systemPrompt: 'You are a Performance Agent. Suggest index and query improvements for the provided database queries.',
      prompt: `Queries:\n${queries.join('\n\n')}`,
    });
  }

  /**
   * Optimizes frontend bundles based on stats.
   * يحسن حزم الواجهة الأمامية بناءً على الإحصائيات.
   */
  async optimizeFrontend(bundleStats: Record<string, any>): Promise<string> {
    logger.info('PerformanceAgent optimizing frontend bundle...');
    return routedCall({
      kind: 'reasoning',
      systemPrompt: 'You are a Performance Agent. Suggest frontend bundle optimizations based on the provided stats.',
      prompt: `Bundle Stats:\n${JSON.stringify(bundleStats, null, 2)}`,
    });
  }

  /**
   * Generates a performance report including Core Web Vitals.
   * يولد تقرير أداء يتضمن مؤشرات الويب الأساسية.
   */
  async generatePerformanceReport(analysis: Record<string, any>): Promise<string> {
    logger.info('PerformanceAgent generating report...');
    return routedCall({
      kind: 'reasoning',
      systemPrompt: 'You are a Performance Agent. Generate a markdown performance report including Core Web Vitals based on the analysis.',
      prompt: `Analysis:\n${JSON.stringify(analysis, null, 2)}`,
    });
  }
}
