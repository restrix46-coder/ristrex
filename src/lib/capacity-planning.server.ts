import { logger } from '@/lib/logger';

export interface CapacityRequirements {
  appInstances: number;
  cpuCores: number;
  ramGb: number;
  storageGb: number;
  dbConnections: number;
  bandwidthGbps: number;
  estimatedMonthlyCost: number;
  cloudProvider: 'aws' | 'gcp' | 'azure' | 'fly' | 'hetzner';
}

export interface TrafficModel {
  dailyActiveUsers: number;
  peakConcurrentUsers: number;
  requestsPerUserPerDay: number;
  avgRequestMs: number;
  growthRateMonthly: number;
}

export interface CapacityPlan {
  current: CapacityRequirements;
  sixMonths: CapacityRequirements;
  twelveMonths: CapacityRequirements;
  recommendations: string[];
  autoScalingPolicy: string;
}

export class CapacityPlanningService {
  public calculateRequirements(traffic: TrafficModel, stack: any): CapacityRequirements {
    logger.info('Calculating capacity requirements');
    const rps = (traffic.peakConcurrentUsers * (traffic.requestsPerUserPerDay / 86400)) * 10;
    const instances = Math.max(2, Math.ceil(rps / 500));
    
    return {
      appInstances: instances,
      cpuCores: instances * 2,
      ramGb: instances * 4,
      storageGb: 100 + (traffic.dailyActiveUsers * 0.01),
      dbConnections: instances * 20,
      bandwidthGbps: (rps * 50) / 1024 / 1024,
      estimatedMonthlyCost: instances * 40,
      cloudProvider: 'aws'
    };
  }

  public planGrowth(current: TrafficModel, growthRate: number, months: number): CapacityPlan {
    const m6Traffic = { ...current, dailyActiveUsers: current.dailyActiveUsers * Math.pow(1 + growthRate, 6), peakConcurrentUsers: current.peakConcurrentUsers * Math.pow(1 + growthRate, 6) };
    const m12Traffic = { ...current, dailyActiveUsers: current.dailyActiveUsers * Math.pow(1 + growthRate, 12), peakConcurrentUsers: current.peakConcurrentUsers * Math.pow(1 + growthRate, 12) };

    return {
      current: this.calculateRequirements(current, {}),
      sixMonths: this.calculateRequirements(m6Traffic, {}),
      twelveMonths: this.calculateRequirements(m12Traffic, {}),
      recommendations: [
        'Implement Auto-scaling groups',
        'Consider read replicas for database after 6 months'
      ],
      autoScalingPolicy: 'Scale out at 70% CPU, scale in at 30% CPU'
    };
  }

  public estimateCost(requirements: CapacityRequirements, provider: 'aws' | 'gcp' | 'azure' | 'fly' | 'hetzner'): number {
    const baseRates = { aws: 40, gcp: 35, azure: 42, fly: 20, hetzner: 10 };
    return requirements.appInstances * baseRates[provider] + requirements.storageGb * 0.1;
  }

  public recommendInstanceTypes(requirements: CapacityRequirements, provider: 'aws' | 'gcp' | 'azure' | 'fly' | 'hetzner'): string[] {
    if (provider === 'aws') return ['t3.medium', 'c5.large'];
    if (provider === 'gcp') return ['e2-medium', 'n2-standard-2'];
    return ['standard-2x'];
  }

  public generateCapacityReport(plan: CapacityPlan): string {
    return `
# Capacity Plan

## Current Requirements
- Instances: ${plan.current.appInstances}
- CPU/RAM: ${plan.current.cpuCores} Cores / ${plan.current.ramGb} GB
- Est. Cost: $${plan.current.estimatedMonthlyCost}/mo

## 6-Month Projection
- Instances: ${plan.sixMonths.appInstances}
- CPU/RAM: ${plan.sixMonths.cpuCores} Cores / ${plan.sixMonths.ramGb} GB
- Est. Cost: $${plan.sixMonths.estimatedMonthlyCost}/mo

## Recommendations
${plan.recommendations.map(r => `- ${r}`).join('\\n')}
`;
  }

  public checkCurrentCapacity(metrics: any): { sufficient: boolean; bottlenecks: string[] } {
    const bottlenecks = [];
    if (metrics.cpuUsage > 80) bottlenecks.push('CPU bound');
    if (metrics.dbConnections > 800) bottlenecks.push('Database connection limit approaching');
    return {
      sufficient: bottlenecks.length === 0,
      bottlenecks
    };
  }
}

export const capacityPlanning = new CapacityPlanningService();
