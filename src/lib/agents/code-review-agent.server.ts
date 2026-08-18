import { routedCall } from '@/lib/model-router.server';

export interface CodeReview {
  isApproved: boolean;
  comments: string[];
  suggestions: { original: string; replacement: string; explanation: string }[];
}

export interface SecurityReview {
  isSecure: boolean;
  vulnerabilities: { issue: string; severity: string; line: number }[];
}

export interface ComplexityReport {
  score: number;
  hotspots: string[];
  recommendations: string[];
}

export interface RefactoringSuggestion {
  target: string;
  suggestion: string;
  benefit: string;
}

/**
 * CodeReviewAgent provides capabilities for reviewing code, checking security, and analyzing complexity.
 */
export class CodeReviewAgent {
  private systemPrompt = `You are a senior code reviewer with a strong security focus. Your goal is to enforce best practices, catch bugs and vulnerabilities, and maintain high code quality. Always return structured JSON when data is requested.`;

  /**
   * Reviews code within a given context.
   * @param code The code to review.
   * @param context The PR context or additional details.
   * @returns A code review object.
   */
  async review(code: string, context: object): Promise<CodeReview> {
    try {
      const response = await routedCall(
        this.systemPrompt,
        `Review this code with context: ${JSON.stringify(context)}\n\n${code}\n\nReturn a JSON object with 'isApproved' (boolean), 'comments' (array of strings), and 'suggestions' (array of objects with 'original', 'replacement', 'explanation').`,
        'reasoning'
      );
      const jsonStr = response.content.match(/\{[\s\S]*\}/)?.[0] || '{}';
      return JSON.parse(jsonStr) as CodeReview;
    } catch (error) {
      throw new Error(`Failed to review code: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Checks code for security vulnerabilities.
   * @param code The code to check.
   * @returns A security review object.
   */
  async checkSecurity(code: string): Promise<SecurityReview> {
    try {
      const response = await routedCall(
        this.systemPrompt,
        `Perform a security review on this code:\n\n${code}\n\nReturn a JSON object with 'isSecure' (boolean) and 'vulnerabilities' (array of objects with 'issue', 'severity', 'line').`,
        'reasoning'
      );
      const jsonStr = response.content.match(/\{[\s\S]*\}/)?.[0] || '{}';
      return JSON.parse(jsonStr) as SecurityReview;
    } catch (error) {
      throw new Error(`Failed to check security: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Analyzes the cyclomatic and cognitive complexity of the code.
   * @param code The code to analyze.
   * @returns A complexity report.
   */
  async checkComplexity(code: string): Promise<ComplexityReport> {
    try {
      const response = await routedCall(
        this.systemPrompt,
        `Analyze the complexity of this code:\n\n${code}\n\nReturn a JSON object with 'score' (number), 'hotspots' (array of string descriptions), and 'recommendations' (array of strings).`,
        'reasoning'
      );
      const jsonStr = response.content.match(/\{[\s\S]*\}/)?.[0] || '{}';
      return JSON.parse(jsonStr) as ComplexityReport;
    } catch (error) {
      throw new Error(`Failed to check complexity: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Suggests refactoring opportunities in the code.
   * @param code The code to analyze.
   * @returns An array of refactoring suggestions.
   */
  async suggestRefactoring(code: string): Promise<RefactoringSuggestion[]> {
    try {
      const response = await routedCall(
        this.systemPrompt,
        `Suggest refactoring opportunities for this code:\n\n${code}\n\nReturn a JSON array of objects with 'target' (string identifying what to refactor), 'suggestion' (string), and 'benefit' (string).`,
        'reasoning'
      );
      const jsonStr = response.content.match(/\[[\s\S]*\]/)?.[0] || '[]';
      return JSON.parse(jsonStr) as RefactoringSuggestion[];
    } catch (error) {
      throw new Error(`Failed to suggest refactoring: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Generates a conversational review comment for a finding.
   * @param finding The finding or issue details.
   * @returns A markdown PR comment string.
   */
  async generateReviewComment(finding: object): Promise<string> {
    try {
      const response = await routedCall(
        this.systemPrompt,
        `Generate a polite, constructive pull request review comment in Markdown based on this finding: ${JSON.stringify(finding)}.`,
        'generation'
      );
      return response.content;
    } catch (error) {
      throw new Error(`Failed to generate review comment: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
