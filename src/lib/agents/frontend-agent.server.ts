import { routedCall } from '@/lib/model-router.server';

export interface CodeReviewResult {
  isApproved: boolean;
  comments: { line: number; message: string; severity: 'low' | 'medium' | 'high' }[];
  suggestedFixes: { original: string; replacement: string }[];
}

export interface OptimizationPlan {
  currentSize: string;
  targetSize: string;
  recommendations: string[];
}

/**
 * FrontendAgent provides capabilities for building, reviewing, and optimizing frontend code.
 */
export class FrontendAgent {
  private systemPrompt = `You are an expert React/TypeScript developer. Your goal is to write clean, performant, and accessible frontend code, review components, and optimize bundles. Always return structured JSON when requested.`;

  /**
   * Builds a frontend component based on a specification.
   * @param spec The component specification.
   * @param framework The framework to use (e.g., 'React', 'Vue').
   * @returns The generated component code as a string.
   */
  async buildComponent(spec: object, framework: string): Promise<string> {
    try {
      const response = await routedCall(
        this.systemPrompt,
        `Build a ${framework} component for the following specification:\n${JSON.stringify(spec)}\nReturn only the raw code string without markdown formatting if possible.`,
        'generation'
      );
      return response.content.replace(/```[\w]*\n/g, '').replace(/\n```/g, '');
    } catch (error) {
      throw new Error(`Failed to build component: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Reviews frontend component code.
   * @param code The code to review.
   * @returns A code review result.
   */
  async reviewComponent(code: string): Promise<CodeReviewResult> {
    try {
      const response = await routedCall(
        this.systemPrompt,
        `Review the following frontend code:\n\n${code}\n\nReturn a JSON object with 'isApproved' (boolean), 'comments' (array of objects with 'line', 'message', 'severity'), and 'suggestedFixes' (array of objects with 'original', 'replacement').`,
        'reasoning'
      );
      const jsonStr = response.content.match(/\{[\s\S]*\}/)?.[0] || '{}';
      return JSON.parse(jsonStr) as CodeReviewResult;
    } catch (error) {
      throw new Error(`Failed to review component: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Analyzes bundle stats and provides an optimization plan.
   * @param stats The bundle statistics object.
   * @returns An optimization plan.
   */
  async optimizeBundle(stats: object): Promise<OptimizationPlan> {
    try {
      const response = await routedCall(
        this.systemPrompt,
        `Analyze these bundle stats: ${JSON.stringify(stats)}. Return a JSON object with 'currentSize' (string), 'targetSize' (string), and 'recommendations' (array of strings).`,
        'reasoning'
      );
      const jsonStr = response.content.match(/\{[\s\S]*\}/)?.[0] || '{}';
      return JSON.parse(jsonStr) as OptimizationPlan;
    } catch (error) {
      throw new Error(`Failed to optimize bundle: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Fixes accessibility issues in given HTML or JSX code.
   * @param code The code containing accessibility issues.
   * @param issues The list of reported issues.
   * @returns The fixed code as a string.
   */
  async fixAccessibility(code: string, issues: object[]): Promise<string> {
    try {
      const response = await routedCall(
        this.systemPrompt,
        `Fix the following accessibility issues: ${JSON.stringify(issues)} in this code:\n\n${code}\n\nReturn only the fixed code.`,
        'generation'
      );
      return response.content.replace(/```[\w]*\n/g, '').replace(/\n```/g, '');
    } catch (error) {
      throw new Error(`Failed to fix accessibility: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
