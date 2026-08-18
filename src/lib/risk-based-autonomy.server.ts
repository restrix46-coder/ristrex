export interface ActionRisk {
  action: string;
  riskScore: number;
  riskFactors: string[];
  reversible: boolean;
  blastRadius: 'critical' | 'high' | 'medium' | 'low';
  requiresApproval: boolean;
  conditions: string[];
}

/**
 * Risk-Based Autonomy Decision Engine
 */
export class RiskBasedAutonomy {
  /**
   * Computes risk score 0-100
   * @param action - The action being assessed
   * @param context - Context parameters
   */
  assessRisk(action: string, context: Record<string, unknown>): ActionRisk {
    let score = 0;
    const factors: string[] = [];

    if (context.environment === 'production') { score += 30; factors.push('production environment'); }
    if (context.irreversible) { score += 20; factors.push('irreversible'); }
    if (typeof context.usersAffected === 'number' && context.usersAffected > 100) { score += 25; factors.push('affects >100 users'); }
    if (context.securityRelated) { score += 20; factors.push('security-related'); }
    if (context.dataDeletion) { score += 30; factors.push('data deletion'); }

    score = Math.min(100, Math.max(0, score));

    let blastRadius: 'critical' | 'high' | 'medium' | 'low' = 'low';
    if (score >= 75) blastRadius = 'critical';
    else if (score >= 50) blastRadius = 'high';
    else if (score >= 25) blastRadius = 'medium';

    return {
      action,
      riskScore: score,
      riskFactors: factors,
      reversible: !context.irreversible,
      blastRadius,
      requiresApproval: score >= 50,
      conditions: this.getConditions(action, context)
    };
  }

  /**
   * Returns autonomy decision based on risk
   * @param action - The action being assessed
   * @param context - Context parameters
   */
  decideAutonomy(action: string, context: Record<string, unknown>): 'auto' | 'conditions' | 'approval_required' {
    const risk = this.assessRisk(action, context);
    if (risk.requiresApproval) return 'approval_required';
    if (risk.conditions.length > 0) return 'conditions';
    return 'auto';
  }

  /**
   * Returns extra conditions for medium-risk actions
   * @param action - The action being assessed
   * @param context - Context parameters
   */
  getConditions(action: string, context: Record<string, unknown>): string[] {
    const conditions: string[] = [];
    if (context.environment === 'production' && !context.irreversible) {
      conditions.push('Ensure rollback plan is verified.');
    }
    return conditions;
  }

  /**
   * Generates full risk markdown report
   * @param action - The action being assessed
   * @param context - Context parameters
   */
  getRiskReport(action: string, context: Record<string, unknown>): string {
    const risk = this.assessRisk(action, context);
    return `
# Risk Assessment: ${action}
**Score:** ${risk.riskScore}/100
**Blast Radius:** ${risk.blastRadius.toUpperCase()}
**Requires Approval:** ${risk.requiresApproval ? 'YES' : 'NO'}

## Risk Factors
${risk.riskFactors.map(f => `- ${f}`).join('\n') || 'None'}

## Conditions
${risk.conditions.map(c => `- ${c}`).join('\n') || 'None'}
    `.trim();
  }
}

export const riskBasedAutonomy = new RiskBasedAutonomy();
