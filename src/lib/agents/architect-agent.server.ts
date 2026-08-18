import { routedCall } from '@/lib/model-router.server';
import { logger } from '@/lib/logger.server';

export interface ArchitectureOutput {
  systemArchitecture: Record<string, any>;
  databaseSchema: Record<string, any>;
  apiDesign: Record<string, any>;
  securityModel: Record<string, any>;
  deploymentPlan: Record<string, any>;
  techStack: Record<string, any>;
}

export class ArchitectAgent {
  /**
   * Designs the system architecture based on requirements and project type.
   * يصمم بنية النظام بناءً على المتطلبات ونوع المشروع.
   *
   * @param requirements - Structured requirements object.
   * @param projectType - Type of the project (e.g., 'web', 'mobile', 'api').
   * @returns A promise that resolves to the structured architecture design.
   */
  async design(requirements: Record<string, any>, projectType: string): Promise<ArchitectureOutput> {
    logger.info('ArchitectAgent designing system...', { projectType });

    const systemPrompt = `You are a specialized Software Architect Agent.
Design the system architecture based on the given requirements and project type.
Consider scalability, security, and performance in every decision.
Return a structured JSON object containing:
- systemArchitecture: Object
- databaseSchema: Object
- apiDesign: Object
- securityModel: Object
- deploymentPlan: Object
- techStack: Object`;

    const prompt = `Project Type: ${projectType}\n\nRequirements: ${JSON.stringify(requirements, null, 2)}`;

    try {
      const response = await routedCall({
        kind: 'reasoning',
        systemPrompt,
        prompt,
        responseFormat: 'json',
      });

      const parsed: ArchitectureOutput = JSON.parse(response);
      return parsed;
    } catch (error) {
      logger.error('Error in ArchitectAgent.design', { error });
      throw error;
    }
  }
}
