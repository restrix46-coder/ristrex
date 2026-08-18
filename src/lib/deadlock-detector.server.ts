import { logger } from '@/lib/logger';

export interface LockNode {
  id: string;
  resource: string;
  heldBy: string;
  waitingFor: string[];
}

export interface DeadlockCycle {
  nodes: LockNode[];
  description: string;
  resolution: string;
}

export interface DeadlockAnalysis {
  hasDeadlock: boolean;
  cycles: DeadlockCycle[];
  recommendations: string[];
  preventionRules: string[];
}

/**
 * Deadlock Detector finds and resolves deadlocks in critical systems.
 * كاشف الجمود للعثور على حالات الجمود وحلها في الأنظمة الحرجة.
 */
export class DeadlockDetector {
  private currentLocks = new Map<string, LockNode>();

  /**
   * Detects cycles in wait-for graph using DFS.
   */
  detectInGraph(nodes: LockNode[]): DeadlockCycle[] {
    const cycles: DeadlockCycle[] = [];
    const visited = new Set<string>();
    const stack = new Set<string>();
    
    const nodeMap = new Map<string, LockNode>();
    nodes.forEach(n => nodeMap.set(n.heldBy, n));

    const dfs = (holder: string, path: LockNode[]) => {
      visited.add(holder);
      stack.add(holder);
      
      const node = nodeMap.get(holder);
      if (node) {
        for (const waitingForUser of node.waitingFor) {
          if (!visited.has(waitingForUser)) {
            const nextNode = nodeMap.get(waitingForUser);
            if (nextNode) {
              dfs(waitingForUser, [...path, nextNode]);
            }
          } else if (stack.has(waitingForUser)) {
            // Cycle detected
            cycles.push({
              nodes: [...path],
              description: `Deadlock between ${path.map(p => p.heldBy).join(' -> ')} -> ${waitingForUser}`,
              resolution: `Abort transaction for ${waitingForUser}`
            });
          }
        }
      }
      stack.delete(holder);
    };

    for (const node of nodes) {
      if (!visited.has(node.heldBy)) {
        dfs(node.heldBy, [node]);
      }
    }

    return cycles;
  }

  /**
   * Records lock acquisition.
   */
  addLockAcquisition(holder: string, resource: string): void {
    const node = this.currentLocks.get(holder) || { id: holder, resource, heldBy: holder, waitingFor: [] };
    node.resource = resource;
    this.currentLocks.set(holder, node);
  }

  /**
   * Records wait intent.
   */
  addWait(waiter: string, resource: string): void {
    const node = this.currentLocks.get(waiter) || { id: waiter, resource: '', heldBy: waiter, waitingFor: [] };
    
    // Find who holds the resource
    for (const current of this.currentLocks.values()) {
      if (current.resource === resource && current.heldBy !== waiter) {
        if (!node.waitingFor.includes(current.heldBy)) {
          node.waitingFor.push(current.heldBy);
        }
      }
    }
    this.currentLocks.set(waiter, node);
  }

  /**
   * Analyzes current lock graph for deadlocks.
   */
  checkForDeadlock(): DeadlockAnalysis {
    const cycles = this.detectInGraph(Array.from(this.currentLocks.values()));
    const analysis: DeadlockAnalysis = {
      hasDeadlock: cycles.length > 0,
      cycles,
      recommendations: cycles.map(c => this.resolveDeadlock(c)),
      preventionRules: []
    };
    analysis.preventionRules = this.generatePreventionRules(analysis);
    return analysis;
  }

  /**
   * Suggests resolution for a cycle.
   */
  resolveDeadlock(cycle: DeadlockCycle): string {
    return cycle.resolution;
  }

  /**
   * Generates lock ordering rules to prevent future deadlocks.
   */
  generatePreventionRules(analysis: DeadlockAnalysis): string[] {
    if (!analysis.hasDeadlock) return ['System is healthy.'];
    return ['Always acquire locks in a globally consistent order (e.g., alphabetical).'];
  }

  /**
   * Generates a markdown report.
   */
  generateReport(analysis: DeadlockAnalysis): string {
    let report = `# Deadlock Analysis Report\n\n`;
    report += `**Status**: ${analysis.hasDeadlock ? 'DEADLOCK DETECTED' : 'HEALTHY'}\n\n`;
    if (analysis.hasDeadlock) {
      report += `## Cycles\n`;
      for (const cycle of analysis.cycles) {
        report += `- ${cycle.description}\n`;
      }
    }
    return report;
  }
}

export const deadlockDetector = new DeadlockDetector();
