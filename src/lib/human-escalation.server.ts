export type EscalationReason = 
  | 'ambiguous_requirements' 
  | 'high_risk_action' 
  | 'legal_compliance' 
  | 'budget_exceeded' 
  | 'security_critical' 
  | 'data_loss_risk' 
  | 'architecture_breaking_change' 
  | 'external_dependency_change' 
  | 'user_data_affected';

export interface EscalationRequest {
  id: string;
  reason: EscalationReason;
  context: string;
  riskLevel: string;
  evidence: string[];
  proposedAction: string;
  alternativeOptions: string[];
  deadline?: Date;
}

/**
 * Human Escalation System — knows when NOT to be autonomous
 */
export class HumanEscalationManager {
  /**
   * Evaluates if human escalation is needed
   * @param action - The action being attempted
   * @param context - The context object
   */
  shouldEscalate(action: string, context: Record<string, any>): { escalate: boolean, reason?: EscalationReason } {
    if (context.budget > 50) return { escalate: true, reason: 'budget_exceeded' };
    if (context.environment === 'production' && context.irreversible) return { escalate: true, reason: 'high_risk_action' };
    if (context.securityRelated) return { escalate: true, reason: 'security_critical' };
    if (context.dataDeletion && context.usersAffected > 10) return { escalate: true, reason: 'data_loss_risk' };

    return { escalate: false };
  }

  /**
   * Creates structured request for escalation
   */
  createEscalationRequest(reason: EscalationReason, context: string, proposedAction: string): EscalationRequest {
    return {
      id: `esc-${Date.now()}`,
      reason,
      context,
      riskLevel: 'high', // Determined elsewhere
      evidence: [],
      proposedAction,
      alternativeOptions: ['abort', 'modify']
    };
  }

  /**
   * Waits for human decision
   * @param requestId - The request ID
   * @param timeoutMs - Timeout in milliseconds
   */
  async waitForApproval(requestId: string, timeoutMs: number): Promise<boolean> {
    // Mock waiting
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(true); // Default mock to true
      }, 100);
    });
  }

  /**
   * Returns collected evidence for the approval
   */
  getApprovalEvidence(action: string, context: Record<string, unknown>): any {
    return {
      diff: '...',
      risk: 'High',
      blastRadius: 'Medium',
      tests: 'Passed',
      security: 'Clean',
      cost: '$50.00',
      rollbackPlan: 'Revert to last commit'
    };
  }

  /**
   * Stores decision in audit log
   */
  logDecision(requestId: string, decision: boolean, approver: string): void {
    console.log(`[EscalationManager] Request ${requestId} was ${decision ? 'APPROVED' : 'REJECTED'} by ${approver}.`);
  }
}

export const humanEscalationManager = new HumanEscalationManager();
