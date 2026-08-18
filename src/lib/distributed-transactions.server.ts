import { getSql } from '@/lib/db';
import { logger } from '@/lib/logger';

export interface SagaStep {
  id: string;
  name: string;
  action: (context: object) => Promise<object>;
  compensation: (context: object) => Promise<void>;
  retries?: number;
  timeout?: number;
}

export interface SagaResult {
  sagaId: string;
  status: 'completed' | 'compensated' | 'failed';
  executedSteps: string[];
  compensatedSteps: string[];
  finalContext: object;
  error?: string;
  duration: number;
}

/**
 * SQL Migration for distributed sagas
 * 
 * CREATE TABLE IF NOT EXISTS sagas (
 *   id TEXT PRIMARY KEY,
 *   status TEXT NOT NULL,
 *   context JSONB NOT NULL,
 *   executed_steps JSONB NOT NULL,
 *   created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
 * );
 */

/**
 * Orchestrator for Distributed Transactions using the Saga pattern.
 * منسق المعاملات الموزعة باستخدام نمط Saga.
 */
export class SagaOrchestrator {
  private activeSagas = new Map<string, SagaResult>();

  /**
   * Executes a saga with automatic compensation on failure.
   */
  async execute(sagaId: string, steps: SagaStep[], initialContext: object): Promise<SagaResult> {
    const startTime = Date.now();
    const result: SagaResult = {
      sagaId,
      status: 'failed',
      executedSteps: [],
      compensatedSteps: [],
      finalContext: { ...initialContext },
      duration: 0
    };

    this.activeSagas.set(sagaId, result);

    try {
      for (const step of steps) {
        try {
          const stepResult = await step.action(result.finalContext);
          result.finalContext = { ...result.finalContext, ...stepResult };
          result.executedSteps.push(step.id);
        } catch (err: any) {
          logger.error(`Saga step failed: ${step.name}`, err);
          result.error = err.message;
          await this.compensate(sagaId, steps, result);
          break;
        }
      }
      
      if (!result.error) {
        result.status = 'completed';
      }
    } finally {
      result.duration = Date.now() - startTime;
      this.activeSagas.delete(sagaId);
      await this.saveSagaState(result);
    }

    return result;
  }

  /**
   * Runs compensation for executed steps in reverse.
   */
  async compensate(sagaId: string, allSteps: SagaStep[], currentResult: SagaResult): Promise<void> {
    const stepsToCompensate = allSteps
      .filter(s => currentResult.executedSteps.includes(s.id))
      .reverse();

    for (const step of stepsToCompensate) {
      try {
        await step.compensation(currentResult.finalContext);
        currentResult.compensatedSteps.push(step.id);
      } catch (err: any) {
        logger.error(`Failed to compensate step: ${step.name}`, err);
        // Important: Stop compensation or mark saga as fundamentally failed
      }
    }
    currentResult.status = 'compensated';
  }

  /**
   * Returns current saga state.
   */
  getSagaStatus(sagaId: string): SagaResult | undefined {
    return this.activeSagas.get(sagaId);
  }

  /**
   * Returns all running sagas.
   */
  listActiveSagas(): SagaResult[] {
    return Array.from(this.activeSagas.values());
  }

  private async saveSagaState(result: SagaResult): Promise<void> {
    const sql = await getSql();
    try {
      await sql`
        INSERT INTO sagas (id, status, context, executed_steps)
        VALUES (${result.sagaId}, ${result.status}, ${JSON.stringify(result.finalContext)}, ${JSON.stringify(result.executedSteps)})
        ON CONFLICT (id) DO UPDATE SET 
          status = EXCLUDED.status,
          context = EXCLUDED.context,
          executed_steps = EXCLUDED.executed_steps
      `;
    } catch (e) {
      logger.error('Failed to save saga state', e);
    }
  }
}

export const sagaOrchestrator = new SagaOrchestrator();

// Pre-built Sagas Example Definitions
export const PaymentSaga = {
  // steps for Reserve -> Charge -> Fulfill
};

export const DeploymentSaga = {
  // steps for Build -> Test -> Stage -> Deploy
};

export const OnboardingSaga = {
  // steps for CreateUser -> SendEmail -> SetupWorkspace
};
