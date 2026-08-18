import { getSql } from '@/lib/db';
import { logger } from '@/lib/logger';

/**
 * Migration string for multi-tenant setup.
 * Create organizations, org_members, and org_quotas tables.
 */
export const MULTI_TENANT_MIGRATION = `
CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(255) UNIQUE NOT NULL,
  plan VARCHAR(50) DEFAULT 'free',
  owner_id UUID NOT NULL,
  settings JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS org_members (
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  role VARCHAR(50) DEFAULT 'member',
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (org_id, user_id)
);

CREATE TABLE IF NOT EXISTS org_quotas (
  org_id UUID PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
  max_projects INT DEFAULT 3,
  max_users INT DEFAULT 5,
  max_storage_gb INT DEFAULT 5,
  max_agent_minutes_per_month INT DEFAULT 100,
  current_usage JSONB DEFAULT '{"projects": 0, "users": 1, "storage_gb": 0, "agent_minutes": 0}'::jsonb
);
`;

/** Represents an Organization */
export interface Organization {
  id: string;
  name: string;
  slug: string;
  plan: string;
  ownerId: string;
  settings: Record<string, any>;
  createdAt: Date;
}

/** Represents a Team */
export interface Team {
  id: string;
  orgId: string;
  name: string;
  members: TeamMember[];
}

/** Represents an Organization Member */
export interface TeamMember {
  userId: string;
  role: string;
  joinedAt: Date;
}

/** Represents Organization Quotas */
export interface OrgQuota {
  orgId: string;
  maxProjects: number;
  maxUsers: number;
  maxStorageGb: number;
  maxAgentMinutesPerMonth: number;
  currentUsage: Record<string, number>;
}

/**
 * Error thrown when a quota is exceeded.
 */
export class QuotaExceededError extends Error {
  public statusCode = 429;

  constructor(message: string) {
    super(message);
    this.name = 'QuotaExceededError';
  }
}

/**
 * Service for managing organizations, members, and quotas.
 */
export class OrganizationService {
  /**
   * Create a new organization
   * @param name - The name of the organization
   * @param ownerId - The ID of the owner
   * @returns The created organization
   */
  async createOrg(name: string, ownerId: string): Promise<Organization> {
    const sql = getSql();
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + Math.random().toString(36).substring(2, 8);
    
    try {
      const orgs = await sql<any[]>`
        INSERT INTO organizations (name, slug, owner_id)
        VALUES (${name}, ${slug}, ${ownerId})
        RETURNING id, name, slug, plan, owner_id as "ownerId", settings, created_at as "createdAt"
      `;
      
      const org = orgs[0] as Organization;

      await sql`
        INSERT INTO org_members (org_id, user_id, role)
        VALUES (${org.id}, ${ownerId}, 'owner')
      `;

      await sql`
        INSERT INTO org_quotas (org_id)
        VALUES (${org.id})
      `;

      logger.info(`Organization created: ${org.id}`);
      return org;
    } catch (error) {
      logger.error('Failed to create organization', { error });
      throw new Error('Failed to create organization');
    }
  }

  /**
   * Retrieve an organization by ID
   * @param orgId - The ID of the organization
   * @returns The organization object
   */
  async getOrg(orgId: string): Promise<Organization> {
    const sql = getSql();
    try {
      const orgs = await sql<any[]>`
        SELECT id, name, slug, plan, owner_id as "ownerId", settings, created_at as "createdAt"
        FROM organizations
        WHERE id = ${orgId}
      `;
      if (!orgs.length) {
        throw new Error('Organization not found');
      }
      return orgs[0] as Organization;
    } catch (error) {
      logger.error(`Failed to fetch org ${orgId}`, { error });
      throw error;
    }
  }

  /**
   * Add a member to an organization
   * @param orgId - The ID of the organization
   * @param userId - The ID of the user to add
   * @param role - The role of the user
   * @returns The newly added team member
   */
  async addMember(orgId: string, userId: string, role: string = 'member'): Promise<TeamMember> {
    const sql = getSql();
    try {
      await this.checkQuota(orgId, 'users', 1);

      const members = await sql<any[]>`
        INSERT INTO org_members (org_id, user_id, role)
        VALUES (${orgId}, ${userId}, ${role})
        ON CONFLICT (org_id, user_id) DO UPDATE SET role = ${role}
        RETURNING user_id as "userId", role, joined_at as "joinedAt"
      `;

      await this.updateQuotaUsage(orgId, 'users', 1);
      return members[0] as TeamMember;
    } catch (error) {
      logger.error(`Failed to add member ${userId} to org ${orgId}`, { error });
      throw error;
    }
  }

