import { routedCall } from '@/lib/model-router.server';

export interface Task {
  id: string;
  title: string;
  description: string;
  dependencies: string[];
  priority: 'low' | 'medium' | 'high' | 'critical';
}

export interface ExecutionPlan {
  phases: {
    name: string;
    tasks: Task[];
  }[];
  estimatedDuration: string;
}

export interface EffortEstimate {
  totalHours: number;
  confidenceRange: string;
  breakdown: Record<string, number>;
}

/**
 * PlannerAgent provides capabilities for project management, task breakdown, and estimation.
 */
export class PlannerAgent {
  private systemPrompt = `You are a senior technical project manager. Your goal is to create realistic execution plans, break down features into actionable tasks, estimate effort, and prioritize work efficiently. Always return valid JSON when structured data is requested.`;

  /**
   * Creates a detailed execution plan based on requirements.
   * @param requirements The project requirements.
   * @param complexity The complexity level of the project.
   * @returns An execution plan detailing phases and tasks.
   */
  async createPlan(requirements: object, complexity: string): Promise<ExecutionPlan> {
    try {
      const response = await routedCall(
        this.systemPrompt,
        `Create an execution plan for complexity level "${complexity}" with requirements: ${JSON.stringify(requirements)}. Return a JSON object with 'phases' (array of objects with 'name' and 'tasks' array) and 'estimatedDuration' (string).`,
        'reasoning'
      );
      const jsonStr = response.content.match(/\{[\s\S]*\}/)?.[0] || '{}';
      return JSON.parse(jsonStr) as ExecutionPlan;
    } catch (error) {
      throw new Error(`Failed to create plan: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Breaks down a feature into smaller, actionable tasks.
   * @param feature The feature to break down.
   * @param context Additional context for the feature.
   * @returns An array of tasks.
   */
  async breakdownFeature(feature: string, context: object): Promise<Task[]> {
    try {
      const response = await routedCall(
        this.systemPrompt,
        `Break down the feature "${feature}" into tasks given context: ${JSON.stringify(context)}. Return a JSON array of Task objects with 'id', 'title', 'description', 'dependencies' (array of string ids), and 'priority'.`,
        'reasoning'
      );
      const jsonStr = response.content.match(/\[[\s\S]*\]/)?.[0] || '[]';
      return JSON.parse(jsonStr) as Task[];
    } catch (error) {
      throw new Error(`Failed to breakdown feature: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Estimates the effort required for a list of tasks.
   * @param tasks The list of tasks to estimate.
   * @returns An effort estimate with breakdown.
   */
  async estimateEffort(tasks: Task[]): Promise<EffortEstimate> {
    try {
      const response = await routedCall(
        this.systemPrompt,
        `Estimate effort for these tasks: ${JSON.stringify(tasks)}. Return a JSON object with 'totalHours' (number), 'confidenceRange' (string), and 'breakdown' (object mapping task ids to hours).`,
        'reasoning'
      );
      const jsonStr = response.content.match(/\{[\s\S]*\}/)?.[0] || '{}';
      return JSON.parse(jsonStr) as EffortEstimate;
    } catch (error) {
      throw new Error(`Failed to estimate effort: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Prioritizes a list of tasks based on constraints.
   * @param tasks The tasks to prioritize.
   * @param constraints The constraints to consider (e.g., resources, deadlines).
   * @returns A prioritized list of tasks.
   */
  async prioritizeTasks(tasks: Task[], constraints: object): Promise<Task[]> {
    try {
      const response = await routedCall(
        this.systemPrompt,
        `Prioritize these tasks: ${JSON.stringify(tasks)} considering constraints: ${JSON.stringify(constraints)}. Return a JSON array of the prioritized Task objects.`,
        'reasoning'
      );
      const jsonStr = response.content.match(/\[[\s\S]*\]/)?.[0] || '[]';
      return JSON.parse(jsonStr) as Task[];
    } catch (error) {
      throw new Error(`Failed to prioritize tasks: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
