import { logger } from '@/lib/logger';
import { getSql } from '@/lib/db';

export interface FailureEvent {
  id: string;
  serviceId: string;
  type: 'outage' | 'degradation' | 'error_spike';
  durationMinutes: number;
  impactPercent: number;
  root_cause?: string;
  startedAt: Date;
  resolvedAt?: Date;
}

export interface FailureBudget {
  serviceId: string;
  sloTarget: number;
  window: 'rolling_30d' | 'monthly' | 'quarterly';
  totalBudgetMinutes: number;
  consumedMinutes: number;
  remainingMinutes: number;
  remainingPercent: number;
  status: 'healthy' | 'warning' | 'exhausted';
  events: FailureEvent[];
}

export interface BudgetPolicy {
  onWarning: 'freeze_deploys' | 'require_approval' | 'notify';
  onExhausted: 'freeze_deploys' | 'emergency_only';
  notificationChannels: string[];
}

export class FailureBudgetService {
  public async migrate(): Promise<void> {
    const sql = await getSql();
    await sql`
      CREATE TABLE IF NOT EXISTS failure_events (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        service_id TEXT NOT NULL,
        type TEXT NOT NULL,
        duration_minutes INTEGER NOT NULL,
        impact_percent NUMERIC NOT NULL,
        root_cause TEXT,
        started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        resolved_at TIMESTAMP WITH TIME ZONE
      )
    `;
  }

  public async createBudget(serviceId: string, sloTarget: number, window: 'rolling_30d' | 'monthly' | 'quarterly'): Promise<FailureBudget> {
    logger.info(`Creating failure budget for service ${serviceId}`);
    
    let totalMinutes = 0;
    if (window === 'rolling_30d' || window === 'monthly') totalMinutes = 30 * 24 * 60;
    else if (window === 'quarterly') totalMinutes = 90 * 24 * 60;

    const totalBudgetMinutes = totalMinutes * (1 - sloTarget / 100);

    return {
      serviceId,
      sloTarget,
      window,
      totalBudgetMinutes,
      consumedMinutes: 0,
      remainingMinutes: totalBudgetMinutes,
      remainingPercent: 100,
      status: 'healthy',
      events: []
    };
  }

  public async recordEvent(event: FailureEvent): Promise<FailureBudget> {
    const sql = await getSql();
    await sql`
      INSERT INTO failure_events (
        service_id, type, duration_minutes, impact_percent, root_cause, started_at, resolved_at
      ) VALUES (
        ${event.serviceId}, ${event.type}, ${event.durationMinutes}, ${event.impactPercent}, ${event.root_cause || null}, ${event.startedAt}, ${event.resolvedAt || null}
      )
    `;
    return this.getBudget(event.serviceId);
  }

  public async getBudget(serviceId: string): Promise<FailureBudget> {
    const budget = await this.createBudget(serviceId, 99.9, 'rolling_30d');
    const sql = await getSql();
    const records = await sql`
      SELECT * FROM failure_events 
      WHERE service_id = ${serviceId} AND started_at > NOW() - INTERVAL '30 days'
    `;
    
    budget.events = records.map((r: any) => ({
      id: r.id,
      serviceId: r.service_id,
      type: r.type,
      durationMinutes: r.duration_minutes,
      impactPercent: r.impact_percent,
      root_cause: r.root_cause,
      startedAt: r.started_at,
      resolvedAt: r.resolved_at
    }));

    budget.consumedMinutes = this.calculateConsumed(budget.events, budget.window);
    budget.remainingMinutes = Math.max(0, budget.totalBudgetMinutes - budget.consumedMinutes);
    budget.remainingPercent = (budget.remainingMinutes / budget.totalBudgetMinutes) * 100;

    if (budget.remainingPercent <= 0) budget.status = 'exhausted';
    else if (budget.remainingPercent <= 20) budget.status = 'warning';
    else budget.status = 'healthy';

    return budget;
  }

  public calculateConsumed(events: FailureEvent[], window: string): number {
    return events.reduce((acc, event) => acc + (event.durationMinutes * (event.impactPercent / 100)), 0);
  }

  public checkPolicy(budget: FailureBudget, policy: BudgetPolicy): { action: string; reason: string } {
    if (budget.status === 'exhausted') {
      return { action: policy.onExhausted, reason: 'Failure budget exhausted' };
    } else if (budget.status === 'warning') {
      return { action: policy.onWarning, reason: 'Failure budget warning limit reached' };
    }
    return { action: 'proceed', reason: 'Budget is healthy' };
  }

  public async canDeploy(serviceId: string): Promise<{ allowed: boolean; reason: string }> {
    const budget = await this.getBudget(serviceId);
    if (budget.status === 'exhausted') {
      return { allowed: false, reason: 'Failure budget exhausted. Emergency deploys only.' };
    }
    return { allowed: true, reason: 'Budget healthy.' };
  }

  public generateReport(budget: FailureBudget): string {
    return `
# Failure Budget Report for ${budget.serviceId}

- **SLO Target:** ${budget.sloTarget}%
- **Window:** ${budget.window}
- **Status:** ${budget.status.toUpperCase()}

## Budget Utilization
- **Total Budget:** ${budget.totalBudgetMinutes.toFixed(2)} min
- **Consumed:** ${budget.consumedMinutes.toFixed(2)} min
- **Remaining:** ${budget.remainingMinutes.toFixed(2)} min (${budget.remainingPercent.toFixed(1)}%)

## Recent Events
${budget.events.map(e => `- ${e.type} for ${e.durationMinutes}m (Impact: ${e.impactPercent}%)`).join('\\n')}
`;
  }
}

export const failureBudget = new FailureBudgetService();
