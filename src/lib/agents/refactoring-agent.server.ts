import { routedCall } from '@/lib/model-router.server';

export interface RefactoringPlan {
  steps: string[];
  estimatedEffort: string;
  risks: string[];
}

/**
 * RefactoringAgent provides capabilities for planning refactors, extracting functions, and cleaning code.
 */
export class RefactoringAgent {
  private systemPrompt = `You are an expert refactoring engineer. Your goal is to restructure existing computer code without changing its external behavior, improving nonfunctional attributes like readability and complexity. Always return raw code or JSON as requested.`;

  /**
   * Plans a refactoring effort.
   * @param code The code to refactor.
   * @param goals The goals of the refactoring.
   * @returns A refactoring plan.
   */
  async planRefactoring(code: string, goals: string[]): Promise<RefactoringPlan> {
    try {
      const response = await routedCall(
        this.systemPrompt,
        `Plan a refactoring for this code:\n\n${code}\n\nGoals: ${goals.join(', ')}. Return a JSON object with 'steps' (array of strings), 'estimatedEffort' (string), and 'risks' (array of strings).`,
        'reasoning'
      );
      const jsonStr = response.content.match(/\{[\s\S]*\}/)?.[0] || '{}';
      return JSON.parse(jsonStr) as RefactoringPlan;
    } catch (error) {
      throw new Error(`Failed to plan refactoring: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Extracts a selected portion of code into a separate function.
   * @param code The original code.
   * @param selection The lines or selection details to extract.
   * @returns The refactored code.
   */
  async extractFunction(code: string, selection: object): Promise<string> {
    try {
      const response = await routedCall(
        this.systemPrompt,
        `Extract a function from this code based on selection: ${JSON.stringify(selection)}\n\nCode:\n${code}\n\nReturn only the updated raw code.`,
        'generation'
      );
      return response.content.replace(/```[\w]*\n/g, '').replace(/\n```/g, '');
    } catch (error) {
      throw new Error(`Failed to extract function: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Removes dead or unreachable code.
   * @param code The code to clean.
   * @returns The cleaned code.
   */
  async removeDeadCode(code: string): Promise<string> {
    try {
      const response = await routedCall(
        this.systemPrompt,
        `Remove all dead or unreachable code from this snippet:\n\n${code}\n\nReturn only the cleaned raw code.`,
        'generation'
      );
      return response.content.replace(/```[\w]*\n/g, '').replace(/\n```/g, '');
    } catch (error) {
      throw new Error(`Failed to remove dead code: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Simplifies complex logic in the code.
   * @param code The code to simplify.
   * @returns The simplified code.
   */
  async simplifyComplexity(code: string): Promise<string> {
    try {
      const response = await routedCall(
        this.systemPrompt,
        `Simplify the logic and reduce complexity in this code without changing behavior:\n\n${code}\n\nReturn only the simplified raw code.`,
        'generation'
      );
      return response.content.replace(/```[\w]*\n/g, '').replace(/\n```/g, '');
    } catch (error) {
      throw new Error(`Failed to simplify complexity: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
