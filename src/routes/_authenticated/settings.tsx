import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  ArrowRight,
  Clock,
  Cpu,
  Github,
  Puzzle,
  Server,
  Sparkles,
  Wallet,
} from "lucide-react";
import { AppShell } from "@/components/agent/app-shell";
import { ConnectorsCatalog } from "@/components/agent/connectors-catalog";
import { CustomSkillsManager } from "@/components/agent/custom-skills-manager";

import { ExecutorsManager } from "@/components/agent/executors-manager";
import { SchedulesManager } from "@/components/agent/schedules-manager";

import { DEFAULT_MODEL, MODEL_OPTIONS, useModelSetting } from "@/lib/model-settings";
import { SKILLS, useSkills } from "@/lib/skills";
import { getUsageSummary } from "@/lib/usage.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "الإعدادات — Weaver" },
      {
        name: "description",
        content: "اضبط نموذج الذكاء الاصطناعي، فعّل المهارات، وراجع استهلاك الطلبات في Weaver.",
      },
      { property: "og:title", content: "الإعدادات — Weaver" },
      { property: "og:description", content: "لوحة الإعدادات الإدارية لوكيل Weaver الهندسي." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SettingsPage,
});

function Section({
  icon: Icon,
  title,
  desc,
  children,
}: {
  icon: typeof Cpu;
  title: string;
  desc: string;
  children: React.ReactNode;
}) {
  return (
    <section className="group relative overflow-hidden rounded-3xl border border-white/5 bg-white/5 p-6 shadow-sm backdrop-blur-xl transition-all duration-500 hover:border-white/10 hover:shadow-xl hover:shadow-indigo-500/5">
      <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 via-transparent to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
      <div className="relative flex items-start gap-4">
        <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 text-indigo-400 shadow-inner ring-1 ring-white/10 transition-transform duration-500 group-hover:scale-110 group-hover:text-indigo-300">
          <Icon className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-[16px] font-bold tracking-tight text-foreground/90">{title}</h2>
          <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground/80">{desc}</p>
        </div>
      </div>
      <div className="relative mt-6">{children}</div>
    </section>
  );
}

