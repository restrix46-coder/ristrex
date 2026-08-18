import { routedCall } from '@/lib/model-router.server';
import { logger } from '@/lib/logger.server';
import { eventBus } from '@/lib/event-bus.server';

export interface RequirementsOutput {
  userStories: string[];
  acceptanceCriteria: string[];
  functionalRequirements: string[];
  nonFunctionalRequirements: string[];
  constraints: string[];
  risks: string[];
  technicalPlan: Record<string, any>;
}

export class RequirementsAgent {
  /**
   * Analyzes user input and project context to extract requirements.
   * يقوم بتحليل مدخلات المستخدم وسياق المشروع لاستخراج المتطلبات.
   *
   * @param userInput - The raw user input/request.
   * @param projectContext - The existing project context.
   * @returns A promise that resolves to the structured requirements.
   */
  async analyze(userInput: string, projectContext: Record<string, any>): Promise<RequirementsOutput> {
    logger.info('RequirementsAgent analyzing input...', { userInputLength: userInput.length });

    const systemPrompt = `You are a specialized Requirements Engineering Agent.
Your task is to analyze the user input and project context, and produce a structured JSON object containing:
- userStories: Array of strings
- acceptanceCriteria: Array of strings
- functionalRequirements: Array of strings
- nonFunctionalRequirements: Array of strings
- constraints: Array of strings
- risks: Array of strings
- technicalPlan: Object representing a high-level technical plan

Validate that your output is complete and accurate.`;

    const prompt = `User Input: ${userInput}\n\nProject Context: ${JSON.stringify(projectContext, null, 2)}`;

    try {
      const response = await routedCall({
        kind: 'reasoning',
        systemPrompt,
        prompt,
        responseFormat: 'json',
      });

      const parsed: RequirementsOutput = JSON.parse(response);

      if (!parsed.userStories || !parsed.functionalRequirements) {
        throw new Error('Incomplete requirements generated');
      }

      try {
        if (eventBus && eventBus.emit) {
          eventBus.emit('requirements:generated', parsed);
        }
      } catch (e) {
        logger.warn('Failed to emit requirements:generated event', { error: e });
      }

      return parsed;
    } catch (error) {
      logger.error('Error in RequirementsAgent.analyze', { error });
      throw error;
    }
  }
}
