import { logger } from '@/lib/logger.server';

/**
 * Represents a scenario for load testing.
 */
export interface LoadTestScenario {
  id: string;
  name: string;
  targetUrl: string;
  endpoints: LoadTestEndpoint[];
  concurrentUsers: number;
  durationSeconds: number;
  rampUpSeconds: number;
  type: 'load' | 'stress' | 'soak' | 'spike';
}

/**
 * Defines an endpoint within a load testing scenario.
 */
export interface LoadTestEndpoint {
  path: string;
  method: string;
  body?: string | Record<string, unknown>;
  headers?: Record<string, string>;
  weight: number;
}

/**
 * Represents the results of a load test.
 */
export interface LoadTestResult {
  scenarioId: string;
  status: 'running' | 'completed' | 'failed';
  metrics: LoadMetrics;
  percentiles: {
    p50: number;
    p75: number;
    p90: number;
    p95: number;
    p99: number;
  };
  errors: ErrorSummary[];
  startedAt: Date;
  completedAt?: Date;
}

/**
 * Detailed load metrics.
 */
export interface LoadMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  avgLatencyMs: number;
  maxLatencyMs: number;
  minLatencyMs: number;
  throughputRps: number;
  errorRate: number;
  peakConcurrentUsers: number;
}

/**
 * Summary of errors during load test.
 */
export interface ErrorSummary {
  status: number;
  count: number;
  path: string;
}

/**
 * Service to execute load tests.
 */
export class LoadTestingService {
  /**
   * Runs a complete scenario.
   * @param scenario The load test scenario to run
   * @returns Promise resolving to the result
   */
  async runScenario(scenario: LoadTestScenario): Promise<LoadTestResult> {
    logger.info(`Starting load test scenario: ${scenario.name}`);
    const startedAt = new Date();
    
    try {
      const result = await this.executeBatches(scenario.targetUrl, scenario.concurrentUsers, scenario.durationSeconds);
      
      const metrics: LoadMetrics = {
        totalRequests: result.total,
        successfulRequests: result.success,
        failedRequests: result.failed,
        avgLatencyMs: result.latencies.reduce((a, b) => a + b, 0) / (result.latencies.length || 1),
        maxLatencyMs: Math.max(...result.latencies, 0),
        minLatencyMs: Math.min(...result.latencies, 0),
        throughputRps: result.total / scenario.durationSeconds,
        errorRate: result.failed / (result.total || 1),
        peakConcurrentUsers: scenario.concurrentUsers,
      };

      const sortedLatencies = result.latencies.sort((a, b) => a - b);
      const getP = (p: number) => sortedLatencies[Math.floor(sortedLatencies.length * p)] || 0;

      return {
        scenarioId: scenario.id,
        status: 'completed',
        metrics,
        percentiles: {
          p50: getP(0.50),
          p75: getP(0.75),
          p90: getP(0.90),
          p95: getP(0.95),
          p99: getP(0.99),
        },
        errors: [],
        startedAt,
        completedAt: new Date(),
      };
    } catch (error) {
      logger.error('Load test scenario failed', { error });
      return {
        scenarioId: scenario.id,
        status: 'failed',
        metrics: this.getEmptyMetrics(),
        percentiles: { p50: 0, p75: 0, p90: 0, p95: 0, p99: 0 },
        errors: [],
        startedAt,
        completedAt: new Date(),
      };
    }
  }

  /**
   * Helper to execute batches of requests.
   */
  private async executeBatches(url: string, users: number, duration: number) {
    const end = Date.now() + duration * 1000;
    let total = 0, success = 0, failed = 0;
    const latencies: number[] = [];

    while (Date.now() < end) {
      const batch = Array.from({ length: users }).map(async () => {
        const start = Date.now();
        try {
          const res = await fetch(url);
          if (res.ok) success++; else failed++;
        } catch {
          failed++;
        } finally {
          latencies.push(Date.now() - start);
          total++;
        }
      });
      await Promise.all(batch);
    }
    
    return { total, success, failed, latencies };
  }

  private getEmptyMetrics(): LoadMetrics {
    return {
      totalRequests: 0, successfulRequests: 0, failedRequests: 0,
      avgLatencyMs: 0, maxLatencyMs: 0, minLatencyMs: 0,
      throughputRps: 0, errorRate: 0, peakConcurrentUsers: 0
    };
  }

  /**
   * Run a basic load test.
   */
  async runLoadTest(url: string, concurrentUsers: number, durationSeconds: number): Promise<LoadTestResult> {
    return this.runScenario({
      id: `load-${Date.now()}`,
      name: 'Basic Load Test',
      targetUrl: url,
      endpoints: [{ path: '/', method: 'GET', weight: 1 }],
      concurrentUsers,
      durationSeconds,
      rampUpSeconds: 0,
      type: 'load'
    });
  }

  /**
   * Run a stress test.
   */
  async runStressTest(url: string, startUsers: number, maxUsers: number, stepSize: number): Promise<LoadTestResult> {
    return this.runLoadTest(url, maxUsers, 60);
  }

  /**
   * Run a soak test.
   */
  async runSoakTest(url: string, users: number, durationMinutes: number): Promise<LoadTestResult> {
    return this.runLoadTest(url, users, durationMinutes * 60);
  }

  /**
   * Generates a markdown report.
   */
  generateReport(result: LoadTestResult): string {
    return `# Load Test Report
Status: ${result.status}
Total Requests: ${result.metrics.totalRequests}
Throughput: ${result.metrics.throughputRps.toFixed(2)} RPS
Error Rate: ${(result.metrics.errorRate * 100).toFixed(2)}%
Average Latency: ${result.metrics.avgLatencyMs.toFixed(2)}ms
P95 Latency: ${result.percentiles.p95}ms`;
  }

  /**
   * Checks results against thresholds.
   */
  checkThresholds(result: LoadTestResult, thresholds: Partial<LoadMetrics>): { passed: boolean; violations: string[] } {
    const violations: string[] = [];
    if (thresholds.errorRate !== undefined && result.metrics.errorRate > thresholds.errorRate) {
      violations.push(`Error rate ${result.metrics.errorRate} exceeds ${thresholds.errorRate}`);
    }
    if (thresholds.avgLatencyMs !== undefined && result.metrics.avgLatencyMs > thresholds.avgLatencyMs) {
      violations.push(`Avg latency ${result.metrics.avgLatencyMs} exceeds ${thresholds.avgLatencyMs}`);
    }
    return { passed: violations.length === 0, violations };
  }
}

export const loadTesting = new LoadTestingService();
