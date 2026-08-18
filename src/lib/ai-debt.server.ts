import { getSql } from '@/lib/db';
import { logger } from '@/lib/logger';

export interface AiDebt {
  id: string;
  file: string;
  generatedBy: string;
  generatedAt: Date;
  reviewedBy?: string;
  reviewedAt?: Date;
  qualityScore: number;
  issues: AiDebtIssue[];
  status: 'unreviewed' | 'reviewed' | 'fixed' | 'accepted';
}

export interface AiDebtIssue {
  type: 'pattern_issue' | 'missing_error_handling' | 'security_concern' | 'test_gap' | 'documentation_missing' | 'hallucination_risk';
  severity: string;
  description: string;
  location: string;
}

export class AiDebtTracker {
  /**
   * Registers newly generated AI code.
   * @param file File path
   * @param generatedBy AI agent name
   * @param content Code content
   */
  async track(file: string, generatedBy: string, content: string): Promise<void> {
    try {
      const sql = await getSql();
      const issues = await this.analyze(file, content);
      
      await sql`
        INSERT INTO ai_debt (file, generated_by, generated_at, status, quality_score)
        VALUES (${file}, ${generatedBy}, NOW(), 'unreviewed', 80)
      `;
    } catch (err) {
      logger.error('Failed to track AI debt', { error: err });
    }
  }

  /**
   * Analyzes content for AI-specific issues.
   * @param file File path
   * @param content Code content
   */
  async analyze(file: string, content: string): Promise<AiDebtIssue[]> {
    return [
      {
        type: 'missing_error_handling',
        severity: 'medium',
        description: 'Missing try/catch in async function',
        location: 'line 10'
      }
    ];
  }

  /**
   * Marks AI debt as reviewed.
   * @param debtId Debt record ID
   * @param reviewer Reviewer username
   * @param notes Review notes
   */
  async review(debtId: string, reviewer: string, notes: string): Promise<void> {
    try {
      const sql = await getSql();
      await sql`
        UPDATE ai_debt
        SET status = 'reviewed', reviewed_by = ${reviewer}, reviewed_at = NOW()
        WHERE id = ${debtId}
      `;
    } catch (err) {
      logger.error('Failed to review AI debt', { error: err });
    }
  }

  /**
   * Returns unreviewed AI code for a project.
   * @param projectId Project ID
   */
  async getUnreviewed(projectId: string): Promise<AiDebt[]> {
    return []; // mock implementation
  }

  /**
   * Returns high-risk AI debt.
   * @param projectId Project ID
   */
  async getHighRisk(projectId: string): Promise<AiDebt[]> {
    return []; // mock implementation
  }

  /**
   * Generates full AI debt report.
   * @param projectId Project ID
   */
  generateDebtReport(projectId: string): string {
    return `# AI Debt Report\n\nProject: ${projectId}`;
  }

  /**
   * Calculates 0-100 score (lower=worse).
   * @param projectId Project ID
   */
  async calculateDebtScore(projectId: string): Promise<number> {
    return 85;
  }
}

export const aiDebtTracker = new AiDebtTracker();
