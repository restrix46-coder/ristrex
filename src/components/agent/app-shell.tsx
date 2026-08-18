import { Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, type ReactNode } from "react";
import {
  Activity,
  Code2,
  Loader2,
  LogOut,
  MessageSquarePlus,
  PanelLeft,
  Rocket,
  ScrollText,
  ListChecks,
  HeartPulse,
  Settings,
  ServerCog,
  Trash2,
  Workflow,
  PlugZap,
} from "lucide-react";
import { toast } from "sonner";
import { LifecycleRail } from "@/components/agent/lifecycle-rail";
import { BuildStatusBar } from "@/components/agent/build-status";
import { createProject, deleteProject, listProjects } from "@/lib/projects.functions";
import { exitSession } from "@/lib/auth.functions";
import { deployPlatform } from "@/lib/platform.functions";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";

export function useProjects() {
  return useQuery({
    queryKey: ["projects"],
    queryFn: () => listProjects(),
  });
}

export function AppShell({
  children,
  activeThreadId,
}: {
  children: ReactNode;
  activeThreadId?: string;
}) {
  const { data: projects = [] } = useProjects();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [showPush, setShowPush] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setCollapsed(window.localStorage.getItem("weaver-sidebar-collapsed") === "1");
  }, []);

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      window.localStorage.setItem("weaver-sidebar-collapsed", next ? "1" : "0");
      return next;
    });
  };

  const create = useMutation({
    mutationFn: (title: string) => createProject({ data: { title } }),
    onSuccess: (project) => {
      void queryClient.invalidateQueries({ queryKey: ["projects"] });
      setOpen(false);
      if (project) void navigate({ to: "/c/$threadId", params: { threadId: project.id } });
    },
    onError: () => toast.error("تعذّر إنشاء المهمة"),
  });

  const remove = useMutation({
    mutationFn: (projectId: string) => deleteProject({ data: { projectId } }),
    onSuccess: (_data, projectId) => {
      void queryClient.invalidateQueries({ queryKey: ["projects"] });
      if (activeThreadId === projectId) void navigate({ to: "/app" });
    },
    onError: () => toast.error("تعذّر حذف المهمة"),
  });

  const push = useMutation({
    mutationFn: () => deployPlatform({ data: { action: "deploy" } }),
    onSuccess: (result) => {
      if (result.pending) toast.info("بدأ الدفع إلى كونتابو…");
      else if (result.ok) toast.success("تم الاتصال بالخادم");
      else toast.error("فشل الاتصال بكونتابو");
      void queryClient.invalidateQueries({ queryKey: ["platform-deploys"] });
      void queryClient.invalidateQueries({ queryKey: ["deploy-status"] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "تعذّر الدفع"),
  });

  return (
    <div className="flex h-dvh overflow-hidden bg-black text-white" dir="rtl">
      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 start-0 z-40 flex h-full flex-col border-e border-white/10 bg-black/40 backdrop-blur-xl transition-all duration-300 ease-in-out lg:static",
          open ? "translate-x-0" : "translate-x-full lg:translate-x-0",
          collapsed ? "w-20" : "w-72 max-w-[85vw]"
        )}
      >
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-white/5 p-4">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-lg shadow-indigo-500/20">
            <Workflow className="size-5 text-white" />
          </span>
          <div className={cn("flex flex-col transition-opacity duration-300", collapsed && "lg:hidden lg:opacity-0")}>
            <p className="text-base font-bold leading-none tracking-tight">Weaver</p>
            <p className="mt-1 font-mono text-[9px] uppercase tracking-[0.2em] text-indigo-400/80">
              Engineering Agent
            </p>
          </div>
        </div>

        {/* New Task Button */}
        <div className="p-4">
          <button
            type="button"
            onClick={() => create.mutate("محادثة جديدة")}
            disabled={create.isPending}
            className={cn(
              "group relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-xl bg-white/5 p-3 text-sm font-semibold transition-all hover:bg-white/10 hover:shadow-lg hover:shadow-indigo-500/10 active:scale-[0.98] disabled:opacity-50 border border-white/5",
              collapsed ? "px-0" : "px-4"
            )}
            title={collapsed ? "مهمة جديدة" : undefined}
          >
            <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/20 to-violet-500/20 opacity-0 transition-opacity group-hover:opacity-100" />
            <MessageSquarePlus className="size-4 relative z-10" />
            {!collapsed && <span className="relative z-10">مهمة جديدة</span>}
          </button>
        </div>

        {/* Projects Nav */}
        <nav className="min-h-0 flex-1 overflow-y-auto px-3 pb-4 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/10 hover:scrollbar-thumb-white/20">
          {!collapsed && (
            <p className="px-2 pb-3 text-xs font-semibold tracking-wider text-white/40">
              المهام النشطة
            </p>
          )}
          {projects.length === 0 && !collapsed && (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-white/10 p-6 text-center">
              <div className="rounded-full bg-white/5 p-3 mb-2">
                <Code2 className="size-5 text-white/40" />
              </div>
              <p className="text-xs text-white/50">لا توجد مهام بعد.</p>
            </div>
          )}
          <ul className="space-y-1.5">
            {projects.map((project) => (
              <li key={project.id} className="group relative">
                <Link
                  to="/c/$threadId"
                  params={{ threadId: project.id }}
                  onClick={() => setOpen(false)}
                  className={cn(
                    "flex items-center gap-3 rounded-xl border border-transparent px-3 py-2.5 transition-all",
                    activeThreadId === project.id
                      ? "bg-indigo-500/10 border-indigo-500/20 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.1)]"
                      : "hover:bg-white/5"
                  )}
                  title={collapsed ? project.title : undefined}
                >
                  <div className={cn(
                    "shrink-0 rounded-full p-1.5",
                    activeThreadId === project.id ? "bg-indigo-500/20 text-indigo-400" : "bg-white/5 text-white/40 group-hover:bg-white/10 group-hover:text-white/70"
                  )}>
                    <Activity className="size-3.5" />
                  </div>
                  {!collapsed && (
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-[13px] font-medium text-white/90">{project.title}</span>
                      </div>
                      <div className="mt-1.5 flex items-center gap-2">
                        <div className="flex-1">
                          <BuildStatusBar
                            phase={project.status}
                            progress={project.build_progress}
                            nextAction={project.next_action}
                            compact
                          />
                        </div>
                        <span className="text-[10px] font-mono text-white/40" dir="ltr">
                          {project.build_progress}%
                        </span>
                      </div>
                    </div>
                  )}
                </Link>
                {!collapsed && (
                  <button
                    type="button"
                    aria-label="حذف المهمة"
                    onClick={(e) => {
                      e.preventDefault();
                      remove.mutate(project.id);
                    }}
                    className="absolute end-2 top-2.5 grid size-7 place-items-center rounded-lg bg-black/40 text-white/40 opacity-0 backdrop-blur-sm transition-all hover:bg-red-500/20 hover:text-red-400 group-hover:opacity-100"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        </nav>

        {!collapsed && (
          <div className="border-t border-white/5 px-4 py-4">
            <p className="mb-3 text-[10px] font-semibold tracking-widest text-white/40">
              دورة العمل
            </p>
            <LifecycleRail />
          </div>
        )}

        {/* Footer Actions */}
        <div className="border-t border-white/5 p-3">
          <div className={cn(
            "flex flex-wrap items-center gap-1.5",
            collapsed ? "justify-center" : "px-1"
          )}>
            {[
              { to: "/health", icon: Activity, label: "صحة النظام" },
              { to: "/worker", icon: ServerCog, label: "مراقبة العامل الخلفي" },
              { to: "/monitor", icon: ScrollText, label: "لوحة المراقبة والسجلات" },
              { to: "/trace", icon: ListChecks, label: "سجل تدقيق الوكيل" },
              { to: "/status", icon: HeartPulse, label: "حالة الخدمات والنشر" },
              { to: "/connectors", icon: PlugZap, label: "الروابط الخارجية" },
              { to: "/platform", icon: Code2, label: "تطوير المنصة" },
              { to: "/settings", icon: Settings, label: "الإعدادات" },
            ].map((item) => (
              <Link
                key={item.to}
                to={item.to as any}
                aria-label={item.label}
                title={item.label}
                className={cn(
                  "grid size-8 place-items-center rounded-lg border border-transparent text-white/40 transition-all hover:bg-white/5 hover:text-white/90",
                  collapsed && "w-10 h-10"
                )}
                activeProps={{ className: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20 shadow-sm" }}
              >
                <item.icon className={cn(collapsed ? "size-4.5" : "size-4")} />
              </Link>
            ))}
          </div>

          <div className={cn(
            "mt-3 flex items-center gap-3 rounded-xl bg-white/5 p-2 transition-all hover:bg-white/10",
            collapsed ? "justify-center" : "px-3 py-2"
          )}>
            <div className="grid size-8 shrink-0 place-items-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-500 text-xs font-bold text-white shadow-inner">
              {user?.email?.charAt(0).toUpperCase() ?? "U"}
            </div>
            {!collapsed && (
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-xs font-medium text-white/90" dir="ltr">
                  {user?.email ?? "User"}
                </span>
                <span className="text-[10px] text-white/40">مسؤول النظام</span>
              </div>
            )}
            <button
              type="button"
              aria-label="تسجيل الخروج"
              title="تسجيل الخروج"
              onClick={() => {
                void exitSession().then(() => {
                  queryClient.clear();
                  void navigate({ to: "/auth" });
                });
              }}
              className={cn(
                "grid place-items-center rounded-lg text-white/40 transition-colors hover:text-red-400",
                collapsed ? "hidden" : "size-8 hover:bg-red-500/10"
              )}
            >
              <LogOut className="size-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile Overlay */}
      {open && (
        <button
          type="button"
          aria-label="إغلاق القائمة"
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-30 bg-black/60 backdrop-blur-sm transition-opacity lg:hidden"
        />
      )}

      {/* Main Content Area */}
      <div className="flex min-w-0 flex-1 flex-col bg-[#0a0a0a]">
        {/* Top Header */}
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-white/5 bg-black/40 px-4 backdrop-blur-xl">
          <button
            type="button"
            aria-label="القائمة"
            onClick={() => setOpen(true)}
            className="grid size-9 place-items-center rounded-xl border border-white/10 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white lg:hidden transition-colors"
          >
            <PanelLeft className="size-4" />
          </button>
          <button
            type="button"
            aria-label={collapsed ? "إظهار الشريط الجانبي" : "إخفاء الشريط الجانبي"}
            onClick={toggleCollapsed}
            className="hidden size-9 place-items-center rounded-xl border border-white/10 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white lg:grid transition-colors"
          >
            <PanelLeft className="size-4" />
          </button>
          
          <div className="flex items-center gap-2 text-sm">
            <span className="font-semibold text-white/90">Weaver</span>
            {activeThreadId && (
              <>
                <span className="text-white/20">/</span>
                <span className="text-white/60">
                  {projects.find((p) => p.id === activeThreadId)?.title || "مهمة"}
                </span>
              </>
            )}
          </div>

          <div className="ms-auto flex items-center gap-3 relative">
            <button
              type="button"
              onClick={() => setShowPush((v) => !v)}
              className="inline-flex h-9 items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 text-xs font-medium text-white/90 shadow-sm transition-all hover:bg-white/10 hover:shadow-md active:scale-95"
            >
              <Rocket className="size-3.5 text-indigo-400" /> 
              <span>دفع</span>
            </button>
            
            {showPush && (
              <div className="absolute end-0 top-12 z-50 w-80 rounded-2xl border border-white/10 bg-black/90 p-4 shadow-2xl shadow-black/50 backdrop-blur-xl animate-in fade-in zoom-in-95 duration-200">
                <div className="mb-3 flex items-center gap-3">
                  <div className="grid size-8 place-items-center rounded-full bg-indigo-500/20 text-indigo-400">
                    <Rocket className="size-4" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">النشر إلى كونتابو</p>
                    <p className="text-[11px] text-white/50" dir="ltr">194.163.155.52</p>
                  </div>
                </div>
                <p className="mb-4 text-xs leading-relaxed text-white/60">
                  سيتم سحب أحدث تغييرات من المستودع وبناء الواجهة الأمامية وإعادة تشغيل الخدمات.
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setShowPush(false)}
                    className="flex-1 rounded-xl border border-white/10 bg-white/5 py-2.5 text-xs font-medium text-white/70 hover:bg-white/10 hover:text-white transition-colors"
                  >
                    إلغاء
                  </button>
                  <button
                    type="button"
                    disabled={push.isPending}
                    onClick={() => {
                      setShowPush(false);
                      push.mutate();
                    }}
                    className="flex flex-[2] items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-600 py-2.5 text-xs font-bold text-white shadow-lg shadow-indigo-500/25 transition-all hover:shadow-indigo-500/40 active:scale-[0.98] disabled:opacity-50"
                  >
                    {push.isPending ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      "تأكيد النشر"
                    )}
                  </button>
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={() => create.mutate("محادثة جديدة")}
              className="grid size-9 place-items-center rounded-xl bg-white text-black shadow-sm transition-all hover:bg-white/90 active:scale-95"
              aria-label="مهمة جديدة"
            >
              <MessageSquarePlus className="size-4" />
            </button>
          </div>
        </header>

        <main className="min-h-0 flex-1 overflow-hidden relative">
          {children}
        </main>
      </div>
    </div>
  );
}
