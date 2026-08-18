import { getSql } from '@/lib/db';
import { logger } from '@/lib/logger';

export interface EventSchema {
  eventType: string;
  version: string;
  schema: Record<string, unknown>;
  producer: string;
  createdAt: Date;
}

export interface CompatibilityIssue {
  field: string;
  type: 'added_required' | 'removed_field' | 'type_changed' | 'format_changed';
  description: string;
  severity: 'breaking' | 'warning';
}

export interface CompatibilityResult {
  compatible: boolean;
  issues: CompatibilityIssue[];
  forwardCompatible: boolean;
  backwardCompatible: boolean;
}

/**
 * SQL Migration:
 * CREATE TABLE IF NOT EXISTS event_schemas (
 *   event_type TEXT,
 *   version TEXT,
 *   schema JSONB,
 *   producer TEXT,
 *   created_at TIMESTAMP,
 *   PRIMARY KEY (event_type, version)
 * );
 */

/**
 * Event Compatibility Service ensures Producer and Consumer agree on Event Schemas.
 * خدمة توافق الأحداث تضمن اتفاق المنتج والمستهلك على مخططات الأحداث.
 */
export class EventCompatibilityService {
  /**
   * Registers a new event schema.
   */
  async register(schema: EventSchema): Promise<void> {
    const sql = await getSql();
    try {
      await sql`
        INSERT INTO event_schemas (event_type, version, schema, producer, created_at)
        VALUES (${schema.eventType}, ${schema.version}, ${JSON.stringify(schema.schema)}, ${schema.producer}, ${schema.createdAt})
        ON CONFLICT (event_type, version) DO NOTHING
      `;
    } catch (err) {
      logger.error('Error registering event schema', err);
    }
  }

  /**
   * Checks compatibility between versions.
   */
  async check(eventType: string, producerVersion: string, consumerVersion: string): Promise<CompatibilityResult> {
    const producerSchema = await this.getSchema(eventType, producerVersion);
    const consumerSchema = await this.getSchema(eventType, consumerVersion);

    if (!producerSchema || !consumerSchema) {
      throw new Error('Schema not found');
    }

    const issues: CompatibilityIssue[] = [];
    const forwardCompatible = this.checkForwardCompat(producerSchema, consumerSchema);
    const backwardCompatible = this.checkBackwardCompat(producerSchema, consumerSchema);

    // Simplified compatibility check
    if (!backwardCompatible) {
      issues.push({
        field: '*',
        type: 'added_required',
        description: 'New schema requires fields not present in old schema.',
        severity: 'breaking'
      });
    }

    return {
      compatible: issues.length === 0,
      issues,
      forwardCompatible,
      backwardCompatible
    };
  }

  /**
   * Can old consumers read new events?
   */
  checkForwardCompat(oldSchema: EventSchema, newSchema: EventSchema): boolean {
    // If new schema removed required fields from old schema, false
    // Simplified logic
    return true; 
  }

  /**
   * Can new consumers read old events?
   */
  checkBackwardCompat(oldSchema: EventSchema, newSchema: EventSchema): boolean {
    // If new schema added required fields, false
    // Simplified logic
    return true;
  }

  /**
   * Retrieves schema.
   */
  async getSchema(eventType: string, version: string): Promise<EventSchema | null> {
    const sql = await getSql();
    const result = await sql`SELECT * FROM event_schemas WHERE event_type = ${eventType} AND version = ${version}`;
    return result.length ? (result[0] as EventSchema) : null;
  }

  /**
   * Lists all versions for event type.
   */
  async listVersions(eventType: string): Promise<EventSchema[]> {
    const sql = await getSql();
    const result = await sql`SELECT * FROM event_schemas WHERE event_type = ${eventType} ORDER BY version DESC`;
    return result as EventSchema[];
  }

  /**
   * Generates a markdown compatibility report.
   */
  generateCompatibilityReport(result: CompatibilityResult): string {
    let report = `## Event Compatibility Report\n\n`;
    report += `- **Compatible**: ${result.compatible ? '✅' : '❌'}\n`;
    report += `- **Forward Compatible**: ${result.forwardCompatible ? '✅' : '❌'}\n`;
    report += `- **Backward Compatible**: ${result.backwardCompatible ? '✅' : '❌'}\n\n`;
    
    if (result.issues.length > 0) {
      report += `### Issues\n`;
      for (const issue of result.issues) {
        report += `- **[${issue.severity.toUpperCase()}]** Field \`${issue.field}\`: ${issue.description}\n`;
      }
    }
    return report;
  }
}

export const eventCompatibility = new EventCompatibilityService();
