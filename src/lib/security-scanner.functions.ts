import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { scanProject } from "@/lib/security-scanner.server";
import { getSql } from "@/lib/db";
import { requireAuth } from "@/lib/chat-auth.server";

const ScanInput = z.object({
  projectId: z.string().uuid(),
  aiEnhanced: z.boolean().optional().default(false),
});

/**
 * يُشغّل فاحص الأمان على ملفات مساحة عمل المشروع.
 * يجلب الملفات من قاعدة البيانات ثم يُمرّرها للـ scanner.
 */
export const runSecurityScan = createServerFn({ method: "POST" })
  .validator((data: unknown) => ScanInput.parse(data))
  .handler(async ({ data }) => {
    await requireAuth();
    const { projectId, aiEnhanced } = data;
    const sql = getSql();

    // جلب ملفات مساحة العمل
    const rows = await sql<{ path: string; content: string }[]>`
      SELECT path, content
      FROM workspace_files
      WHERE project_id = ${projectId}
        AND content IS NOT NULL
        AND length(content) < 200000
      ORDER BY path
      LIMIT 100
    `;

    const files = rows.map((r) => ({
      path: r.path,
      content: r.content,
    }));

    return scanProject(projectId, files, {
      aiEnhanced: aiEnhanced ?? false,
      maxFilesForAI: 5,
    });
  });
