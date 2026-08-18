import { getSql } from '@/lib/db';
import { randomUUID } from 'crypto';

export const FEATURE_LIFECYCLE_MIGRATION = `
CREATE TABLE IF NOT EXISTS features (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL,
  requirement_ids JSONB DEFAULT '[]',
  milestone_id TEXT,
  assigned_agents JSONB DEFAULT '[]',
  metrics JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS feature_status_changes (
  id TEXT PRIMARY KEY,
  feature_id TEXT NOT NULL REFERENCES features(id),
  from_status TEXT NOT NULL,
  to_status TEXT NOT NULL,
  changed_by TEXT NOT NULL,
  reason TEXT,
  evidence TEXT,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
`;

export type FeatureStatus = 'requested' | 'specified' | 'designed' | 'implemented' | 'tested' | 'reviewed' | 'approved' | 'released' | 'monitored' | 'deprecated';

export interface FeatureMetrics {
  adoptionRate?: number;
  errorRate?: number;
  avgResponseMs?: number;
  userFeedbackScore?: number;
}

export interface FeatureStatusChange {
  from: FeatureStatus;
  to: FeatureStatus;
  changedBy: string;
  reason: string;
  timestamp: Date;
  evidence?: string;
}

export interface Feature {
  id: string;
  projectId: string;
  name: string;
  description: string;
  status: FeatureStatus;
  requirementIds: string[];
  milestoneId?: string;
  assignedAgents: string[];
  history: FeatureStatusChange[];
  metrics?: FeatureMetrics;
  createdAt: Date;
  completedAt?: Date;
}

const VALID_TRANSITIONS: Record<FeatureStatus, FeatureStatus[]> = {
  'requested': ['specified', 'deprecated'],
  'specified': ['designed', 'deprecated'],
  'designed': ['implemented', 'deprecated'],
  'implemented': ['tested', 'deprecated'],
  'tested': ['reviewed', 'implemented'], // Can go back if tests fail
  'reviewed': ['approved', 'implemented'], // Can go back if review fails
  'approved': ['released', 'deprecated'],
  'released': ['monitored', 'deprecated'],
  'monitored': ['deprecated'],
  'deprecated': []
};

export class FeatureLifecycleService {
  /**
   * Creates a new feature
   */
  public async createFeature(feature: Omit<Feature, 'id' | 'status' | 'history' | 'createdAt' | 'completedAt'>): Promise<Feature> {
    const id = randomUUID();
    const sql = await getSql();

    await sql`
      INSERT INTO features (id, project_id, name, description, status, requirement_ids, milestone_id, assigned_agents, metrics)
      VALUES (${id}, ${feature.projectId}, ${feature.name}, ${feature.description}, 'requested', ${JSON.stringify(feature.requirementIds || [])}, ${feature.milestoneId || null}, ${JSON.stringify(feature.assignedAgents || [])}, ${JSON.stringify(feature.metrics || {})})
    `;

    return this.getFeature(id);
  }

  /**
   * Advances feature to a new status
   */
  public async advance(featureId: string, newStatus: FeatureStatus, evidence: string, changedBy: string = 'system', reason: string = ''): Promise<Feature> {
    const feature = await this.getFeature(featureId);
    
    if (!VALID_TRANSITIONS[feature.status].includes(newStatus)) {
      throw new Error(`Invalid transition from ${feature.status} to ${newStatus}`);
    }

    const sql = await getSql();

    await sql.begin(async tx => {
      await tx`
        UPDATE features 
        SET status = ${newStatus}, completed_at = ${(newStatus === 'released' || newStatus === 'deprecated') ? new Date() : null}
        WHERE id = ${featureId}
      `;

      await tx`
        INSERT INTO feature_status_changes (id, feature_id, from_status, to_status, changed_by, reason, evidence)
        VALUES (${randomUUID()}, ${featureId}, ${feature.status}, ${newStatus}, ${changedBy}, ${reason}, ${evidence})
      `;
    });

    return this.getFeature(featureId);
  }

  /**
   * Gets feature by ID
   */
  public async getFeature(featureId: string): Promise<Feature> {
    const sql = await getSql();
    const [row] = await sql`SELECT * FROM features WHERE id = ${featureId}`;
    if (!row) throw new Error('Feature not found');

    const historyRows = await sql`SELECT * FROM feature_status_changes WHERE feature_id = ${featureId} ORDER BY timestamp ASC`;
    
    return {
      id: row.id,
      projectId: row.project_id,
      name: row.name,
      description: row.description,
      status: row.status as FeatureStatus,
      requirementIds: row.requirement_ids || [],
      milestoneId: row.milestone_id,
      assignedAgents: row.assigned_agents || [],
      metrics: row.metrics || {},
      createdAt: row.created_at,
      completedAt: row.completed_at,
      history: historyRows.map(h => ({
        from: h.from_status as FeatureStatus,
        to: h.to_status as FeatureStatus,
        changedBy: h.changed_by,
        reason: h.reason,
        evidence: h.evidence,
        timestamp: h.timestamp
      }))
    };
  }

  /**
   * Lists features optionally filtered by status
   */
  public async listFeatures(projectId: string, status?: FeatureStatus): Promise<Feature[]> {
    const sql = await getSql();
    const query = status 
      ? sql`SELECT id FROM features WHERE project_id = ${projectId} AND status = ${status}`
      : sql`SELECT id FROM features WHERE project_id = ${projectId}`;
      
    const rows = await query;
    return Promise.all(rows.map(r => this.getFeature(r.id)));
  }

  /**
   * Gets a lifecycle report
   */
  public async getLifecycleReport(projectId: string): Promise<string> {
    const features = await this.listFeatures(projectId);
    const countByStatus = features.reduce((acc, f) => {
      acc[f.status] = (acc[f.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return `
# Feature Lifecycle Report
Total Features: ${features.length}

## Status Breakdown
${Object.entries(countByStatus).map(([status, count]) => `- ${status}: ${count}`).join('\n')}
    `.trim();
  }

  /**
   * Finds features stuck in a status for too long
   */
  public async findStuckFeatures(projectId: string, daysThreshold: number): Promise<Feature[]> {
    const sql = await getSql();
    // Complex query could be used here; doing simple logic for now
    const features = await this.listFeatures(projectId);
    const now = Date.now();
    
    return features.filter(f => {
      if (f.status === 'released' || f.status === 'deprecated') return false;
      
      const lastChange = f.history.length > 0 
        ? f.history[f.history.length - 1].timestamp.getTime() 
        : f.createdAt.getTime();
        
      const daysSinceChange = (now - lastChange) / (1000 * 60 * 60 * 24);
      return daysSinceChange > daysThreshold;
    });
  }

  /**
   * Generates Kanban board data
   */
  public async generateFeatureBoard(projectId: string): Promise<Record<string, Feature[]>> {
    const features = await this.listFeatures(projectId);
    const board: Record<string, Feature[]> = {};
    
    for (const f of features) {
      if (!board[f.status]) board[f.status] = [];
      board[f.status].push(f);
    }
    
    return board;
  }
}

export const featureLifecycle = new FeatureLifecycleService();
