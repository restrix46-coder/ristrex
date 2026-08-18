import { routedCall } from '@/lib/model-router.server';

export interface UserPersona {
  name: string;
  role: string;
  goals: string[];
  painPoints: string[];
}

export interface ProductAnalysis {
  features: string[];
  roles: string[];
  permissions: string[];
  dataModels: string[];
  integrations: string[];
  monetization: string[];
}

/**
 * ProductAgent provides capabilities for product management, feature analysis,
 * and generating product specifications.
 */
export class ProductAgent {
  private systemPrompt = `You are an expert product manager who thinks like Stripe/Linear/Notion. Your goal is to analyze features, identify user personas, and generate high-quality product specifications. Always return structured JSON data unless markdown is explicitly requested.`;

  /**
   * Analyzes a product feature description to extract roles, permissions, data models, and integrations.
   * @param description The feature description.
   * @returns A structured analysis of the product feature.
   */
  async analyze(description: string): Promise<ProductAnalysis> {
    try {
      const response = await routedCall(
        this.systemPrompt,
        `Analyze the following feature description and return a JSON object with 'features', 'roles', 'permissions', 'dataModels', 'integrations', and 'monetization' arrays of strings:\n\n${description}`,
        'reasoning'
      );
      const jsonStr = response.content.match(/\{[\s\S]*\}/)?.[0] || '{}';
      return JSON.parse(jsonStr) as ProductAnalysis;
    } catch (error) {
      throw new Error(`Failed to analyze product description: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Generates a complete product specification in markdown format.
   * @param request The request or brief for the product specification.
   * @returns The generated product specification in markdown.
   */
  async generateProductSpec(request: string): Promise<string> {
    try {
      const response = await routedCall(
        this.systemPrompt,
        `Generate a comprehensive product specification in Markdown format for the following request:\n\n${request}`,
        'generation'
      );
      return response.content;
    } catch (error) {
      throw new Error(`Failed to generate product spec: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Identifies potential user personas based on a product description.
   * @param description The product or feature description.
   * @returns An array of identified user personas.
   */
  async identifyUserPersonas(description: string): Promise<UserPersona[]> {
    try {
      const response = await routedCall(
        this.systemPrompt,
        `Based on the following product description, identify user personas. Return a JSON array of objects with 'name', 'role', 'goals' (array of strings), and 'painPoints' (array of strings):\n\n${description}`,
        'reasoning'
      );
      const jsonStr = response.content.match(/\[[\s\S]*\]/)?.[0] || '[]';
      return JSON.parse(jsonStr) as UserPersona[];
    } catch (error) {
      throw new Error(`Failed to identify user personas: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
