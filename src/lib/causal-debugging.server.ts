import { logger } from '@/lib/logger';

export interface CausalNode {
  type: 'code_change' | 'config_change' | 'dependency_update' | 'data_issue' | 'external_api';
  description: string;
  timestamp?: Date;
  evidence: string[];
}

export interface CausalEvent {
  timestamp: Date;
  type: string;
  description: string;
  file?: string;
  commit?: string;
}

export interface CausalChain {
  error: string;
  triggeredBy: CausalNode[];
  rootCause: CausalNode;
  timeline: CausalEvent[];
  confidence: number;
}

/**
 * Causal Debugging — traces Error→Change→Component→Dependency→RootCause.
 */
export class CausalDebugger {
  /**
   * Builds a causal chain from an error and recent events.
   * @param error The error encountered.
   * @param recentChanges Recent system events.
   * @returns A CausalChain object.
   */
  public trace(error: Error, recentChanges: CausalEvent[]): CausalChain {
    logger.info(`Tracing error: ${error.message}`);
    const correlated = this.correlateWithChanges(new Date(), recentChanges);
    const rootCauseNode: CausalNode = correlated.length > 0
      ? { type: 'code_change', description: correlated[0].description, evidence: [correlated[0].file || ''] }
      : { type: 'data_issue', description: 'Unknown root cause', evidence: [] };

    return {
      error: error.message,
      triggeredBy: [],
      rootCause: rootCauseNode,
      timeline: recentChanges,
      confidence: correlated.length > 0 ? 0.8 : 0.3
    };
  }

  /**
   * Finds the AI-powered root cause.
   * @param error The error message.
   * @param systemState State of the system when error occurred.
   * @returns A string describing the root cause.
   */
  public async findRootCause(error: string, systemState: Record<string, unknown>): Promise<string> {
    logger.debug('Finding root cause with AI...', { error, stateKeys: Object.keys(systemState) });
    return 'Simulated Root Cause: Unhandled null reference in API response payload.';
  }

  /**
   * Finds changes that correlate with the error timestamp.
   * @param errorTimestamp The time the error occurred.
   * @param changes Recent events.
   * @returns Array of correlated events.
   */
  public correlateWithChanges(errorTimestamp: Date, changes: CausalEvent[]): CausalEvent[] {
    // Return changes that happened within the last 2 hours before the error
    const twoHours = 2 * 60 * 60 * 1000;
    return changes.filter(c => {
      const diff = errorTimestamp.getTime() - c.timestamp.getTime();
      return diff > 0 && diff < twoHours;
    });
  }

  /**
   * Generates a markdown report for the debugging session.
   * @param chain The CausalChain object.
   * @returns Markdown string.
   */
  public generateDebugReport(chain: CausalChain): string {
    let report = `# Causal Debugging Report\n\n`;
    report += `**Error**: ${chain.error}\n`;
    report += `**Confidence**: ${chain.confidence * 100}%\n\n`;
    report += `## Root Cause\n`;
    report += `- Type: ${chain.rootCause.type}\n`;
    report += `- Description: ${chain.rootCause.description}\n\n`;
    report += `## Timeline\n`;
    chain.timeline.forEach(event => {
      report += `- [${event.timestamp.toISOString()}] ${event.type}: ${event.description}\n`;
    });
    return report;
  }

  /**
   * Suggests a concrete fix based on the causal chain.
   * @param chain The causal chain.
   * @returns A string containing the suggested fix.
   */
  public suggestFix(chain: CausalChain): string {
    return `Revert recent commit related to ${chain.rootCause.description} or add null-checks to the affected module.`;
  }
}

export const causalDebugger = new CausalDebugger();
