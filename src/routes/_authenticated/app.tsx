import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  ArrowUp,
  FolderKanban,
  GitBranch,
  LayoutTemplate,
  Loader2,
  Search,
  ShieldCheck,
  TerminalSquare,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/agent/app-shell";
import { createProject, listProjects } from "@/lib/projects.functions";
import { applyTemplate } from "@/lib/templates.functions";

import { STARTER_TEMPLATES } from "@/lib/templates";

export const Route = createFileRoute("/_authenticated/app")({
  head: () => ({
    meta: [
      { title: "مساحة العمل — Weaver" },
      {
        name: "description",
        content: "ابدأ مهمة هندسية جديدة: مواصفات، رسم مهام باعتماديات، تنفيذ وتحقق بالأدلة.",
      },
      { property: "og:title", content: "مساحة العمل — Weaver" },
      {
        property: "og:description",
        content: "لوحة انطلاق مهامك الهندسية داخل Weaver.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Workspace,
});

const SAMPLES = [
  "أريد موقعًا مثل Airbnb ولكن للمطاعم",
  "منصة اشتراكات مع دفع ولوحة تحكم للمشرف",
  "راجع معمارية مشروع SaaS متعدد المستأجرين",
];

const PILLARS = [
  {
    icon: TerminalSquare,
    title: "مواصفات قبل الكود",
    desc: "يحوّل طلبك إلى مصدر حقيقة واحد: أهداف، متطلبات، قيود، ومعايير قبول.",
  },
  {
    icon: GitBranch,
    title: "رسم مهام لا قائمة",
    desc: "مهام لها اعتماديات ومخرجات ومعايير قبول، قابلة للتنفيذ المتوازي.",
  },
  {
    icon: ShieldCheck,
    title: "تحقق بالأدلة",
    desc: "لا يعلن الإنجاز إلا بعد build وtypecheck واختبارات ومراجعة مستقلة.",
  },
];

function Workspace() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [input, setInput] = useState("");
  const [query, setQuery] = useState("");
  const projects = useQuery({ queryKey: ["projects"], queryFn: () => listProjects() });
  const filteredProjects = useMemo(() => {
    const list = projects.data ?? [];
    const term = query.trim().toLowerCase();
    return term ? list.filter((p) => p.title.toLowerCase().includes(term)) : list;
  }, [projects.data, query]);

  const create = useMutation({
    mutationFn: (title: string) => createProject({ data: { title } }),
    onError: () => toast.error("تعذّر بدء المهمة"),
  });

  const launch = (prompt: string) => {
    const value = prompt.trim();
    if (!value || create.isPending) return;
    create.mutate(value.slice(0, 110), {
      onSuccess: (project) => {
        void queryClient.invalidateQueries({ queryKey: ["projects"] });
        if (project) {
          void navigate({
            to: "/c/$threadId",
            params: { threadId: project.id },
            search: { q: value },
          });
        }
      },
    });
  };

  const [starting, setStarting] = useState<string | null>(null);

  const launchTemplate = async (templateId: string) => {
    const template = STARTER_TEMPLATES.find((item) => item.id === templateId);
    if (!template || starting) return;
    setStarting(templateId);
    try {
      const project = await createProject({ data: { title: template.title } });
      if (!project) throw new Error("تعذّر إنشاء المشروع");
      await applyTemplate({ data: { projectId: project.id, templateId } });
      void queryClient.invalidateQueries({ queryKey: ["projects"] });
      void navigate({
        to: "/c/$threadId",
        params: { threadId: project.id },
        search: { q: template.prompt },
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "تعذّر بدء القالب");
    } finally {
      setStarting(null);
    }
  };

  return (
    <AppShell>
      <div className="grid-paper h-full overflow-y-auto">
        <div className="mx-auto w-full max-w-3xl px-5 py-14 sm:py-20">
          <div className="flex justify-center sm:justify-start">
            <span className="inline-flex items-center gap-2.5 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 font-mono text-[11px] tracking-[0.2em] text-indigo-300 shadow-sm backdrop-blur-md">
              <span className="flex size-1.5 animate-pulse rounded-full bg-indigo-400"></span>
              INTAKE → SPEC → GRAPH → VERIFY → DEPLOY
            </span>
          </div>
          <h1 className="mt-8 bg-gradient-to-br from-white via-white to-white/50 bg-clip-text text-4xl font-extrabold leading-tight tracking-tight text-transparent sm:text-5xl lg:text-6xl">
            وكيل هندسي يخطّط وينفّذ ويتحقق
            <span className="mt-2 block bg-gradient-to-r from-indigo-400 via-purple-400 to-cyan-400 bg-clip-text text-transparent">قبل أن يقول: انتهيت.</span>
          </h1>
          <p className="mt-6 max-w-2xl text-[16px] leading-relaxed text-muted-foreground/80">
            اكتب طلبك بلغتك، وسيبدأ Weaver من تفكيك المتطلبات حتى خطة النشر والمراقبة — وكل شيء
            محفوظ في حسابك.
          </p>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              launch(input);
            }}
            className="mt-10"
          >
            <div className="group relative flex items-end gap-3 rounded-3xl border border-white/10 bg-black/40 p-3 shadow-2xl backdrop-blur-xl transition-all focus-within:border-indigo-500/50 focus-within:bg-black/60 focus-within:ring-4 focus-within:ring-indigo-500/10 hover:border-white/20">
              <div className="absolute inset-0 -z-10 rounded-3xl bg-gradient-to-b from-white/5 to-transparent opacity-0 transition-opacity group-focus-within:opacity-100"></div>
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    launch(input);
                  }
                }}
                rows={2}
                autoFocus
                placeholder="مثال: أريد منصة حجوزات للمطاعم مع لوحة تحكم ودفع إلكتروني…"
                className="max-h-48 flex-1 resize-none bg-transparent px-4 py-3 text-[15px] leading-relaxed text-foreground/90 outline-none placeholder:text-muted-foreground/50"
              />
              <button
                type="submit"
                disabled={!input.trim() || create.isPending}
                className="group/btn relative grid size-12 shrink-0 place-items-center overflow-hidden rounded-2xl bg-indigo-500 text-white shadow-lg shadow-indigo-500/25 transition-all hover:scale-105 hover:bg-indigo-400 hover:shadow-indigo-500/40 disabled:scale-100 disabled:opacity-50"
                aria-label="ابدأ المهمة"
              >
                <div className="absolute inset-0 bg-gradient-to-b from-white/20 to-transparent"></div>
                {create.isPending ? (
                  <Loader2 className="relative size-5 animate-spin" />
                ) : (
                  <ArrowUp className="relative size-5 transition-transform group-hover/btn:-translate-y-1" />
                )}
              </button>
            </div>
          </form>

          <div className="mt-6 flex flex-wrap gap-2">
            {SAMPLES.map((sample) => (
              <button
                key={sample}
                type="button"
                onClick={() => launch(sample)}
                className="rounded-full border border-white/5 bg-white/5 px-4 py-2 text-[12.5px] font-medium text-muted-foreground/80 shadow-sm backdrop-blur-md transition-all hover:border-indigo-500/30 hover:bg-white/10 hover:text-indigo-300"
              >
                {sample}
              </button>
            ))}
          </div>

          <section className="mt-12">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="flex items-center gap-2 text-[15px] font-bold">
                <FolderKanban className="size-4 text-primary" />
                مشاريعي
                <span className="font-mono text-[11px] text-muted-foreground">
                  {projects.data?.length ?? 0}
                </span>
              </h2>
              <div className="relative">
                <Search className="pointer-events-none absolute inset-y-0 start-2.5 my-auto size-3.5 text-muted-foreground" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="ابحث في مشاريعك…"
                  className="w-56 rounded-lg border bg-card py-1.5 pe-3 ps-8 text-[12px] outline-none focus:ring-2 focus:ring-ring/40"
                />
              </div>
            </div>

            {projects.isLoading ? (
              <div className="mt-6 flex animate-pulse items-center justify-center gap-3 rounded-2xl border border-white/5 bg-white/5 p-12 backdrop-blur-sm">
                <Loader2 className="size-6 animate-spin text-indigo-400" />
                <p className="text-[14px] font-medium text-muted-foreground">جارٍ تحميل المشاريع…</p>
              </div>
            ) : filteredProjects.length === 0 ? (
              <div className="mt-6 rounded-3xl border border-dashed border-white/10 bg-white/5 p-12 text-center shadow-inner backdrop-blur-sm">
                <FolderKanban className="mx-auto mb-4 size-10 text-muted-foreground/30" />
                <p className="text-[14px] font-medium text-muted-foreground/80">
                  {query ? "لا توجد نتائج مطابقة." : "لا توجد مشاريع بعد — ابدأ واحداً من الأعلى."}
                </p>
              </div>
            ) : (
              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                {filteredProjects.map((project) => (
                  <Link
                    key={project.id}
                    to="/c/$threadId"
                    params={{ threadId: project.id }}
                    className="group relative overflow-hidden rounded-2xl border border-white/5 bg-white/5 p-5 shadow-sm backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:border-indigo-500/30 hover:shadow-xl hover:shadow-indigo-500/10"
                  >
                    <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100"></div>
                    <div className="relative flex items-start justify-between gap-3">
                      <h3 className="line-clamp-2 text-[15px] font-bold leading-tight text-foreground/90 transition-colors group-hover:text-indigo-300">
                        {project.title}
                      </h3>
                      <span className="shrink-0 rounded-full border border-white/10 bg-black/20 px-2.5 py-1 font-mono text-[10px] font-medium text-muted-foreground/80 shadow-inner">
                        {project.status}
                      </span>
                    </div>
                    <p className="relative mt-3 font-mono text-[11px] text-muted-foreground/60" dir="ltr">
                      {new Date(project.updated_at).toLocaleString("en-GB")}
                    </p>
                  </Link>
                ))}
              </div>
            )}
          </section>

          <section className="mt-12">
            <h2 className="flex items-center gap-2 text-[15px] font-bold">
              <LayoutTemplate className="size-4 text-primary" />
              قوالب انطلاق جاهزة
            </h2>
            <p className="mt-1 text-[13px] text-muted-foreground">
              ابدأ من هيكل عربي RTL كامل (HTML + CSS + JS) ثم دع Weaver يطوّره وينشره.
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {STARTER_TEMPLATES.map((template) => (
                <button
                  key={template.id}
                  type="button"
                  onClick={() => void launchTemplate(template.id)}
                  disabled={Boolean(starting)}
                  className="rounded-xl border bg-card p-4 text-start shadow-soft transition-colors hover:border-primary/40 disabled:opacity-60"
                >
                  <div className="flex items-center gap-2">
                    <h3 className="text-[14px] font-bold">{template.title}</h3>
                    {starting === template.id && (
                      <Loader2 className="size-3.5 animate-spin text-primary" />
                    )}
                  </div>
                  <p className="mt-1.5 text-[12px] leading-relaxed text-muted-foreground">
                    {template.description}
                  </p>
                </button>
              ))}
            </div>
          </section>

          <div className="mt-16 grid gap-4 sm:grid-cols-3">
            {PILLARS.map((pillar) => (
              <article key={pillar.title} className="group relative overflow-hidden rounded-3xl border border-white/5 bg-white/5 p-6 shadow-sm backdrop-blur-xl transition-all duration-500 hover:border-white/10 hover:shadow-xl hover:shadow-indigo-500/5">
                <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 via-transparent to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
                <span className="relative grid size-12 place-items-center rounded-2xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 text-indigo-400 shadow-inner ring-1 ring-white/10 transition-transform duration-500 group-hover:scale-110 group-hover:text-indigo-300">
                  <pillar.icon className="size-6" />
                </span>
                <h2 className="relative mt-5 text-[15px] font-bold tracking-tight text-foreground/90">{pillar.title}</h2>
                <p className="relative mt-2 text-[13px] leading-relaxed text-muted-foreground/80">
                  {pillar.desc}
                </p>
              </article>
            ))}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
