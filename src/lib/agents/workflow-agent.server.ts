import { routedCall } from '@/lib/model-router.server';

export interface WorkflowDesign {
  id: string;
  name: string;
  steps: { id: string; action: string; next?: string }[];
}

export interface WorkflowOptimization {
  bottlenecks: string[];
  suggestions: string[];
  estimatedImprovement: string;
}

export interface WorkflowStatus {
  state: 'running' | 'completed' | 'failed' | 'paused';
  currentStep: string;
  logs: string[];
}

/**
 * WorkflowAgent provides capabilities for designing, optimizing, and monitoring business processes.
 */
export class WorkflowAgent {
  private systemPrompt = `You are an expert workflow and BPM engineer. Your goal is to design efficient processes, identify bottlenecks, and model workflows effectively. Always return structured JSON or raw domain-specific formats when requested.`;

  /**
   * Designs a workflow from a description and set of steps.
   * @param process Description of the process.
   * @param steps Array of step descriptions.
   * @returns A structured workflow design.
   */
  async designWorkflow(process: string, steps: string[]): Promise<WorkflowDesign> {
    try {
      const response = await routedCall(
        this.systemPrompt,
        `Design a workflow for process: "${process}" given these steps: ${JSON.stringify(steps)}. Return a JSON object with 'id', 'name', and 'steps' (array of objects with 'id', 'action', and optional 'next' step id).`,
        'reasoning'
      );
      const jsonStr = response.content.match(/\{[\s\S]*\}/)?.[0] || '{}';
      return JSON.parse(jsonStr) as WorkflowDesign;
    } catch (error) {
      throw new Error(`Failed to design workflow: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Optimizes an existing workflow definition.
   * @param current The current workflow object.
   * @returns A workflow optimization report.
   */
  async optimizeWorkflow(current: object): Promise<WorkflowOptimization> {
    try {
      const response = await routedCall(
        this.systemPrompt,
        `Optimize this workflow: ${JSON.stringify(current)}. Return a JSON object with 'bottlenecks' (array of strings), 'suggestions' (array of strings), and 'estimatedImprovement' (string).`,
        'reasoning'
      );
      const jsonStr = response.content.match(/\{[\s\S]*\}/)?.[0] || '{}';
      return JSON.parse(jsonStr) as WorkflowOptimization;
    } catch (error) {
      throw new Error(`Failed to optimize workflow: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Generates a BPMN-like text description of a workflow.
   * @param workflow The workflow design object.
   * @returns A string representation (BPMN XML or similar text format).
   */
  async generateBpmn(workflow: WorkflowDesign): Promise<string> {
    try {
      const response = await routedCall(
        this.systemPrompt,
        `Generate a BPMN XML representation for this workflow: ${JSON.stringify(workflow)}. Return only the raw XML.`,
        'generation'
      );
      return response.content.replace(/```xml\n/gi, '').replace(/\n```/g, '');
    } catch (error) {
      throw new Error(`Failed to generate BPMN: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Simulates monitoring a workflow instance.
   * @param instanceId The ID of the workflow instance.
   * @returns The current status of the workflow.
   */
  async monitorWorkflow(instanceId: string): Promise<WorkflowStatus> {
    try {
      const response = await routedCall(
        this.systemPrompt,
        `Simulate fetching status for workflow instance ID: "${instanceId}". Return a JSON object with 'state' (running/completed/failed/paused), 'currentStep' (string), and 'logs' (array of strings).`,
        'reasoning'
      );
      const jsonStr = response.content.match(/\{[\s\S]*\}/)?.[0] || '{}';
      return JSON.parse(jsonStr) as WorkflowStatus;
    } catch (error) {
      throw new Error(`Failed to monitor workflow: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
