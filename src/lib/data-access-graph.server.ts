import { logger } from '@/lib/logger';

export interface DataNode {
  id: string;
  type: 'user_role' | 'agent' | 'service' | 'api_endpoint' | 'table';
  name: string;
}

export interface DataAccess {
  from: DataNode;
  to: DataNode;
  permissions: string[];
  conditions?: string[];
  sensitive: boolean;
}

/**
 * Tracks and visualizes access controls across entities and data tables.
 */
export class DataAccessGraph {
  private edges: DataAccess[] = [];

  /**
   * Registers a new data access relationship.
   * @param access The access configuration.
   */
  public addAccess(access: DataAccess): void {
    try {
      this.edges.push(access);
      logger.info(`Added access from ${access.from.name} to ${access.to.name}`);
    } catch (error) {
      logger.error('Failed to add access relation', error);
      throw new Error('Add access failed');
    }
  }

  /**
   * Determines which entities can access a specific data type/target.
   * @param dataType The ID of the data node.
   * @returns Array of access relationships.
   */
  public whoCanAccess(dataType: string): DataAccess[] {
    return this.edges.filter(edge => edge.to.id === dataType);
  }

  /**
   * Determines what data a specific entity can access.
   * @param entityId The ID of the entity node.
   * @returns Array of access relationships.
   */
  public whatCanAccess(entityId: string): DataAccess[] {
    return this.edges.filter(edge => edge.from.id === entityId);
  }

  /**
   * Finds entities that might have excessive permissions (heuristic based).
   */
  public findOverprivileged(): DataNode[] {
    const accessCount: Record<string, number> = {};
    const overprivileged: DataNode[] = [];

    for (const edge of this.edges) {
      if (edge.from.type !== 'user_role' && edge.from.type !== 'service') continue;
      accessCount[edge.from.id] = (accessCount[edge.from.id] || 0) + 1;
      
      // If an entity has broad access but lacks conditions, flag it
      if (accessCount[edge.from.id] > 5 && overprivileged.findIndex(n => n.id === edge.from.id) === -1) {
        overprivileged.push(edge.from);
      }
    }
    return overprivileged;
  }

  /**
   * Detects sensitive data that is exposed to too many entities.
   */
  public findSensitiveDataExposure(): DataNode[] {
    const sensitiveNodes: Record<string, { node: DataNode, accessors: number }> = {};
    
    for (const edge of this.edges) {
      if (edge.sensitive) {
        if (!sensitiveNodes[edge.to.id]) {
          sensitiveNodes[edge.to.id] = { node: edge.to, accessors: 0 };
        }
        sensitiveNodes[edge.to.id].accessors += 1;
      }
    }

    // Flag if sensitive data is accessed by more than 2 distinct system roles/services
    return Object.values(sensitiveNodes)
      .filter(sn => sn.accessors > 2)
      .map(sn => sn.node);
  }

  /**
   * Detects violations against a set of given access policies.
   */
  public detectViolations(policies: { targetId: string; denyFromTypes: string[] }[]): DataAccess[] {
    const violations: DataAccess[] = [];
    for (const policy of policies) {
      const accesses = this.whoCanAccess(policy.targetId);
      for (const access of accesses) {
        if (policy.denyFromTypes.includes(access.from.type)) {
          violations.push(access);
        }
      }
    }
    return violations;
  }

  /**
   * Generates a mermaid.js representation of the access graph.
   */
  public toMermaid(): string {
    let mermaid = 'graph TD\n';
    const addedNodes = new Set<string>();

    for (const edge of this.edges) {
      if (!addedNodes.has(edge.from.id)) {
        mermaid += `  ${edge.from.id}["${edge.from.name} (${edge.from.type})"]\n`;
        addedNodes.add(edge.from.id);
      }
      if (!addedNodes.has(edge.to.id)) {
        mermaid += `  ${edge.to.id}[("${edge.to.name} (${edge.to.type})")]\n`;
        addedNodes.add(edge.to.id);
      }
      
      const linkStyle = edge.sensitive ? 'stroke:red,stroke-width:2px;' : '';
      mermaid += `  ${edge.from.id} -->|${edge.permissions.join(',')}| ${edge.to.id}\n`;
      if (linkStyle) {
        mermaid += `  style ${edge.to.id} ${linkStyle}\n`;
      }
    }
    return mermaid;
  }

  /**
   * Generates a markdown report summarizing the data access graph risks.
   */
  public generateAccessReport(): string {
    const overprivileged = this.findOverprivileged();
    const exposed = this.findSensitiveDataExposure();

    let md = '# Data Access Graph Report\n\n';
    
    md += '## Overprivileged Entities\n';
    if (overprivileged.length === 0) md += 'None detected.\n\n';
    else {
      overprivileged.forEach(node => md += `- **${node.name}** (${node.type})\n`);
      md += '\n';
    }

    md += '## Exposed Sensitive Data\n';
    if (exposed.length === 0) md += 'No highly exposed sensitive data detected.\n\n';
    else {
      exposed.forEach(node => md += `- **${node.name}** (${node.type})\n`);
      md += '\n';
    }

    md += '## Access Graph\n```mermaid\n' + this.toMermaid() + '```\n';
    return md;
  }
}

export const dataAccessGraph = new DataAccessGraph();
