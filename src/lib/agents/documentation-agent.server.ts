import { routedCall } from '@/lib/model-router.server';
import { logger } from '@/lib/logger.server';

export class DocumentationAgent {
  /**
   * Generates a full README.md for the project.
   * يولد ملف README.md كامل للمشروع.
   */
  async generateReadme(project: Record<string, any>): Promise<string> {
    logger.info('DocumentationAgent generating README...');
    return routedCall({
      kind: 'coding',
      systemPrompt: 'You are a Documentation Agent. Generate a comprehensive README.md for the project.',
      prompt: `Project Details:\n${JSON.stringify(project, null, 2)}`,
    });
  }

  /**
   * Generates OpenAPI-ready API documentation.
   * يولد توثيق API جاهز كـ OpenAPI.
   */
  async generateApiDocs(contracts: Record<string, any>[]): Promise<string> {
    logger.info('DocumentationAgent generating API docs...');
    return routedCall({
      kind: 'coding',
      systemPrompt: 'You are a Documentation Agent. Generate OpenAPI 3.0 specification in YAML format from the given contracts.',
      prompt: `Contracts:\n${JSON.stringify(contracts, null, 2)}`,
    });
  }

  /**
   * Generates a formatted CHANGELOG from commit messages.
   * يولد سجل تغييرات منسق من رسائل الـ commits.
   */
  async generateChangelog(commits: string[]): Promise<string> {
    logger.info('DocumentationAgent generating Changelog...');
    return routedCall({
      kind: 'coding',
      systemPrompt: 'You are a Documentation Agent. Generate a formatted CHANGELOG.md based on the provided commits.',
      prompt: `Commits:\n${commits.join('\n')}`,
    });
  }

  /**
   * Generates an architecture guide with Mermaid diagrams.
   * يولد دليل بنية النظام مع رسوم بيانية من نوع Mermaid.
   */
  async generateArchitectureDocs(architecture: Record<string, any>): Promise<string> {
    logger.info('DocumentationAgent generating Architecture docs...');
    return routedCall({
      kind: 'coding',
      systemPrompt: 'You are a Documentation Agent. Generate an architecture guide with Mermaid diagrams based on the provided architecture definition.',
      prompt: `Architecture Definition:\n${JSON.stringify(architecture, null, 2)}`,
    });
  }
}
