import { logger } from '@/lib/logger';
import { getSql } from '@/lib/db';

export interface HealthMetric {
  name: string;
  value: number | string;
  status: 'good' | 'warning' | 'critical';
  threshold: { warning: number; critical: number };
}

export interface HealthDimension {
  name: string;
  score: number;
  weight: number;
  metrics: HealthMetric[];
  trend: 'improving' | 'stable' | 'degrading';
}

export interface ProjectHealthReport {
  projectId: string;
  overallScore: number;
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  dimensions: HealthDimension[];
  criticalIssues: string[];
  recommendations: string[];
  generatedAt: Date;
}

export type AllMetrics = {
  testCoverage: number;
  securityIssues: number;
  p95Latency: number;
  bundleSize: number;
  debtHours: number;
  outdatedDeps: number;
  deploySuccessRate: number;
  uptimePercent: number;
  [key: string]: number;
};

export class ProjectHealthService {
  /**
   * Calculates the project health report.
   * @param projectId The project ID.
   * @param metrics The metrics to use for calculation.
   * @returns The project health report.
   */
  public calculateHealth(projectId: string, metrics: AllMetrics): ProjectHealthReport {
    logger.info(`Calculating health for project ${projectId}`);
    
    const dimensions: HealthDimension[] = [
      this.getTestHealth(projectId, metrics),
      this.getSecurityHealth(projectId, metrics),
      this.getPerformanceHealth(metrics),
      this.getArchitectureHealth(projectId),
      this.getTechDebtHealth(metrics),
      this.getDependencyHealth(metrics),
      this.getDeploymentHealth(metrics),
      this.getMonitoringHealth(metrics),
    ];

    let totalScore = 0;
    let totalWeight = 0;
    const criticalIssues: string[] = [];
    const recommendations: string[] = [];

    dimensions.forEach(dim => {
      totalScore += dim.score * dim.weight;
      totalWeight += dim.weight;
      
      dim.metrics.forEach(metric => {
        if (metric.status === 'critical') {
          criticalIssues.push(`${dim.name} - ${metric.name}: ${metric.value} (Threshold: ${metric.threshold.critical})`);
          recommendations.push(`Fix critical issue in ${dim.name}: ${metric.name}`);
        } else if (metric.status === 'warning') {
          recommendations.push(`Improve ${dim.name}: ${metric.name}`);
        }
      });
    });

    const overallScore = totalWeight > 0 ? Math.round(totalScore / totalWeight) : 0;
    let grade: 'A' | 'B' | 'C' | 'D' | 'F' = 'F';
    if (overallScore >= 90) grade = 'A';
    else if (overallScore >= 80) grade = 'B';
    else if (overallScore >= 70) grade = 'C';
    else if (overallScore >= 60) grade = 'D';

    return {
      projectId,
      overallScore,
      grade,
      dimensions,
      criticalIssues,
      recommendations,
      generatedAt: new Date()
    };
  }

  public getTestHealth(projectPath: string, metrics?: AllMetrics): HealthDimension {
    const coverage = metrics?.testCoverage ?? 0;
    const status = coverage >= 80 ? 'good' : coverage >= 50 ? 'warning' : 'critical';
    return {
      name: 'Testing',
      score: coverage,
      weight: 1.5,
      trend: 'stable',
      metrics: [{ name: 'Test Coverage', value: coverage, status, threshold: { warning: 80, critical: 50 } }]
    };
  }

  public getSecurityHealth(projectPath: string, metrics?: AllMetrics): HealthDimension {
    const issues = metrics?.securityIssues ?? 0;
    const status = issues === 0 ? 'good' : issues <= 5 ? 'warning' : 'critical';
    return {
      name: 'Security',
      score: Math.max(100 - issues * 10, 0),
      weight: 2,
      trend: 'improving',
      metrics: [{ name: 'Security Issues', value: issues, status, threshold: { warning: 1, critical: 5 } }]
    };
  }

