/**
 * security-panel.tsx — لوحة فاحص الأمان المرئية في Weaver.
 *
 * تعرض:
 * ✅ نتيجة الأمان (درجة A-F + نقاط 0-100)
 * ✅ قائمة الثغرات مصنّفة حسب الخطورة
 * ✅ تفاصيل كل ثغرة مع الكود المتأثر والإصلاح
 * ✅ فحص سريع (Static) وفحص عميق (AI-enhanced)
 */

import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Loader2,
  Lock,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { runSecurityScan } from "@/lib/security-scanner.functions";
import type { ScanResult, Severity, SecurityIssue } from "@/lib/security-scanner.server";

// ============================================================
// مكوّنات مساعدة
// ============================================================

const SEVERITY_CONFIG: Record<
  Severity,
  { label: string; color: string; bg: string; border: string; icon: typeof AlertTriangle }
> = {
  critical: {
    label: "حرجة",
    color: "text-red-400",
    bg: "bg-red-500/10",
    border: "border-red-500/30",
    icon: ShieldAlert,
  },
  high: {
    label: "عالية",
    color: "text-orange-400",
    bg: "bg-orange-500/10",
    border: "border-orange-500/30",
    icon: AlertTriangle,
  },
  medium: {
    label: "متوسطة",
    color: "text-yellow-400",
    bg: "bg-yellow-500/10",
    border: "border-yellow-500/30",
    icon: AlertTriangle,
  },
  low: {
    label: "منخفضة",
    color: "text-blue-400",
    bg: "bg-blue-500/10",
    border: "border-blue-500/30",
    icon: ShieldCheck,
  },
  info: {
    label: "معلوماتية",
    color: "text-slate-400",
    bg: "bg-slate-500/10",
    border: "border-slate-500/30",
    icon: ShieldCheck,
  },
};

const GRADE_CONFIG: Record<
  ScanResult["grade"],
  { color: string; bg: string; label: string }
> = {
  A: { color: "text-emerald-400", bg: "bg-emerald-500/10", label: "ممتاز" },
  B: { color: "text-green-400", bg: "bg-green-500/10", label: "جيد" },
  C: { color: "text-yellow-400", bg: "bg-yellow-500/10", label: "متوسط" },
  D: { color: "text-orange-400", bg: "bg-orange-500/10", label: "ضعيف" },
  F: { color: "text-red-400", bg: "bg-red-500/10", label: "فاشل" },
};

// ============================================================
// مكوّن عنصر الثغرة
// ============================================================

