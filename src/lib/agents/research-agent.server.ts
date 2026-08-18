import { routedCall } from '@/lib/model-router.server';

export interface ResearchResult {
  summary: string;
  keyFindings: string[];
  sources: string[];
}

export interface VerificationResult {
  isTrue: boolean;
  confidence: number;
  explanation: string;
  supportingSources: string[];
}

/**
 * ResearchAgent provides capabilities for thorough research, comparison, and fact-checking.
 */
export class ResearchAgent {
  private systemPrompt = `You are a meticulous researcher who cross-references multiple sources. Your goal is to provide accurate, deep, and well-structured research results. Respond with structured JSON when appropriate.`;

  /**
   * Conducts research on a given topic.
   * @param topic The topic to research.
   * @param depth The depth of the research ('quick' or 'thorough').
   * @returns A detailed research result.
   */
  async research(topic: string, depth: 'quick' | 'thorough'): Promise<ResearchResult> {
    try {
      const response = await routedCall(
        this.systemPrompt,
        `Conduct ${depth} research on the topic: "${topic}". Return a JSON object with 'summary' (string), 'keyFindings' (array of strings), and 'sources' (array of strings).`,
        depth === 'thorough' ? 'agentic' : 'reasoning'
      );
      const jsonStr = response.content.match(/\{[\s\S]*\}/)?.[0] || '{}';
      return JSON.parse(jsonStr) as ResearchResult;
    } catch (error) {
      throw new Error(`Failed to conduct research: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Finds best practices for a specific technology.
   * @param technology The technology to find best practices for.
   * @returns An array of best practices.
   */
  async findBestPractices(technology: string): Promise<string[]> {
    try {
      const response = await routedCall(
        this.systemPrompt,
        `Find the industry best practices for using "${technology}". Return a JSON array of strings representing each best practice.`,
        'reasoning'
      );
      const jsonStr = response.content.match(/\[[\s\S]*\]/)?.[0] || '[]';
      return JSON.parse(jsonStr) as string[];
    } catch (error) {
      throw new Error(`Failed to find best practices: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Compares multiple options based on specific criteria.
   * @param options The options to compare.
   * @param criteria The criteria to compare them against.
   * @returns A comparison matrix in Markdown format.
   */
  async compareOptions(options: string[], criteria: string[]): Promise<string> {
    try {
      const response = await routedCall(
        this.systemPrompt,
        `Compare the following options: ${options.join(', ')} based on the following criteria: ${criteria.join(', ')}. Return the comparison as a Markdown table matrix.`,
        'reasoning'
      );
      return response.content;
    } catch (error) {
      throw new Error(`Failed to compare options: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Verifies a specific claim against a list of sources.
   * @param claim The claim to verify.
   * @param sources The sources to use for verification.
   * @returns A verification result detailing whether the claim is true.
   */
  async verifyFact(claim: string, sources: string[]): Promise<VerificationResult> {
    try {
      const response = await routedCall(
        this.systemPrompt,
        `Verify the following claim: "${claim}" using these sources: ${sources.join(', ')}. Return a JSON object with 'isTrue' (boolean), 'confidence' (number 0-100), 'explanation' (string), and 'supportingSources' (array of strings).`,
        'reasoning'
      );
      const jsonStr = response.content.match(/\{[\s\S]*\}/)?.[0] || '{}';
      return JSON.parse(jsonStr) as VerificationResult;
    } catch (error) {
      throw new Error(`Failed to verify fact: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
