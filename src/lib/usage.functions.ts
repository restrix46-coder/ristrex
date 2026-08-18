import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/lib/weaver-auth";
import { getSql } from "@/lib/db";
import { z } from "zod";

/** ملخّص استهلاك التوكنات والتكلفة لمشروع واحد ولكل الحساب. */
export const getUsage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => z.object({ projectId: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    try {
      const sql = getSql();
      const [projectRows, allRows] = await Promise.all([
        sql`
          SELECT model, input_tokens, output_tokens, total_tokens, cost_usd, created_at
          FROM public.usage_events
          WHERE project_id = ${data.projectId}
          ORDER BY created_at DESC
          LIMIT 100
        `.then((r) => r as unknown as Record<string, unknown>[]).catch(() => []),
        sql`
          SELECT total_tokens, cost_usd
          FROM public.usage_events
        `.then((r) => r as unknown as Record<string, unknown>[]).catch(() => []),
      ]);

      const events = projectRows;
      const byModel = new Map<
        string,
        { model: string; tokens: number; cost: number; calls: number }
      >();
      for (const row of events) {
        const modelName = String(row["model"] ?? "default");
        const totalTok = Number(row["total_tokens"] ?? 0);
        const costUsd = Number(row["cost_usd"] ?? 0);
        const current = byModel.get(modelName) ?? { model: modelName, tokens: 0, cost: 0, calls: 0 };
        current.tokens += totalTok;
        current.cost += costUsd;
        current.calls += 1;
        byModel.set(modelName, current);
      }

      const account = allRows.reduce(
        (acc, row) => ({
          tokens: acc.tokens + Number(row["total_tokens"] ?? 0),
          cost: acc.cost + Number(row["cost_usd"] ?? 0),
        }),
        { tokens: 0, cost: 0 }
      );

      return {
        events: events.slice(0, 30).map((row) => ({
          model: String(row["model"] ?? "default"),
          inputTokens: Number(row["input_tokens"] ?? 0),
          outputTokens: Number(row["output_tokens"] ?? 0),
          totalTokens: Number(row["total_tokens"] ?? 0),
          cost: Number(row["cost_usd"] ?? 0),
          createdAt: String(row["created_at"] ?? new Date().toISOString()),
        })),
        byModel: [...byModel.values()].sort((a, b) => b.cost - a.cost),
        project: events.reduce(
          (acc, row) => ({
            tokens: acc.tokens + Number(row["total_tokens"] ?? 0),
            cost: acc.cost + Number(row["cost_usd"] ?? 0),
            calls: acc.calls + 1,
          }),
          { tokens: 0, cost: 0, calls: 0 }
        ),
        account,
      };
    } catch {
      return {
        events: [],
        byModel: [],
        project: { tokens: 0, cost: 0, calls: 0 },
        account: { tokens: 0, cost: 0 },
      };
    }
  });

/** ملخّص استهلاك على مستوى الحساب كامل (للوحة الإعدادات). */
export const getUsageSummary = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    try {
      const sql = getSql();
      const rows = await sql`
        SELECT total_tokens, cost_usd
        FROM public.usage_events
      `.then((r) => r as unknown as Record<string, unknown>[]).catch(() => []);

      return {
        requests: rows.length,
        totalTokens: rows.reduce((sum, row) => sum + Number(row["total_tokens"] ?? 0), 0),
        costUsd: rows.reduce((sum, row) => sum + Number(row["cost_usd"] ?? 0), 0),
      };
    } catch {
      return {
        requests: 0,
        totalTokens: 0,
        costUsd: 0,
      };
    }
  });
