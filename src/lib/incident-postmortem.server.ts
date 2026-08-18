import { logger } from '@/lib/logger';
import { getSql } from '@/lib/db';

export interface PostmortemEvent {
  timestamp: Date;
  description: string;
  actor: string;
}

export interface ActionItem {
  id?: string;
  description: string;
  owner: string;
  deadline: Date;
  priority: string;
  status: 'open' | 'in_progress' | 'done';
}

export interface Postmortem {
  id: string;
  incidentId: string;
  title: string;
  severity: string;
  startTime: Date;
  endTime: Date;
  duration: number;
  impact: string;
  timeline: PostmortemEvent[];
  rootCauses: string[];
  contributingFactors: string[];
  whatWentWell: string[];
  whatWentPoorly: string[];
  actionItems: ActionItem[];
  lessonsLearned: string[];
  createdAt: Date;
}

export class PostmortemGenerator {
  public async generate(incident: any): Promise<Postmortem> {
    logger.info(`Generating postmortem for incident ${incident.id}`);
    const sql = await getSql();
    
    // Migrations
    await sql`
      CREATE TABLE IF NOT EXISTS postmortems (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        incident_id VARCHAR(255) NOT NULL,
        title VARCHAR(255) NOT NULL,
        data JSONB NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS postmortem_action_items (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        postmortem_id UUID REFERENCES postmortems(id),
        description TEXT NOT NULL,
        owner VARCHAR(255) NOT NULL,
        deadline TIMESTAMP NOT NULL,
        status VARCHAR(50) DEFAULT 'open'
      );
    `;

    return {
      id: 'pm-1',
      incidentId: incident.id,
      title: 'Initial Postmortem Draft',
      severity: 'high',
      startTime: new Date(),
      endTime: new Date(),
      duration: 0,
      impact: 'Unknown',
      timeline: [],
      rootCauses: [],
      contributingFactors: [],
      whatWentWell: [],
      whatWentPoorly: [],
      actionItems: [],
      lessonsLearned: [],
      createdAt: new Date(),
    };
  }

  public async addEvent(postmortemId: string, event: PostmortemEvent): Promise<void> {
    logger.info(`Adding event to ${postmortemId}`);
  }

  public async addRootCause(postmortemId: string, cause: string): Promise<void> {
    logger.info(`Adding root cause to ${postmortemId}`);
  }

  public async addActionItem(postmortemId: string, item: ActionItem): Promise<void> {
    logger.info(`Adding action item to ${postmortemId}`);
  }

  public async finalize(postmortemId: string): Promise<void> {
    logger.info(`Finalizing postmortem ${postmortemId}`);
  }

  public generateMarkdown(postmortem: Postmortem): string {
    return `# Postmortem: ${postmortem.title}\nSeverity: ${postmortem.severity}\nImpact: ${postmortem.impact}`;
  }

  public async getOverdueActionItems(): Promise<ActionItem[]> {
    return [];
  }
}

export const postmortemGenerator = new PostmortemGenerator();
