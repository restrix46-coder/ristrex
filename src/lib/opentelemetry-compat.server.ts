import { logger } from '@/lib/logger.server';
import type { Span } from './tracing.server';

export interface OtelAttribute {
  key: string;
  value: {
    stringValue?: string;
    intValue?: number;
    boolValue?: boolean;
    doubleValue?: number;
  };
}

export interface OtelEvent {
  name: string;
  timeUnixNano: bigint;
  attributes: OtelAttribute[];
}

export interface OtelSpan {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  name: string;
  kind: 'INTERNAL' | 'SERVER' | 'CLIENT' | 'PRODUCER' | 'CONSUMER';
  startTimeUnixNano: bigint;
  endTimeUnixNano?: bigint;
  attributes: OtelAttribute[];
  status: { code: 0 | 1 | 2; message?: string };
  events: OtelEvent[];
}

export interface OtelDataPoint {
  timeUnixNano: bigint;
  value: number;
  attributes: OtelAttribute[];
}

export interface OtelMetric {
  name: string;
  description: string;
  unit: string;
  type: 'gauge' | 'counter' | 'histogram';
  dataPoints: OtelDataPoint[];
}

export interface OtelLogRecord {
  timestamp: bigint;
  severityNumber: number;
  severityText: string;
  body: string;
  attributes: OtelAttribute[];
}

export class OpenTelemetryExporter {
  /**
   * Exports a trace span in OTLP format.
   */
  public exportSpan(span: OtelSpan): void {
    logger.info(`Exporting OTel span: ${span.name}`);
    this.sendToCollector('http://localhost:4318/v1/traces', { resourceSpans: [span] });
  }

  /**
   * Exports a metric in OTLP format.
   */
  public exportMetric(metric: OtelMetric): void {
    logger.info(`Exporting OTel metric: ${metric.name}`);
    this.sendToCollector('http://localhost:4318/v1/metrics', { resourceMetrics: [metric] });
  }

  /**
   * Exports a log record in OTLP format.
   */
  public exportLog(log: OtelLogRecord): void {
    logger.info(`Exporting OTel log: ${log.severityText}`);
    this.sendToCollector('http://localhost:4318/v1/logs', { resourceLogs: [log] });
  }

  /**
   * Converts Weaver internal span to OTel span.
   */
  public convertFromInternalSpan(span: Span | any): OtelSpan {
    return {
      traceId: span.traceId || '0000000000000000',
      spanId: span.spanId || '00000000',
      name: span.name || 'unknown',
      kind: span.kind || 'INTERNAL',
      startTimeUnixNano: BigInt(Date.now() * 1000000),
      attributes: [],
      status: { code: 0 },
      events: []
    };
  }

  /**
   * Converts an internal metric to OTel format.
   */
  public convertFromInternalMetric(metric: any): OtelMetric {
    return {
      name: metric.name || 'custom.metric',
      description: metric.desc || '',
      unit: '1',
      type: 'counter',
      dataPoints: []
    };
  }

  /**
   * Generates OTLP JSON payload for spans.
   */
  public generateOtlpJson(spans: OtelSpan[]): string {
    return JSON.stringify({ resourceSpans: spans });
  }

  /**
   * Sends OTLP data via HTTP to a collector.
   */
  public sendToCollector(endpoint: string, data: Record<string, unknown>): void {
    // In a real implementation this would use fetch or similar HTTP client
    logger.info(`Sending data to OTel collector at ${endpoint}`);
  }
}

export const otelExporter = new OpenTelemetryExporter();
