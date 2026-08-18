/**
 * User Feedback Loop — src/lib/feedback.server.ts
 *
 * يحوّل ملاحظات المستخدم إلى:
 * Feedback → Issue → Analysis → Task → Implementation → Test → Release
 */

import { getSql } from "@/lib/db";
import { logger } from "@/lib/logger.server";

// ─── الأنواع ────────────────────────────────────────────────────────────────

export type FeedbackType = "bug" | "feature_request" | "improvement" | "performance" | "ux" | "praise";
export type FeedbackStatus = "new" | "triaged" | "planned" | "in_progress" | "completed" | "rejected";

export interface UserFeedback {
  id: string;
  projectId: string;
  userId?: string;
  type: FeedbackType;
  title: string;
  description: string;
  status: FeedbackStatus;
  priority?: "critical" | "high" | "medium" | "low";
  sentiment?: "positive" | "neutral" | "negative";
  linkedTaskId?: string;
  tags: string[];
  metadata: Record<string, unknown>;
  createdAt: Date;
  resolvedAt?: Date;
}

export interface FeedbackAnalysis {
  feedbackId: string;
  sentiment: "positive" | "neutral" | "negative";
  intent: string;
  suggestedType: FeedbackType;
  suggestedPriority: "critical" | "high" | "medium" | "low";
  actionable: boolean;
  suggestedTask?: string;
  keywords: string[];
}

export interface FeedbackTrend {
  period: string;
  totalFeedback: number;
  byType: Record<FeedbackType, number>;
  bySentiment: { positive: number; neutral: number; negative: number };
  topIssues: string[];
  satisfactionScore: number; // 0-100
}

// ─── FeedbackService ──────────────────────────────────────────────────────────

export class FeedbackService {
  /**
   * يُسجّل ملاحظة مستخدم ويحلّلها
   */
  async submit(feedback: Omit<UserFeedback, "id" | "createdAt" | "status">): Promise<UserFeedback> {
    const sql = getSql();

    const analysis = this.analyzeFeedback(feedback.title, feedback.description);

    const [created] = await sql<UserFeedback[]>`
      INSERT INTO user_feedback (
        project_id, user_id, type, title, description, status,
        priority, sentiment, tags, metadata
      ) VALUES (
        ${feedback.projectId},
        ${feedback.userId ?? null},
        ${feedback.type},
        ${feedback.title},
        ${feedback.description},
        'new',
        ${analysis.suggestedPriority},
        ${analysis.sentiment},
        ${feedback.tags},
        ${JSON.stringify(feedback.metadata)}::jsonb
      )
      RETURNING *
    `;

    logger.info("Feedback submitted", { id: created!.id, type: feedback.type, sentiment: analysis.sentiment });
    return created!;
  }

  /**
   * يُحلّل الملاحظة ويستخرج التفاصيل
   */
  analyzeFeedback(title: string, description: string): FeedbackAnalysis {
    const text = `${title} ${description}`.toLowerCase();

    // تحليل Sentiment
    const positiveWords = ["great", "love", "amazing", "perfect", "excellent", "رائع", "ممتاز", "جيد", "أحب"];
    const negativeWords = ["bug", "broken", "error", "crash", "fail", "خطأ", "مشكلة", "لا يعمل", "معطل"];

    const positiveCount = positiveWords.filter((w) => text.includes(w)).length;
    const negativeCount = negativeWords.filter((w) => text.includes(w)).length;
    const sentiment = positiveCount > negativeCount ? "positive" : negativeCount > 0 ? "negative" : "neutral";

    // تحديد النوع
    const isBug = text.includes("bug") || text.includes("error") || text.includes("crash") || text.includes("خطأ");
    const isFeature = text.includes("feature") || text.includes("add") || text.includes("want") || text.includes("أريد");
    const isPerf = text.includes("slow") | text.includes("fast") || text.includes("performance") || text.includes("بطيء");

    const suggestedType: FeedbackType = isBug ? "bug" : isFeature ? "feature_request" : isPerf ? "performance" : "improvement";

    // تحديد الأولوية
    const isCritical = text.includes("crash") || text.includes("data loss") || text.includes("security");
    const isHigh = isBug || text.includes("can't") || text.includes("لا أستطيع");
    const suggestedPriority = isCritical ? "critical" : isHigh ? "high" : "medium";

    return {
      feedbackId: "",
      sentiment,
      intent: suggestedType,
      suggestedType,
      suggestedPriority,
      actionable: isBug || isFeature || isPerf,
      suggestedTask: isFeature ? `Implement: ${title}` : isBug ? `Fix: ${title}` : undefined,
      keywords: text.split(/\s+/).filter((w) => w.length > 4).slice(0, 10),
    };
  }