  /**
   * Remove a member from an organization
   * @param orgId - The ID of the organization
   * @param userId - The ID of the user to remove
   */
  async removeMember(orgId: string, userId: string): Promise<void> {
    const sql = getSql();
    try {
      await sql`
        DELETE FROM org_members
        WHERE org_id = ${orgId} AND user_id = ${userId}
      `;
      await this.updateQuotaUsage(orgId, 'users', -1);
      logger.info(`Removed member ${userId} from org ${orgId}`);
    } catch (error) {
      logger.error(`Failed to remove member ${userId} from org ${orgId}`, { error });
      throw new Error('Failed to remove member');
    }
  }

  /**
   * Get all members of an organization
   * @param orgId - The ID of the organization
   * @returns A list of team members
   */
  async getMembers(orgId: string): Promise<TeamMember[]> {
    const sql = getSql();
    try {
      const members = await sql<any[]>`
        SELECT user_id as "userId", role, joined_at as "joinedAt"
        FROM org_members
        WHERE org_id = ${orgId}
      `;
      return members as TeamMember[];
    } catch (error) {
      logger.error(`Failed to get members for org ${orgId}`, { error });
      throw new Error('Failed to get members');
    }
  }

  /**
   * Check if a resource quota is exceeded for an organization
   * @param orgId - The ID of the organization
   * @param resource - The resource to check (projects, users, etc.)
   * @param amount - The amount to increase by
   * @returns true if allowed, throws if exceeded
   */
  async checkQuota(orgId: string, resource: string, amount: number): Promise<boolean> {
    const sql = getSql();
    try {
      const quotas = await sql<any[]>`
        SELECT max_projects as "maxProjects", max_users as "maxUsers", 
               max_storage_gb as "maxStorageGb", max_agent_minutes_per_month as "maxAgentMinutesPerMonth",
               current_usage as "currentUsage"
        FROM org_quotas
        WHERE org_id = ${orgId}
      `;
      if (!quotas.length) {
        throw new Error('Quota record not found');
      }

      const quota = quotas[0] as OrgQuota;
      const current = quota.currentUsage[resource] || 0;
      
      let max = Infinity;
      if (resource === 'projects') max = quota.maxProjects;
      else if (resource === 'users') max = quota.maxUsers;
      else if (resource === 'storage_gb') max = quota.maxStorageGb;
      else if (resource === 'agent_minutes') max = quota.maxAgentMinutesPerMonth;

      if (current + amount > max) {
        throw new QuotaExceededError(`Quota exceeded for ${resource}. Maximum allowed: ${max}`);
      }

      return true;
    } catch (error) {
      if (error instanceof QuotaExceededError) throw error;
      logger.error(`Failed to check quota for org ${orgId}`, { error });
      throw new Error('Failed to check quota');
    }
  }

  /**
   * Update the usage of a specific resource quota
   * @param orgId - The ID of the organization
   * @param resource - The resource to update
   * @param delta - The change in usage
   */
  async updateQuotaUsage(orgId: string, resource: string, delta: number): Promise<void> {
    const sql = getSql();
    try {
      await sql`
        UPDATE org_quotas
        SET current_usage = jsonb_set(
          COALESCE(current_usage, '{}'::jsonb),
          array[${resource}],
          (COALESCE((current_usage->>${resource})::int, 0) + ${delta})::text::jsonb
        )
        WHERE org_id = ${orgId}
      `;
    } catch (error) {
      logger.error(`Failed to update quota usage for org ${orgId}`, { error });
      throw new Error('Failed to update quota usage');
    }
  }

  /**
   * Get organization stats and usage
   * @param orgId - The ID of the organization
   * @returns Organization quota summary
   */
  async getOrgStats(orgId: string): Promise<OrgQuota> {
    const sql = getSql();
    try {
      const stats = await sql<any[]>`
        SELECT org_id as "orgId", max_projects as "maxProjects", max_users as "maxUsers",
               max_storage_gb as "maxStorageGb", max_agent_minutes_per_month as "maxAgentMinutesPerMonth",
               current_usage as "currentUsage"
        FROM org_quotas
        WHERE org_id = ${orgId}
      `;
      if (!stats.length) {
        throw new Error('Organization stats not found');
      }
      return stats[0] as OrgQuota;
    } catch (error) {
      logger.error(`Failed to get stats for org ${orgId}`, { error });
      throw new Error('Failed to get org stats');
    }
  }
}
