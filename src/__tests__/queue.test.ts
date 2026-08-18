/**
 * اختبارات Queue System
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { JobQueue } from "@/lib/queue.server";

// محاكاة SQL
const mockSql = vi.fn();
vi.mock("@/lib/db", () => ({
  getSql: () => mockSql,
}));

describe("JobQueue — Enqueue", () => {
  let queue: JobQueue<{ type: string }>;

  beforeEach(() => {
    queue = new JobQueue("test-queue");
    vi.clearAllMocks();
    mockSql.mockResolvedValue([{ id: "job-123" }]);
  });

  it("يُعيد معرّف المهمة عند الإضافة", async () => {
    const id = await queue.enqueue({ type: "test" });
    expect(id).toBe("job-123");
  });

  it("يستدعي SQL بالمعاملات الصحيحة", async () => {
    await queue.enqueue({ type: "build" }, { priority: 8, maxAttempts: 5 });
    expect(mockSql).toHaveBeenCalled();
  });
});

describe("JobQueue — getStats", () => {
  let queue: JobQueue;

  beforeEach(() => {
    queue = new JobQueue("stats-queue");
    mockSql.mockResolvedValue([
      { status: "pending", count: "5" },
      { status: "completed", count: "10" },
      { status: "failed", count: "2" },
    ]);
  });

  it("يُرجع إحصائيات صحيحة", async () => {
    const stats = await queue.getStats();
    expect(stats.pending).toBe(5);
    expect(stats.completed).toBe(10);
    expect(stats.failed).toBe(2);
    expect(stats.processing).toBe(0);
    expect(stats.dead).toBe(0);
  });
});
