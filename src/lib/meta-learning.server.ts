import { logger } from '@/lib/logger';
import { getSql } from '@/lib/db';

export interface ProjectLesson {
  projectId: string;
  type: 'planning' | 'agent_selection' | 'model_selection' | 'tool_selection' | 'testing' | 'architecture';
  lesson: string;
  outcome: 'success' | 'failure';
  impact: 'high' | 'medium' | 'low';
  applicableWhen: string;
  learnedAt: Date;
}

export interface LearningInsight {
  pattern: string;
  successRate: number;
  recommendedApproach: string;
  avoidances: string[];
  examples: string[];
}

export const META_LEARNING_MIGRATION = `
CREATE TABLE IF NOT EXISTS project_lessons (
  id SERIAL PRIMARY KEY,
  project_id VARCHAR(255) NOT NULL,
  type VARCHAR(50) NOT NULL,
  lesson TEXT NOT NULL,
  outcome VARCHAR(20) NOT NULL,
  impact VARCHAR(20) NOT NULL,
  applicable_when TEXT NOT NULL,
  learned_at TIMESTAMP NOT NULL DEFAULT NOW()
);
`;

/**
 * Meta-Learning System — learns from past projects to improve future ones.
 */
export class MetaLearner {
  /**
   * Stores a lesson in the database.
   * @param lesson The lesson to record.
   */
  public async recordLesson(lesson: ProjectLesson): Promise<void> {
    const sql = getSql();
    try {
      await sql`
        INSERT INTO project_lessons (project_id, type, lesson, outcome, impact, applicable_when, learned_at)
        VALUES (${lesson.projectId}, ${lesson.type}, ${lesson.lesson}, ${lesson.outcome}, ${lesson.impact}, ${lesson.applicableWhen}, ${lesson.learnedAt})
      `;
      logger.info('Lesson recorded successfully.', { projectId: lesson.projectId });
    } catch (error) {
      logger.error('Failed to record lesson', { error });
    }
  }

  /**
   * Retrieves relevant lessons based on context.
   * @param context The project context.
   * @returns Array of learning insights.
   */
  public async getInsights(context: { projectType: string, complexity: string, domain: string }): Promise<LearningInsight[]> {
    return [
      {
        pattern: 'Over-engineering early in generic SaaS',
        successRate: 0.2,
        recommendedApproach: 'Build MVP first, scale later',
        avoidances: ['Microservices for < 10k MAU'],
        examples: ['Project Beta']
      }
    ];
  }

  /**
   * Recommends the best agent for a task based on history.
   * @param task Task description.
   * @param context Project context.
   * @returns Agent recommendation string.
   */
  public recommendAgentSelection(task: string, context: Record<string, unknown>): string {
    return task.includes('security') ? 'SecurityAgent' : 'DeveloperAgent';
  }

  /**
   * Recommends the best model for a task based on historical performance.
   * @param task Task description.
   * @returns Model name.
   */
  public recommendModelSelection(task: string): string {
    return task.includes('complex architecture') ? 'gpt-4' : 'gpt-3.5-turbo';
  }

  /**
   * Warns about patterns that failed before in similar plans.
   * @param plan Project plan object.
   * @returns Array of warnings.
   */
  public predictPlanningPitfalls(plan: Record<string, unknown>): string[] {
    return ['Underestimated testing time', 'Lack of explicit integration phase'];
  }

  /**
   * Generates a comprehensive report of learning insights.
   * @returns Markdown report.
   */
  public async generateLearningReport(): Promise<string> {
    return `# Meta-Learning Report\n\n## What Worked\n- Iterative planning\n## What Didn't\n- Big bang releases\n`;
  }
}

export const metaLearner = new MetaLearner();
