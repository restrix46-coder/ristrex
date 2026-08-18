import { routedCall } from '@/lib/model-router.server';
import { logger } from '@/lib/logger.server';

export class TestingAgent {
  /**
   * Generates unit tests for the provided code.
   * يولد اختبارات الوحدة للكود المعطى.
   */
  async generateUnitTests(code: string, filePath: string): Promise<string> {
    logger.info('TestingAgent generating unit tests...', { filePath });
    return routedCall({
      kind: 'coding',
      systemPrompt: 'You are a specialized Testing Agent. Generate high-quality unit tests for the provided code. Ensure high coverage.',
      prompt: `File: ${filePath}\n\nCode:\n${code}`,
    });
  }

  /**
   * Generates integration tests based on an API contract.
   * يولد اختبارات التكامل بناءً على عقد API.
   */
  async generateIntegrationTests(apiContract: Record<string, any>): Promise<string> {
    logger.info('TestingAgent generating integration tests...');
    return routedCall({
      kind: 'coding',
      systemPrompt: 'You are a specialized Testing Agent. Generate integration tests based on the provided API contract.',
      prompt: `API Contract: ${JSON.stringify(apiContract, null, 2)}`,
    });
  }

  /**
   * Analyzes test coverage and identifies gaps.
   * يحلل تغطية الاختبارات ويحدد الثغرات.
   */
  async analyzeTestCoverage(testResults: Record<string, any>): Promise<string> {
    logger.info('TestingAgent analyzing coverage...');
    return routedCall({
      kind: 'coding',
      systemPrompt: 'You are a Testing Agent. Analyze the test coverage results and identify gaps or untested areas. Return markdown output.',
      prompt: `Test Results: ${JSON.stringify(testResults, null, 2)}`,
    });
  }

  /**
   * Generates end-to-end scenarios using Playwright based on user flows.
   * يولد سيناريوهات شاملة باستخدام Playwright بناءً على تدفقات المستخدم.
   */
  async generateE2EScenarios(userFlows: string[]): Promise<string> {
    logger.info('TestingAgent generating E2E scenarios...');
    return routedCall({
      kind: 'coding',
      systemPrompt: 'You are a Testing Agent. Generate Playwright E2E test scenarios based on the provided user flows.',
      prompt: `User Flows:\n${userFlows.join('\n')}`,
    });
  }
}
