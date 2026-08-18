import { getSql } from '@/lib/db';

export interface AgentPermissionSet {
  agentId: string;
  taskId: string;
  allowedTools: string[];
  allowedResources: string[];
  allowedDomains: string[];
  maxCostUsd: number;
  maxDurationMs: number;
  canWriteFiles: boolean;
  canExecuteCode: boolean;
  canAccessSecrets: boolean;
  canDeployToProduction: boolean;
  expiresAt: Date;
}

export interface PermissionRequest {
  agentId: string;
  taskId: string;
  requestedTool: string;
  requestedResource: string;
  justification: string;
}

/**
 * Zero-Trust Agent Security — no agent gets permissions beyond what the task requires.
 */
export class ZeroTrustAgentSecurity {
  constructor() {
    this.init();
  }

  private async init() {
    try {
      const sql = await getSql();
      await sql`
        CREATE TABLE IF NOT EXISTS agent_permissions (
          id SERIAL PRIMARY KEY,
          agent_id TEXT NOT NULL,
          task_id TEXT NOT NULL,
          allowed_tools JSONB NOT NULL,
          allowed_resources JSONB NOT NULL,
          allowed_domains JSONB NOT NULL,
          max_cost_usd NUMERIC NOT NULL,
          max_duration_ms BIGINT NOT NULL,
          can_write_files BOOLEAN NOT NULL,
          can_execute_code BOOLEAN NOT NULL,
          can_access_secrets BOOLEAN NOT NULL,
          can_deploy_to_production BOOLEAN NOT NULL,
          expires_at TIMESTAMP WITH TIME ZONE NOT NULL
        );

        CREATE TABLE IF NOT EXISTS agent_permission_audits (
          id SERIAL PRIMARY KEY,
          agent_id TEXT NOT NULL,
          tool TEXT,
          resource TEXT,
          granted BOOLEAN NOT NULL,
          timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
      `;
    } catch (e) {
      console.error('Failed to init ZeroTrustAgentSecurity', e);
    }
  }

  public async grantMinimalPermissions(agentType: string, taskId: string, complexity: string): Promise<AgentPermissionSet> {
    const agentId = `agent_${Date.now()}`; // simple mock
    let permissions: AgentPermissionSet = {
      agentId, taskId,
      allowedTools: [],
      allowedResources: [],
      allowedDomains: [],
      maxCostUsd: 1.0,
      maxDurationMs: 60000,
      canWriteFiles: false,
      canExecuteCode: false,
      canAccessSecrets: false,
      canDeployToProduction: false,
      expiresAt: new Date(Date.now() + 3600000) // 1 hour
    };

    switch (agentType) {
      case 'frontend':
        permissions.canWriteFiles = true;
        permissions.allowedTools = ['read_file', 'write_file', 'browser'];
        break;
      case 'testing':
        permissions.allowedTools = ['read_file', 'run_test'];
        break;
      case 'security':
        permissions.allowedTools = ['read_file', 'scan'];
        break;
      case 'devops':
        permissions.canWriteFiles = true;
        permissions.canExecuteCode = true;
        permissions.canAccessSecrets = true;
        // Deploy to production requires human
        permissions.canDeployToProduction = false;
        permissions.allowedTools = ['read_file', 'write_file', 'run_cmd', 'deploy_staging'];
        break;
      default:
        break;
    }

    const sql = await getSql();
    await sql`
      INSERT INTO agent_permissions (
        agent_id, task_id, allowed_tools, allowed_resources, allowed_domains,
        max_cost_usd, max_duration_ms, can_write_files, can_execute_code,
        can_access_secrets, can_deploy_to_production, expires_at
      ) VALUES (
        ${permissions.agentId}, ${permissions.taskId}, ${JSON.stringify(permissions.allowedTools)}::jsonb,
        ${JSON.stringify(permissions.allowedResources)}::jsonb, ${JSON.stringify(permissions.allowedDomains)}::jsonb,
        ${permissions.maxCostUsd}, ${permissions.maxDurationMs}, ${permissions.canWriteFiles},
        ${permissions.canExecuteCode}, ${permissions.canAccessSecrets}, ${permissions.canDeployToProduction},
        ${permissions.expiresAt}
      )
    `;

    return permissions;
  }

  public checkPermission(permSet: AgentPermissionSet, request: PermissionRequest): boolean {
    if (new Date() > permSet.expiresAt) return false;
    
    if (!permSet.allowedTools.includes(request.requestedTool) && request.requestedTool !== '*') {
      return false;
    }
    
    return true;
  }

  public async revokePermissions(agentId: string, taskId: string): Promise<void> {
    const sql = await getSql();
    await sql`DELETE FROM agent_permissions WHERE agent_id = ${agentId} AND task_id = ${taskId}`;
  }

  public async auditPermissionUse(agentId: string, tool: string, resource: string, granted: boolean): Promise<void> {
    const sql = await getSql();
    await sql`
      INSERT INTO agent_permission_audits (agent_id, tool, resource, granted)
      VALUES (${agentId}, ${tool}, ${resource}, ${granted})
    `;
  }

  public async getPermissionSet(agentId: string, taskId: string): Promise<AgentPermissionSet | null> {
    const sql = await getSql();
    const rows = await sql`
      SELECT * FROM agent_permissions 
      WHERE agent_id = ${agentId} AND task_id = ${taskId}
      ORDER BY id DESC LIMIT 1
    `;
    if (!rows.length) return null;
    const row = rows[0];
    return {
      agentId: row.agent_id,
      taskId: row.task_id,
      allowedTools: typeof row.allowed_tools === 'string' ? JSON.parse(row.allowed_tools) : row.allowed_tools,
      allowedResources: typeof row.allowed_resources === 'string' ? JSON.parse(row.allowed_resources) : row.allowed_resources,
      allowedDomains: typeof row.allowed_domains === 'string' ? JSON.parse(row.allowed_domains) : row.allowed_domains,
      maxCostUsd: Number(row.max_cost_usd),
      maxDurationMs: Number(row.max_duration_ms),
      canWriteFiles: row.can_write_files,
      canExecuteCode: row.can_execute_code,
      canAccessSecrets: row.can_access_secrets,
      canDeployToProduction: row.can_deploy_to_production,
      expiresAt: row.expires_at
    };
  }

  public async generatePermissionReport(agentId: string): Promise<string> {
    const sql = await getSql();
    const rows = await sql`
      SELECT granted, COUNT(*) as count 
      FROM agent_permission_audits 
      WHERE agent_id = ${agentId} 
      GROUP BY granted
    `;
    return `# Permission Report for ${agentId}
Audits: ${JSON.stringify(rows)}
    `;
  }
}

export const zeroTrustSecurity = new ZeroTrustAgentSecurity();
