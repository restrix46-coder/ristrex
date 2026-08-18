/**
 * Global Project State — src/lib/project-state.server.ts
 *
 * حالة المشروع الكاملة لحظة بلحظة:
 * Completed/Active/Failed Tasks، Architecture، Bugs، Tech Debt، Decisions
 */

import { getSql } from "@/lib/db";
import { logger } from "@/lib/logger.server";

// ─── الأنواع ────────────────────────────────────────────────────────────────

export type TaskStatus = "pending" | "active" | "completed" | "failed" | "blocked" | "cancelled";
export type RiskLevel = "none" | "low" | "medium" | "high" | "critical";

export interface ProjectTask {
  id: string;
  projectId: string;
  title: string;
  description?: string;
  status: TaskStatus;
  agentType?: string;
  featureId?: string;
  milestoneId?: string;
  dependencies: string[];
  priority: 1 | 2 | 3 | 4 | 5;
  estimatedMinutes?: number;
  actualMinutes?: number;
  error?: string;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
}

export interface KnownBug {
  id: string;
  projectId: string;
  title: string;
  description: string;
  severity: "critical" | "high" | "medium" | "low";
  status: "open" | "in_progress" | "fixed" | "wont_fix";
  file?: string;
  line?: number;
  reproduceSteps?: string;
  createdAt: Date;
  fixedAt?: Date;
}

export interface ProjectDecision {
  id: string;
  projectId: string;
  type: "technical" | "architecture" | "ux" | "business" | "user";
  title: string;
  decision: string;
  rationale: string;
  alternatives: string[];
  madeBy: "ai" | "user";
  createdAt: Date;
}

export interface GlobalProjectState {
  projectId: string;
  totalTasks: number;
  completedTasks: number;
  activeTasks: number;
  failedTasks: number;
  pendingTasks: number;
  blockedTasks: number;
  completionPercent: number;
  currentArchitecture: string;
  currentVersion: string;
  activeDeployment?: string;
  knownBugs: KnownBug[];
  openBugCount: number;
  decisions: ProjectDecision[];
  technicalDebt: string[];
  risks: Array<{ description: string; level: RiskLevel }>;
  lastUpdated: Date;
}

// ─── ProjectStateService ───────────────────────────────────────────────────

export class ProjectStateService {
  /**
   * يُرجع الحالة الكاملة للمشروع
   */
  async getState(projectId: string): Promise<GlobalProjectState> {
    const sql = getSql();

    const [taskStats] = await sql<{
      total: string; completed: string; active: string;
      failed: string; pending: string; blocked: string;
    }[]>`
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'completed') as completed,
        COUNT(*) FILTER (WHERE status = 'active') as active,
        COUNT(*) FILTER (WHERE status = 'failed') as failed,
        COUNT(*) FILTER (WHERE status = 'pending') as pending,
        COUNT(*) FILTER (WHERE status = 'blocked') as blocked
      FROM project_tasks
      WHERE project_id = ${projectId}
    `;

    const bugs = await sql<KnownBug[]>`
      SELECT * FROM known_bugs
      WHERE project_id = ${projectId}
      ORDER BY severity DESC, created_at DESC
      LIMIT 50
    `;

    const decisions = await sql<ProjectDecision[]>`
      SELECT * FROM project_decisions
      WHERE project_id = ${projectId}
      ORDER BY created_at DESC
      LIMIT 20
    `;

    const total = parseInt(taskStats?.total ?? "0");
    const completed = parseInt(taskStats?.completed ?? "0");

    return {
      projectId,
      totalTasks: total,
      completedTasks: completed,
      activeTasks: parseInt(taskStats?.active ?? "0"),
      failedTasks: parseInt(taskStats?.failed ?? "0"),
      pendingTasks: parseInt(taskStats?.pending ?? "0"),
      blockedTasks: parseInt(taskStats?.blocked ?? "0"),
      completionPercent: total > 0 ? Math.round((completed / total) * 100) : 0,
      currentArchitecture: "Next.js + PostgreSQL + TypeScript",
      currentVersion: "1.0.0",
      knownBugs: bugs,
      openBugCount: bugs.filter((b) => b.status === "open" || b.status === "in_progress").length,
      decisions,
      technicalDebt: [],
      risks: [],
      lastUpdated: new Date(),
    };
  }

  /**
   * يُسجّل مهمة جديدة
   */
  async createTask(task: Omit<ProjectTask, "id" | "createdAt">): Promise<ProjectTask> {
    const sql = getSql();
    const [created] = await sql<ProjectTask[]>`
      INSERT INTO project_tasks (project_id, title, description, status, agent_type, feature_id, milestone_id, dependencies, priority, estimated_minutes)
      VALUES (${task.projectId}, ${task.title}, ${task.description ?? null}, ${task.status}, ${task.agentType ?? null}, ${task.featureId ?? null}, ${task.milestoneId ?? null}, ${task.dependencies}, ${task.priority}, ${task.estimatedMinutes ?? null})
      RETURNING *
    `;
    return created!;
  }

