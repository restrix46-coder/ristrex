import { getSql } from '@/lib/db';
import { randomUUID } from 'crypto';

export const CANARY_MIGRATION = `
CREATE TABLE IF NOT EXISTS canary_deployments (
  id TEXT PRIMARY KEY,
  config JSONB NOT NULL,
  current_traffic_percent INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'running',
  metrics JSONB DEFAULT '{}',
  started_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
`;

export interface CanaryConfig {
  deploymentId: string;
  canaryVersion: string;
  stableVersion: string;
  trafficPercent: number;
  maxTrafficPercent: number;
  incrementPercent: number;
  incrementIntervalMinutes: number;
  metricsThresholds: {
    maxErrorRate: number;
    maxLatencyMs: number;
    minSuccessRate: number;
  };
}

export interface CanaryMetrics {
  errorRate: number;
  avgLatencyMs: number;
  successRate: number;
  requestCount: number;
  p99LatencyMs: number;
}

export interface CanaryStatus {
  id: string;
  config: CanaryConfig;
  currentTrafficPercent: number;
  status: 'running' | 'promoting' | 'rolling_back' | 'completed' | 'failed';
  metrics: CanaryMetrics;
  startedAt: Date;
  updatedAt: Date;
}

export class CanaryDeploymentService {
  /**
   * Starts a new canary deployment
   */
  public async startCanary(config: CanaryConfig): Promise<CanaryStatus> {
    const id = randomUUID();
    const sql = await getSql();
    
    await sql`
      INSERT INTO canary_deployments (id, config, current_traffic_percent, status)
      VALUES (${id}, ${JSON.stringify(config)}, ${config.trafficPercent}, 'running')
    `;

    return this.getStatus(id);
  }

  /**
   * Advances the canary traffic incrementally
   */
  public async advanceCanary(deploymentId: string): Promise<CanaryStatus> {
    const status = await this.getStatus(deploymentId);
    if (status.status !== 'running') {
      throw new Error(`Cannot advance canary in status ${status.status}`);
    }

    const nextPercent = Math.min(status.currentTrafficPercent + status.config.incrementPercent, status.config.maxTrafficPercent);
    
    const sql = await getSql();
    await sql`
      UPDATE canary_deployments 
      SET current_traffic_percent = ${nextPercent}, updated_at = NOW() 
      WHERE id = ${deploymentId}
    `;

    if (nextPercent === 100) {
      await this.promoteCanary(deploymentId);
    }

    return this.getStatus(deploymentId);
  }

  /**
   * Collects metrics (stubbed out for platform integration)
   */
  public async collectMetrics(deploymentId: string): Promise<CanaryMetrics> {
    // In a real implementation, this would query Prometheus/Datadog/etc.
    // Stubbing dummy values
    return {
      errorRate: Math.random() * 0.05, // 0-5% error rate
      avgLatencyMs: 150 + Math.random() * 100,
      successRate: 0.95 + Math.random() * 0.05,
      requestCount: 1000 + Math.floor(Math.random() * 5000),
      p99LatencyMs: 300 + Math.random() * 200
    };
  }

  /**
   * Evaluates the health of the canary deployment
   */
  public evaluateHealth(status: CanaryStatus): { healthy: boolean; issues: string[] } {
    const issues: string[] = [];
    const m = status.metrics;
    const t = status.config.metricsThresholds;

    if (m.errorRate > t.maxErrorRate) issues.push(`Error rate ${m.errorRate} exceeds max ${t.maxErrorRate}`);
    if (m.avgLatencyMs > t.maxLatencyMs) issues.push(`Latency ${m.avgLatencyMs}ms exceeds max ${t.maxLatencyMs}ms`);
    if (m.successRate < t.minSuccessRate) issues.push(`Success rate ${m.successRate} below min ${t.minSuccessRate}`);

    return { healthy: issues.length === 0, issues };
  }

  /**
   * Promotes the canary fully
   */
  public async promoteCanary(deploymentId: string): Promise<void> {
    const sql = await getSql();
    await sql`
      UPDATE canary_deployments 
      SET current_traffic_percent = 100, status = 'completed', updated_at = NOW() 
      WHERE id = ${deploymentId}
    `;
  }

  /**
   * Rolls back the canary deployment
   */
  public async rollbackCanary(deploymentId: string, reason: string): Promise<void> {
    const sql = await getSql();
    await sql`
      UPDATE canary_deployments 
      SET current_traffic_percent = 0, status = 'rolling_back', updated_at = NOW() 
      WHERE id = ${deploymentId}
    `;
    // Update metric or logs with reason
    console.error(`Canary ${deploymentId} rolled back: ${reason}`);
  }

  /**
   * Retrieves the current status
   */
  public async getStatus(deploymentId: string): Promise<CanaryStatus> {
    const sql = await getSql();
    const [row] = await sql`SELECT * FROM canary_deployments WHERE id = ${deploymentId}`;
    if (!row) throw new Error('Canary deployment not found');

    return {
      id: row.id,
      config: row.config,
      currentTrafficPercent: row.current_traffic_percent,
      status: row.status as any,
      metrics: row.metrics || this.collectMetrics(deploymentId), // Fallback
      startedAt: row.started_at,
      updatedAt: row.updated_at
    };
  }

  /**
   * Automated runner for advancing or rolling back based on health
   */
  public async runAutopilot(deploymentId: string): Promise<void> {
    const status = await this.getStatus(deploymentId);
    if (status.status !== 'running') return;

    const metrics = await this.collectMetrics(deploymentId);
    
    // Save new metrics
    const sql = await getSql();
    await sql`UPDATE canary_deployments SET metrics = ${JSON.stringify(metrics)} WHERE id = ${deploymentId}`;
    status.metrics = metrics;

    const health = this.evaluateHealth(status);

    if (!health.healthy) {
      await this.rollbackCanary(deploymentId, health.issues.join('; '));
      return;
    }

    const timeSinceUpdate = (Date.now() - status.updatedAt.getTime()) / (1000 * 60);
    if (timeSinceUpdate >= status.config.incrementIntervalMinutes) {
      await this.advanceCanary(deploymentId);
    }
  }
}

export const canaryDeployment = new CanaryDeploymentService();
