import { getSql } from '@/lib/db';
import { EventEmitter } from 'events';

export type BehaviorFlag = 'unusual_tool_use' | 'excessive_file_access' | 'unauthorized_resource' | 'prompt_injection_attempt' | 'cost_spike' | 'timeout_exceeded' | 'circular_behavior' | 'out_of_scope';

export interface AgentBehaviorEvent {
  agentId: string;
  taskId: string;
  action: string;
  tool?: string;
  resource?: string;
  timestamp: Date;
  flags: BehaviorFlag[];
}

export interface BehaviorProfile {
  agentId: string;
  normalToolUsage: Record<string, number>;
  normalCostPerTask: number;
  normalDurationMs: number;
  anomalyScore: number;
  flaggedEvents: AgentBehaviorEvent[];
  lastUpdated: Date;
}

/**
 * Agent Behavior Monitor — detects anomalous agent behavior.
 */
export class AgentBehaviorMonitor extends EventEmitter {
  private profiles = new Map<string, BehaviorProfile>();

  constructor() {
    super();
    this.init();
  }

  private async init() {
    try {
      const sql = await getSql();
      await sql`
        CREATE TABLE IF NOT EXISTS agent_behavior_profiles (
          agent_id TEXT PRIMARY KEY,
          normal_tool_usage JSONB,
          normal_cost_per_task NUMERIC,
          normal_duration_ms BIGINT,
          anomaly_score NUMERIC,
          last_updated TIMESTAMP WITH TIME ZONE
        );
      `;
      // Load into memory (for simplicity, loading all)
      const rows = await sql`SELECT * FROM agent_behavior_profiles`;
      for (const row of rows) {
        this.profiles.set(row.agent_id, {
          agentId: row.agent_id,
          normalToolUsage: row.normal_tool_usage || {},
          normalCostPerTask: Number(row.normal_cost_per_task),
          normalDurationMs: Number(row.normal_duration_ms),
          anomalyScore: Number(row.anomaly_score),
          flaggedEvents: [],
          lastUpdated: row.last_updated
        });
      }
    } catch (e) {
      console.error('Failed to init AgentBehaviorMonitor', e);
    }
  }

  public async recordAction(eventData: Omit<AgentBehaviorEvent, 'flags'>): Promise<void> {
    const flags: BehaviorFlag[] = [];
    
    // Basic analysis inline
    const profile = this.getProfile(eventData.agentId);
    
    if (eventData.tool && (!profile.normalToolUsage[eventData.tool] || profile.normalToolUsage[eventData.tool] < 0.1)) {
      flags.push('unusual_tool_use');
    }

    const event: AgentBehaviorEvent = { ...eventData, flags };
    
    if (flags.length > 0) {
      this.analyzeForAnomalies(event);
    }
  }

  public analyzeForAnomalies(event: AgentBehaviorEvent): void {
    const profile = this.getProfile(event.agentId);
    
    profile.anomalyScore += event.flags.length * 10;
    profile.flaggedEvents.push(event);

    if (profile.anomalyScore > 50) {
      this.emit('SecurityAlert', {
        agentId: event.agentId,
        score: profile.anomalyScore,
        flags: event.flags
      });
    }
  }

  public getProfile(agentId: string): BehaviorProfile {
    if (!this.profiles.has(agentId)) {
      this.profiles.set(agentId, {
        agentId,
        normalToolUsage: {},
        normalCostPerTask: 0,
        normalDurationMs: 0,
        anomalyScore: 0,
        flaggedEvents: [],
        lastUpdated: new Date()
      });
    }
    return this.profiles.get(agentId)!;
  }

  public async updateBaseline(agentId: string, taskResult: any): Promise<void> {
    const profile = this.getProfile(agentId);
    profile.lastUpdated = new Date();
    // In reality, incorporate taskResult data into profile metrics
    
    const sql = await getSql();
    await sql`
      INSERT INTO agent_behavior_profiles (
        agent_id, normal_tool_usage, normal_cost_per_task, normal_duration_ms, anomaly_score, last_updated
      ) VALUES (
        ${agentId}, ${profile.normalToolUsage as any}, ${profile.normalCostPerTask}, 
        ${profile.normalDurationMs}, ${profile.anomalyScore}, ${profile.lastUpdated}
      ) ON CONFLICT (agent_id) DO UPDATE SET
        normal_tool_usage = EXCLUDED.normal_tool_usage,
        normal_cost_per_task = EXCLUDED.normal_cost_per_task,
        normal_duration_ms = EXCLUDED.normal_duration_ms,
        anomaly_score = EXCLUDED.anomaly_score,
        last_updated = EXCLUDED.last_updated
    `;
  }

  public flagSuspiciousBehavior(agentId: string, flag: BehaviorFlag, context: string): void {
    const event: AgentBehaviorEvent = {
      agentId,
      taskId: 'manual',
      action: context,
      timestamp: new Date(),
      flags: [flag]
    };
    this.analyzeForAnomalies(event);
  }

  public shouldBlockAgent(agentId: string): boolean {
    const profile = this.getProfile(agentId);
    return profile.anomalyScore > 100;
  }

  public generateReport(agentId: string): string {
    const profile = this.getProfile(agentId);
    return `# Behavior Report: ${agentId}
- Anomaly Score: ${profile.anomalyScore}
- Flags Count: ${profile.flaggedEvents.length}
- Blocked: ${this.shouldBlockAgent(agentId)}
    `;
  }
}

export const agentBehaviorMonitor = new AgentBehaviorMonitor();
