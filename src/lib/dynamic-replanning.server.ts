import { getSql } from '@/lib/db.server';
import { logger } from '@/lib/logger.server';

export interface PlanStep {
  id: string;
  description: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  agentType: string;
  dependencies: string[];
  result?: any;
  error?: any;
}

export interface ExecutionPlan {
  id: string;
  steps: PlanStep[];
  currentStep: string | null;
  status: 'pending' | 'active' | 'completed' | 'failed' | 'replanning';
  replannedAt?: string;
}

export class DynamicPlanner {
  /**
   * Generates an initial execution plan based on requirements.
   * يولد خطة تنفيذ أولية بناءً على المتطلبات.
   */
  async createPlan(requirements: Record<string, any>): Promise<ExecutionPlan> {
    logger.info('Creating execution plan...');
    const plan: ExecutionPlan = {
      id: crypto.randomUUID(),
      steps: [
        { id: 'step-1', description: 'Analyze requirements', status: 'pending', agentType: 'RequirementsAgent', dependencies: [] }
      ],
      currentStep: 'step-1',
      status: 'pending',
    };
    await this.persistPlan(plan);
    return plan;
  }

  /**
   * Executes the plan step by step, calling onStep for each.
   * ينفذ الخطة خطوة بخطوة.
   */
  async executePlan(plan: ExecutionPlan, onStep: (step: PlanStep) => Promise<any>): Promise<void> {
    plan.status = 'active';
    await this.persistPlan(plan);

    for (const step of plan.steps) {
      if (step.status !== 'pending') continue;

      plan.currentStep = step.id;
      step.status = 'running';
      await this.persistPlan(plan);

      try {
        const result = await onStep(step);
        step.status = 'completed';
        step.result = result;
        await this.observe(plan, result);
      } catch (error) {
        step.status = 'failed';
        step.error = error;
        await this.replan(plan, step, error);
        break; // Stop execution to allow replanning
      }
      await this.persistPlan(plan);
    }

    if (!plan.steps.some(s => s.status === 'failed' || s.status === 'pending')) {
      plan.status = 'completed';
      plan.currentStep = null;
      await this.persistPlan(plan);
    }
  }

  /**
   * Observes the result of a step and evaluates if replanning is needed.
   * يراقب نتيجة الخطوة ويقيم ما إذا كانت إعادة التخطيط مطلوبة.
   */
  async observe(plan: ExecutionPlan, stepResult: any): Promise<void> {
    logger.info('Observing step result for plan...', { planId: plan.id });
    // Logic to detect anomalies and trigger replan could go here.
  }

  /**
   * Generates new steps for the failed portion and updates the plan.
   * يولد خطوات جديدة للجزء الفاشل ويحدث الخطة.
   */
  async replan(plan: ExecutionPlan, failedStep: PlanStep, error: any): Promise<ExecutionPlan> {
    logger.warn('Replanning due to failure...', { stepId: failedStep.id, error });
    plan.status = 'replanning';
    plan.replannedAt = new Date().toISOString();
    
    // Simulate replanning logic by adding a recovery step
    const recoveryStep: PlanStep = {
      id: crypto.randomUUID(),
      description: `Recover from failure in ${failedStep.description}`,
      status: 'pending',
      agentType: 'RecoveryAgent',
      dependencies: []
    };
    
    plan.steps.push(recoveryStep);
    plan.currentStep = recoveryStep.id;
    plan.status = 'active';
    
    await this.persistPlan(plan);
    return plan;
  }

  /**
   * Returns the current state of a plan.
   * يرجع الحالة الحالية للخطة.
   */
  async getPlanStatus(planId: string): Promise<ExecutionPlan | null> {
    const sql = getSql();
    const [record] = await sql`SELECT plan_data FROM execution_plans WHERE id = ${planId}`;
    if (record) {
      return record.plan_data as ExecutionPlan;
    }
    return null;
  }

  private async persistPlan(plan: ExecutionPlan) {
    try {
      const sql = getSql();
      await sql`
        INSERT INTO execution_plans (id, plan_data)
        VALUES (${plan.id}, ${JSON.stringify(plan)})
        ON CONFLICT (id) DO UPDATE SET plan_data = ${JSON.stringify(plan)}
      `;
    } catch (e) {
      logger.error('Failed to persist execution plan.', { error: e });
    }
  }
}

/**
 * SQL MIGRATION:
 * CREATE TABLE IF NOT EXISTS execution_plans (
 *   id TEXT PRIMARY KEY,
 *   plan_data JSONB NOT NULL
 * );
 */
