import { routedCall } from '@/lib/model-router.server';

export interface DeploymentPlan {
  steps: string[];
  environmentVariables: string[];
  rollbackPlan: string;
}

export interface HealthCheckResult {
  status: 'healthy' | 'unhealthy';
  latencyMs: number;
  checks: Record<string, boolean>;
}

/**
 * DeploymentAgent provides capabilities for planning deployments and generating configuration files.
 */
export class DeploymentAgent {
  private systemPrompt = `You are an expert DevOps and deployment engineer. Your goal is to create safe deployment strategies, generate optimized container configurations, and ensure reliable environments. Always return structured JSON or raw config files when requested.`;

  /**
   * Plans a deployment for a project to a specific target.
   * @param project The project configuration or details.
   * @param target The deployment target (e.g., 'AWS', 'Vercel').
   * @returns A deployment plan.
   */
  async planDeployment(project: object, target: string): Promise<DeploymentPlan> {
    try {
      const response = await routedCall(
        this.systemPrompt,
        `Plan a deployment to "${target}" for project: ${JSON.stringify(project)}. Return a JSON object with 'steps' (array of strings), 'environmentVariables' (array of strings), and 'rollbackPlan' (string).`,
        'reasoning'
      );
      const jsonStr = response.content.match(/\{[\s\S]*\}/)?.[0] || '{}';
      return JSON.parse(jsonStr) as DeploymentPlan;
    } catch (error) {
      throw new Error(`Failed to plan deployment: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Generates a Dockerfile for a given stack.
   * @param stack Description of the technology stack.
   * @returns The generated Dockerfile string.
   */
  async generateDockerfile(stack: string): Promise<string> {
    try {
      const response = await routedCall(
        this.systemPrompt,
        `Generate a production-ready Dockerfile for this stack: "${stack}". Return only the raw Dockerfile content.`,
        'generation'
      );
      return response.content.replace(/```dockerfile\n/gi, '').replace(/```docker\n/gi, '').replace(/\n```/g, '');
    } catch (error) {
      throw new Error(`Failed to generate Dockerfile: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Generates an nginx.conf configuration.
   * @param domain The target domain.
   * @param ssl Whether to configure SSL.
   * @returns The nginx configuration string.
   */
  async generateNginxConfig(domain: string, ssl: boolean): Promise<string> {
    try {
      const response = await routedCall(
        this.systemPrompt,
        `Generate an nginx.conf for domain "${domain}" with SSL ${ssl ? 'enabled' : 'disabled'}. Return only the raw configuration content.`,
        'generation'
      );
      return response.content.replace(/```nginx\n/gi, '').replace(/\n```/g, '');
    } catch (error) {
      throw new Error(`Failed to generate nginx config: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Simulates running a health check against a URL.
   * @param url The URL to check.
   * @returns A health check result.
   */
  async runHealthCheck(url: string): Promise<HealthCheckResult> {
    try {
      const response = await routedCall(
        this.systemPrompt,
        `Simulate a health check for URL: "${url}". Return a JSON object with 'status' ("healthy" or "unhealthy"), 'latencyMs' (number), and 'checks' (object mapping string names to boolean results).`,
        'reasoning'
      );
      const jsonStr = response.content.match(/\{[\s\S]*\}/)?.[0] || '{}';
      return JSON.parse(jsonStr) as HealthCheckResult;
    } catch (error) {
      throw new Error(`Failed to run health check: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
