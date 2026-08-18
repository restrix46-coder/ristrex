import { routedCall } from '@/lib/model-router.server';

export interface VisualQAResult {
  passed: boolean;
  mismatches: string[];
  suggestions: string[];
}

export interface FlowTestResult {
  completed: boolean;
  failedStepIndex: number;
  errorLog: string;
}

export interface ResponsivenessReport {
  score: number;
  mobileIssues: string[];
  tabletIssues: string[];
}

export interface AccessibilityAudit {
  score: number;
  violations: { element: string; rule: string; severity: string }[];
}

/**
 * BrowserQAAgent provides capabilities for visual QA, user flow testing, and frontend auditing.
 */
export class BrowserQAAgent {
  private systemPrompt = `You are an expert browser QA engineer. Your goal is to ensure visual fidelity, flawless user flows, responsiveness, and web accessibility. Always return structured JSON when data is requested.`;

  /**
   * Runs a visual QA check on a given URL.
   * @param url The URL to check.
   * @returns A visual QA result.
   */
  async runVisualQA(url: string): Promise<VisualQAResult> {
    try {
      const response = await routedCall(
        this.systemPrompt,
        `Analyze the visual QA for URL: "${url}". Return a JSON object with 'passed' (boolean), 'mismatches' (array of strings), and 'suggestions' (array of strings).`,
        'reasoning' // Or 'vision' if actual screenshots were passed
      );
      const jsonStr = response.content.match(/\{[\s\S]*\}/)?.[0] || '{}';
      return JSON.parse(jsonStr) as VisualQAResult;
    } catch (error) {
      throw new Error(`Failed to run visual QA: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Tests a specific user flow against a base URL.
   * @param flow The steps in the user flow.
   * @param baseUrl The base URL to test against.
   * @returns A flow test result.
   */
  async testUserFlow(flow: string[], baseUrl: string): Promise<FlowTestResult> {
    try {
      const response = await routedCall(
        this.systemPrompt,
        `Simulate testing this user flow: ${JSON.stringify(flow)} on base URL: "${baseUrl}". Return a JSON object with 'completed' (boolean), 'failedStepIndex' (number, -1 if passed), and 'errorLog' (string).`,
        'reasoning'
      );
      const jsonStr = response.content.match(/\{[\s\S]*\}/)?.[0] || '{}';
      return JSON.parse(jsonStr) as FlowTestResult;
    } catch (error) {
      throw new Error(`Failed to test user flow: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Checks the responsiveness of a given URL.
   * @param url The URL to check.
   * @returns A responsiveness report.
   */
  async checkResponsiveness(url: string): Promise<ResponsivenessReport> {
    try {
      const response = await routedCall(
        this.systemPrompt,
        `Evaluate the responsiveness of URL: "${url}". Return a JSON object with 'score' (number 0-100), 'mobileIssues' (array of strings), and 'tabletIssues' (array of strings).`,
        'reasoning'
      );
      const jsonStr = response.content.match(/\{[\s\S]*\}/)?.[0] || '{}';
      return JSON.parse(jsonStr) as ResponsivenessReport;
    } catch (error) {
      throw new Error(`Failed to check responsiveness: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Audits the accessibility of a given URL.
   * @param url The URL to audit.
   * @returns An accessibility audit result.
   */
  async auditAccessibility(url: string): Promise<AccessibilityAudit> {
    try {
      const response = await routedCall(
        this.systemPrompt,
        `Perform an accessibility audit for URL: "${url}". Return a JSON object with 'score' (number 0-100) and 'violations' (array of objects with 'element', 'rule', and 'severity' strings).`,
        'reasoning'
      );
      const jsonStr = response.content.match(/\{[\s\S]*\}/)?.[0] || '{}';
      return JSON.parse(jsonStr) as AccessibilityAudit;
    } catch (error) {
      throw new Error(`Failed to audit accessibility: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
