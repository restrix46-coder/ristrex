import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { KeyRound, Loader2, Workflow } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { enterWithPasscode } from "@/lib/auth.functions";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "الدخول إلى Weaver — رمز سري" },
      {
        name: "description",
        content: "ادخل الرمز السري للوصول إلى مساحة عمل Weaver: المواصفات والمهام والملفات والنشر.",
      },
      { property: "og:title", content: "الدخول إلى Weaver" },
      { property: "og:description", content: "مساحة عمل خاصة محمية برمز سري." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const login = useServerFn(enterWithPasscode);
  const [passcode, setPasscode] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      const result = await login({ data: { passcode } });
      if (!result.ok) {
        toast.error("الرمز السري غير صحيح");
        return;
      }
      toast.success("تم الدخول بنجاح");
      void navigate({ to: "/platform" });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "تعذّر الدخول");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-black px-4 py-12" dir="rtl">
      {/* Animated Background */}
      <div className="absolute inset-0 z-0">
        <div className="absolute -top-[20%] -left-[10%] h-[50%] w-[50%] animate-pulse rounded-full bg-indigo-600/30 blur-[120px]" />
        <div className="absolute top-[60%] -right-[10%] h-[40%] w-[40%] animate-pulse rounded-full bg-violet-600/20 blur-[100px]" style={{ animationDelay: '2s' }} />
        <div className="absolute top-[20%] right-[20%] h-[30%] w-[30%] animate-pulse rounded-full bg-cyan-600/20 blur-[120px]" style={{ animationDelay: '4s' }} />
      </div>

      <div className="relative z-10 w-full max-w-sm animate-in fade-in slide-in-from-bottom-8 duration-700">
        <Link to="/" className="group mb-8 flex items-center justify-center gap-3 transition-transform hover:scale-105">
          <span className="grid size-12 place-items-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-lg shadow-indigo-500/25 ring-1 ring-white/10 transition-all group-hover:shadow-indigo-500/40">
            <Workflow className="size-6 transition-transform group-hover:rotate-12" />
          </span>
          <span className="bg-gradient-to-r from-white to-white/70 bg-clip-text text-2xl font-bold tracking-tight text-transparent">Weaver</span>
        </Link>

        <div className="overflow-hidden rounded-3xl border border-white/10 bg-white/5 p-8 shadow-2xl backdrop-blur-xl transition-all hover:border-white/20 hover:bg-white/10">
          <h1 className="flex items-center gap-2 text-xl font-bold text-white">
            <KeyRound className="size-5 text-indigo-400" />
            الدخول بالرمز السري
          </h1>
          <p className="mt-2 text-sm text-white/60">
            هذه مساحة عمل خاصة. أدخل الرمز السري للمتابعة.
          </p>

          <form onSubmit={submit} className="mt-8 space-y-4">
            <div className="relative group">
              <div className="absolute -inset-0.5 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 opacity-0 blur transition duration-500 group-focus-within:opacity-50"></div>
              <input
                type="password"
                required
                autoFocus
                autoComplete="current-password"
                value={passcode}
                onChange={(e) => setPasscode(e.target.value)}
                placeholder="الرمز السري"
                dir="ltr"
                className="relative w-full rounded-xl border border-white/10 bg-black/50 px-4 py-3.5 text-center text-lg tracking-[0.5em] text-white outline-none backdrop-blur-sm transition-all placeholder:tracking-normal placeholder:text-white/30 focus:border-indigo-500/50 focus:bg-black/80"
              />
            </div>
            <button
              type="submit"
              disabled={busy}
              className="group relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-xl bg-white px-4 py-3.5 text-sm font-bold text-black transition-all hover:bg-white/90 active:scale-[0.98] disabled:opacity-50"
            >
              <div className="absolute inset-0 flex h-full w-full justify-center [transform:skew(-12deg)_translateX(-100%)] group-hover:duration-1000 group-hover:[transform:skew(-12deg)_translateX(100%)]">
                <div className="relative h-full w-8 bg-black/10" />
              </div>
              {busy ? (
                <Loader2 className="size-5 animate-spin text-indigo-600" />
              ) : (
                <span className="relative z-10 flex items-center gap-2">
                  دخول
                </span>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
