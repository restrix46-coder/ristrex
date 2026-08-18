import { routedCall } from '@/lib/model-router.server';

export interface ApiSpec {
  method: string;
  path: string;
  requestBody?: Record<string, string>;
  responseBody: Record<string, string>;
  statusCodes: number[];
}

export interface CodeReviewResult {
  isApproved: boolean;
  issues: string[];
  suggestions: string[];
}

export interface SchemaDesign {
  tables: { name: string; columns: Record<string, string> }[];
  relations: string[];
}

/**
 * BackendAgent provides capabilities for designing APIs, schemas, and building backend code.
 */
export class BackendAgent {
  private systemPrompt = `You are an expert backend engineer. Your goal is to design scalable APIs, robust database schemas, and write secure backend code. Always return structured JSON when data is requested.`;

  /**
   * Designs an API specification for a given feature.
   * @param feature The feature description.
   * @param requirements The requirements for the API.
   * @returns An API specification object.
   */
  async designApi(feature: string, requirements: object): Promise<ApiSpec> {
    try {
      const response = await routedCall(
        this.systemPrompt,
        `Design an API endpoint for feature: "${feature}" with requirements: ${JSON.stringify(requirements)}. Return a JSON object with 'method' (string), 'path' (string), 'requestBody' (optional object), 'responseBody' (object), and 'statusCodes' (array of numbers).`,
        'reasoning'
      );
      const jsonStr = response.content.match(/\{[\s\S]*\}/)?.[0] || '{}';
      return JSON.parse(jsonStr) as ApiSpec;
    } catch (error) {
      throw new Error(`Failed to design API: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Builds endpoint code based on an API specification.
   * @param spec The API specification.
   * @returns The generated endpoint code as a string.
   */
  async buildEndpoint(spec: ApiSpec): Promise<string> {
    try {
      const response = await routedCall(
        this.systemPrompt,
        `Write Node.js/TypeScript Express endpoint code for this API spec:\n${JSON.stringify(spec)}\nReturn only the raw code without markdown wrapping.`,
        'generation'
      );
      return response.content.replace(/```[\w]*\n/g, '').replace(/\n```/g, '');
    } catch (error) {
      throw new Error(`Failed to build endpoint: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Reviews backend endpoint code.
   * @param code The code to review.
   * @returns A code review result.
   */
  async reviewApi(code: string): Promise<CodeReviewResult> {
    try {
      const response = await routedCall(
        this.systemPrompt,
        `Review the following backend API code for security and performance:\n\n${code}\n\nReturn a JSON object with 'isApproved' (boolean), 'issues' (array of strings), and 'suggestions' (array of strings).`,
        'reasoning'
      );
      const jsonStr = response.content.match(/\{[\s\S]*\}/)?.[0] || '{}';
      return JSON.parse(jsonStr) as CodeReviewResult;
    } catch (error) {
      throw new Error(`Failed to review API: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Designs a database schema for given entities and relations.
   * @param entities The entities to model.
   * @param relations The relationships between entities.
   * @returns A schema design object.
   */
  async designSchema(entities: string[], relations: object): Promise<SchemaDesign> {
    try {
      const response = await routedCall(
        this.systemPrompt,
        `Design a relational database schema for entities: ${entities.join(', ')} and relations: ${JSON.stringify(relations)}. Return a JSON object with 'tables' (array of objects with 'name' and 'columns' mapping name to type) and 'relations' (array of strings describing foreign keys).`,
        'reasoning'
      );
      const jsonStr = response.content.match(/\{[\s\S]*\}/)?.[0] || '{}';
      return JSON.parse(jsonStr) as SchemaDesign;
    } catch (error) {
      throw new Error(`Failed to design schema: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