  /**
   * يُحدّث حالة مهمة
   */
  async updateTaskStatus(taskId: string, status: TaskStatus, error?: string): Promise<void> {
    const sql = getSql();
    const now = new Date();
    await sql`
      UPDATE project_tasks
      SET status = ${status},
          error = ${error ?? null},
          started_at = CASE WHEN ${status} = 'active' THEN ${now} ELSE started_at END,
          completed_at = CASE WHEN ${status} IN ('completed', 'failed') THEN ${now} ELSE completed_at END
      WHERE id = ${taskId}
    `;
    logger.info("Task status updated", { taskId, status });
  }

  /**
   * يُسجّل خطأ/بق
   */
  async reportBug(bug: Omit<KnownBug, "id" | "createdAt">): Promise<KnownBug> {
    const sql = getSql();
    const [created] = await sql<KnownBug[]>`
      INSERT INTO known_bugs (project_id, title, description, severity, status, file, line, reproduce_steps)
      VALUES (${bug.projectId}, ${bug.title}, ${bug.description}, ${bug.severity}, ${bug.status}, ${bug.file ?? null}, ${bug.line ?? null}, ${bug.reproduceSteps ?? null})
      RETURNING *
    `;
    return created!;
  }

  /**
   * يُسجّل قراراً
   */
  async recordDecision(decision: Omit<ProjectDecision, "id" | "createdAt">): Promise<ProjectDecision> {
    const sql = getSql();
    const [created] = await sql<ProjectDecision[]>`
      INSERT INTO project_decisions (project_id, type, title, decision, rationale, alternatives, made_by)
      VALUES (${decision.projectId}, ${decision.type}, ${decision.title}, ${decision.decision}, ${decision.rationale}, ${JSON.stringify(decision.alternatives)}, ${decision.madeBy})
      RETURNING *
    `;
    return created!;
  }

  /**
   * يُولّد تقرير حالة مفصّل
   */
  async generateStatusReport(projectId: string): Promise<string> {
    const state = await this.getState(projectId);
    const lines = [
      `# حالة المشروع — ${new Date().toLocaleDateString("ar")}`,
      ``,
      `## التقدم العام: ${state.completionPercent}%`,
      `- ✅ مكتملة: ${state.completedTasks}`,
      `- 🔄 نشطة: ${state.activeTasks}`,
      `- ⏳ قيد الانتظار: ${state.pendingTasks}`,
      `- ❌ فاشلة: ${state.failedTasks}`,
      `- 🚫 محجوبة: ${state.blockedTasks}`,
      ``,
      `## الأخطاء المعروفة: ${state.openBugCount} مفتوح`,
      ...state.knownBugs.filter((b) => b.status === "open").map((b) => `- [${b.severity}] ${b.title}`),
    ];
    return lines.join("\n");
  }
}

// ─── Migration ──────────────────────────────────────────────────────────────

export const PROJECT_STATE_MIGRATION = `
  CREATE TABLE IF NOT EXISTS project_tasks (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    project_id UUID NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'pending'
      CHECK (status IN ('pending','active','completed','failed','blocked','cancelled')),
    agent_type TEXT,
    feature_id UUID,
    milestone_id UUID,
    dependencies TEXT[] DEFAULT '{}',
    priority INTEGER NOT NULL DEFAULT 3 CHECK (priority BETWEEN 1 AND 5),
    estimated_minutes INTEGER,
    actual_minutes INTEGER,
    error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ
  );

  CREATE TABLE IF NOT EXISTS known_bugs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    project_id UUID NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    severity TEXT NOT NULL DEFAULT 'medium'
      CHECK (severity IN ('critical','high','medium','low')),
    status TEXT NOT NULL DEFAULT 'open'
      CHECK (status IN ('open','in_progress','fixed','wont_fix')),
    file TEXT,
    line INTEGER,
    reproduce_steps TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    fixed_at TIMESTAMPTZ
  );

  CREATE TABLE IF NOT EXISTS project_decisions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    project_id UUID NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('technical','architecture','ux','business','user')),
    title TEXT NOT NULL,
    decision TEXT NOT NULL,
    rationale TEXT NOT NULL,
    alternatives JSONB NOT NULL DEFAULT '[]',
    made_by TEXT NOT NULL DEFAULT 'ai',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE INDEX IF NOT EXISTS idx_tasks_project ON project_tasks (project_id, status);
  CREATE INDEX IF NOT EXISTS idx_bugs_project ON known_bugs (project_id, status);
  CREATE INDEX IF NOT EXISTS idx_decisions_project ON project_decisions (project_id, created_at DESC);
`;

export const projectStateService = new ProjectStateService();
