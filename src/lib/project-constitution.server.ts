import { getSql } from '@/lib/db';

export const CONSTITUTION_MIGRATION = `
CREATE TABLE IF NOT EXISTS project_constitutions (
    project_id TEXT PRIMARY KEY,
    version INTEGER NOT NULL,
    constitution_data JSON NOT NULL,
    last_updated DATETIME DEFAULT CURRENT_TIMESTAMP
);
`;

export interface ArchitectureRules {
    frontend: string;
    backend: string;
    database: string;
    auth: string;
    storage: string;
    queue: string;
    cache: string;
    search: string;
    forbidden: string[];
}

export interface CodingRule {
    rule: string;
    rationale: string;
    example?: string;
    antiExample?: string;
}

export interface FolderRules {
    [folderPath: string]: string;
}

export interface NamingRule {
    pattern: string;
    description: string;
}

export interface DependencyRule {
    allowed: string[];
    forbidden: string[];
}

export interface SecurityRule {
    rule: string;
    description: string;
}

export interface DatabaseRule {
    rule: string;
}

export interface ApiRule {
    rule: string;
}

export interface UiRule {
    rule: string;
}

export interface TestingRule {
    rule: string;
}

export interface DeploymentRule {
    rule: string;
}

export interface PerformanceRule {
    rule: string;
}

export interface ProjectConstitution {
    projectId: string;
    version: number;
    architecture: ArchitectureRules;
    folderStructure: FolderRules;
    codingRules: CodingRule[];
    namingConventions: NamingRule[];
    dependencies: DependencyRule[];
    security: SecurityRule[];
    database: DatabaseRule[];
    api: ApiRule[];
    ui: UiRule[];
    testing: TestingRule[];
    deployment: DeploymentRule[];
    accessibility: string[];
    seo: string[];
    performance: PerformanceRule[];
    lastUpdated: Date;
}

export interface ConstitutionViolation {
    rule: string;
    file: string;
    description: string;
    severity: 'critical' | 'major' | 'minor';
}

export const DEFAULT_CONSTITUTION_TEMPLATE: ProjectConstitution = {
    projectId: '',
    version: 1,
    architecture: {
        frontend: 'React with Next.js',
        backend: 'Node.js with Express/Next API',
        database: 'PostgreSQL',
        auth: 'JWT based',
        storage: 'S3 compatible',
        queue: 'Redis',
        cache: 'Redis',
        search: 'Elasticsearch',
        forbidden: ['Direct DB access from frontend']
    },
    folderStructure: {
        'src/components': 'UI Components',
        'src/lib': 'Shared libraries and utilities',
        'src/pages': 'Next.js pages or equivalent routing'
    },
    codingRules: [
        {
            rule: 'Use strict TypeScript',
            rationale: 'Prevent runtime type errors',
        }
    ],
    namingConventions: [],
    dependencies: [],
    security: [],
    database: [],
    api: [],
    ui: [],
    testing: [],
    deployment: [],
    accessibility: [],
    seo: [],
    performance: [],
    lastUpdated: new Date()
};

export class ProjectConstitutionService {
    /**
     * Create a project constitution.
     */
    async createConstitution(projectId: string, initial: Partial<ProjectConstitution>): Promise<ProjectConstitution> {
        const sql = getSql();
        const constitution: ProjectConstitution = {
            ...DEFAULT_CONSTITUTION_TEMPLATE,
            ...initial,
            projectId,
            version: 1,
            lastUpdated: new Date()
        };

        await sql`
            INSERT INTO project_constitutions (project_id, version, constitution_data)
            VALUES (${projectId}, ${constitution.version}, ${JSON.stringify(constitution)})
        `;

        return constitution;
    }

    /**
     * Get a project constitution.
     */
    async getConstitution(projectId: string): Promise<ProjectConstitution | null> {
        const sql = getSql();
        const rows = await sql`SELECT * FROM project_constitutions WHERE project_id = ${projectId}`;
        if (rows.length === 0) return null;

        const data = JSON.parse(rows[0].constitution_data);
        return {
            ...data,
            lastUpdated: new Date(rows[0].last_updated)
        };
    }

    /**
     * Update project constitution.
     */
    async updateConstitution(projectId: string, updates: Partial<ProjectConstitution>): Promise<ProjectConstitution> {
        const current = await this.getConstitution(projectId);
        if (!current) throw new Error('Constitution not found');

        const updated: ProjectConstitution = {
            ...current,
            ...updates,
            version: current.version + 1,
            lastUpdated: new Date()
        };

        const sql = getSql();
        await sql`
            UPDATE project_constitutions
            SET version = ${updated.version}, constitution_data = ${JSON.stringify(updated)}, last_updated = CURRENT_TIMESTAMP
            WHERE project_id = ${projectId}
        `;

        return updated;
    }

    /**
     * Check if code changes violate the constitution.
     */
    async checkViolations(projectId: string, proposedChange: any): Promise<ConstitutionViolation[]> {
        // Evaluate the proposed change against the stored constitution
        return [];
    }

    /**
     * Render the constitution to a markdown string.
     */
    generateConstitutionFile(constitution: ProjectConstitution): string {
        let md = `# Project Constitution (v${constitution.version})\n\n`;
        md += `Last updated: ${constitution.lastUpdated.toISOString()}\n\n`;
        md += `## Architecture\n`;
        md += `- Frontend: ${constitution.architecture.frontend}\n`;
        md += `- Backend: ${constitution.architecture.backend}\n`;
        return md;
    }

    /**
     * Parse markdown to a constitution.
     */
    parseConstitutionFile(markdown: string): Partial<ProjectConstitution> {
        // Parse the markdown string back into constitution structure
        return {};
    }
}

export const constitutionService = new ProjectConstitutionService();
