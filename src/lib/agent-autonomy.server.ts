export enum AutonomyLevel {
  READ_ONLY = 0,
  SUGGEST = 1,
  SANDBOX_EXECUTE = 2,
  STAGING_EXECUTE = 3,
  PRODUCTION_WITH_APPROVAL = 4,
  CONTROLLED_AUTONOMOUS_PRODUCTION = 5
}

export interface AutonomyCondition {
  condition: string;
  requiredLevel: AutonomyLevel;
  requiresHumanApproval: boolean;
}

export interface AutonomyPolicy {
  agentType: string;
  defaultLevel: AutonomyLevel;
  maxLevel: AutonomyLevel;
  conditions: AutonomyCondition[];
}

/**
 * Agent Autonomy Levels system
 */
export class AutonomyController {
  private policies: Map<string, AutonomyPolicy> = new Map();

  constructor() {
    // Default policies
    this.setPolicy({
      agentType: 'default',
      defaultLevel: AutonomyLevel.SANDBOX_EXECUTE,
      maxLevel: AutonomyLevel.PRODUCTION_WITH_APPROVAL,
      conditions: []
    });
    this.setPolicy({
      agentType: 'devops',
      defaultLevel: AutonomyLevel.STAGING_EXECUTE,
      maxLevel: AutonomyLevel.CONTROLLED_AUTONOMOUS_PRODUCTION,
      conditions: []
    });
    this.setPolicy({
      agentType: 'emergency',
      defaultLevel: AutonomyLevel.READ_ONLY,
      maxLevel: AutonomyLevel.READ_ONLY,
      conditions: []
    });
  }

  /**
   * Returns current autonomy level for an agent
   * @param agentType - The type of agent
   * @param action - The action being attempted
   * @param context - Contextual parameters
   */
  getLevel(agentType: string, action: string, context: Record<string, unknown>): AutonomyLevel {
    const policy = this.policies.get(agentType) || this.policies.get('default');
    return policy ? policy.defaultLevel : AutonomyLevel.READ_ONLY;
  }

  /**
   * Checks if an action can be executed
   * @param agentType - The type of agent
   * @param action - The action being attempted
   * @param context - Contextual parameters
   */
  canExecute(agentType: string, action: string, context: Record<string, unknown>): { allowed: boolean, reason: string } {
    const level = this.getLevel(agentType, action, context);
    if (level < AutonomyLevel.SANDBOX_EXECUTE) {
      return { allowed: false, reason: `Insufficient autonomy level (${level}). Needs at least SANDBOX_EXECUTE.` };
    }
    return { allowed: true, reason: 'Autonomy level sufficient.' };
  }

  /**
   * Returns true if human approval is required
   * @param agentType - The type of agent
   * @param action - The action being attempted
   * @param context - Contextual parameters
   */
  requiresApproval(agentType: string, action: string, context: Record<string, unknown>): boolean {
    const level = this.getLevel(agentType, action, context);
    return level === AutonomyLevel.PRODUCTION_WITH_APPROVAL;
  }

  /**
   * Logs an elevation request
   * @param agentType - The type of agent
   * @param targetLevel - The requested level
   * @param reason - The reason for the request
   */
  requestElevation(agentType: string, targetLevel: AutonomyLevel, reason: string): void {
    console.log(`[AutonomyController] Elevation requested for ${agentType} to level ${targetLevel}. Reason: ${reason}`);
  }

  /**
   * Sets policy for an agent type
   * @param policy - The autonomy policy
   */
  setPolicy(policy: AutonomyPolicy): void {
    this.policies.set(policy.agentType, policy);
  }
}

export const autonomyController = new AutonomyController();
