/**
 * Correlated Tracing — src/lib/tracing.server.ts
 *
 * تتبع مترابط كامل من طلب المستخدم إلى:
 * User Request → Agent Task → Tool → API → Database → Error
 * ضمن Trace ID واحد.
 */

import { logger } from "@/lib/logger.server";

// ─── الأنواع ────────────────────────────────────────────────────────────────

export interface Span {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  name: string;
  service: string;
  type: "request" | "agent" | "tool" | "api" | "database" | "cache" | "queue";
  status: "ok" | "error" | "timeout";
  startTime: number; // ms timestamp
  endTime?: number;
  durationMs?: number;
  attributes: Record<string, string | number | boolean>;
  error?: string;
  events: SpanEvent[];
}

export interface SpanEvent {
  name: string;
  timestamp: number;
  attributes?: Record<string, unknown>;
}

export interface Trace {
  traceId: string;
  rootSpan: Span;
  spans: Span[];
  totalDurationMs: number;
  status: "ok" | "error" | "partial";
  createdAt: Date;
}

// ─── Tracer ──────────────────────────────────────────────────────────────────

export class Tracer {
  private traces = new Map<string, Trace>();
  private activeSpans = new Map<string, Span>();

  /**
   * يبدأ trace جديد
   */
  startTrace(name: string, attributes: Record<string, string | number | boolean> = {}): string {
    const traceId = crypto.randomUUID();
    const rootSpan = this.createSpan(traceId, name, "request", attributes);
    const trace: Trace = {
      traceId,
      rootSpan,
      spans: [rootSpan],
      totalDurationMs: 0,
      status: "ok",
      createdAt: new Date(),
    };
    this.traces.set(traceId, trace);
    logger.debug("Trace started", { traceId, name });
    return traceId;
  }

  /**
   * يبدأ span داخل trace موجود
   */
  startSpan(
    traceId: string,
    name: string,
    type: Span["type"],
    parentSpanId?: string,
    attributes: Record<string, string | number | boolean> = {},
  ): string {
    const span = this.createSpan(traceId, name, type, attributes, parentSpanId);
    const trace = this.traces.get(traceId);
    if (trace) {
      trace.spans.push(span);
    }
    this.activeSpans.set(span.spanId, span);
    return span.spanId;
  }

  /**
   * يُنهي span
   */
  endSpan(spanId: string, status: "ok" | "error" | "timeout" = "ok", error?: string): void {
    const span = this.activeSpans.get(spanId);
    if (!span) return;

    span.endTime = Date.now();
    span.durationMs = span.endTime - span.startTime;
    span.status = status;
    if (error) span.error = error;

    this.activeSpans.delete(spanId);

    if (status === "error") {
      const trace = this.traces.get(span.traceId);
      if (trace) trace.status = "error";
    }
  }

  /**
   * يُضيف event لـ span
   */
  addEvent(spanId: string, name: string, attributes?: Record<string, unknown>): void {
    const span = this.activeSpans.get(spanId);
    if (!span) return;
    span.events.push({ name, timestamp: Date.now(), attributes });
  }

  /**
   * يُنهي trace ويُرجع النتيجة
   */
  endTrace(traceId: string): Trace | null {
    const trace = this.traces.get(traceId);
    if (!trace) return null;

    trace.rootSpan.endTime = Date.now();
    trace.rootSpan.durationMs = trace.rootSpan.endTime - trace.rootSpan.startTime;
    trace.totalDurationMs = trace.rootSpan.durationMs ?? 0;

    logger.info("Trace completed", {
      traceId,
      durationMs: trace.totalDurationMs,
      spanCount: trace.spans.length,
      status: trace.status,
    });

    return trace;
  }

  /**
   * يُرجع trace
   */
  getTrace(traceId: string): Trace | null {
    return this.traces.get(traceId) ?? null;
  }

  /**
   * يُولّد waterfall view للـ trace
   */
  generateWaterfallView(trace: Trace): string {
    const lines = [`# Trace: ${trace.traceId}`, `Duration: ${trace.totalDurationMs}ms | Status: ${trace.status}`, ``];

    const sorted = [...trace.spans].sort((a, b) => a.startTime - b.startTime);
    for (const span of sorted) {
      const indent = span.parentSpanId ? "  " : "";
      const icon = { request: "🌐", agent: "🤖", tool: "🔧", api: "📡", database: "🗄️", cache: "⚡", queue: "📬" }[span.type] ?? "•";
      const status = span.status === "ok" ? "✅" : span.status === "error" ? "❌" : "⏱️";
      lines.push(`${indent}${status} ${icon} ${span.name} (${span.durationMs ?? "?"}ms)`);
    }

    return lines.join("\n");
  }

  private createSpan(
    traceId: string,
    name: string,
    type: Span["type"],
    attributes: Record<string, string | number | boolean> = {},
    parentSpanId?: string,
  ): Span {
    return {
      traceId,
      spanId: crypto.randomUUID(),
      parentSpanId,
      name,
      service: "weaver",
      type,
      status: "ok",
      startTime: Date.now(),
      attributes,
      events: [],
    };
  }
}

// ─── Middleware helper ───────────────────────────────────────────────────────

/**
 * يُنشئ trace لـ HTTP request ويربطه بالـ response
 */
export function traceRequest(
  method: string,
  path: string,
  handler: (traceId: string) => Promise<Response>,
): Promise<Response> {
  const traceId = tracer.startTrace(`${method} ${path}`, { method, path });
  return handler(traceId).finally(() => {
    tracer.endTrace(traceId);
  });
}

// ─── Singleton ───────────────────────────────────────────────────────────────

export const tracer = new Tracer();
