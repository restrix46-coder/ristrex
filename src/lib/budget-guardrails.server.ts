import { getSql } from '@/lib/db';
import { emit } from './event-bus.server';

export const BUDGET_TABLE_MIGRATION = `
CREATE TABLE IF NOT EXISTS project_budgets (
  project_id TEXT PRIMARY KEY,
  max_cost_usd REAL NOT NULL DEFAULT 0,
  max_tokens INTEGER NOT NULL DEFAULT 0,
  max_api_calls INTEGER NOT NULL DEFAULT 0,
  max_agent_minutes INTEGER NOT NULL DEFAULT 0,
  max_storage_bytes BIGINT NOT NULL DEFAULT 0,
  used_cost_usd REAL NOT NULL DEFAULT 0,
  used_tokens INTEGER NOT NULL DEFAULT 0,
  used_api_calls INTEGER NOT NULL DEFAULT 0,
  used_agent_minutes INTEGER NOT NULL DEFAULT 0,
  used_storage_bytes BIGINT NOT NULL DEFAULT 0
);
`;

export interface BudgetLimits {
  maxCostUsd: number;
  maxTokens: number;
  maxApiCalls: number;
  maxAgentMinutes: number;
  maxStorageBytes: number;
}

export interface BudgetUsage extends BudgetLimits {
  usedCostUsd: number;
  usedTokens: number;
  usedApiCalls: number;
  usedAgentMinutes: number;
  usedStorageBytes: number;
  percentUsed: number;
  remainingUsd: number;
}

export class BudgetExceededError extends Error {
  public statusCode = 402;
  constructor(public details: string) {
    super(`Budget Exceeded: ${details}`);
    this.name = 'BudgetExceededError';
  }
}

/**
 * Checks if the estimated cost will exceed the budget limits
 * @param projectId Project ID
 * @param estimatedCostUsd Estimated cost
 */
export async function checkBudget(projectId: string, estimatedCostUsd: number): Promise<void> {
  const sql = getSql();
  const [row] = await sql`
    SELECT max_cost_usd, used_cost_usd 
    FROM project_budgets 
    WHERE project_id = ${projectId}
  `;
  if (!row) return;

  if (row.used_cost_usd + estimatedCostUsd > row.max_cost_usd) {
    throw new BudgetExceededError(`Project ${projectId} will exceed max cost of ${row.max_cost_usd} USD.`);
  }
}

/**
 * Records usage to the database and emits event if near budget
 * @param projectId Project ID
 * @param usage Usage details
 */
export async function recordUsage(projectId: string, usage: Partial<BudgetUsage>): Promise<void> {
  const sql = getSql();
  
  await sql`
    UPDATE project_budgets
    SET
      used_cost_usd = used_cost_usd + ${usage.usedCostUsd || 0},
      used_tokens = used_tokens + ${usage.usedTokens || 0},
      used_api_calls = used_api_calls + ${usage.usedApiCalls || 0},
      used_agent_minutes = used_agent_minutes + ${usage.usedAgentMinutes || 0},
      used_storage_bytes = used_storage_bytes + ${usage.usedStorageBytes || 0}
    WHERE project_id = ${projectId}
  `;

  const status = await getBudgetStatus(projectId);
  if (status && status.percentUsed >= 90) {
    emit('BudgetExceeded', { 
      projectId, 
      estimatedCostUsd: status.usedCostUsd, 
      limitUsd: status.maxCostUsd 
    });
  }
}

/**
 * Gets the current budget status
 * @param projectId Project ID
 */
export async function getBudgetStatus(projectId: string): Promise<BudgetUsage | null> {
  const sql = getSql();
  const [row] = await sql`SELECT * FROM project_budgets WHERE project_id = ${projectId}`;
  
  if (!row) return null;
  
  const remainingUsd = row.max_cost_usd - row.used_cost_usd;
  const percentUsed = row.max_cost_usd > 0 ? (row.used_cost_usd / row.max_cost_usd) * 100 : 0;

  return {
    maxCostUsd: row.max_cost_usd,
    maxTokens: row.max_tokens,
    maxApiCalls: row.max_api_calls,
    maxAgentMinutes: row.max_agent_minutes,
    maxStorageBytes: row.max_storage_bytes,
    usedCostUsd: row.used_cost_usd,
    usedTokens: row.used_tokens,
    usedApiCalls: row.used_api_calls,
    usedAgentMinutes: row.used_agent_minutes,
    usedStorageBytes: row.used_storage_bytes,
    percentUsed,
    remainingUsd
  };
}

/**
 * Sets budget limits for a project
 * @param projectId Project ID
 * @param limits Limits definition
 */
export async function setBudgetLimits(projectId: string, limits: BudgetLimits): Promise<void> {
  const sql = getSql();
  await sql`
    INSERT INTO project_budgets (
      project_id, max_cost_usd, max_tokens, max_api_calls, max_agent_minutes, max_storage_bytes
    ) VALUES (
      ${projectId}, ${limits.maxCostUsd}, ${limits.maxTokens}, ${limits.maxApiCalls}, ${limits.maxAgentMinutes}, ${limits.maxStorageBytes}
    )
    ON CONFLICT (project_id) DO UPDATE SET
      max_cost_usd = EXCLUDED.max_cost_usd,
      max_tokens = EXCLUDED.max_tokens,
      max_api_calls = EXCLUDED.max_api_calls,
      max_agent_minutes = EXCLUDED.max_agent_minutes,
      max_storage_bytes = EXCLUDED.max_storage_bytes
  `;
}