function IssueCard({ issue }: { issue: SecurityIssue }) {
  const [expanded, setExpanded] = useState(false);
  const cfg = SEVERITY_CONFIG[issue.severity];
  const Icon = cfg.icon;

  return (
    <div
      className={cn(
        "rounded-lg border transition-all duration-200",
        cfg.bg,
        cfg.border,
      )}
    >
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        className="flex w-full items-start gap-3 p-3 text-start"
      >
        <Icon className={cn("mt-0.5 size-4 shrink-0", cfg.color)} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={cn("text-[11px] font-bold uppercase tracking-wide", cfg.color)}>
              {cfg.label}
            </span>
            <span className="text-[11px] text-muted-foreground">{issue.category}</span>
            {issue.cweId && (
              <a
                href={`https://cwe.mitre.org/data/definitions/${issue.cweId.replace("CWE-", "")}.html`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-0.5"
                onClick={(e) => e.stopPropagation()}
              >
                {issue.cweId} <ExternalLink className="size-2.5" />
              </a>
            )}
          </div>
          <p className="text-[13px] font-medium mt-0.5">{issue.title}</p>
          {issue.file && (
            <p className="text-[11px] text-muted-foreground mt-0.5 font-mono">
              {issue.file}{issue.line ? `:${issue.line}` : ""}
            </p>
          )}
        </div>
        {expanded ? (
          <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
        )}
      </button>

      {expanded && (
        <div className="border-t border-current/10 px-3 pb-3 pt-2 space-y-2">
          <p className="text-[12px] text-muted-foreground">{issue.description}</p>
          {issue.code && (
            <pre className="rounded bg-black/30 px-3 py-2 text-[11px] font-mono text-foreground/80 overflow-x-auto">
              {issue.code}
            </pre>
          )}
          <div className="rounded bg-emerald-500/10 border border-emerald-500/20 px-3 py-2">
            <p className="text-[11px] font-semibold text-emerald-400 mb-1">الإصلاح المقترح:</p>
            <p className="text-[12px] text-foreground/80">{issue.fix}</p>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// مكوّن نتيجة الدرجة
// ============================================================

function ScoreRing({ score, grade }: { score: number; grade: ScanResult["grade"] }) {
  const cfg = GRADE_CONFIG[grade];
  const circumference = 2 * Math.PI * 28;
  const dashOffset = circumference * (1 - score / 100);

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative size-20">
        <svg className="size-20 -rotate-90" viewBox="0 0 64 64">
          <circle
            cx="32" cy="32" r="28"
            fill="none"
            stroke="currentColor"
            strokeWidth="6"
            className="text-muted/20"
          />
          <circle
            cx="32" cy="32" r="28"
            fill="none"
            strokeWidth="6"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            strokeLinecap="round"
            className={cn("transition-all duration-1000", cfg.color)}
            style={{ stroke: "currentColor" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={cn("text-2xl font-black", cfg.color)}>{grade}</span>
        </div>
      </div>
      <div className="text-center">
        <p className="text-[13px] font-semibold">{score}/100</p>
        <p className={cn("text-[11px]", cfg.color)}>{cfg.label}</p>
      </div>
    </div>
  );
}

// ============================================================
// اللوحة الرئيسية
// ============================================================

export function SecurityPanel({ projectId }: { projectId: string }) {
  const [aiMode, setAiMode] = useState(false);

  const scan = useMutation({
    mutationFn: ({ ai }: { ai: boolean }) =>
      runSecurityScan({ data: { projectId, aiEnhanced: ai } }),
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : "فشل فحص الأمان"),
  });

  const result = scan.data as ScanResult | undefined;

  const criticalIssues = result?.issues.filter((i) => i.severity === "critical") ?? [];
  const highIssues = result?.issues.filter((i) => i.severity === "high") ?? [];
  const mediumIssues = result?.issues.filter((i) => i.severity === "medium") ?? [];
  const lowIssues = result?.issues.filter((i) => i.severity === "low") ?? [];

  return (
    <div className="flex h-full flex-col gap-3 overflow-auto p-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Lock className="size-4 text-primary" />
          <h2 className="text-[14px] font-semibold">فاحص الأمان</h2>
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1.5 cursor-pointer select-none">
            <div
              onClick={() => setAiMode((v) => !v)}
              className={cn(
                "relative h-5 w-9 rounded-full transition-colors cursor-pointer",
                aiMode ? "bg-primary" : "bg-muted",
              )}
            >
              <div
                className={cn(
                  "absolute top-0.5 size-4 rounded-full bg-white shadow transition-transform",
                  aiMode ? "translate-x-4" : "translate-x-0.5",
                )}
              />
            </div>
            <span className="text-[12px] text-muted-foreground">AI</span>
          </label>
          <Button
            size="sm"
            variant="outline"
            disabled={scan.isPending}
            onClick={() => scan.mutate({ ai: aiMode })}
            className="gap-1.5 text-[12px]"
          >
            {scan.isPending ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <RefreshCw className="size-3.5" />
            )}
            {scan.isPending ? "جارٍ الفحص…" : "فحص الآن"}
          </Button>
        </div>
      </div>

      {/* حالة المسح */}
      {!result && !scan.isPending && (
        <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-dashed py-12 text-center">
          <ShieldAlert className="size-10 text-muted-foreground/50" />
          <div className="space-y-1">
            <p className="text-[14px] font-medium">اكتشاف الثغرات الأمنية</p>
            <p className="text-[12px] text-muted-foreground max-w-xs">
              يفحص كود مشروعك بحثاً عن {">"}10 أنواع من الثغرات بما فيها OWASP Top 10
            </p>
          </div>
          <Button
            variant="default"
            size="sm"
            onClick={() => scan.mutate({ ai: aiMode })}
            className="gap-2"
          >
            <Zap className="size-3.5" />
            ابدأ الفحص
          </Button>
        </div>
      )}

      {scan.isPending && (
        <div className="flex flex-col items-center justify-center gap-3 py-12">
          <Loader2 className="size-8 animate-spin text-primary" />
          <p className="text-[13px] text-muted-foreground">
            {aiMode ? "فحص عميق بالذكاء الاصطناعي…" : "فحص سريع…"}
          </p>
        </div>
      )}

      {result && !scan.isPending && (
        <>
          {/* النتيجة الإجمالية */}
          <div className="flex items-center gap-6 rounded-xl border bg-surface/60 p-4">
            <ScoreRing score={result.score} grade={result.grade} />
            <div className="flex-1 space-y-1">
              <p className="text-[13px] font-medium">{result.summary}</p>
              <p className="text-[11px] text-muted-foreground">
                فحص {result.filesScanned} ملف •{" "}
                {new Date(result.scannedAt).toLocaleTimeString("ar")}
                {result.aiEnhanced && (
                  <span className="ms-1.5 rounded bg-primary/10 px-1.5 py-0.5 text-[10px] text-primary">
                    AI
                  </span>
                )}
              </p>
              <div className="flex gap-3 pt-1">
                {criticalIssues.length > 0 && (
                  <span className="text-[11px] font-semibold text-red-400">
                    {criticalIssues.length} حرجة
                  </span>
                )}
                {highIssues.length > 0 && (
                  <span className="text-[11px] font-semibold text-orange-400">
                    {highIssues.length} عالية
                  </span>
                )}
                {mediumIssues.length > 0 && (
                  <span className="text-[11px] font-semibold text-yellow-400">
                    {mediumIssues.length} متوسطة
                  </span>
                )}
                {lowIssues.length > 0 && (
                  <span className="text-[11px] font-semibold text-blue-400">
                    {lowIssues.length} منخفضة
                  </span>
                )}
                {result.issues.length === 0 && (
                  <span className="text-[11px] font-semibold text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 className="size-3" /> لا ثغرات
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* قائمة الثغرات */}
          {result.issues.length > 0 && (
            <div className="space-y-2">
              {(["critical", "high", "medium", "low", "info"] as Severity[]).map((sev) => {
                const sevIssues = result.issues.filter((i) => i.severity === sev);
                if (sevIssues.length === 0) return null;
                return (
                  <div key={sev} className="space-y-1.5">
                    <p className={cn("text-[11px] font-bold uppercase", SEVERITY_CONFIG[sev].color)}>
                      {SEVERITY_CONFIG[sev].label} ({sevIssues.length})
                    </p>
                    {sevIssues.map((issue) => (
                      <IssueCard key={issue.id} issue={issue} />
                    ))}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
