import { routedCall } from '@/lib/model-router.server';
import { logger } from '@/lib/logger.server';

export class DevOpsAgent {
  /**
   * Generates a CI pipeline (GitHub Actions YAML) for a given project type.
   * يولد مسار التكامل المستمر (CI pipeline) لنوع مشروع معين.
   */
  async generateCiPipeline(projectType: string, stack: string): Promise<string> {
    logger.info('DevOpsAgent generating CI pipeline...', { projectType, stack });
    return routedCall({
      kind: 'coding',
      systemPrompt: 'You are a DevOps Agent. Generate a complete GitHub Actions YAML file for the specified project type and stack.',
      prompt: `Project Type: ${projectType}\nStack: ${stack}`,
    });
  }

  /**
   * Generates a Dockerfile for the application.
   * يولد ملف Dockerfile للتطبيق.
   */
  async generateDockerfile(stack: string, entrypoint: string): Promise<string> {
    logger.info('DevOpsAgent generating Dockerfile...', { stack });
    return routedCall({
      kind: 'coding',
      systemPrompt: 'You are a DevOps Agent. Generate a production-ready Dockerfile for the specified stack and entrypoint.',
      prompt: `Stack: ${stack}\nEntrypoint: ${entrypoint}`,
    });
  }

  /**
   * Generates Nginx configuration.
   * يولد إعدادات Nginx.
   */
  async generateNginxConfig(domains: string[], ssl: boolean): Promise<string> {
    logger.info('DevOpsAgent generating Nginx config...');
    return routedCall({
      kind: 'coding',
      systemPrompt: 'You are a DevOps Agent. Generate a production-ready nginx.conf.',
      prompt: `Domains: ${domains.join(', ')}\nSSL Enabled: ${ssl}`,
    });
  }

  /**
   * Plans the deployment steps.
   * يخطط لخطوات النشر.
   */
  async planDeployment(project: Record<string, any>): Promise<string> {
    logger.info('DevOpsAgent planning deployment...');
    return routedCall({
      kind: 'coding',
      systemPrompt: 'You are a DevOps Agent. Generate a markdown deployment plan with clear steps.',
      prompt: `Project Details:\n${JSON.stringify(project, null, 2)}`,
    });
  }
}
