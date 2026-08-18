import { routedCall } from '@/lib/model-router.server';
import { logger } from '@/lib/logger.server';

export class SecurityAgent {
  /**
   * Audits code files for security vulnerabilities.
   * يدقق ملفات الكود بحثًا عن ثغرات أمنية.
   */
  async auditCode(files: Array<{path: string, content: string}>): Promise<Record<string, any>> {
    logger.info('SecurityAgent auditing code...', { fileCount: files.length });
    const response = await routedCall({
      kind: 'reasoning',
      systemPrompt: 'You are a Security Agent. Perform a deep security analysis covering OWASP Top 10, injection, auth bugs, and secret leakage. Return a JSON report.',
      prompt: `Files:\n${JSON.stringify(files)}`,
      responseFormat: 'json',
    });
    return JSON.parse(response);
  }

  /**
   * Audits dependencies for known CVEs.
   * يدقق التبعيات بحثًا عن ثغرات معروفة (CVEs).
   */
  async auditDependencies(packageJson: Record<string, any>): Promise<Record<string, any>> {
    logger.info('SecurityAgent auditing dependencies...');
    const response = await routedCall({
      kind: 'reasoning',
      systemPrompt: 'You are a Security Agent. Check these dependencies for known CVEs. Return a JSON report.',
      prompt: `Package.json:\n${JSON.stringify(packageJson, null, 2)}`,
      responseFormat: 'json',
    });
    return JSON.parse(response);
  }

  /**
   * Generates a security report with CVSS scores.
   * يولد تقريرًا أمنيًا مع درجات CVSS.
   */
  async generateSecurityReport(auditResult: Record<string, any>): Promise<string> {
    logger.info('SecurityAgent generating security report...');
    return routedCall({
      kind: 'reasoning',
      systemPrompt: 'You are a Security Agent. Generate a markdown security report based on the audit results, including estimated CVSS scores.',
      prompt: `Audit Result:\n${JSON.stringify(auditResult, null, 2)}`,
    });
  }

  /**
   * Suggests concrete code fixes for a given vulnerability.
   * يقترح إصلاحات كود ملموسة لثغرة معينة.
   */
  async suggestFixes(vulnerability: Record<string, any>): Promise<string> {
    logger.info('SecurityAgent suggesting fixes...');
    return routedCall({
      kind: 'reasoning',
      systemPrompt: 'You are a Security Agent. Provide a concrete code fix for the specified vulnerability.',
      prompt: `Vulnerability:\n${JSON.stringify(vulnerability, null, 2)}`,
    });
  }
}
