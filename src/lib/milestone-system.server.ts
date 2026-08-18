import { getSql } from '@/lib/db';
import { randomUUID } from 'crypto';

export const MILESTONE_MIGRATION = `
CREATE TABLE IF NOT EXISTS milestones (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  target_date TIMESTAMP WITH TIME ZONE,
  status TEXT NOT NULL DEFAULT 'planned',
  features JSONB NOT NULL DEFAULT '[]',
  completion_percent INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS quality_gates (
  id TEXT PRIMARY KEY,
  milestone_id TEXT NOT NULL REFERENCES milestones(id),
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  threshold NUMERIC,
  status TEXT NOT NULL DEFAULT 'pending',
  evaluated_at TIMESTAMP WITH TIME ZONE,
  evidence TEXT
);
`;

export interface QualityGate {
  id: string;
  name: string;
  type: 'test_coverage' | 'security_scan' | 'performance' | 'accessibility' | 'code_review' | 'deployment' | 'custom';
  threshold?: number;
  status: 'pending' | 'passed' | 'failed' | 'skipped';
  evaluatedAt?: Date;
  evidence?: string;
}

export interface Milestone {
  id: string;
  projectId: string;
  name: string;
  description: string;
  targetDate: Date;
  status: 'planned' | 'in_progress' | 'blocked' | 'completed' | 'missed';
  qualityGates: QualityGate[];
  features: string[];
  completionPercent: number;
  createdAt: Date;
}

export interface MilestoneProgress {
  milestone: Milestone;
  completedFeatures: number;
  totalFeatures: number;
  passedGates: number;
  totalGates: number;
  blockers: string[];
  riskLevel: 'green' | 'yellow' | 'red';
}

export class MilestoneService {
  /**
   * Creates a new milestone with quality gates
   */
  public async createMilestone(milestone: Omit<Milestone, 'id' | 'createdAt' | 'completionPercent' | 'status'>): Promise<Milestone> {
    const id = randomUUID();
    const sql = await getSql();

    await sql.begin(async tx => {
      await tx`
        INSERT INTO milestones (id, project_id, name, description, target_date, status, features, completion_percent)
        VALUES (${id}, ${milestone.projectId}, ${milestone.name}, ${milestone.description}, ${milestone.targetDate}, 'planned', ${JSON.stringify(milestone.features)}, 0)
      `;

      for (const gate of milestone.qualityGates) {
        const gateId = gate.id || randomUUID();
        await tx`
          INSERT INTO quality_gates (id, milestone_id, name, type, threshold, status)
          VALUES (${gateId}, ${id}, ${gate.name}, ${gate.type}, ${gate.threshold || null}, 'pending')
        `;
      }
    });

    return {
      ...milestone,
      id,
      status: 'planned',
      completionPercent: 0,
      createdAt: new Date()
    };
  }

  /**
   * Updates milestone completion
   */
  public async updateProgress(milestoneId: string, completedFeatures: number): Promise<MilestoneProgress> {
    const sql = await getSql();
    
    // Simplistic update
    const [row] = await sql`
      UPDATE milestones 
      SET completion_percent = ${completedFeatures} 
      WHERE id = ${milestoneId} 
      RETURNING *
    `;

    if (!row) throw new Error('Milestone not found');

    const statuses = await this.getMilestoneStatus(row.project_id);
    return statuses.find(s => s.milestone.id === milestoneId)!;
  }

  /**
   * Evaluates a quality gate
   */
  public async evaluateQualityGate(gateId: string, evidence: string, pass: boolean = true): Promise<QualityGate> {
    const sql = await getSql();
    
    const [row] = await sql`
      UPDATE quality_gates 
      SET status = ${pass ? 'passed' : 'failed'}, evidence = ${evidence}, evaluated_at = NOW() 
      WHERE id = ${gateId} 
      RETURNING *
    `;

    if (!row) throw new Error('Quality gate not found');

    return {
      id: row.id,
      name: row.name,
      type: row.type as any,
      threshold: row.threshold,
      status: row.status as any,
      evaluatedAt: row.evaluated_at,
      evidence: row.evidence
    };
  }

