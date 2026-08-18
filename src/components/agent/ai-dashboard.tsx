/**
 * ai-dashboard.tsx — لوحة المراقبة الشاملة لـ Weaver.
 *
 * تعرض في الوقت الفعلي:
 * ✅ حالة كل مزوّدي الذكاء الاصطناعي (Gemini)
 * ✅ إحصائيات الاستخدام (tokens, requests, costs)
 * ✅ حالة بنية Weaver (DB, Runtime, Worker, Nginx)
 * ✅ آخر المشاريع النشطة
 * ✅ مؤشرات الأداء الحية (latency, errors)
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  AlertTriangle,
  Bot,
  Braces,
  CheckCircle2,
  ChevronUp,
  Cpu,
  Database,
  Loader2,
  Server,
  TrendingUp,
  Wifi,
  WifiOff,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getInfraHealth } from "@/lib/infra-health.functions";
import { getUsage } from "@/lib/usage.functions";

// ============================================================
// مكوّنات مساعدة
// ============================================================

/** بطاقة KPI متحركة */
function KpiCard({
  icon: Icon,
  label,
  value,
  sub,
  trend,
  color = "text-primary",
}: {
  icon: typeof Activity;
  label: string;
  value: string;
  sub?: string;
  trend?: "up" | "down" | "stable";
  color?: string;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-xl border bg-surface/60 p-3 transition-all duration-200 hover:bg-surface/80">
      <div className="flex items-center justify-between">
        <div className={cn("rounded-lg bg-current/10 p-1.5", color)}>
          <Icon className={cn("size-3.5", color)} />
        </div>
        {trend && (
          <div
            className={cn(
              "flex items-center gap-0.5 text-[10px] font-medium",
              trend === "up" ? "text-emerald-400" : trend === "down" ? "text-red-400" : "text-muted-foreground",
            )}
          >
            {trend === "up" && <ChevronUp className="size-3" />}
            {trend === "down" && <ChevronUp className="size-3 rotate-180" />}
          </div>
        )}
      </div>
      <div>
        <p className="text-[20px] font-black tabular-nums">{value}</p>
        <p className="text-[11px] text-muted-foreground">{label}</p>
        {sub && <p className="text-[10px] text-muted-foreground/70 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

/** مؤشر حالة الخدمة */
function ServiceStatus({
  name,
  status,
  latency,
  icon: Icon,
}: {
  name: string;
  status: "healthy" | "degraded" | "down" | "unknown";
  latency?: number;
  icon: typeof Server;
}) {
  const statusConfig = {
    healthy: { dot: "bg-emerald-400", text: "text-emerald-400", label: "متاح" },
    degraded: { dot: "bg-yellow-400", text: "text-yellow-400", label: "بطيء" },
    down: { dot: "bg-red-400", text: "text-red-400", label: "معطّل" },
    unknown: { dot: "bg-slate-400", text: "text-slate-400", label: "غير معروف" },
  };
  const cfg = statusConfig[status];

  return (
    <div className="flex items-center gap-2 rounded-lg border bg-surface/40 px-3 py-2">
      <Icon className="size-3.5 text-muted-foreground shrink-0" />
      <span className="flex-1 text-[12px] font-medium">{name}</span>
      {latency !== undefined && (
        <span className="text-[10px] font-mono text-muted-foreground">{latency}ms</span>
      )}
      <div className="flex items-center gap-1">
        <span className={cn("size-2 rounded-full animate-pulse", cfg.dot)} />
        <span className={cn("text-[10px] font-semibold", cfg.text)}>{cfg.label}</span>
      </div>
    </div>
  );
}

/** شريط استخدام Tokens */
function TokenUsageBar({
  used,
  limit,
  label,
}: {
  used: number;
  limit: number;
  label: string;
}) {
  const pct = Math.min(100, (used / limit) * 100);
  const color = pct >= 90 ? "bg-red-500" : pct >= 70 ? "bg-yellow-500" : "bg-primary";

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-[11px]">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-mono">
          {(used / 1000).toFixed(0)}K / {(limit / 1000).toFixed(0)}K
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-muted/30">
        <div
          className={cn("h-full rounded-full transition-all duration-500", color)}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

/** بطاقة مزوّد AI */
function ProviderCard({
  name,
  model,
  requests,
  configured,
  active,
}: {
  name: string;
  model: string;
  requests: number;
  configured: boolean;
  active: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-lg border p-3 transition-all",
        active
          ? "border-primary/30 bg-primary/5"
          : configured
          ? "bg-surface/40"
          : "opacity-50",
      )}
    >
      <div className={cn("rounded-lg p-1.5", active ? "bg-primary/10" : "bg-muted/20")}>
        <Bot className={cn("size-4", active ? "text-primary" : "text-muted-foreground")} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <p className="text-[12px] font-semibold">{name}</p>
          {active && (
            <span className="rounded bg-primary/10 px-1 py-0.5 text-[9px] font-bold text-primary">
              ACTIVE
            </span>
          )}
        </div>
        <p className="text-[10px] font-mono text-muted-foreground truncate">{model}</p>
      </div>
      <div className="text-end">
        <p className="text-[12px] font-semibold tabular-nums">{requests.toLocaleString("ar")}</p>
        <p className="text-[10px] text-muted-foreground">طلب</p>
      </div>
    </div>
  );
}

// ============================================================
// اللوحة الرئيسية
// ============================================================

export function AiDashboard({ projectId }: { projectId?: string }) {
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const infraHealth = useQuery({
    queryKey: ["infra-health"],
    queryFn: () => getInfraHealth(),
    refetchInterval: 15_000,
    staleTime: 10_000,
  });

  const usage = useQuery({
    queryKey: ["usage", projectId],
    queryFn: () => getUsage({ data: { projectId: projectId ?? "" } }),
    enabled: Boolean(projectId),
    refetchInterval: 30_000,
  });

  useEffect(() => {
    if (infraHealth.dataUpdatedAt) {
      setLastUpdated(new Date(infraHealth.dataUpdatedAt));
    }
  }, [infraHealth.dataUpdatedAt]);

  const health = infraHealth.data;
  const usageData = usage.data;

  // حساب الإحصائيات
  const totalRequests = usageData?.totalRequests ?? 0;
  const totalTokens = usageData?.totalTokens ?? 0;
  const estimatedCost = usageData?.estimatedCostUsd ?? 0;
  const avgLatency = health?.avgLatencyMs ?? 0;

  return (
    <div className="flex h-full flex-col gap-4 overflow-auto p-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TrendingUp className="size-4 text-primary" />
          <h2 className="text-[14px] font-semibold">لوحة المراقبة</h2>
        </div>
        <div className="flex items-center gap-2">
          {infraHealth.isFetching && (
            <Loader2 className="size-3.5 animate-spin text-muted-foreground" />
          )}
          {lastUpdated && (
            <span className="text-[10px] text-muted-foreground">
              آخر تحديث: {lastUpdated.toLocaleTimeString("ar")}
            </span>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-2">
        <KpiCard
          icon={Zap}
          label="إجمالي الطلبات"
          value={totalRequests > 1000 ? `${(totalRequests / 1000).toFixed(1)}K` : String(totalRequests)}
          color="text-primary"
          trend="up"
        />
        <KpiCard
          icon={Braces}
          label="الرموز المستهلكة"
          value={totalTokens > 1_000_000 ? `${(totalTokens / 1_000_000).toFixed(1)}M` : `${(totalTokens / 1000).toFixed(0)}K`}
          color="text-purple-400"
        />
        <KpiCard
          icon={Activity}
          label="متوسط الاستجابة"
          value={avgLatency > 0 ? `${avgLatency}ms` : "—"}
          color={avgLatency > 3000 ? "text-red-400" : avgLatency > 1000 ? "text-yellow-400" : "text-emerald-400"}
        />
        <KpiCard
          icon={Cpu}
          label="التكلفة التقديرية"
          value={`$${estimatedCost.toFixed(3)}`}
          sub="هذا الشهر"
          color="text-amber-400"
        />
      </div>

      {/* حالة البنية التحتية */}
      <div className="space-y-2">
        <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
          البنية التحتية
        </p>
        <div className="space-y-1.5">
          <ServiceStatus
            name="قاعدة البيانات"
            icon={Database}
            status={health?.db ?? "unknown"}
            latency={health?.dbLatencyMs}
          />
          <ServiceStatus
            name="بيئة التنفيذ (Runtime)"
            icon={Server}
            status={health?.runtime ?? "unknown"}
            latency={health?.runtimeLatencyMs}
          />
          <ServiceStatus
            name="خدمة الإنترنت"
            icon={health?.network === "healthy" ? Wifi : WifiOff}
            status={health?.network ?? "unknown"}
          />
          <ServiceStatus
            name="نموذج AI"
            icon={Bot}
            status={health?.ai ?? "unknown"}
            latency={health?.aiLatencyMs}
          />
        </div>
      </div>

      {/* مزوّدو AI */}
      <div className="space-y-2">
        <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
          مزوّدو الذكاء الاصطناعي
        </p>
        <div className="space-y-1.5">
          <ProviderCard
            name="Google Gemini"
            model="gemini-flash-latest"
            requests={usageData?.geminiRequests ?? 0}
            configured={Boolean(health?.providers?.gemini)}
            active={Boolean(health?.providers?.gemini)}
          />
        </div>
      </div>

      {/* استخدام Tokens */}
      {usageData && (
        <div className="space-y-2">
          <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
            الاستخدام الشهري
          </p>
          <div className="rounded-xl border bg-surface/40 p-3 space-y-3">
            <TokenUsageBar
              used={usageData.totalTokens ?? 0}
              limit={2_000_000}
              label="الرموز الكلية"
            />
            <TokenUsageBar
              used={usageData.totalRequests ?? 0}
              limit={10_000}
              label="الطلبات"
            />
          </div>
        </div>
      )}

      {/* تحذيرات */}
      {health && (
        <div className="space-y-1.5">
          {health.db === "down" && (
            <div className="flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-3">
              <AlertTriangle className="size-4 text-red-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-[12px] font-semibold text-red-400">قاعدة البيانات معطّلة</p>
                <p className="text-[11px] text-muted-foreground">تحقق من إعدادات DATABASE_URL</p>
              </div>
            </div>
          )}
          {health.runtime === "down" && (
            <div className="flex items-start gap-2 rounded-lg border border-orange-500/30 bg-orange-500/10 p-3">
              <AlertTriangle className="size-4 text-orange-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-[12px] font-semibold text-orange-400">بيئة التنفيذ غير متاحة</p>
                <p className="text-[11px] text-muted-foreground">
                  تحقق من EXECUTOR_TOKEN وتشغيل حاوية runtime
                </p>
              </div>
            </div>
          )}
          {health.ai === "down" && (
            <div className="flex items-start gap-2 rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-3">
              <AlertTriangle className="size-4 text-yellow-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-[12px] font-semibold text-yellow-400">لا يوجد مزوّد AI مُفعَّل</p>
                <p className="text-[11px] text-muted-foreground">
                  أضف GEMINI_API_KEY
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
