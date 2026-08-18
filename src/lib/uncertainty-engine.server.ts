/**
 * Uncertainty Engine — distinguish Known/Inferred/Unknown/Conflicting.
 */

export type CertaintyLevel = 'certain' | 'high_confidence' | 'inferred' | 'uncertain' | 'unknown' | 'conflicting';

export interface UncertaintyTag {
  id: string;
  claim: string;
  certainty: CertaintyLevel;
  sources: string[];
  confidence: number;
  conflictsWith?: string[];
  needsVerification: boolean;
  verificationQuestion?: string;
}

export interface UncertaintyReport {
  totalClaims: number;
  certainClaims: number;
  uncertainClaims: number;
  conflictingClaims: number;
  unknownClaims: number;
  highRiskUncertainties: UncertaintyTag[];
  recommendations: string[];
}

export class UncertaintyEngine {
  /**
   * Tags a claim with certainty level
   */
  tag(claim: string, sources: string[], confidence: number): UncertaintyTag {
    const certainty = this.classify(confidence);
    return {
      id: crypto.randomUUID(),
      claim,
      certainty,
      sources,
      confidence,
      needsVerification: certainty === 'uncertain' || certainty === 'conflicting' || certainty === 'unknown',
    };
  }

  /**
   * Finds contradictory claims
   */
  detectConflicts(tags: UncertaintyTag[]): UncertaintyTag[] {
    // Basic mock implementation for conflict detection
    return tags.filter(tag => tag.conflictsWith && tag.conflictsWith.length > 0);
  }

  /**
   * Returns CertaintyLevel from 0-1 confidence
   */
  classify(confidence: number): CertaintyLevel {
    if (confidence >= 0.95) return 'certain';
    if (confidence >= 0.80) return 'high_confidence';
    if (confidence >= 0.60) return 'inferred';
    if (confidence >= 0.30) return 'uncertain';
    return 'unknown';
  }

  /**
   * Returns true if confidence too low or conflicting
   */
  shouldAskUser(tag: UncertaintyTag): boolean {
    return tag.needsVerification || tag.certainty === 'conflicting';
  }

  /**
   * Generates question to resolve uncertainty
   */
  generateClarificationQuestion(tag: UncertaintyTag): string {
    return `Can you clarify this: ${tag.claim}?`;
  }

  /**
   * Extracts uncertainty tags from AI response
   */
  analyzeResponse(context: string): UncertaintyTag[] {
    // Mock extraction
    return [];
  }

  /**
   * Markdown uncertainty report
   */
  generateReport(tags: UncertaintyTag[]): string {
    const uncertain = tags.filter(t => t.certainty === 'uncertain').length;
    return `# Uncertainty Report\nTotal tags: ${tags.length}\nUncertain: ${uncertain}`;
  }

  /**
   * Throws if uncertainty too high
   */
  blockIfTooUncertain(tags: UncertaintyTag[], threshold: number = 0.5): void {
    const avgConfidence = tags.reduce((sum, tag) => sum + tag.confidence, 0) / (tags.length || 1);
    if (avgConfidence < threshold) {
      throw new Error(`Execution blocked: Overall confidence ${avgConfidence} is below threshold ${threshold}`);
    }
  }
}

export const uncertaintyEngine = new UncertaintyEngine();