  public getPerformanceHealth(metrics: AllMetrics): HealthDimension {
    const latency = metrics?.p95Latency ?? 0;
    const status = latency < 200 ? 'good' : latency < 500 ? 'warning' : 'critical';
    return {
      name: 'Performance',
      score: Math.max(100 - (latency / 10), 0),
      weight: 1.5,
      trend: 'stable',
      metrics: [{ name: 'p95 Latency', value: latency, status, threshold: { warning: 200, critical: 500 } }]
    };
  }

  public getArchitectureHealth(projectPath: string): HealthDimension {
    return {
      name: 'Architecture',
      score: 85,
      weight: 1.0,
      trend: 'stable',
      metrics: [{ name: 'Modularity', value: 85, status: 'good', threshold: { warning: 70, critical: 50 } }]
    };
  }

  public getTechDebtHealth(metrics: AllMetrics): HealthDimension {
    const debtHours = metrics?.debtHours ?? 0;
    const status = debtHours < 20 ? 'good' : debtHours < 100 ? 'warning' : 'critical';
    return {
      name: 'Tech Debt',
      score: Math.max(100 - debtHours, 0),
      weight: 1.0,
      trend: 'degrading',
      metrics: [{ name: 'Debt Hours', value: debtHours, status, threshold: { warning: 20, critical: 100 } }]
    };
  }

  public getDependencyHealth(metrics: AllMetrics): HealthDimension {
    const outdated = metrics?.outdatedDeps ?? 0;
    const status = outdated < 5 ? 'good' : outdated < 20 ? 'warning' : 'critical';
    return {
      name: 'Dependencies',
      score: Math.max(100 - outdated * 2, 0),
      weight: 1.0,
      trend: 'stable',
      metrics: [{ name: 'Outdated Dependencies', value: outdated, status, threshold: { warning: 5, critical: 20 } }]
    };
  }

  public getDeploymentHealth(metrics: AllMetrics): HealthDimension {
    const rate = metrics?.deploySuccessRate ?? 100;
    const status = rate >= 95 ? 'good' : rate >= 80 ? 'warning' : 'critical';
    return {
      name: 'Deployment',
      score: rate,
      weight: 1.5,
      trend: 'stable',
      metrics: [{ name: 'Success Rate', value: rate, status, threshold: { warning: 95, critical: 80 } }]
    };
  }

  public getMonitoringHealth(metrics: AllMetrics): HealthDimension {
    const uptime = metrics?.uptimePercent ?? 100;
    const status = uptime >= 99.9 ? 'good' : uptime >= 99.0 ? 'warning' : 'critical';
    return {
      name: 'Monitoring',
      score: uptime,
      weight: 2.0,
      trend: 'stable',
      metrics: [{ name: 'Uptime', value: uptime, status, threshold: { warning: 99.9, critical: 99.0 } }]
    };
  }

  public generateReport(health: ProjectHealthReport): string {
    let report = `# Project Health Report\n\n`;
    report += `**Project ID:** ${health.projectId}\n`;
    report += `**Overall Score:** ${health.overallScore}/100 (Grade: ${health.grade})\n`;
    report += `**Generated At:** ${health.generatedAt.toISOString()}\n\n`;

    report += `## Critical Issues\n`;
    if (health.criticalIssues.length > 0) {
      health.criticalIssues.forEach(issue => report += `- ${issue}\n`);
    } else {
      report += `- None\n`;
    }

    report += `\n## Dimensions\n`;
    health.dimensions.forEach(dim => {
      report += `### ${dim.name} (Score: ${dim.score}, Trend: ${dim.trend})\n`;
      dim.metrics.forEach(metric => {
        report += `- **${metric.name}**: ${metric.value} [${metric.status.toUpperCase()}]\n`;
      });
    });

    report += `\n## Recommendations\n`;
    health.recommendations.forEach(rec => report += `- ${rec}\n`);

    return report;
  }

  public generateBadge(score: number): string {
    const color = score >= 90 ? 'brightgreen' : score >= 80 ? 'green' : score >= 70 ? 'yellow' : score >= 60 ? 'orange' : 'red';
    return `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="20"><rect width="100" height="20" fill="${color}"/><text x="50" y="15" fill="white" text-anchor="middle">Health: ${score}</text></svg>`;
  }
}

export const projectHealth = new ProjectHealthService();