  /**
   * يُنشئ Task من Feedback
   */
  async convertToTask(feedbackId: string): Promise<{ taskId: string }> {
    const sql = getSql();
    const [feedback] = await sql<UserFeedback[]>`SELECT * FROM user_feedback WHERE id = ${feedbackId}`;
    if (!feedback) throw new Error(`Feedback ${feedbackId} not found`);

    // إنشاء Task مرتبط
    const [task] = await sql<{ id: string }[]>`
      INSERT INTO project_tasks (project_id, title, description, status, priority)
      VALUES (${feedback.projectId}, ${`[Feedback] ${feedback.title}`}, ${feedback.description}, 'pending', 3)
      RETURNING id
    `;

    await sql`
      UPDATE user_feedback SET linked_task_id = ${task!.id}, status = 'planned' WHERE id = ${feedbackId}
    `;

    logger.info("Feedback converted to task", { feedbackId, taskId: task!.id });
    return { taskId: task!.id };
  }

  /**
   * يُولّد تحليل الاتجاهات
   */
  async analyzeTrends(projectId: string, days = 30): Promise<FeedbackTrend> {
    const sql = getSql();
    const feedbacks = await sql<UserFeedback[]>`
      SELECT * FROM user_feedback
      WHERE project_id = ${projectId}
        AND created_at > NOW() - INTERVAL '${days} days'
    `;

    const byType = {} as Record<FeedbackType, number>;
    let positive = 0, neutral = 0, negative = 0;

    for (const f of feedbacks) {
      byType[f.type] = (byType[f.type] ?? 0) + 1;
      if (f.sentiment === "positive") positive++;
      else if (f.sentiment === "negative") negative++;
      else neutral++;
    }

    const total = feedbacks.length;
    const satisfactionScore = total > 0 ? Math.round((positive / total) * 100) : 50;

    return {
      period: `Last ${days} days`,
      totalFeedback: total,
      byType,
      bySentiment: { positive, neutral, negative },
      topIssues: feedbacks
        .filter((f) => f.type === "bug")
        .map((f) => f.title)
        .slice(0, 5),
      satisfactionScore,
    };
  }
}

// ─── Migration ───────────────────────────────────────────────────────────────

export const FEEDBACK_MIGRATION = `
  CREATE TABLE IF NOT EXISTS user_feedback (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    project_id UUID NOT NULL,
    user_id UUID,
    type TEXT NOT NULL CHECK (type IN ('bug','feature_request','improvement','performance','ux','praise')),
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'new'
      CHECK (status IN ('new','triaged','planned','in_progress','completed','rejected')),
    priority TEXT CHECK (priority IN ('critical','high','medium','low')),
    sentiment TEXT CHECK (sentiment IN ('positive','neutral','negative')),
    linked_task_id UUID,
    tags TEXT[] DEFAULT '{}',
    metadata JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved_at TIMESTAMPTZ
  );
  CREATE INDEX IF NOT EXISTS idx_feedback_project ON user_feedback (project_id, status, created_at DESC);
`;

export const feedbackService = new FeedbackService();
