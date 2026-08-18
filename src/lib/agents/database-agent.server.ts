import { routedCall } from '@/lib/model-router.server';

export interface SchemaDesign {
  tables: { name: string; schema: string }[];
  enums: string[];
}

export interface OptimizedQuery {
  original: string;
  optimized: string;
  explanation: string;
}

export interface SchemaReview {
  score: number;
  warnings: string[];
  recommendations: string[];
}

export interface IndexSuggestion {
  table: string;
  columns: string[];
  reason: string;
}

/**
 * DatabaseAgent provides capabilities for database design, query optimization, and schema reviews.
 */
export class DatabaseAgent {
  private systemPrompt = `You are an expert PostgreSQL database architect. Your goal is to design efficient schemas, optimize SQL queries, and ensure data integrity. Always return structured JSON when data is requested.`;

  /**
   * Designs a database schema based on given requirements.
   * @param requirements The application requirements.
   * @returns A schema design object.
   */
  async designSchema(requirements: object): Promise<SchemaDesign> {
    try {
      const response = await routedCall(
        this.systemPrompt,
        `Design a PostgreSQL schema for these requirements: ${JSON.stringify(requirements)}. Return a JSON object with 'tables' (array of objects with 'name' and 'schema' SQL definitions) and 'enums' (array of strings).`,
        'reasoning'
      );
      const jsonStr = response.content.match(/\{[\s\S]*\}/)?.[0] || '{}';
      return JSON.parse(jsonStr) as SchemaDesign;
    } catch (error) {
      throw new Error(`Failed to design schema: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Optimizes a list of SQL queries.
   * @param queries The SQL queries to optimize.
   * @returns An array of optimized queries with explanations.
   */
  async optimizeQueries(queries: string[]): Promise<OptimizedQuery[]> {
    try {
      const response = await routedCall(
        this.systemPrompt,
        `Optimize these PostgreSQL queries: ${JSON.stringify(queries)}. Return a JSON array of objects with 'original', 'optimized', and 'explanation'.`,
        'reasoning'
      );
      const jsonStr = response.content.match(/\[[\s\S]*\]/)?.[0] || '[]';
      return JSON.parse(jsonStr) as OptimizedQuery[];
    } catch (error) {
      throw new Error(`Failed to optimize queries: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Creates a SQL migration string based on proposed changes.
   * @param changes The schema changes required.
   * @returns The raw SQL migration string.
   */
  async createMigration(changes: object): Promise<string> {
    try {
      const response = await routedCall(
        this.systemPrompt,
        `Write a safe PostgreSQL migration script for these changes: ${JSON.stringify(changes)}. Return only the raw SQL.`,
        'generation'
      );
      return response.content.replace(/```sql\n/gi, '').replace(/\n```/g, '');
    } catch (error) {
      throw new Error(`Failed to create migration: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Reviews a provided SQL schema.
   * @param schema The SQL schema to review.
   * @returns A schema review result.
   */
  async reviewSchema(schema: string): Promise<SchemaReview> {
    try {
      const response = await routedCall(
        this.systemPrompt,
        `Review this PostgreSQL schema:\n\n${schema}\n\nReturn a JSON object with 'score' (number 0-100), 'warnings' (array of strings), and 'recommendations' (array of strings).`,
        'reasoning'
      );
      const jsonStr = response.content.match(/\{[\s\S]*\}/)?.[0] || '{}';
      return JSON.parse(jsonStr) as SchemaReview;
    } catch (error) {
      throw new Error(`Failed to review schema: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Suggests indexes for a schema given a set of common queries.
   * @param schema The database schema.
   * @param queries The queries run against the database.
   * @returns An array of index suggestions.
   */
  async suggestIndexes(schema: string, queries: string[]): Promise<IndexSuggestion[]> {
    try {
      const response = await routedCall(
        this.systemPrompt,
        `Given this schema:\n${schema}\n\nAnd these queries:\n${queries.join('\n')}\n\nSuggest indexes. Return a JSON array of objects with 'table' (string), 'columns' (array of strings), and 'reason' (string).`,
        'reasoning'
      );
      const jsonStr = response.content.match(/\[[\s\S]*\]/)?.[0] || '[]';
      return JSON.parse(jsonStr) as IndexSuggestion[];
    } catch (error) {
      throw new Error(`Failed to suggest indexes: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
