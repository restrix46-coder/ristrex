import { getSql } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';

export const ADR_MIGRATION = `
CREATE TABLE IF NOT EXISTS architecture_decision_records (
    id TEXT PRIMARY KEY,
    number INTEGER NOT NULL,
    project_id TEXT NOT NULL,
    title TEXT NOT NULL,
    status TEXT NOT NULL,
    context TEXT NOT NULL,
    decision TEXT NOT NULL,
    rationale TEXT NOT NULL,
    consequences JSON NOT NULL,
    alternatives JSON NOT NULL,
    related_adrs JSON NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_by TEXT
);
`;

export type AdrStatus = 'proposed' | 'accepted' | 'rejected' | 'deprecated' | 'superseded';

export interface AdrAlternative {
    title: string;
    description: string;
    whyRejected: string;
}

export interface ArchitectureDecisionRecord {
    id: string;
    number: number;
    projectId?: string;
    title: string;
    status: AdrStatus;
    context: string;
    decision: string;
    rationale: string;
    consequences: {
        positive: string[];
        negative: string[];
        neutral: string[];
    };
    alternatives: AdrAlternative[];
    relatedAdrs: string[];
    createdAt: Date;
    updatedAt: Date;
    createdBy?: string;
}

export class AdrService {
    /**
     * Creates a new ADR.
     */
    async createAdr(adr: Omit<ArchitectureDecisionRecord, 'id' | 'createdAt' | 'updatedAt' | 'number'>): Promise<ArchitectureDecisionRecord> {
        const sql = getSql();
        const id = uuidv4();
        
        // Find the next ADR number
        const numberResult = await sql`SELECT MAX(number) as max_num FROM architecture_decision_records WHERE project_id = ${adr.projectId || 'default'}`;
        const number = (numberResult[0].max_num || 0) + 1;

        const newAdr: ArchitectureDecisionRecord = {
            ...adr,
            id,
            number,
            createdAt: new Date(),
            updatedAt: new Date(),
        };

        await sql`
            INSERT INTO architecture_decision_records (
                id, number, project_id, title, status, context, decision, rationale, consequences, alternatives, related_adrs, created_by
            ) VALUES (
                ${id}, ${number}, ${adr.projectId || 'default'}, ${adr.title}, ${adr.status}, ${adr.context}, ${adr.decision}, ${adr.rationale}, 
                ${JSON.stringify(adr.consequences)}, ${JSON.stringify(adr.alternatives)}, ${JSON.stringify(adr.relatedAdrs)}, ${adr.createdBy || null}
            )
        `;

        return newAdr;
    }

    /**
     * Updates an ADR.
     */
    async updateAdr(id: string, updates: Partial<ArchitectureDecisionRecord>): Promise<ArchitectureDecisionRecord> {
        const sql = getSql();
        const adr = await this.getAdr(id);
        if (!adr) throw new Error('ADR not found');

        const updatedAdr = { ...adr, ...updates, updatedAt: new Date() };

        await sql`
            UPDATE architecture_decision_records SET
                title = ${updatedAdr.title},
                status = ${updatedAdr.status},
                context = ${updatedAdr.context},
                decision = ${updatedAdr.decision},
                rationale = ${updatedAdr.rationale},
                consequences = ${JSON.stringify(updatedAdr.consequences)},
                alternatives = ${JSON.stringify(updatedAdr.alternatives)},
                related_adrs = ${JSON.stringify(updatedAdr.relatedAdrs)},
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ${id}
        `;

        return updatedAdr;
    }

    /**
     * Deprecates an ADR.
     */
    async deprecateAdr(id: string, supersededById?: string): Promise<void> {
        const sql = getSql();
        await sql`
            UPDATE architecture_decision_records 
            SET status = 'deprecated', updated_at = CURRENT_TIMESTAMP
            WHERE id = ${id}
        `;
        
        // Handle superseded logic if supersededById is provided
    }

    /**
     * Lists all ADRs.
     */
    async listAdrs(projectId: string, status?: AdrStatus): Promise<ArchitectureDecisionRecord[]> {
        const sql = getSql();
        let rows;
        if (status) {
            rows = await sql`SELECT * FROM architecture_decision_records WHERE project_id = ${projectId} AND status = ${status} ORDER BY number ASC`;
        } else {
            rows = await sql`SELECT * FROM architecture_decision_records WHERE project_id = ${projectId} ORDER BY number ASC`;
        }

        return rows.map((r: any) => this.mapRowToAdr(r));
    }

    /**
     * Retrieves an ADR.
     */
    async getAdr(id: string): Promise<ArchitectureDecisionRecord | null> {
        const sql = getSql();
        const rows = await sql`SELECT * FROM architecture_decision_records WHERE id = ${id}`;
        if (rows.length === 0) return null;
        return this.mapRowToAdr(rows[0]);
    }

    /**
     * Generates Markdown for a specific ADR.
     */
    generateAdrFile(adr: ArchitectureDecisionRecord): string {
        return `# ${adr.number}. ${adr.title}\n\nDate: ${adr.createdAt.toISOString().split('T')[0]}\n\n## Status\n\n${adr.status}\n\n## Context\n\n${adr.context}\n\n## Decision\n\n${adr.decision}\n\n## Consequences\n\n${adr.rationale}\n`;
    }

    /**
     * Generates a markdown index of ADRs.
     */
    generateAdrIndex(adrs: ArchitectureDecisionRecord[]): string {
        let index = '# Architecture Decision Records\n\n';
        for (const adr of adrs) {
            index += `- [${adr.number}. ${adr.title}](./${adr.number}-${adr.title.replace(/\s+/g, '-').toLowerCase()}.md) (${adr.status})\n`;
        }
        return index;
    }

    /**
     * Find related ADRs by topic keywords.
     */
    async findRelatedAdrs(topic: string, adrs: ArchitectureDecisionRecord[]): Promise<ArchitectureDecisionRecord[]> {
        const topicLower = topic.toLowerCase();
        return adrs.filter(a => a.title.toLowerCase().includes(topicLower) || a.context.toLowerCase().includes(topicLower));
    }

    private mapRowToAdr(row: any): ArchitectureDecisionRecord {
        return {
            id: row.id,
            number: row.number,
            projectId: row.project_id,
            title: row.title,
            status: row.status,
            context: row.context,
            decision: row.decision,
            rationale: row.rationale,
            consequences: JSON.parse(row.consequences),
            alternatives: JSON.parse(row.alternatives),
            relatedAdrs: JSON.parse(row.related_adrs),
            createdAt: new Date(row.created_at),
            updatedAt: new Date(row.updated_at),
            createdBy: row.created_by,
        };
    }
}

export const adrService = new AdrService();
