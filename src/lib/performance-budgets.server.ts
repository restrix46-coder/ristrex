import { logger } from '@/lib/logger';

export interface PerformanceBudget {
  metric: 'lcp' | 'fcp' | 'cls' | 'tti' | 'tbt' | 'api_latency' | 'bundle_size' | 'db_query_time';
  limit: number;
  unit: 'ms' | 'bytes' | 'score';
  severity: 'error' | 'warning';
}

export interface BudgetViolation {
  budget: PerformanceBudget;
  actual: number;
  exceeded: boolean;
  overage: number;
  timestamp: Date;
}

export class PerformanceBudgetEnforcer {
  private budgets: PerformanceBudget[] = this.getDefaultBudgets();

  public setBudget(metric: PerformanceBudget['metric'], limit: number, unit: PerformanceBudget['unit'], severity: PerformanceBudget['severity']): void {
    logger.info(`Setting budget for ${metric}: ${limit} ${unit} (${severity})`);
    
    this.budgets = this.budgets.filter(b => b.metric !== metric);
    this.budgets.push({ metric, limit, unit, severity });
  }

  public check(metric: PerformanceBudget['metric'], actual: number): BudgetViolation | null {
    const budget = this.budgets.find(b => b.metric === metric);
    if (!budget) return null;
    
    if (actual > budget.limit) {
      return {
        budget,
        actual,
        exceeded: true,
        overage: actual - budget.limit,
        timestamp: new Date()
      };
    }
    return null;
  }

  public checkAll(metrics: Record<string, number>): BudgetViolation[] {
    const violations: BudgetViolation[] = [];
    for (const [key, value] of Object.entries(metrics)) {
      const violation = this.check(key as PerformanceBudget['metric'], value);
      if (violation) violations.push(violation);
    }
    return violations;
  }

  public blockIfViolated(violations: BudgetViolation[]): void {
    const errors = violations.filter(v => v.budget.severity === 'error');
    if (errors.length > 0) {
      throw new Error(`Performance budgets violated: ${errors.map(e => e.budget.metric).join(', ')}`);
    }
  }

  public generateReport(violations: BudgetViolation[]): string {
    return `# Performance Budgets Report\nFound ${violations.length} violations.`;
  }

  public getDefaultBudgets(): PerformanceBudget[] {
    return [
      { metric: 'lcp', limit: 2500, unit: 'ms', severity: 'error' },
      { metric: 'fcp', limit: 1800, unit: 'ms', severity: 'warning' },
      { metric: 'cls', limit: 0.1, unit: 'score', severity: 'error' },
      { metric: 'api_latency', limit: 500, unit: 'ms', severity: 'error' },
      { metric: 'db_query_time', limit: 200, unit: 'ms', severity: 'warning' },
      { metric: 'bundle_size', limit: 250 * 1024, unit: 'bytes', severity: 'error' },
    ];
  }
}

export const performanceBudgets = new PerformanceBudgetEnforcer();