  /**
   * Checks if milestone can advance to completed
   */
  public async checkCanAdvance(milestoneId: string): Promise<{ canAdvance: boolean; blockers: string[] }> {
    const sql = await getSql();
    const gates = await sql`SELECT * FROM quality_gates WHERE milestone_id = ${milestoneId}`;
    
    const blockers = gates.filter(g => g.status !== 'passed').map(g => g.name);
    return {
      canAdvance: blockers.length === 0,
      blockers
    };
  }

  /**
   * Marks milestone as complete
   */
  public async completeMilestone(milestoneId: string): Promise<void> {
    const check = await this.checkCanAdvance(milestoneId);
    if (!check.canAdvance) {
      throw new Error(`Cannot complete milestone. Blockers: ${check.blockers.join(', ')}`);
    }

    const sql = await getSql();
    await sql`UPDATE milestones SET status = 'completed' WHERE id = ${milestoneId}`;
  }

  /**
   * Gets status of all milestones for a project
   */
  public async getMilestoneStatus(projectId: string): Promise<MilestoneProgress[]> {
    const sql = await getSql();
    const milestones = await sql`SELECT * FROM milestones WHERE project_id = ${projectId}`;
    
    const results: MilestoneProgress[] = [];

    for (const m of milestones) {
      const gates = await sql`SELECT * FROM quality_gates WHERE milestone_id = ${m.id}`;
      
      const qualityGates: QualityGate[] = gates.map(g => ({
        id: g.id,
        name: g.name,
        type: g.type as any,
        threshold: g.threshold,
        status: g.status as any,
        evaluatedAt: g.evaluated_at,
        evidence: g.evidence
      }));

      const milestone: Milestone = {
        id: m.id,
        projectId: m.project_id,
        name: m.name,
        description: m.description,
        targetDate: m.target_date,
        status: m.status as any,
        features: m.features || [],
        completionPercent: m.completion_percent,
        qualityGates,
        createdAt: m.created_at
      };

      const passedGates = qualityGates.filter(g => g.status === 'passed').length;
      
      let riskLevel: 'green'|'yellow'|'red' = 'green';
      if (m.status === 'blocked') riskLevel = 'red';
      else if (new Date() > m.target_date && m.status !== 'completed') riskLevel = 'red';
      else if (m.completionPercent < 50 && passedGates < qualityGates.length / 2) riskLevel = 'yellow';

      results.push({
        milestone,
        completedFeatures: Math.floor((m.completionPercent / 100) * (m.features?.length || 0)),
        totalFeatures: m.features?.length || 0,
        passedGates,
        totalGates: qualityGates.length,
        blockers: qualityGates.filter(g => g.status === 'failed').map(g => g.name),
        riskLevel
      });
    }

    return results;
  }

  /**
   * Generates a markdown report for a milestone
   */
  public async generateMilestoneReport(milestoneId: string): Promise<string> {
    const sql = await getSql();
    const [m] = await sql`SELECT * FROM milestones WHERE id = ${milestoneId}`;
    if (!m) throw new Error('Milestone not found');

    const statuses = await this.getMilestoneStatus(m.project_id);
    const progress = statuses.find(s => s.milestone.id === milestoneId);
    
    if (!progress) throw new Error('Failed to load progress');

    return `
# Milestone Report: ${progress.milestone.name}
**Status:** ${progress.milestone.status} | **Risk:** ${progress.riskLevel}

## Features
${progress.completedFeatures} / ${progress.totalFeatures} completed (${progress.milestone.completionPercent}%)

## Quality Gates
${progress.passedGates} / ${progress.totalGates} passed
${progress.milestone.qualityGates.map(g => `- [${g.status === 'passed' ? 'x' : ' '}] ${g.name} (${g.type})`).join('\n')}

## Blockers
${progress.blockers.length ? progress.blockers.map(b => `- ${b}`).join('\n') : 'None'}
    `.trim();
  }
}

export const milestoneService = new MilestoneService();
