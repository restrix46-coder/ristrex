/**
 * External Monitoring & Alerting — src/lib/monitoring.server.ts
 *
 * نظام مراقبة شامل يتكامل مع:
 * - Sentry للـ Error Tracking
 * - Uptime monitoring
 * - Alert channels (Telegram/Email/Slack)
 * - Performance metrics
 *
 * المتغيّرات الاختيارية:
 *   SENTRY_DSN=https://...
 *   SLACK_WEBHOOK_URL=https://hooks.slack.com/...
 *   TELEGRAM_ALERT_BOT_TOKEN=...
 *   TELEGRAM_ALERT_CHAT_ID=...
 */

import { logger } from "@/lib/logger.server";

// ─── Sentry Error Tracking ─────────────────────────────────────────────────

export interface CaptureOptions {
  level?: "debug" | "info" | "warning" | "error" | "fatal";
  tags?: Record<string, string>;
  extra?: Record<string, unknown>;
  userId?: string;
}

/**
 * يُرسل خطأ إلى Sentry (إن كان مُضبوطاً)
 */
export async function captureError(
  error: Error | string,
  opts: CaptureOptions = {},
): Promise<void> {
  const dsn = process.env["SENTRY_DSN"];
  if (!dsn) {
    logger.warn("Sentry DSN غير مضبوط — الخطأ مسجّل محلياً فقط", {
      error: error instanceof Error ? error.message : error,
    });
    return;
  }

  try {
    const errorObj = error instanceof Error ? error : new Error(String(error));
    const body = {
      exception: {
        values: [
          {
            type: errorObj.name,
            value: errorObj.message,
            stacktrace: {
              frames: parseStackFrames(errorObj.stack ?? ""),
            },
          },
        ],
      },
      level: opts.level ?? "error",
      tags: {
        environment: process.env["NODE_ENV"] ?? "production",
        service: "weaver",
        ...opts.tags,
      },
      extra: opts.extra,
      user: opts.userId ? { id: opts.userId } : undefined,
      timestamp: new Date().toISOString(),
    };

    const [dsn_host, auth] = parseDsn(dsn);
    await fetch(`${dsn_host}/api/store/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Sentry-Auth": auth,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(5000),
    });
  } catch (sentryErr) {
    logger.warn("فشل إرسال الخطأ إلى Sentry", { sentryErr });
  }
}

// ─── Performance Metrics ──────────────────────────────────────────────────

const metricsBuffer: Array<{
  name: string;
  value: number;
  unit: string;
  tags: Record<string, string>;
  timestamp: number;
}> = [];

export function recordMetric(
  name: string,
  value: number,
  unit: "ms" | "bytes" | "count" | "percent",
  tags: Record<string, string> = {},
): void {
  metricsBuffer.push({ name, value, unit, tags, timestamp: Date.now() });
  // إبقاء آخر 1000 قراءة فقط في الذاكرة
  if (metricsBuffer.length > 1000) {
    metricsBuffer.splice(0, metricsBuffer.length - 1000);
  }
}

export function getMetrics() {
  return [...metricsBuffer];
}

// ─── Alerts ───────────────────────────────────────────────────────────────

export type AlertSeverity = "info" | "warning" | "critical";

export interface Alert {
  title: string;
  message: string;
  severity: AlertSeverity;
  metadata?: Record<string, unknown>;
}

/**
 * يُرسل تنبيهاً عبر كل القنوات المُضبوطة
 */
export async function sendAlert(alert: Alert): Promise<void> {
  logger.info("Alert", { ...alert });

  const promises: Promise<void>[] = [];

  if (process.env["TELEGRAM_ALERT_BOT_TOKEN"] && process.env["TELEGRAM_ALERT_CHAT_ID"]) {
    promises.push(sendTelegramAlert(alert));
  }

  if (process.env["SLACK_WEBHOOK_URL"]) {
    promises.push(sendSlackAlert(alert));
  }

  await Promise.allSettled(promises);
}

async function sendTelegramAlert(alert: Alert): Promise<void> {
  const token = process.env["TELEGRAM_ALERT_BOT_TOKEN"]!;
  const chatId = process.env["TELEGRAM_ALERT_CHAT_ID"]!;

  const emoji = alert.severity === "critical" ? "🚨" : alert.severity === "warning" ? "⚠️" : "ℹ️";
  const text = `${emoji} *${escapeMarkdown(alert.title)}*\n\n${escapeMarkdown(alert.message)}`;

  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "MarkdownV2" }),
    signal: AbortSignal.timeout(5000),
  });
}

async function sendSlackAlert(alert: Alert): Promise<void> {
  const url = process.env["SLACK_WEBHOOK_URL"]!;
  const color = alert.severity === "critical" ? "danger" : alert.severity === "warning" ? "warning" : "good";

  await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      attachments: [
        {
          color,
          title: alert.title,
          text: alert.message,
          footer: "Weaver Monitor",
          ts: Math.floor(Date.now() / 1000),
        },
      ],
    }),
    signal: AbortSignal.timeout(5000),
  });
}

// ─── Uptime Check ─────────────────────────────────────────────────────────

export interface UptimeResult {
  url: string;
  status: "up" | "down" | "degraded";
  responseTimeMs: number;
  statusCode?: number;
  error?: string;
}

export async function checkUptime(url: string): Promise<UptimeResult> {
  const start = Date.now();
  try {
    const res = await fetch(url, {
      method: "GET",
      signal: AbortSignal.timeout(10_000),
    });
    const ms = Date.now() - start;
    return {
      url,
      status: res.ok ? (ms > 3000 ? "degraded" : "up") : "down",
      responseTimeMs: ms,
      statusCode: res.status,
    };
  } catch (err) {
    return {
      url,
      status: "down",
      responseTimeMs: Date.now() - start,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

// ─── مساعدات ──────────────────────────────────────────────────────────────

function parseDsn(dsn: string): [string, string] {
  const url = new URL(dsn);
  const key = url.username;
  const host = `${url.protocol}//${url.host}`;
  return [host, `Sentry sentry_version=7, sentry_key=${key}`];
}

function parseStackFrames(stack: string) {
  return stack
    .split("\n")
    .slice(1)
    .map((line) => {
      const match = line.match(/at\s+(.+)\s+\((.+):(\d+):(\d+)\)/);
      if (match) {
        return {
          function: match[1],
          filename: match[2],
          lineno: parseInt(match[3] ?? "0"),
          colno: parseInt(match[4] ?? "0"),
        };
      }
      return { filename: line.trim() };
    });
}

function escapeMarkdown(text: string): string {
  return text.replace(/[_*[\]()~`>#+=|{}.!-]/g, "\\$&");
}
