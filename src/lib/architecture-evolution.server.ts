import { logger } from '@/lib/logger';

export interface MigrationStep {
  order: number;
  title: string;
  description: string;
  type: 'code' | 'infrastructure' | 'database' | 'deployment' | 'testing';
  effort: 'hours' | 'days' | 'weeks';
  canParallelize: boolean;
  prerequisites: number[];
}

export interface ArchitectureEvolutionPlan {
  projectId: string;
  currentArchitecture: string;
  targetArchitecture: string;
  trigger: string;
  migrationSteps: MigrationStep[];
  estimatedEffort: string;
  risk: 'low' | 'medium' | 'high';
  benefits: string[];
  createdAt: Date;
}

export interface ScalingSignal {
  type: 'traffic' | 'complexity' | 'team_size' | 'data_volume' | 'latency';
  current: number;
  threshold: number;
  recommendation: string;
}

export class ArchitectureEvolutionService {
  public analyzeNeedForEvolution(projectPath: string, metrics: any): ScalingSignal[] {
    const signals: ScalingSignal[] = [];
    if (metrics.traffic && metrics.traffic > 10000) {
      signals.push({ type: 'traffic', current: metrics.traffic, threshold: 10000, recommendation: 'Consider Microservices' });
    }
    if (metrics.teamSize && metrics.teamSize > 10) {
      signals.push({ type: 'team_size', current: metrics.teamSize, threshold: 10, recommendation: 'Split to Modular Monolith' });
    }
    return signals;
  }

  public suggestEvolution(currentArch: string, signals: ScalingSignal[]): ArchitectureEvolutionPlan | null {
    if (signals.length === 0) return null;
    
    let target = 'Modular Monolith';
    if (signals.some(s => s.type === 'traffic' || s.type === 'team_size' && s.current > 20)) {
      target = 'Microservices';
    }

    return this.createMigrationPlan(currentArch, target);
  }

  public createMigrationPlan(from: string, to: string): ArchitectureEvolutionPlan {
    logger.info(`Creating migration plan from ${from} to ${to}`);
    
    return {
      projectId: 'project-1',
      currentArchitecture: from,
      targetArchitecture: to,
      trigger: 'Scaling thresholds exceeded',
      migrationSteps: this.getMigrationPath(from, to),
      estimatedEffort: 'Several weeks',
      risk: 'medium',
      benefits: ['Improved scalability', 'Better team autonomy'],
      createdAt: new Date()
    };
  }

  public getMigrationPath(from: string, to: string): MigrationStep[] {
    if (from === 'Monolith' && to === 'Modular Monolith') {
      return [
        { order: 1, title: 'Identify Domains', description: 'Map out bounded contexts', type: 'code', effort: 'days', canParallelize: false, prerequisites: [] },
        { order: 2, title: 'Refactor Modules', description: 'Isolate code by domain', type: 'code', effort: 'weeks', canParallelize: true, prerequisites: [1] }
      ];
    }
    return [
      { order: 1, title: 'Plan Migration', description: 'Draft architecture plan', type: 'infrastructure', effort: 'days', canParallelize: false, prerequisites: [] }
    ];
  }

  public estimateEffort(plan: ArchitectureEvolutionPlan): string {
    return plan.estimatedEffort;
  }

  public generateEvolutionReport(plan: ArchitectureEvolutionPlan): string {
    return `
# Architecture Evolution Plan
**From:** ${plan.currentArchitecture}
**To:** ${plan.targetArchitecture}
**Risk:** ${plan.risk.toUpperCase()}
**Estimated Effort:** ${plan.estimatedEffort}

## Benefits
${plan.benefits.map(b => `- ${b}`).join('\\n')}

## Migration Steps
${plan.migrationSteps.map(s => `- ${s.order}. ${s.title} [${s.type}, ${s.effort}]`).join('\\n')}
`;
  }
}

export const architectureEvolution = new ArchitectureEvolutionService();
