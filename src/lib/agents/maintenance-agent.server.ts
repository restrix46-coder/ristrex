import { routedCall } from '@/lib/model-router.server';

export interface MaintenancePlan {
  tasks: string[];
  estimatedDowntime: string;
  schedule: string;
}

export interface UpdatePlan {
  safeUpdates: string[];
  breakingUpdates: string[];
  manualSteps: string[];
}

export interface OutdatedDep {
  name: string;
  current: string;
  latest: string;
  severity: 'low' | 'medium' | 'high';
}

/**
 * MaintenanceAgent provides capabilities for planning maintenance, updating dependencies, and generating reports.
 */
export class MaintenanceAgent {
  private systemPrompt = `You are an expert software maintenance engineer. Your goal is to keep systems up to date, secure, and running smoothly while minimizing downtime. Always return structured JSON when data is requested.`;

  /**
   * Plans system maintenance based on project details.
   * @param project The project or system details.
   * @returns A maintenance plan.
   */
  async planMaintenance(project: object): Promise<MaintenancePlan> {
    try {
      const response = await routedCall(
        this.systemPrompt,
        `Plan a maintenance window for project: ${JSON.stringify(project)}. Return a JSON object with 'tasks' (array of strings), 'estimatedDowntime' (string), and 'schedule' (string).`,
        'reasoning'
      );
      const jsonStr = response.content.match(/\{[\s\S]*\}/)?.[0] || '{}';
      return JSON.parse(jsonStr) as MaintenancePlan;
    } catch (error) {
      throw new Error(`Failed to plan maintenance: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Creates an update plan based on a package.json file.
   * @param packageJson The package.json contents as an object.
   * @returns An update plan separating safe and breaking updates.
   */
  async updateDependencies(packageJson: object): Promise<UpdatePlan> {
    try {
      const response = await routedCall(
        this.systemPrompt,
        `Analyze this package.json for updates: ${JSON.stringify(packageJson)}. Return a JSON object with 'safeUpdates' (array), 'breakingUpdates' (array), and 'manualSteps' (array).`,
        'reasoning'
      );
      const jsonStr = response.content.match(/\{[\s\S]*\}/)?.[0] || '{}';
      return JSON.parse(jsonStr) as UpdatePlan;
    } catch (error) {
      throw new Error(`Failed to plan dependency updates: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Simulates detecting outdated dependencies.
   * @param dependencies Object mapping dependency names to current versions.
   * @returns An array of outdated dependencies with severity.
   */
  async detectOutdated(dependencies: object): Promise<OutdatedDep[]> {
    try {
      const response = await routedCall(
        this.systemPrompt,
        `Simulate checking for outdated packages for these dependencies: ${JSON.stringify(dependencies)}. Return a JSON array of objects with 'name', 'current', 'latest', and 'severity'.`,
        'reasoning'
      );
      const jsonStr = response.content.match(/\[[\s\S]*\]/)?.[0] || '[]';
      return JSON.parse(jsonStr) as OutdatedDep[];
    } catch (error) {
      throw new Error(`Failed to detect outdated dependencies: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Generates a comprehensive maintenance report in markdown.
   * @param project The project details.
   * @returns A markdown report string.
   */
  async generateMaintenanceReport(project: object): Promise<string> {
    try {
      const response = await routedCall(
        this.systemPrompt,
        `Generate a comprehensive Markdown maintenance report for project: ${JSON.stringify(project)}.`,
        'generation'
      );
      return response.content;
    } catch (error) {
      throw new Error(`Failed to generate maintenance report: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
