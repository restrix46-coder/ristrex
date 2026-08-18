import { getSql } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';

export const TRACEABILITY_MIGRATION = `
CREATE TABLE IF NOT EXISTS requirements (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    title TEXT NOT NULL,
    type TEXT NOT NULL,
    priority TEXT NOT NULL,
    status TEXT NOT NULL,
    acceptance_criteria JSON NOT NULL
);

CREATE TABLE IF NOT EXISTS user_stories (
    id TEXT PRIMARY KEY,
    requirement_id TEXT NOT NULL,
    title TEXT NOT NULL,
    as_a TEXT NOT NULL,
    i_want TEXT NOT NULL,
    so_that TEXT NOT NULL,
    acceptance_criteria JSON NOT NULL,
    story_points INTEGER,
    FOREIGN KEY(requirement_id) REFERENCES requirements(id)
);

CREATE TABLE IF NOT EXISTS traceability_links (
    id TEXT PRIMARY KEY,
    requirement_id TEXT NOT NULL,
    user_story_id TEXT,
    feature_id TEXT,
    task_id TEXT,
    artifacts JSON NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(requirement_id) REFERENCES requirements(id)
);
`;

export interface Requirement {
    id: string;
    projectId?: string;
    title: string;
    type: 'functional' | 'non-functional' | 'technical';
    priority: 'must' | 'should' | 'could';
    status: string;
    acceptanceCriteria: string[];
}

export interface UserStory {
    id: string;
    requirementId: string;
    title: string;
    asA: string;
    iWant: string;
    soThat: string;
    acceptanceCriteria: string[];
    storyPoints?: number;
}

export interface TraceableArtifact {
    type: 'file' | 'function' | 'test' | 'deployment' | 'api';
    path: string;
    name: string;
}

export interface TraceabilityLink {
    id?: string;
    requirementId: string;
    userStoryId?: string;
    featureId?: string;
    taskId?: string;
    artifacts: TraceableArtifact[];
    createdAt?: Date;
}

export interface TraceabilityMatrix {
    requirements: Requirement[];
    userStories: UserStory[];
    links: TraceabilityLink[];
    coveragePercent: number;
    uncoveredRequirements: string[];
}

export class RequirementsTraceabilityService {
    /**
     * Create a new requirement.
     */
    async createRequirement(req: Omit<Requirement, 'id' | 'status'>): Promise<Requirement> {
        const sql = getSql();
        const id = uuidv4();
        const requirement: Requirement = {
            ...req,
            id,
            status: 'draft',
        };

        await sql`
            INSERT INTO requirements (id, project_id, title, type, priority, status, acceptance_criteria)
            VALUES (${id}, ${req.projectId || 'default'}, ${req.title}, ${req.type}, ${req.priority}, ${requirement.status}, ${JSON.stringify(req.acceptanceCriteria)})
        `;

        return requirement;
    }

    /**
     * Create a user story linked to a requirement.
     */
    async createUserStory(story: Omit<UserStory, 'id'>): Promise<UserStory> {
        const sql = getSql();
        const id = uuidv4();
        const newStory: UserStory = {
            ...story,
            id,
        };

        await sql`
            INSERT INTO user_stories (id, requirement_id, title, as_a, i_want, so_that, acceptance_criteria, story_points)
            VALUES (${id}, ${story.requirementId}, ${story.title}, ${story.asA}, ${story.iWant}, ${story.soThat}, ${JSON.stringify(story.acceptanceCriteria)}, ${story.storyPoints || null})
        `;

        return newStory;
    }

    /**
     * Link code artifacts to a requirement.
     */
    async linkArtifact(requirementId: string, artifacts: TraceableArtifact[]): Promise<void> {
        const sql = getSql();
        const id = uuidv4();
        
        await sql`
            INSERT INTO traceability_links (id, requirement_id, artifacts)
            VALUES (${id}, ${requirementId}, ${JSON.stringify(artifacts)})
        `;
    }

    /**
     * Retrieve the traceability matrix for a given project.
     */
    async getMatrix(projectId: string): Promise<TraceabilityMatrix> {
        const sql = getSql();
        
        const reqRows = await sql`SELECT * FROM requirements WHERE project_id = ${projectId}`;
        const requirements: Requirement[] = reqRows.map((r: any) => ({
            id: r.id,
            projectId: r.project_id,
            title: r.title,
            type: r.type,
            priority: r.priority,
            status: r.status,
            acceptanceCriteria: JSON.parse(r.acceptance_criteria),
        }));

        const storyRows = await sql`SELECT * FROM user_stories WHERE requirement_id IN (SELECT id FROM requirements WHERE project_id = ${projectId})`;
        const userStories: UserStory[] = storyRows.map((s: any) => ({
            id: s.id,
            requirementId: s.requirement_id,
            title: s.title,
            asA: s.as_a,
            iWant: s.i_want,
            soThat: s.so_that,
            acceptanceCriteria: JSON.parse(s.acceptance_criteria),
            storyPoints: s.story_points,
        }));

        const linkRows = await sql`SELECT * FROM traceability_links WHERE requirement_id IN (SELECT id FROM requirements WHERE project_id = ${projectId})`;
        const links: TraceabilityLink[] = linkRows.map((l: any) => ({
            id: l.id,
            requirementId: l.requirement_id,
            userStoryId: l.user_story_id,
            featureId: l.feature_id,
            taskId: l.task_id,
            artifacts: JSON.parse(l.artifacts),
            createdAt: new Date(l.created_at),
        }));

        const linkedReqIds = new Set(links.map(l => l.requirementId));
        const uncoveredRequirements = requirements.filter(r => !linkedReqIds.has(r.id)).map(r => r.id);
        const coveragePercent = requirements.length ? ((requirements.length - uncoveredRequirements.length) / requirements.length) * 100 : 100;

        return {
            requirements,
            userStories,
            links,
            coveragePercent,
            uncoveredRequirements,
        };
    }

    /**
     * Find orphaned code files with no requirements attached.
     */
    async findOrphanCode(projectPath: string, matrix: TraceabilityMatrix): Promise<TraceableArtifact[]> {
        // Implementation would scan directory and diff with matrix.links artifacts
        // This is a stub representation of the actual directory scanning logic.
        return [];
    }

    /**
     * Find requirements without code artifact coverage.
     */
    async findUncoveredRequirements(matrix: TraceabilityMatrix): Promise<Requirement[]> {
        const uncoveredSet = new Set(matrix.uncoveredRequirements);
        return matrix.requirements.filter(r => uncoveredSet.has(r.id));
    }

    /**
     * Generate a markdown report of the traceability matrix.
     */
    generateTraceabilityReport(matrix: TraceabilityMatrix): string {
        let md = `# Traceability Report\n\n`;
        md += `**Coverage:** ${matrix.coveragePercent.toFixed(2)}%\n\n`;
        md += `## Requirements\n`;
        for (const req of matrix.requirements) {
            const isCovered = !matrix.uncoveredRequirements.includes(req.id);
            md += `- [${isCovered ? 'x' : ' '}] **${req.id}**: ${req.title} (${req.priority})\n`;
        }
        return md;
    }

    /**
     * Check if a specific requirement has tests linked.
     */
    async checkTestCoverage(requirementId: string, matrix: TraceabilityMatrix): Promise<boolean> {
        const links = matrix.links.filter(l => l.requirementId === requirementId);
        return links.some(l => l.artifacts.some(a => a.type === 'test'));
    }
}

export const traceabilityService = new RequirementsTraceabilityService();
