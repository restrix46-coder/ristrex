import { routedCall } from '@/lib/model-router.server';

export interface A11yAuditResult {
  score: number;
  violations: { element: string; issue: string; rule: string }[];
}

export interface ContrastResult {
  ratio: number;
  passesAA: boolean;
  passesAAA: boolean;
}

/**
 * AccessibilityAgent provides capabilities for auditing accessibility, fixing violations, and checking contrast.
 */
export class AccessibilityAgent {
  private systemPrompt = `You are a WCAG 2.1 AA expert. Your goal is to ensure web content is accessible to all users, properly semantic, and compliant with accessibility standards. Always return structured JSON when data is requested.`;

  /**
   * Audits HTML content for accessibility violations.
   * @param html The HTML content to audit.
   * @param url Optional URL context.
   * @returns An accessibility audit result.
   */
  async auditAccessibility(html: string, url?: string): Promise<A11yAuditResult> {
    try {
      const context = url ? ` for URL: ${url}` : '';
      const response = await routedCall(
        this.systemPrompt,
        `Audit this HTML for WCAG 2.1 AA compliance${context}:\n\n${html}\n\nReturn a JSON object with 'score' (number 0-100) and 'violations' (array of objects with 'element', 'issue', and 'rule').`,
        'reasoning'
      );
      const jsonStr = response.content.match(/\{[\s\S]*\}/)?.[0] || '{}';
      return JSON.parse(jsonStr) as A11yAuditResult;
    } catch (error) {
      throw new Error(`Failed to audit accessibility: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Fixes accessibility violations in a given HTML string.
   * @param html The HTML content with violations.
   * @param violations The list of violations to fix.
   * @returns The fixed HTML string.
   */
  async fixViolations(html: string, violations: object[]): Promise<string> {
    try {
      const response = await routedCall(
        this.systemPrompt,
        `Fix these accessibility violations: ${JSON.stringify(violations)} in the following HTML:\n\n${html}\n\nReturn only the fixed raw HTML.`,
        'generation'
      );
      return response.content.replace(/```html\n/gi, '').replace(/\n```/g, '');
    } catch (error) {
      throw new Error(`Failed to fix violations: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Generates appropriate ARIA attributes for a given element and context.
   * @param element The HTML element or description.
   * @param context The usage context for the element.
   * @returns A string containing the ARIA attributes to add.
   */
  async generateAria(element: string, context: string): Promise<string> {
    try {
      const response = await routedCall(
        this.systemPrompt,
        `Generate ARIA attributes for element: "${element}" used in context: "${context}". Return a string formatted as HTML attributes (e.g., aria-label="...").`,
        'generation'
      );
      return response.content.replace(/```[\w]*\n/g, '').replace(/\n```/g, '');
    } catch (error) {
      throw new Error(`Failed to generate ARIA: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Checks the color contrast between foreground and background colors.
   * @param fg The foreground color.
   * @param bg The background color.
   * @returns A contrast result.
   */
  async checkColorContrast(fg: string, bg: string): Promise<ContrastResult> {
    try {
      const response = await routedCall(
        this.systemPrompt,
        `Calculate color contrast for foreground "${fg}" and background "${bg}". Return a JSON object with 'ratio' (number), 'passesAA' (boolean), and 'passesAAA' (boolean).`,
        'reasoning'
      );
      const jsonStr = response.content.match(/\{[\s\S]*\}/)?.[0] || '{}';
      return JSON.parse(jsonStr) as ContrastResult;
    } catch (error) {
      throw new Error(`Failed to check color contrast: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