function SettingsPage() {
  const { model, setModel } = useModelSetting();
  const { skills, toggle } = useSkills();
  const usage = useQuery({
    queryKey: ["usage-summary"],
    queryFn: () => getUsageSummary(),
  });

  return (
    <AppShell>
      <div className="h-full overflow-y-auto">
        <div className="mx-auto w-full max-w-3xl space-y-5 px-5 py-10">
          <header>
            <h1 className="text-2xl font-bold tracking-tight">الإعدادات</h1>
            <p className="mt-1.5 text-[13px] text-muted-foreground">
              كل ما يتحكّم في سلوك الوكيل من مكان واحد.
            </p>
          </header>

          <Section
            icon={Cpu}
            title="نموذج الذكاء الاصطناعي"
            desc="النموذج المستخدم عبر Gemini في كل المحادثات الجديدة."
          >
            <div className="grid gap-3 sm:grid-cols-2">
              {MODEL_OPTIONS.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setModel(option.id)}
                  className={cn(
                    "group/btn relative flex flex-col items-start overflow-hidden rounded-2xl border p-4 text-start transition-all duration-300",
                    model === option.id
                      ? "border-indigo-500/50 bg-indigo-500/10 shadow-lg shadow-indigo-500/10 ring-1 ring-indigo-500/20"
                      : "border-white/5 bg-white/5 hover:border-white/10 hover:bg-white/10",
                  )}
                >
                  <span className="relative flex w-full items-center justify-between text-[14px] font-bold text-foreground/90">
                    {option.label}
                    <span className={cn("size-2.5 rounded-full transition-all duration-300", model === option.id ? "bg-indigo-400 shadow-[0_0_8px_rgba(129,140,248,0.8)] scale-100" : "bg-white/20 scale-0")}></span>
                  </span>
                  <span className="relative mt-1 block text-[12px] text-muted-foreground/80">
                    {option.note}
                  </span>
                  <span
                    className="relative mt-2 inline-flex items-center rounded-md bg-black/20 px-2 py-0.5 font-mono text-[10px] font-medium text-muted-foreground"
                    dir="ltr"
                  >
                    {option.id}
                  </span>
                </button>
              ))}
            </div>
            <div className="mt-5 space-y-2 rounded-2xl border border-white/5 bg-black/20 p-4">
              <label className="block text-[13px] font-semibold text-foreground/90">معرّف نموذج مخصص</label>
              <div className="relative">
                <input
                  defaultValue={model}
                  onBlur={(e) => {
                    setModel(e.target.value || DEFAULT_MODEL);
                    toast.success("تم الحفظ بنجاح", { icon: <Activity className="size-4 text-emerald-400" /> });
                  }}
                  dir="ltr"
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 font-mono text-[13px] text-foreground/90 outline-none transition-all placeholder:text-muted-foreground/50 focus:border-indigo-500/50 focus:bg-white/10 focus:ring-4 focus:ring-indigo-500/10"
                  placeholder="vendor/model-id"
                />
              </div>
            </div>
          </Section>

          <Section
            icon={Sparkles}
            title="المهارات"
            desc="المهارات المفعّلة تُحقن في تعليمات الوكيل وتغيّر طريقة بنائه للمشاريع."
          >
            <div className="grid gap-3 sm:grid-cols-2">
              {SKILLS.map((skill) => {
                const active = skills.includes(skill.id);
                return (
                  <button
                    key={skill.id}
                    type="button"
                    onClick={() => toggle(skill.id)}
                    className={cn(
                      "group flex flex-col gap-2 rounded-2xl border p-4 text-start transition-all duration-300",
                      active
                        ? "border-indigo-500/40 bg-indigo-500/5 shadow-md shadow-indigo-500/5"
                        : "border-white/5 bg-white/5 hover:border-white/10 hover:bg-white/10",
                    )}
                  >
                    <div className="flex w-full items-center justify-between">
                      <span className="text-[14px] font-bold text-foreground/90">{skill.name}</span>
                      <div className={cn("relative h-5 w-9 rounded-full transition-colors duration-300", active ? "bg-indigo-500" : "bg-white/10")}>
                        <div className={cn("absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform duration-300 shadow-sm", active ? "start-[18px]" : "start-0.5")} />
                      </div>
                    </div>
                    <span className="block text-[12px] leading-relaxed text-muted-foreground/80">
                      {skill.desc}
                    </span>
                  </button>
                );
              })}
            </div>
          </Section>

          <Section
            icon={Puzzle}
            title="منشئ المهارات"
            desc="عرّف مهارات خاصة بك: اسم ووصف وتعليمات يلتزم بها الوكيل حرفياً عند تفعيلها من صندوق المحادثة."
          >
            <CustomSkillsManager />
          </Section>

          <ConnectorsCatalog />

          <Section
            icon={Server}
            title="منفّذ التنفيذ (Contabo / VPS)"
            desc="اربط خادمك الخاص ليشغّل الوكيل أوامر حقيقية: npm install وbuild واختبارات وgit — ثم تعود الملفات المعدّلة تلقائياً إلى المشروع."
          >
            <ExecutorsManager />
          </Section>

          <Section
            icon={Clock}
            title="المهام المجدولة"
            desc="أوامر دورية تُدفع تلقائياً إلى طابور المنفّذ: بناء ليلي، اختبارات، نسخ احتياطي، أو أي أمر تريده يتكرر."
          >
            <SchedulesManager />
          </Section>

          <Section
            icon={Activity}
            title="صحة النظام"
            desc="حالة المنفّذات، الطابور، الإخفاقات الأخيرة، الاستهلاك، والمواقع المنشورة في لوحة واحدة."
          >
            <Link
              to="/health"
              className="inline-flex items-center gap-1.5 rounded-lg border bg-card px-3 py-2 text-[12.5px] font-semibold hover:bg-surface"
            >
              فتح لوحة صحة النظام
              <ArrowRight className="size-3.5 rotate-180" />
            </Link>
          </Section>

          <Section
            icon={Wallet}
            title="الاستهلاك"
            desc="إجمالي التوكينز والتكلفة التقديرية لطلبات الوكيل."
          >
            {usage.isLoading ? (
              <p className="text-[12.5px] text-muted-foreground">جارٍ الحساب…</p>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                <Stat label="الطلبات" value={String(usage.data?.requests ?? 0)} />
                <Stat
                  label="التوكينز"
                  value={(usage.data?.totalTokens ?? 0).toLocaleString("en-US")}
                />
                <Stat
                  label="التكلفة التقديرية"
                  value={`$${(usage.data?.costUsd ?? 0).toFixed(4)}`}
                />
              </div>
            )}
          </Section>

          <Section
            icon={Github}
            title="المستودع والنشر"
            desc="رفع مساحة عمل أي مشروع إلى GitHub ونشره على رابط مباشر يتم من داخل لوحة المشروع."
          >
            <Link
              to="/app"
              className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-[12.5px] font-semibold transition-colors hover:bg-surface"
            >
              الذهاب إلى المشاريع
              <ArrowRight className="size-3.5 rotate-180" />
            </Link>
          </Section>
        </div>
      </div>
    </AppShell>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border bg-surface/60 p-3">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="mt-1 font-mono text-[15px] font-bold" dir="ltr">
        {value}
      </p>
    </div>
  );
}
