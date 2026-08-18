/**
 * Queue System — src/lib/queue.server.ts
 *
 * نظام طوابير مبني على PostgreSQL (pgmq-compatible).
 *
 * يدعم:
 * - إضافة المهام للطابور (enqueue)
 * - معالجة المهام بالتسلسل أو التوازي
 * - إعادة المحاولة عند الفشل (exponential backoff)
 * - Dead Letter Queue للمهام الفاشلة
 * - أولويات (priority)
 *
 * الاستخدام:
 *   const queue = new JobQueue("ai-tasks");
 *   await queue.enqueue({ type: "build_project", projectId: "xyz" });
 */

import { getSql } from "@/lib/db";
import { logger } from "@/lib/logger.server";

// ─── الأنواع ───────────────────────────────────────────────────────────────

export interface Job<T = unknown> {
  id: string;
  queue: string;
  payload: T;
  priority: number;
  attempts: number;
  maxAttempts: number;
  status: "pending" | "processing" | "completed" | "failed" | "dead";
  scheduledAt: Date;
  createdAt: Date;
  processedAt?: Date;
  error?: string;
}

export interface EnqueueOptions {
  priority?: number;        // 0-10، الأعلى أولوية أكبر
  maxAttempts?: number;
  delayMs?: number;         // تأخير قبل المعالجة
}

export type JobHandler<T> = (job: Job<T>) => Promise<void>;

// ─── JobQueue ─────────────────────────────────────────────────────────────

export class JobQueue<T = unknown> {
  private handlers = new Map<string, JobHandler<unknown>>();
  private isRunning = false;

  constructor(
    public readonly name: string,
    private readonly concurrency = 1,
  ) {}

  /**
   * يُضيف مهمة للطابور
   */
  async enqueue(payload: T, opts: EnqueueOptions = {}): Promise<string> {
    const sql = getSql();
    const scheduledAt = new Date(Date.now() + (opts.delayMs ?? 0));

    const [job] = await sql<{ id: string }[]>`
      INSERT INTO job_queue (
        queue_name, payload, priority, max_attempts, status, scheduled_at
      )
      VALUES (
        ${this.name},
        ${JSON.stringify(payload)}::jsonb,
        ${opts.priority ?? 5},
        ${opts.maxAttempts ?? 3},
        'pending',
        ${scheduledAt.toISOString()}
      )
      RETURNING id
    `;

    logger.info("Job enqueued", { queue: this.name, jobId: job?.id });
    return job?.id ?? "";
  }

  /**
   * يُنفّذ المهام الجاهزة من الطابور
   */
  async processNext(handler: JobHandler<T>): Promise<boolean> {
    const sql = getSql();

    // جلب مهمة بـ Pessimistic Lock لمنع التعارض
    const jobs = await sql<Job<T>[]>`
      UPDATE job_queue
      SET status = 'processing', processed_at = NOW()
      WHERE id = (
        SELECT id FROM job_queue
        WHERE queue_name = ${this.name}
          AND status = 'pending'
          AND scheduled_at <= NOW()
          AND attempts < max_attempts
        ORDER BY priority DESC, scheduled_at ASC
        LIMIT 1
        FOR UPDATE SKIP LOCKED
      )
      RETURNING *
    `;

    if (!jobs[0]) return false;
    const job = jobs[0];

    try {
      await handler(job);
      await sql`
        UPDATE job_queue
        SET status = 'completed', processed_at = NOW()
        WHERE id = ${job.id}
      `;
      logger.info("Job completed", { queue: this.name, jobId: job.id });
      return true;
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      const newAttempts = (job.attempts ?? 0) + 1;
      const isDead = newAttempts >= (job.maxAttempts ?? 3);

      // Exponential backoff
      const backoffMs = Math.min(1000 * Math.pow(2, newAttempts), 3_600_000);
      const nextScheduled = new Date(Date.now() + backoffMs);

      await sql`
        UPDATE job_queue
        SET
          status = ${isDead ? "dead" : "pending"},
          attempts = ${newAttempts},
          error = ${errMsg},
          scheduled_at = ${nextScheduled.toISOString()}
        WHERE id = ${job.id}
      `;

      logger.warn("Job failed", {
        queue: this.name,
        jobId: job.id,
        attempts: newAttempts,
        isDead,
        error: errMsg,
      });
      return false;
    }
  }

  /**
   * يُرجع إحصائيات الطابور
   */
  async getStats(): Promise<{
    pending: number;
    processing: number;
    completed: number;
    failed: number;
    dead: number;
  }> {
    const sql = getSql();
    const rows = await sql<{ status: string; count: string }[]>`
      SELECT status, COUNT(*) as count
      FROM job_queue
      WHERE queue_name = ${this.name}
      GROUP BY status
    `;
    const stats = { pending: 0, processing: 0, completed: 0, failed: 0, dead: 0 };
    for (const row of rows) {
      const key = row.status as keyof typeof stats;
      if (key in stats) stats[key] = parseInt(row.count, 10);
    }
    return stats;
  }
}

// ─── طوابير جاهزة ─────────────────────────────────────────────────────────

export const aiTaskQueue = new JobQueue("ai-tasks", 3);
export const deployQueue = new JobQueue("deployments", 1);
export const emailQueue = new JobQueue("emails", 5);
export const cleanupQueue = new JobQueue("cleanup", 2);

// ─── الـ Migration للجدول ──────────────────────────────────────────────────

export const JOB_QUEUE_MIGRATION = `
  CREATE TABLE IF NOT EXISTS job_queue (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    queue_name TEXT NOT NULL,
    payload JSONB NOT NULL DEFAULT '{}',
    priority INTEGER NOT NULL DEFAULT 5,
    attempts INTEGER NOT NULL DEFAULT 0,
    max_attempts INTEGER NOT NULL DEFAULT 3,
    status TEXT NOT NULL DEFAULT 'pending'
      CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'dead')),
    error TEXT,
    scheduled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    processed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE INDEX IF NOT EXISTS idx_job_queue_next
    ON job_queue (queue_name, priority DESC, scheduled_at ASC)
    WHERE status = 'pending';
`;
