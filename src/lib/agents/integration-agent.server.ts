import { routedCall } from '@/lib/model-router.server';

export interface IntegrationPlan {
  steps: string[];
  authStrategy: string;
  dataMapping: Record<string, string>;
  risks: string[];
}

export interface WebhookReview {
  isSecure: boolean;
  vulnerabilities: string[];
  suggestions: string[];
}

export interface TestResult {
  success: boolean;
  logs: string[];
  errors: string[];
}

/**
 * IntegrationAgent provides capabilities for planning, building, and reviewing third-party API integrations.
 */
export class IntegrationAgent {
  private systemPrompt = `You are an expert API integration specialist. Your goal is to design robust, secure, and fault-tolerant third-party integrations and webhooks. Always return structured JSON when data is requested.`;

  /**
   * Plans an integration with a third-party service.
   * @param service The name of the service (e.g., 'Stripe', 'Twilio').
   * @param requirements The integration requirements.
   * @returns An integration plan object.
   */
  async planIntegration(service: string, requirements: object): Promise<IntegrationPlan> {
    try {
      const response = await routedCall(
        this.systemPrompt,
        `Plan an integration with "${service}" for requirements: ${JSON.stringify(requirements)}. Return a JSON object with 'steps' (array of strings), 'authStrategy' (string), 'dataMapping' (object), and 'risks' (array of strings).`,
        'reasoning'
      );
      const jsonStr = response.content.match(/\{[\s\S]*\}/)?.[0] || '{}';
      return JSON.parse(jsonStr) as IntegrationPlan;
    } catch (error) {
      throw new Error(`Failed to plan integration: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Generates connector code for a third-party service.
   * @param service The name of the service.
   * @param auth The authentication method.
   * @returns The connector code as a string.
   */
  async generateConnector(service: string, auth: string): Promise<string> {
    try {
      const response = await routedCall(
        this.systemPrompt,
        `Generate TypeScript connector code for "${service}" using "${auth}" authentication. Return only raw code.`,
        'generation'
      );
      return response.content.replace(/```[\w]*\n/g, '').replace(/\n```/g, '');
    } catch (error) {
      throw new Error(`Failed to generate connector: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Reviews webhook handler code for security and best practices.
   * @param code The webhook handler code.
   * @param service The service sending the webhook.
   * @returns A webhook review result.
   */
  async reviewWebhook(code: string, service: string): Promise<WebhookReview> {
    try {
      const response = await routedCall(
        this.systemPrompt,
        `Review this webhook handler for "${service}":\n\n${code}\n\nReturn a JSON object with 'isSecure' (boolean), 'vulnerabilities' (array of strings), and 'suggestions' (array of strings).`,
        'reasoning'
      );
      const jsonStr = response.content.match(/\{[\s\S]*\}/)?.[0] || '{}';
      return JSON.parse(jsonStr) as WebhookReview;
    } catch (error) {
      throw new Error(`Failed to review webhook: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Simulates or proposes a test plan for an integration configuration.
   * @param config The integration configuration.
   * @returns A test result object.
   */
  async testIntegration(config: object): Promise<TestResult> {
    try {
      const response = await routedCall(
        this.systemPrompt,
        `Simulate a test run for this integration config: ${JSON.stringify(config)}. Return a JSON object with 'success' (boolean), 'logs' (array of strings), and 'errors' (array of strings).`,
        'reasoning'
      );
      const jsonStr = response.content.match(/\{[\s\S]*\}/)?.[0] || '{}';
      return JSON.parse(jsonStr) as TestResult;
    } catch (error) {
      throw new Error(`Failed to test integration: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
