import { systemGraph } from './system-graph.server.ts';
import { digitalTwin } from './digital-twin.server.ts';

export interface BlastRadiusResult {
  changeTarget: string;
  affectedFiles: string[];
  affectedModules: string[];
  affectedAPIs: string[];
  affectedUsers: number;
  affectedServices: string[];
  riskLevel: 'critical' | 'high' | 'medium' | 'low';
  confidence: number;
  details: string;
}

/**
 * Blast Radius Analysis before every change
 */
export class BlastRadiusAnalyzer {
  /**
   * Computes full blast radius using SystemGraph
   * @param changeTarget - The ID of the node to change
   * @param changeType - The type of change
   */
  async analyze(changeTarget: string, changeType: 'modify' | 'delete' | 'rename'): Promise<BlastRadiusResult> {
    const impactNodes = systemGraph.findImpact(changeTarget);
    
    const affectedFiles = impactNodes.filter(n => n.type === 'file').map(n => n.id);
    const affectedModules = impactNodes.filter(n => n.type === 'module').map(n => n.id);
    const affectedAPIs = impactNodes.filter(n => n.type === 'api').map(n => n.id);
    const affectedServices = impactNodes.filter(n => n.type === 'service').map(n => n.id);
    
    const affectedUsers = await this.estimateUserImpact(affectedAPIs);
    
    let riskLevel: 'critical' | 'high' | 'medium' | 'low' = 'low';
    if (affectedUsers > 1000 || affectedServices.length > 3 || changeType === 'delete') riskLevel = 'critical';
    else if (affectedUsers > 100 || affectedAPIs.length > 2) riskLevel = 'high';
    else if (affectedUsers > 10 || affectedFiles.length > 5) riskLevel = 'medium';

    return {
      changeTarget,
      affectedFiles,
      affectedModules,
      affectedAPIs,
      affectedUsers,
      affectedServices,
      riskLevel,
      confidence: 0.85,
      details: `Analyzed ${impactNodes.length} dependent nodes.`
    };
  }

  /**
   * Estimates how many users are affected
   * @param affectedAPIs - List of affected API IDs
   */
  async estimateUserImpact(affectedAPIs: string[]): Promise<number> {
    // In a real scenario, this would query logs or the Digital Twin to see how many users use these APIs
    return affectedAPIs.length * 100; // Mock estimation
  }

  /**
   * Generates a markdown report for the blast radius
   * @param result - The blast radius result object
   */
  generateReport(result: BlastRadiusResult): string {
    return `
# Blast Radius Report
**Target:** ${result.changeTarget}
**Risk Level:** ${result.riskLevel.toUpperCase()}
**Confidence:** ${result.confidence * 100}%

## Affected Components
- **Files:** ${result.affectedFiles.length} (${result.affectedFiles.join(', ')})
- **Modules:** ${result.affectedModules.length} (${result.affectedModules.join(', ')})
- **APIs:** ${result.affectedAPIs.length} (${result.affectedAPIs.join(', ')})
- **Services:** ${result.affectedServices.length} (${result.affectedServices.join(', ')})

**Estimated User Impact:** ${result.affectedUsers} users

## Details
${result.details}
    `.trim();
  }

  /**
   * Returns true if blast radius is critical or high
   * @param result - The blast radius result object
   */
  isApprovalRequired(result: BlastRadiusResult): boolean {
    return result.riskLevel === 'critical' || result.riskLevel === 'high';
  }
}

export const blastRadiusAnalyzer = new BlastRadiusAnalyzer();
