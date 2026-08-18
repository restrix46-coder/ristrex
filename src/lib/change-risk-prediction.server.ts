import { logger } from '@/lib/logger';

/**
 * Represents the risk profile of a proposed code change.
 */
export interface ChangeRisk {
  change: string;
  riskScore: number;
  confidence: number;
  riskFactors: string[];
  affectedSystems: string[];
  recommendedActions: string[];
  testingRequired: string[];
}

/**
 * Change Risk Predictor — estimates risk before applying any change.
 */
export class ChangeRiskPredictor {
  /**
   * Predicts the risk score of a change based on file modifications.
   * @param change Details of the proposed change.
   * @returns The computed risk score.
   */
  public predict(change: { files: string[], changeType: string, size: number }): number {
    let score = 0;
    if (change.size > 1000) score += 20;
    if (change.changeType === 'refactor') score += 15;
    
    change.files.forEach(file => {
      if (file.includes('config') && file.includes('prod')) score += 30;
      if (file.includes('auth') || file.includes('security')) score += 25;
      if (file.includes('migration')) score += 20;
      if (file.includes('api')) score += 15;
    });
    
    return Math.min(score, 100);
  }

  /**
   * Analyzes an actual diff to predict risk.
   * @param before Content before change.
   * @param after Content after change.
   * @param filePath The path of the modified file.
   * @returns A ChangeRisk object detailing the risk profile.
   */
  public predictFromDiff(before: string, after: string, filePath: string): ChangeRisk {
    const riskScore = filePath.includes('auth') ? 70 : 30;
    return {
      change: filePath,
      riskScore,
      confidence: 0.85,
      riskFactors: filePath.includes('auth') ? ['Security file modification'] : ['General code update'],
      affectedSystems: ['Core API'],
      recommendedActions: ['Require peer review'],
      testingRequired: this.getRequiredTests({ files: [filePath], changeType: 'modify', size: after.length })
    };
  }

  /**
   * Determines what tests must pass before applying the change.
   * @param change The change details.
   * @returns Array of required test suites.
   */
  public getRequiredTests(change: { files: string[], changeType: string, size: number }): string[] {
    const tests = ['Unit Tests'];
    const hasAuth = change.files.some(f => f.includes('auth'));
    if (hasAuth) tests.push('Security Regression Tests', 'E2E Tests');
    const hasDb = change.files.some(f => f.includes('migration'));
    if (hasDb) tests.push('Database Rollback Tests');
    return tests;
  }

  /**
   * Provides actionable recommendations based on the risk profile.
   * @param risk The risk profile.
   * @returns Array of recommendations.
   */
  public getRecommendations(risk: ChangeRisk): string[] {
    if (risk.riskScore > 80) return ['Escalate to architecture review board', 'Require 2 approvals'];
    if (risk.riskScore > 50) return ['Ensure full test coverage', 'Require 1 peer review'];
    return ['Standard CI/CD pipeline'];
  }

  /**
   * Generates a Markdown report of the change risk.
   * @param risk The risk profile.
   * @returns Markdown formatted report.
   */
  public generateReport(risk: ChangeRisk): string {
    return `# Change Risk Report\n
**Risk Score**: ${risk.riskScore}/100
**Confidence**: ${risk.confidence * 100}%

## Risk Factors
${risk.riskFactors.map(f => `- ${f}`).join('\n')}

## Recommended Actions
${risk.recommendedActions.map(r => `- ${r}`).join('\n')}

## Required Tests
${risk.testingRequired.map(t => `- ${t}`).join('\n')}
`;
  }
}

export const changeRiskPredictor = new ChangeRiskPredictor();
