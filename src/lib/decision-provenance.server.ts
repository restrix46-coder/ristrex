/**
 * Decision Provenance — save every decision with evidence and reasoning.
 */

import { getSql } from '@/lib/db';

export interface DecisionProvenance {
  id: string;
  decisionId: string;
  question: string;
  decision: string;
  reasoning: string;
  evidence: Evidence[];
  alternatives: Alternative[];
  confidence: number;
  madeBy: 'ai' | 'user' | 'system';
  timestamp: Date;
  relatedDecisions: string[];
  outcomeVerified?: boolean;
  outcome?: string;
}

export interface Evidence {
  type: 'code' | 'test' | 'log' | 'metric' | 'user_input' | 'research' | 'benchmark';
  source: string;
  content: string;
  relevance: number;
}

export interface Alternative {
  option: string;
  whyRejected: string;
  tradeoffs: string[];
}

export interface EvidenceGraph {
  decisions: DecisionProvenance[];
  edges: Array<{
    from: string;
    to: string;
    relationship: 'depends_on' | 'contradicts' | 'supports';
  }>;
}

export class DecisionProvenanceService {
  /**
   * Records a decision with all context
   */
  async record(decision: Omit<DecisionProvenance, 'id' | 'timestamp'>): Promise<DecisionProvenance> {
    const id = crypto.randomUUID();
    const timestamp = new Date();
    const fullDecision: DecisionProvenance = { ...decision, id, timestamp };

    const sql = getSql();
    try {
      await sql`
        INSERT INTO decision_provenance (
          id, decision_id, question, decision, reasoning, evidence, alternatives,
          confidence, made_by, timestamp, related_decisions, outcome_verified, outcome
        ) VALUES (
          ${id}, ${decision.decisionId}, ${decision.question}, ${decision.decision},
          ${decision.reasoning}, ${JSON.stringify(decision.evidence)}, ${JSON.stringify(decision.alternatives)},
          ${decision.confidence}, ${decision.madeBy}, ${timestamp}, ${decision.relatedDecisions},
          ${decision.outcomeVerified ?? null}, ${decision.outcome ?? null}
        )
      `;
      return fullDecision;
    } catch (error) {
      console.error('Failed to record decision provenance:', error);
      throw new Error('Database error recording decision provenance');
    }
  }

  /**
   * Adds evidence post-decision
   */
  async addEvidence(decisionId: string, evidence: Evidence): Promise<void> {
    const sql = getSql();
    try {
      await sql`
        UPDATE decision_provenance
        SET evidence = evidence || ${JSON.stringify([evidence])}::jsonb
        WHERE decision_id = ${decisionId}
      `;
    } catch (error) {
      console.error('Failed to add evidence:', error);
      throw new Error('Database error adding evidence');
    }
  }

  /**
   * Records what actually happened
   */
  async verifyOutcome(decisionId: string, outcome: string, success: boolean): Promise<void> {
    const sql = getSql();
    try {
      await sql`
        UPDATE decision_provenance
        SET outcome = ${outcome}, outcome_verified = ${success}
        WHERE decision_id = ${decisionId}
      `;
    } catch (error) {
      console.error('Failed to verify outcome:', error);
      throw new Error('Database error verifying outcome');
    }
  }

  /**
   * Retrieves decision
   */
  async getDecision(id: string): Promise<DecisionProvenance | null> {
    const sql = getSql();
    try {
      const [result] = await sql<DecisionProvenance[]>`
        SELECT * FROM decision_provenance WHERE id = ${id}
      `;
      return result || null;
    } catch (error) {
      console.error('Failed to get decision:', error);
      throw new Error('Database error getting decision');
    }
  }

  /**
   * Returns full evidence graph
   */
  async getEvidenceGraph(projectId: string): Promise<EvidenceGraph> {
    // In a real implementation, this would filter by projectId
    const sql = getSql();
    try {
      const decisions = await sql<DecisionProvenance[]>`
        SELECT * FROM decision_provenance
      `;
      const edges = await sql<any[]>`
        SELECT * FROM decision_provenance_edges
      `;
      return { decisions, edges };
    } catch (error) {
      console.error('Failed to get evidence graph:', error);
      throw new Error('Database error getting evidence graph');
    }
  }

  /**
   * Finds conflicting decisions
   */
  async findContradictions(decisions: DecisionProvenance[]): Promise<any[]> {
    // Basic mock implementation
    return [];
  }

  /**
   * Markdown provenance report
   */
  async generateReport(decisionId: string): Promise<string> {
    const decision = await this.getDecision(decisionId);
    if (!decision) return 'Decision not found.';
    return `# Decision Report: ${decision.decisionId}\n\n**Question:** ${decision.question}\n**Decision:** ${decision.decision}\n\n**Reasoning:**\n${decision.reasoning}\n`;
  }

  /**
   * Mermaid diagram
   */
  generateEvidenceGraphDiagram(graph: EvidenceGraph): string {
    let mermaid = 'graph TD;\n';
    graph.edges.forEach(edge => {
      mermaid += `  ${edge.from} -->|${edge.relationship}| ${edge.to};\n`;
    });
    return mermaid;
  }
}

export const decisionProvenance = new DecisionProvenanceService();

/**
 * Migration:
 * CREATE TABLE decision_provenance (
 *   id UUID PRIMARY KEY,
 *   decision_id TEXT NOT NULL,
 *   question TEXT,
 *   decision TEXT,
 *   reasoning TEXT,
 *   evidence JSONB,
 *   alternatives JSONB,
 *   confidence FLOAT,
 *   made_by TEXT,
 *   timestamp TIMESTAMP,
 *   related_decisions TEXT[],
 *   outcome_verified BOOLEAN,
 *   outcome TEXT
 * );
 * CREATE TABLE decision_provenance_edges (
 *   "from" TEXT,
 *   "to" TEXT,
 *   relationship TEXT
 * );
 */
