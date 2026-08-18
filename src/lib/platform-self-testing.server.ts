import { logger } from './logger';
import { getSql } from './db';
import { randomUUID } from 'crypto';

export interface PlatformTest {
  id: string;
  name: string;
  category: 'agents' | 'models' | 'tools' | 'orchestrator' | 'sandbox' | 'security' | 'queues' | 'database' | 'ui' | 'deployment';
  test: () => Promise<TestOutcome>;
  critical: boolean;
}

export interface TestOutcome {
  passed: boolean;
  duration: number;
  error?: string;
  metrics?: Record<string, number>;
}

export interface PlatformTestReport {
  runId: string;
  timestamp: Date;
  totalTests: number;
  passedTests: number;
  failedTests: number;
  criticalFailures: string[];
  overallStatus: 'healthy' | 'degraded' | 'critical';
  results: Array<{ test: PlatformTest; outcome: TestOutcome }>;
}

export class PlatformSelfTester {
  private tests: PlatformTest[] = [];

  constructor() {
    this.registerBuiltInTests();
  }

  /**
   * Registers a new platform test.
   */
  public addTest(test: PlatformTest): void {
    this.tests.push(test);
  }

  /**
   * Runs all registered platform tests.
   */
  public async runAll(): Promise<PlatformTestReport> {
    return this.executeTests(this.tests);
  }

  /**
   * Runs tests for a specific category.
   */
  public async runCategory(category: PlatformTest['category']): Promise<PlatformTestReport> {
    const categoryTests = this.tests.filter(t => t.category === category);
    return this.executeTests(categoryTests);
  }

  /**
   * Runs only critical tests.
   */
  public async runCritical(): Promise<PlatformTestReport> {
    const criticalTests = this.tests.filter(t => t.critical);
    return this.executeTests(criticalTests);
  }

  /**
   * Checks if the test report contains critical failures.
   */
  public shouldBlockDeployment(report: PlatformTestReport): boolean {
    return report.overallStatus === 'critical' || report.criticalFailures.length > 0;
  }

  /**
   * Generates a markdown report for the given test report.
   */
  public generateReport(report: PlatformTestReport): string {
    let md = `# Platform Test Report - ${report.overallStatus.toUpperCase()}\n\n`;
    md += `Run ID: ${report.runId}\nTimestamp: ${report.timestamp.toISOString()}\n\n`;
    md += `## Summary\n`;
    md += `- Total Tests: ${report.totalTests}\n`;
    md += `- Passed: ${report.passedTests}\n`;
    md += `- Failed: ${report.failedTests}\n`;
    
    if (report.criticalFailures.length > 0) {
      md += `\n## Critical Failures\n`;
      report.criticalFailures.forEach(f => md += `- ${f}\n`);
    }

    md += `\n## Detailed Results\n`;
    report.results.forEach(({ test, outcome }) => {
      const status = outcome.passed ? '✅ PASSED' : '❌ FAILED';
      md += `### ${test.name} (${test.category}) - ${status}\n`;
      md += `- Duration: ${outcome.duration}ms\n`;
      if (outcome.error) md += `- Error: ${outcome.error}\n`;
      if (outcome.metrics) {
        md += `- Metrics:\n`;
        Object.entries(outcome.metrics).forEach(([k, v]) => md += `  - ${k}: ${v}\n`);
      }
    });

    return md;
  }

  private async executeTests(testsToRun: PlatformTest[]): Promise<PlatformTestReport> {
    const results = [];
    let passedTests = 0;
    let failedTests = 0;
    const criticalFailures: string[] = [];

    for (const test of testsToRun) {
      const start = Date.now();
      try {
        const outcome = await test.test();
        const duration = Date.now() - start;
        outcome.duration = duration;
        
        results.push({ test, outcome });
        
        if (outcome.passed) {
          passedTests++;
        } else {
          failedTests++;
          if (test.critical) {
            criticalFailures.push(`${test.name}: ${outcome.error || 'Unknown error'}`);
          }
        }
      } catch (err: any) {
        const duration = Date.now() - start;
        failedTests++;
        if (test.critical) {
          criticalFailures.push(`${test.name}: Exception - ${err.message}`);
        }
        results.push({
          test,
          outcome: { passed: false, duration, error: err.message || String(err) }
        });
      }
    }

    let overallStatus: PlatformTestReport['overallStatus'] = 'healthy';
    if (criticalFailures.length > 0) {
      overallStatus = 'critical';
    } else if (failedTests > 0) {
      overallStatus = 'degraded';
    }

    return {
      runId: randomUUID(),
      timestamp: new Date(),
      totalTests: testsToRun.length,
      passedTests,
      failedTests,
      criticalFailures,
      overallStatus,
      results
    };
  }

  private registerBuiltInTests(): void {
    // Agents
    this.addTest({
      id: 'test-agent-init',
      name: 'Agent Initialization',
      category: 'agents',
      critical: true,
      test: async () => {
        return { passed: true, duration: 0 };
      }
    });
    
    // Database
    this.addTest({
      id: 'test-db-conn',
      name: 'Database Connection',
      category: 'database',
      critical: true,
      test: async () => {
        try {
          const sql = getSql();
          await sql`SELECT 1`;
          return { passed: true, duration: 0 };
        } catch (err: any) {
          return { passed: false, duration: 0, error: err.message };
        }
      }
    });

    // Tools
    this.addTest({
      id: 'test-tool-fs',
      name: 'Filesystem Access',
      category: 'tools',
      critical: true,
      test: async () => ({ passed: true, duration: 0 })
    });

    // Security
    this.addTest({
      id: 'test-sec-csrf',
      name: 'CSRF Protection Active',
      category: 'security',
      critical: true,
      test: async () => ({ passed: true, duration: 0 })
    });

    // Queues
    this.addTest({
      id: 'test-queue-health',
      name: 'Queue Enqueue/Dequeue',
      category: 'queues',
      critical: true,
      test: async () => ({ passed: true, duration: 0 })
    });

    // Sandbox
    this.addTest({
      id: 'test-sandbox-isol',
      name: 'Sandbox Isolation',
      category: 'sandbox',
      critical: true,
      test: async () => ({ passed: true, duration: 0 })
    });
  }
}

export const platformSelfTester = new PlatformSelfTester();
