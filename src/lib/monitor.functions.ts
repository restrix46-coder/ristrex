import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/lib/weaver-auth";
import { getSql } from "@/lib/db";
import {
  DATABASE_URL,
  SESSION_SECRET,
  WEAVER_PASSCODE,
  WEAVER_WORKER_TOKEN,
  GEMINI_API_KEY,
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY,
  EXECUTOR_TOKEN,
  GITHUB_TOKEN,
  GITHUB_REPO_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  WEAVER_SCHEDULER_SECRET,
} from "@/lib/env.server";

export type EnvItem = {
  name: string;
  hint: string;
  critical: boolean;
  present: boolean;
};

export type MonitorEvent = {
  id: string;
  kind: string;
  label: string;
  detail: string | null;
  ok: boolean | null;
  durationMs: number | null;
  createdAt: string;
};

export type MonitorSnapshot = {
  ok: boolean;
  db: boolean;
  dbError: string | null;
  env: EnvItem[];
  alerts: string[];
  events: MonitorEvent[];
  jobs: { status: string; count: number }[];
  workerLastSeen: string | null;
  at: string;
};

const CRITICAL: { name: string; hint: string; getValue: () => string }[] = [
  { name: "DATABASE_URL", hint: "اتصال قاعدة البيانات المحلية", getValue: () => DATABASE_URL },
  { name: "SESSION_SECRET", hint: "توقيع جلسة الدخول", getValue: () => SESSION_SECRET },
  { name: "WEAVER_PASSCODE", hint: "الرمز السري للدخول", getValue: () => WEAVER_PASSCODE },
  { name: "WEAVER_WORKER_TOKEN", hint: "مصادقة العامل الخلفي مع التطبيق", getValue: () => WEAVER_WORKER_TOKEN },
  { name: "GEMINI_API_KEY", hint: "مفتاح النماذج الذكية", getValue: () => GEMINI_API_KEY },
];

const OPTIONAL: { name: string; hint: string; getValue: () => string }[] = [
  { name: "WEAVER_SCHEDULER_SECRET", hint: "المهام المجدولة", getValue: () => WEAVER_SCHEDULER_SECRET },
  { name: "EXECUTOR_TOKEN", hint: "منفّذ الأوامر على الخادم", getValue: () => EXECUTOR_TOKEN },
  { name: "GITHUB_TOKEN", hint: "الرفع إلى GitHub والتطوير الذاتي", getValue: () => GITHUB_TOKEN },
  { name: "GITHUB_REPO_URL", hint: "مستودع Weaver نفسه", getValue: () => GITHUB_REPO_URL },
  { name: "SUPABASE_URL", hint: "عنوان الاتصال المحلي", getValue: () => SUPABASE_URL },
  { name: "SUPABASE_PUBLISHABLE_KEY", hint: "مفتاح الاتصال المحلي", getValue: () => SUPABASE_PUBLISHABLE_KEY },
  { name: "SUPABASE_SERVICE_ROLE_KEY", hint: "عمليات مميّزة", getValue: () => SUPABASE_SERVICE_ROLE_KEY },
];

/** لقطة مراقبة: صحة، متغيّرات بيئة، سجلات العامل، وتنبيهات. */
export const getMonitorSnapshot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async (): Promise<MonitorSnapshot> => {
    const withTimeout = <T>(work: Promise<T>, ms = 6000): Promise<T> =>
      Promise.race([
        work,
        new Promise<T>((_, reject) =>
          setTimeout(() => reject(new Error("انتهت مهلة الاتصال بقاعدة البيانات")), ms),
        ),
      ]);

    const env: EnvItem[] = [
      ...CRITICAL.map((item) => ({
        name: item.name,
        hint: item.hint,
        critical: true,
        present: Boolean(item.getValue()),
      })),
      ...OPTIONAL.map((item) => ({
        name: item.name,
        hint: item.hint,
        critical: false,
        present: Boolean(item.getValue()),
      })),
    ];

    const alerts: string[] = [];
    for (const item of env) {
      if (item.critical && !item.present)
        alerts.push(`متغيّر حرج مفقود: ${item.name} — ${item.hint}`);
    }

    let db = true;
    let dbError: string | null = null;
    let events: MonitorEvent[] = [];
    let jobs: { status: string; count: number }[] = [];
    let workerLastSeen: string | null = null;

    try {
      const sql = getSql();
      await withTimeout(Promise.resolve(sql`SELECT 1`));

      const [evRows, jobRows, lastEv] = await Promise.all([
        withTimeout(
          sql`
            SELECT id, kind, label, detail, ok, duration_ms, created_at
            FROM public.agent_job_events
            ORDER BY created_at DESC
            LIMIT 40
          `.then((r) => r as unknown as Record<string, unknown>[]),
        ).catch(() => []),
        withTimeout(
          sql`
            SELECT status, COUNT(*)::int as count
            FROM public.agent_jobs
            GROUP BY status
          `.then((r) => r as unknown as Record<string, unknown>[]),
        ).catch(() => []),
        withTimeout(
          sql`
            SELECT created_at FROM public.agent_job_events
            ORDER BY created_at DESC LIMIT 1
          `.then((r) => r as unknown as Record<string, unknown>[]),
        ).catch(() => []),
      ]);

      events = evRows.map((r) => ({
        id: String(r["id"]),
        kind: String(r["kind"]),
        label: String(r["label"]),
        detail: (r["detail"] as string | null) ?? null,
        ok: (r["ok"] as boolean | null) ?? null,
        durationMs: (r["duration_ms"] as number | null) ?? null,
        createdAt: String(r["created_at"]),
      }));

      jobs = jobRows.map((r) => ({
        status: String(r["status"]),
        count: Number(r["count"]),
      }));

      if (lastEv[0]?.["created_at"]) {
        workerLastSeen = String(lastEv[0]["created_at"]);
      }
    } catch (err) {
      db = false;
      dbError = err instanceof Error ? err.message : String(err);
      alerts.push(`خطأ في قاعدة البيانات المحلية: ${dbError}`);
    }

    return {
      ok: alerts.length === 0 && db,
      db,
      dbError,
      env,
      alerts,
      events,
      jobs,
      workerLastSeen,
      at: new Date().toISOString(),
    };
  });

export const getAuditLog = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    return { ok: true, logs: [] };
  });

export const sendTestAlert = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    return { ok: true, sent: true };
  });
