import { routedCall } from '@/lib/model-router.server';

export interface MigrationPlan {
  phases: string[];
  dataMigrationStrategy: string;
  risks: string[];
}

export interface MigratedFile {
  filename: string;
  content: string;
}

export interface ValidationResult {
  isEquivalent: boolean;
  differences: string[];
}

/**
 * MigrationAgent provides capabilities for planning migrations, generating SQL, and translating framework code.
 */
export class MigrationAgent {
  private systemPrompt = `You are an expert migration and modernization engineer. Your goal is to safely move systems from legacy to modern stacks, ensuring zero data loss and functional parity. Always return structured JSON when data is requested.`;

  /**
   * Plans a migration between two systems or frameworks.
   * @param from The current system/framework.
   * @param to The target system/framework.
   * @param codebase Overview of the codebase.
   * @returns A migration plan.
   */
  async planMigration(from: string, to: string, codebase: object): Promise<MigrationPlan> {
    try {
      const response = await routedCall(
        this.systemPrompt,
        `Plan a migration from "${from}" to "${to}" given this codebase context: ${JSON.stringify(codebase)}. Return a JSON object with 'phases' (array of strings), 'dataMigrationStrategy' (string), and 'risks' (array of strings).`,
        'reasoning'
      );
      const jsonStr = response.content.match(/\{[\s\S]*\}/)?.[0] || '{}';
      return JSON.parse(jsonStr) as MigrationPlan;
    } catch (error) {
      throw new Error(`Failed to plan migration: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Generates a database migration script.
   * @param changes The schema changes needed.
   * @returns The raw SQL migration string.
   */
  async generateDatabaseMigration(changes: object): Promise<string> {
    try {
      const response = await routedCall(
        this.systemPrompt,
        `Generate a SQL database migration script for these changes: ${JSON.stringify(changes)}. Return only raw SQL.`,
        'generation'
      );
      return response.content.replace(/```sql\n/gi, '').replace(/\n```/g, '');
    } catch (error) {
      throw new Error(`Failed to generate database migration: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Migrates framework code for a set of files.
   * @param from Source framework.
   * @param to Target framework.
   * @param files Array of file objects with name and content.
   * @returns Array of migrated files.
   */
  async migrateFramework(from: string, to: string, files: object[]): Promise<MigratedFile[]> {
    try {
      const response = await routedCall(
        this.systemPrompt,
        `Migrate these files from ${from} to ${to}:\n${JSON.stringify(files)}\n\nReturn a JSON array of objects with 'filename' and 'content' (raw code).`,
        'generation'
      );
      const jsonStr = response.content.match(/\[[\s\S]*\]/)?.[0] || '[]';
      return JSON.parse(jsonStr) as MigratedFile[];
    } catch (error) {
      throw new Error(`Failed to migrate framework: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Validates if the "before" and "after" states are functionally equivalent.
   * @param before The before state data.
   * @param after The after state data.
   * @returns A validation result.
   */
  async validateMigration(before: object, after: object): Promise<ValidationResult> {
    try {
      const response = await routedCall(
        this.systemPrompt,
        `Validate if 'before' and 'after' data are equivalent.\nBefore: ${JSON.stringify(before)}\nAfter: ${JSON.stringify(after)}\n\nReturn a JSON object with 'isEquivalent' (boolean) and 'differences' (array of strings).`,
        'reasoning'
      );
      const jsonStr = response.content.match(/\{[\s\S]*\}/)?.[0] || '{}';
      return JSON.parse(jsonStr) as ValidationResult;
    } catch (error) {
      throw new Error(`Failed to validate migration: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
