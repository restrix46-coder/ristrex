import { routedCall } from '@/lib/model-router.server';

export interface UserFlowStep {
  action: string;
  screen: string;
  description: string;
}

export interface UserFlow {
  title: string;
  steps: UserFlowStep[];
}

export interface UXReviewResult {
  score: number;
  issues: string[];
  strengths: string[];
}

export interface UXImprovement {
  element: string;
  suggestion: string;
  impact: 'low' | 'medium' | 'high';
}

/**
 * UiUxAgent provides capabilities for designing user flows, wireframing, and reviewing UX.
 */
export class UiUxAgent {
  private systemPrompt = `You are a senior UX designer who follows Nielsen's heuristics. Your goal is to design intuitive user flows, create wireframe concepts, and provide actionable UX reviews. Always return structured JSON data unless markdown is explicitly requested.`;

  /**
   * Designs a user flow for a given feature and personas.
   * @param feature The feature to design a flow for.
   * @param personas The user personas to consider.
   * @returns A structured user flow.
   */
  async designUserFlow(feature: string, personas: object[]): Promise<UserFlow> {
    try {
      const response = await routedCall(
        this.systemPrompt,
        `Design a user flow for feature: "${feature}" targeting personas: ${JSON.stringify(personas)}. Return a JSON object with 'title' (string) and 'steps' (array of objects with 'action', 'screen', and 'description' strings).`,
        'reasoning'
      );
      const jsonStr = response.content.match(/\{[\s\S]*\}/)?.[0] || '{}';
      return JSON.parse(jsonStr) as UserFlow;
    } catch (error) {
      throw new Error(`Failed to design user flow: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Creates a wireframe description in markdown format.
   * @param screen The screen to wireframe.
   * @param requirements The requirements for the screen.
   * @returns A markdown representation of the wireframe.
   */
  async createWireframe(screen: string, requirements: object): Promise<string> {
    try {
      const response = await routedCall(
        this.systemPrompt,
        `Create a text-based wireframe description in Markdown for screen: "${screen}" with requirements: ${JSON.stringify(requirements)}. Use structural elements like [Header], [Button], etc.`,
        'generation'
      );
      return response.content;
    } catch (error) {
      throw new Error(`Failed to create wireframe: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Reviews the UX of provided screenshots against criteria.
   * @param screenshots Array of screenshot URLs or base64 strings.
   * @param criteria Criteria for the review.
   * @returns A UX review result.
   */
  async reviewUX(screenshots: string[], criteria: string[]): Promise<UXReviewResult> {
    try {
      // In a real implementation, we might pass images to a vision model.
      // Here we assume the model handles image URLs or we describe them.
      const response = await routedCall(
        this.systemPrompt,
        `Review the UX for the following screens: ${screenshots.join(', ')} against criteria: ${criteria.join(', ')}. Return a JSON object with 'score' (number 0-100), 'issues' (array of strings), and 'strengths' (array of strings).`,
        'reasoning' // Or 'vision' if supported
      );
      const jsonStr = response.content.match(/\{[\s\S]*\}/)?.[0] || '{}';
      return JSON.parse(jsonStr) as UXReviewResult;
    } catch (error) {
      throw new Error(`Failed to review UX: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Suggests UX improvements for a given current UX description.
   * @param currentUX The description or code of the current UX.
   * @returns An array of suggested UX improvements.
   */
  async suggestImprovements(currentUX: string): Promise<UXImprovement[]> {
    try {
      const response = await routedCall(
        this.systemPrompt,
        `Suggest UX improvements for the following current UX: "${currentUX}". Return a JSON array of objects with 'element', 'suggestion', and 'impact' (low/medium/high).`,
        'reasoning'
      );
      const jsonStr = response.content.match(/\[[\s\S]*\]/)?.[0] || '[]';
      return JSON.parse(jsonStr) as UXImprovement[];
    } catch (error) {
      throw new Error(`Failed to suggest UX improvements: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
