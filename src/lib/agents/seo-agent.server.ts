import { routedCall } from '@/lib/model-router.server';

export interface SeoAuditResult {
  score: number;
  issues: string[];
  recommendations: string[];
}

export interface SeoMetadata {
  title: string;
  description: string;
  keywords: string[];
  openGraph: Record<string, string>;
}

export interface KeywordAnalysis {
  relevance: number;
  missingKeywords: string[];
  suggestions: string[];
}

/**
 * SeoAgent provides capabilities for auditing SEO, generating metadata, and keyword analysis.
 */
export class SeoAgent {
  private systemPrompt = `You are an expert SEO engineer. Your goal is to optimize web content for search engines, ensure proper metadata, and analyze keyword targeting. Always return structured JSON when data is requested.`;

  /**
   * Audits the SEO of a given URL and its HTML content.
   * @param url The URL being audited.
   * @param html The HTML content of the page.
   * @returns An SEO audit result.
   */
  async auditSeo(url: string, html: string): Promise<SeoAuditResult> {
    try {
      const response = await routedCall(
        this.systemPrompt,
        `Audit the SEO for URL: "${url}" with this HTML content:\n\n${html}\n\nReturn a JSON object with 'score' (number 0-100), 'issues' (array of strings), and 'recommendations' (array of strings).`,
        'reasoning'
      );
      const jsonStr = response.content.match(/\{[\s\S]*\}/)?.[0] || '{}';
      return JSON.parse(jsonStr) as SeoAuditResult;
    } catch (error) {
      throw new Error(`Failed to audit SEO: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Generates SEO metadata for a given content and type.
   * @param content The page content or description.
   * @param type The type of page (e.g., 'article', 'product').
   * @returns Generated SEO metadata.
   */
  async generateMetadata(content: string, type: string): Promise<SeoMetadata> {
    try {
      const response = await routedCall(
        this.systemPrompt,
        `Generate SEO metadata for a page of type "${type}" with this content: "${content}". Return a JSON object with 'title' (string, max 60 chars), 'description' (string, max 160 chars), 'keywords' (array of strings), and 'openGraph' (object with og: tags).`,
        'reasoning'
      );
      const jsonStr = response.content.match(/\{[\s\S]*\}/)?.[0] || '{}';
      return JSON.parse(jsonStr) as SeoMetadata;
    } catch (error) {
      throw new Error(`Failed to generate metadata: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Creates an XML sitemap from a list of routes.
   * @param routes Array of URL routes.
   * @returns The generated XML sitemap as a string.
   */
  async createSitemap(routes: string[]): Promise<string> {
    try {
      const response = await routedCall(
        this.systemPrompt,
        `Generate a valid XML sitemap for these routes: ${JSON.stringify(routes)}. Return only the raw XML.`,
        'generation'
      );
      return response.content.replace(/```xml\n/gi, '').replace(/\n```/g, '');
    } catch (error) {
      throw new Error(`Failed to create sitemap: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Analyzes content against a target keyword phrase.
   * @param content The content to analyze.
   * @param target The target keyword phrase.
   * @returns A keyword analysis result.
   */
  async analyzeKeywords(content: string, target: string): Promise<KeywordAnalysis> {
    try {
      const response = await routedCall(
        this.systemPrompt,
        `Analyze this content against the target keyword: "${target}".\n\nContent:\n${content}\n\nReturn a JSON object with 'relevance' (number 0-100), 'missingKeywords' (array of related keywords not present), and 'suggestions' (array of strings to improve targeting).`,
        'reasoning'
      );
      const jsonStr = response.content.match(/\{[\s\S]*\}/)?.[0] || '{}';
      return JSON.parse(jsonStr) as KeywordAnalysis;
    } catch (error) {
      throw new Error(`Failed to analyze keywords: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
