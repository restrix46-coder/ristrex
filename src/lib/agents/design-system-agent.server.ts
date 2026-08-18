import { routedCall } from '@/lib/model-router.server';

export interface DesignTokens {
  colors: Record<string, string>;
  typography: Record<string, string>;
  spacing: Record<string, string>;
  shadows: Record<string, string>;
}

export interface ComponentSpec {
  name: string;
  props: Record<string, string>;
  variants: Record<string, Record<string, string>>;
  accessibilityNotes: string[];
}

export interface ConsistencyReport {
  score: number;
  inconsistencies: string[];
  recommendations: string[];
}

/**
 * DesignSystemAgent provides capabilities for creating design tokens, component specs, and style guides.
 */
export class DesignSystemAgent {
  private systemPrompt = `You are an expert design system architect. Your goal is to create scalable design tokens, specify robust components, and ensure design consistency across the codebase. Always return structured JSON when data is requested.`;

  /**
   * Generates design tokens based on brand colors and a style.
   * @param brandColors Array of brand color hex codes.
   * @param style The desired style (e.g., 'modern', 'brutalist').
   * @returns Generated design tokens.
   */
  async generateTokens(brandColors: string[], style: string): Promise<DesignTokens> {
    try {
      const response = await routedCall(
        this.systemPrompt,
        `Generate design tokens for brand colors: ${brandColors.join(', ')} and style: "${style}". Return a JSON object with 'colors', 'typography', 'spacing', and 'shadows' objects containing key-value string pairs.`,
        'generation'
      );
      const jsonStr = response.content.match(/\{[\s\S]*\}/)?.[0] || '{}';
      return JSON.parse(jsonStr) as DesignTokens;
    } catch (error) {
      throw new Error(`Failed to generate tokens: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Creates a component specification including props and variants.
   * @param name The name of the component.
   * @param variants Array of variant names to include.
   * @returns A structured component specification.
   */
  async createComponent(name: string, variants: string[]): Promise<ComponentSpec> {
    try {
      const response = await routedCall(
        this.systemPrompt,
        `Create a component spec for "${name}" with variants: ${variants.join(', ')}. Return a JSON object with 'name' (string), 'props' (object of prop names to types), 'variants' (object mapping variant names to style objects), and 'accessibilityNotes' (array of strings).`,
        'reasoning'
      );
      const jsonStr = response.content.match(/\{[\s\S]*\}/)?.[0] || '{}';
      return JSON.parse(jsonStr) as ComponentSpec;
    } catch (error) {
      throw new Error(`Failed to create component spec: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Audits a codebase or code snippet for design system consistency.
   * @param codebase The code to audit.
   * @returns A consistency report.
   */
  async auditDesignConsistency(codebase: string): Promise<ConsistencyReport> {
    try {
      const response = await routedCall(
        this.systemPrompt,
        `Audit this codebase snippet for design system consistency: \n\n${codebase}\n\nReturn a JSON object with 'score' (number 0-100), 'inconsistencies' (array of strings), and 'recommendations' (array of strings).`,
        'reasoning'
      );
      const jsonStr = response.content.match(/\{[\s\S]*\}/)?.[0] || '{}';
      return JSON.parse(jsonStr) as ConsistencyReport;
    } catch (error) {
      throw new Error(`Failed to audit design consistency: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Generates a markdown style guide from design tokens.
   * @param tokens The design tokens object.
   * @returns A markdown formatted style guide.
   */
  async generateStyleGuide(tokens: object): Promise<string> {
    try {
      const response = await routedCall(
        this.systemPrompt,
        `Generate a comprehensive Markdown style guide for the following design tokens: ${JSON.stringify(tokens)}. Include code snippets and usage guidelines.`,
        'generation'
      );
      return response.content;
    } catch (error) {
      throw new Error(`Failed to generate style guide: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
