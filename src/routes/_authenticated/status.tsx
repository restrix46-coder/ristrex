import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Download, Loader2, Printer, RefreshCcw, XCircle } from "lucide-react";
import { useState } from "react";
import { getInfraHealth, restartInfraService } from "@/lib/infra-health.functions";
import { cn } from "@/lib/utils";
import { AppShell } from "@/components/agent/app-shell";

export const Route = createFileRoute("/_authenticated/status")({
  component: StatusPage,
  head: () => ({
    meta: [
      { title: "حالة الخدمات والنشر | Weaver" },
      {
        name: "description",
        content:
          "حالة deploy-hook و Nginx وبيئة التنفيذ على كونتابو مع وقت آخر نشر، سجلات آخر 200 سطر، وتقرير أعطال جاهز.",
      },
      { property: "og:title", content: "حالة الخدمات والنشر | Weaver" },
      {
        property: "og:description",
        content: "مؤشرات PASS/FAIL لكل خدمة، أزرار إعادة تشغيل فورية، وتقرير أعطال قابل للتنزيل.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

type Service = "deploy-hook" | "nginx" | "runtime" | "app" | "worker";

const SERVICES: { service: Service; label: string }[] = [
  { service: "deploy-hook", label: "خطّاف النشر" },
  { service: "runtime", label: "بيئة التنفيذ" },
  { service: "nginx", label: "بوابة Nginx" },
  { service: "app", label: "التطبيق" },
  { service: "worker", label: "العامل الخلفي" },
];

function Badge({ ok }: { ok: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold shadow-sm backdrop-blur-md transition-all duration-300",
        ok 
          ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 shadow-emerald-500/10" 
          : "bg-rose-500/10 text-rose-500 border border-rose-500/20 shadow-rose-500/10",
      )}
    >
      <span className="relative flex size-2">
        <span className={cn("absolute inline-flex h-full w-full animate-ping rounded-full opacity-75", ok ? "bg-emerald-500" : "bg-rose-500")}></span>
        <span className={cn("relative inline-flex size-2 rounded-full", ok ? "bg-emerald-500" : "bg-rose-500")}></span>
      </span>
      {ok ? "PASS" : "FAIL"}
    </span>
  );
}

function StatusPage() {
  const queryClient = useQueryClient();
  const [note, setNote] = useState<string | null>(null);
  const { data, isPending, isFetching, error, refetch } = useQuery({
    queryKey: ["infra-health"],
    queryFn: () => getInfraHealth(),
    refetchInterval: 30_000,
    retry: false,
  });

  const restart = useMutation({
    mutationFn: (service: Service) => restartInfraService({ data: { service } }),
    onSuccess: (result) => {
      setNote(result.detail);
      void queryClient.invalidateQueries({ queryKey: ["infra-health"] });
    },
    onError: (err) => setNote(err instanceof Error ? err.message : String(err)),
  });

  const downloadReport = () => {
    if (!data) return;
    const blob = new Blob([data.report], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `weaver-incident-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const printReport = () => {
    if (!data) return;
    const win = window.open("", "_blank", "width=900,height=1000");
    if (!win) return;
    win.document.write(
      `<html dir="rtl"><head><meta charset="utf-8"><title>تقرير أعطال Weaver</title></head><body style="font-family:system-ui;padding:24px"><pre style="white-space:pre-wrap;font-size:12px">${data.report.replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" })[c] ?? c)}</pre></body></html>`,
    );
    win.document.close();
    win.focus();
    win.print();
  };

  return (
    <AppShell>
      <div className="h-full overflow-y-auto">
        <main className="mx-auto w-full max-w-5xl space-y-5 p-6" dir="rtl">
          <header className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-white/10 bg-gradient-to-br from-indigo-500/10 via-purple-500/5 to-cyan-500/10 p-6 shadow-2xl backdrop-blur-xl">
            <div>
              <h1 className="bg-gradient-to-r from-indigo-400 via-purple-400 to-cyan-400 bg-clip-text text-2xl font-extrabold text-transparent">حالة الخدمات والنشر</h1>
              <p className="mt-2 text-[13px] text-muted-foreground/80">
                deploy-hook، Nginx، بيئة التنفيذ، وآخر نشر على كونتابو — مع مؤشرات PASS/FAIL.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => void refetch()}
                className="group relative inline-flex items-center gap-2 overflow-hidden rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-[12px] font-medium shadow-lg backdrop-blur-md transition-all hover:bg-white/10 hover:shadow-indigo-500/20"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/20 to-purple-500/20 opacity-0 transition-opacity group-hover:opacity-100"></div>
                <RefreshCcw className={cn("relative size-4 transition-transform group-hover:rotate-180", isFetching && "animate-spin")} />
                <span className="relative">تحديث</span>
              </button>
              <button
                type="button"
                disabled={!data || isPending}
                onClick={downloadReport}
                className="group inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-[12px] font-medium shadow-lg backdrop-blur-md transition-all hover:bg-white/10 hover:shadow-indigo-500/20 disabled:opacity-50"
              >
                <Download className="size-4 transition-transform group-hover:-translate-y-0.5" /> تقرير نصّي
              </button>
              <button
                type="button"
                disabled={!data || isPending}
                onClick={printReport}
                className="group inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-[12px] font-medium shadow-lg backdrop-blur-md transition-all hover:bg-white/10 hover:shadow-indigo-500/20 disabled:opacity-50"
              >
                <Printer className="size-4 transition-transform group-hover:scale-110" /> PDF
              </button>
            </div>
          </header>

          {isPending && (
            <div className="flex animate-pulse items-center gap-3 rounded-2xl border border-white/5 bg-white/5 p-6 backdrop-blur-sm">
              <Loader2 className="size-5 animate-spin text-indigo-400" />
              <p className="text-[13px] font-medium text-muted-foreground">جارٍ فحص الخدمات على الخادم…</p>
            </div>
          )}

          {error && (
            <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-[12px] text-destructive">
              <p className="font-semibold">تعذّر جلب حالة البنية التحتية من الخادم:</p>
              <p className="mt-1 font-mono">{error instanceof Error ? error.message : String(error)}</p>
              <button
                type="button"
                onClick={() => void refetch()}
                className="mt-2 text-xs font-semibold underline"
              >
                إعادة المحاولة
              </button>
            </div>
          )}

          {data && (
            <>
              <section className="rounded-xl border">
                <div className="flex items-center justify-between border-b px-4 py-2.5">
                  <h2 className="text-[13px] font-semibold">الخدمات</h2>
                  <Badge ok={data.ok} />
                </div>
                <div className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-3">
                  {data.probes.map((probe) => (
                    <div
                      key={probe.label}
                      className="group flex flex-col gap-3 rounded-2xl border border-white/5 bg-gradient-to-b from-white/5 to-transparent p-4 shadow-sm backdrop-blur-sm transition-all duration-500 hover:-translate-y-1 hover:border-indigo-500/30 hover:bg-white/10 hover:shadow-xl hover:shadow-indigo-500/10"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-foreground/90">{probe.label}</span>
                        <Badge ok={probe.ok} />
                      </div>
                      <span className="truncate text-[11.5px] text-muted-foreground/70" dir="ltr">
                        {probe.detail}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="flex flex-wrap items-center gap-2.5 border-t border-white/10 bg-white/5 px-5 py-4">
                  <span className="text-[12px] font-medium text-muted-foreground/80">إجراءات سريعة:</span>
                  {SERVICES.map((item) => (
                    <button
                      key={item.service}
                      type="button"
                      disabled={restart.isPending}
                      onClick={() => restart.mutate(item.service)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-black/20 px-3 py-1.5 text-[11px] font-semibold text-foreground/80 shadow-sm backdrop-blur-md transition-all hover:bg-indigo-500/20 hover:text-indigo-300 disabled:opacity-50"
                    >
                      {restart.isPending && restart.variables === item.service ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <RefreshCcw className="size-3" />
                      )}
                      إعادة تشغيل {item.label}
                    </button>
                  ))}
                  {note && (
                    <span className="w-full truncate text-[11px] text-muted-foreground" dir="ltr">
                      {note}
                    </span>
                  )}
                </div>
              </section>

              <section className="rounded-xl border p-4 text-[12px]">
                <h2 className="mb-2 text-[13px] font-semibold">آخر نشر</h2>
                {data.lastDeploy ? (
                  <dl className="grid grid-cols-2 gap-2 md:grid-cols-4">
                    <div>
                      <dt className="text-muted-foreground">الحالة</dt>
                      <dd className="font-semibold">{data.lastDeploy.status ?? "—"}</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">النوع</dt>
                      <dd>{data.lastDeploy.action ?? "—"}</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">البدء</dt>
                      <dd dir="ltr">
                        {data.lastDeploy.startedAt
                          ? new Date(data.lastDeploy.startedAt).toLocaleString("ar")
                          : "—"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">الانتهاء</dt>
                      <dd dir="ltr">
                        {data.lastDeploy.finishedAt
                          ? new Date(data.lastDeploy.finishedAt).toLocaleString("ar")
                          : data.activeJob
                            ? "قيد التنفيذ"
                            : "—"}
                      </dd>
                    </div>
                  </dl>
                ) : (
                  <p className="text-muted-foreground">لا توجد مهمة نشر مسجّلة على الخادم بعد.</p>
                )}
              </section>

              {data.incident && (
                <section className="rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-[12px]">
                  <h2 className="mb-2 text-[13px] font-semibold text-destructive">تقرير الأعطال</h2>
                  <p className="font-semibold">الأسباب</p>
                  <ul className="mb-2 list-disc space-y-0.5 pe-5">
                    {data.incident.reasons.map((reason) => (
                      <li key={reason} dir="ltr" className="break-words">
                        {reason}
                      </li>
                    ))}
                  </ul>
                  <p className="font-semibold">الخطوة المقترحة</p>
                  <ul className="list-disc space-y-0.5 pe-5">
                    {data.incident.steps.map((step) => (
                      <li key={step}>{step}</li>
                    ))}
                  </ul>
                </section>
              )}

              <section className="rounded-xl border">
                <h2 className="border-b px-4 py-2.5 text-[13px] font-semibold">
                  سجل آخر نشر (آخر 200 سطر)
                </h2>
                <pre
                  dir="ltr"
                  className="max-h-[420px] overflow-auto bg-surface/50 p-4 text-[11px] leading-5 whitespace-pre-wrap"
                >
                  {data.lastDeploy?.log?.trim() || data.hookError || "لا يوجد سجل متاح."}
                </pre>
              </section>

              {data.disk && (
                <section className="rounded-xl border p-4">
                  <h2 className="mb-1.5 text-[13px] font-semibold">مساحة القرص</h2>
                  <pre dir="ltr" className="text-[11px] whitespace-pre-wrap">
                    {data.disk}
                  </pre>
                </section>
              )}
            </>
          )}
        </main>
      </div>
    </AppShell>
  );
}
