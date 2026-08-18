import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, useRef } from "react";
import {
  ArrowLeft,
  Bot,
  Cpu,
  Hammer,
  Layers,
  MessagesSquare,
  Network,
  Search,
  ShieldCheck,
  Sparkles,
  Workflow,
  Zap,
  Activity,
  Lock,
  Scale,
  BrainCircuit,
  ChevronRight,
  Terminal,
  Code2,
  Globe,
  Database
} from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Weaver — Ultimate Autonomous AI Software Factory (Master Spec 213/213)" },
      {
        name: "description",
        content:
          "المنصة المستقلة الأولى لهندسة البرمجيات بالذكاء الاصطناعي: 281 محركاً برمجياً، 27 وكيلاً متخصصاً، Digital Twin، وSystem Graph بحجم مؤسسي كامل.",
      },
      { property: "og:title", content: "Weaver — Ultimate Autonomous AI Software Factory" },
      {
        property: "og:description",
        content: "تحويل الطلب الطبيعي إلى برمجيات حقيقية جاهزة للإنتاج: تخطيط، معمارية، اختبار، أمان، ونشر حي تلقائي.",
      },
      { property: "og:type", content: "website" },
    ],
  }),
  component: Landing,
});

const STATS = [
  { value: "213 / 213", label: "معيار قياسي منجز بنسبة 100%" },
  { value: "281", label: "محركاً برمجياً في النواة (src/lib)" },
  { value: "27", label: "وكيلاً متخصصاً بتقسيم الأدوار" },
  { value: "Level 5", label: "أعلى مستوى استقلالية ذكية" },
];

const MASTER_FEATURES = [
  {
    icon: Network,
    title: "Digital Twin & System Graph",
    desc: "نموذج كائن حي لكل مشروع ومخطط علاقات (Graph) يربط بين الملفات والـ APIs وقواعد البيانات لمعرفة تأثير أي تعديل فوراً.",
  },
  {
    icon: BrainCircuit,
    title: "27 وكيلاً متخصصاً + Meta Agent",
    desc: "فصل تام للمسؤوليات: وكيل متطلبات، معمارية، أمان، أداء، اختبار مستقل، ووكيل مراجعة مستقل (Independent Verifier).",
  },
  {
    icon: ShieldCheck,
    title: "Red/Blue Team & Sandbox",
    desc: "اختبارات اختراق وحماية ذاتية مستمرة، مع بيئة تنفيذ معزولة بالكامل وحماية ضد Prompt Injection.",
  },
  {
    icon: Zap,
    title: "Multi-Model Consensus",
    desc: "تحكيم ذكي متسق بين أكثر من نموذج AI، مع التوجيه التلقائي بحسب التكلفة والأداء وحزمة الأمان.",
  },
  {
    icon: Activity,
    title: "Causal Debugging & Prediction",
    desc: "تتبع الأسباب الجذرية والتنبؤ بالأخطاء قبل حدوثها استناداً لتاريخ النظام وتفاعلات المستخدمين.",
  },
  {
    icon: Scale,
    title: "Autoscaling & Scheduler",
    desc: "جدولة وتوزيع الموارد ديناميكياً مع تقليص وتوسيع تلقائي يضمن أعلى استقرار بأقل تكلفة.",
  },
];

const MODES = [
  { icon: Hammer, name: "بناء مستمر", desc: "مواصفات، رسم مهام، ملفات حقيقية، فحص أدلة، ونشر حي تلقائي." },
  { icon: Search, name: "استكشاف وبحث", desc: "بحث حي متعمق، قراءة وثائق المكاتب، وتوليد تقارير بأسس مراجع." },
  { icon: MessagesSquare, name: "استشارة معمارية", desc: "تحديد المخاطر والبدائل المعمارية (Counterfactual) قبل كتابة كود." },
  { icon: Bot, name: "بوتات وتكاملات", desc: "إنشاء وتشغيل بوتات وتطبيقات سحابية مصغرة تلقائياً." },
];

function AnimatedNumber({ value }: { value: string }) {
  const [displayValue, setDisplayValue] = useState(value.match(/^\d+$/) ? "0" : value);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!value.match(/^\d+$/)) return;
    
    const target = parseInt(value, 10);
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          let start = 0;
          const duration = 2000;
          const stepTime = 16;
          const increment = target / (duration / stepTime);
          
          const timer = setInterval(() => {
            start += increment;
            if (start >= target) {
              setDisplayValue(target.toString());
              clearInterval(timer);
            } else {
              setDisplayValue(Math.floor(start).toString());
            }
          }, stepTime);
          observer.disconnect();
        }
      },
      { threshold: 0.1 }
    );
    
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [value]);

  return <span ref={ref} className="inline-block hover:scale-110 transition-transform cursor-default">{displayValue}</span>;
}

function Landing() {
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("active");
          }
        });
      },
      { threshold: 0.1, rootMargin: "0px 0px -50px 0px" }
    );

    document.querySelectorAll(".reveal").forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  return (
    <div className="min-h-screen bg-[#030407] text-slate-100 font-sans selection:bg-cyan-500/30 selection:text-cyan-100 overflow-x-hidden" dir="rtl">
      <style>{`
        @keyframes gradient-x {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
        .animate-gradient-x {
          background-size: 200% 200%;
          animation: gradient-x 8s ease infinite;
        }
        @keyframes float {
          0%, 100% { transform: translateY(0) scale(1); opacity: 0.8; }
          50% { transform: translateY(-20px) scale(1.1); opacity: 1; }
        }
        .animate-float {
          animation: float 6s ease-in-out infinite;
        }
        .animate-float-delayed {
          animation: float 7s ease-in-out 3s infinite;
        }
        .animate-float-slow {
          animation: float 9s ease-in-out 1s infinite;
        }
        .reveal {
          opacity: 0;
          transform: translateY(40px);
          transition: all 1s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .reveal.active {
          opacity: 1;
          transform: translateY(0);
        }
        .delay-100 { transition-delay: 100ms; }
        .delay-200 { transition-delay: 200ms; }
        .delay-300 { transition-delay: 300ms; }
      `}</style>

      {/* Premium Background Elements */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-cyan-600/10 blur-[150px] mix-blend-screen" />
        <div className="absolute top-[20%] right-[-10%] w-[30%] h-[50%] rounded-full bg-indigo-600/10 blur-[150px] mix-blend-screen" />
        <div className="absolute bottom-[-20%] left-[20%] w-[50%] h-[40%] rounded-full bg-blue-600/10 blur-[150px] mix-blend-screen" />
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 mix-blend-overlay"></div>
      </div>

      {/* Glassmorphism Navbar */}
      <header className="fixed top-0 inset-x-0 z-50 border-b border-white/5 bg-[#030407]/60 backdrop-blur-xl supports-[backdrop-filter]:bg-[#030407]/40 transition-all duration-300">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-4 group cursor-pointer">
            <div className="relative flex size-10 items-center justify-center rounded-xl bg-gradient-to-tr from-cyan-400 to-blue-600 shadow-[0_0_20px_rgba(6,182,212,0.3)] group-hover:shadow-[0_0_30px_rgba(6,182,212,0.5)] transition-all duration-300">
              <div className="absolute inset-[1px] rounded-xl bg-[#030407] z-0" />
              <Workflow className="size-5 text-cyan-400 z-10 group-hover:scale-110 transition-transform duration-300" />
            </div>
            <div>
              <span className="text-xl font-black tracking-tight text-white group-hover:text-cyan-100 transition-colors">Weaver</span>
              <span className="ms-3 rounded-full border border-cyan-500/20 bg-cyan-500/10 px-2.5 py-0.5 font-mono text-[10px] font-bold text-cyan-400 uppercase tracking-widest backdrop-blur-md">
                v2.0 Factory
              </span>
            </div>
          </div>

          <nav className="hidden items-center gap-10 text-sm font-medium text-slate-400 md:flex">
            <a href="#factory-specs" className="hover:text-cyan-400 transition-colors">المواصفة الكاملة</a>
            <a href="#master-features" className="hover:text-cyan-400 transition-colors">الأنظمة الذكية</a>
            <a href="#modes" className="hover:text-cyan-400 transition-colors">أوضاع التشغيل</a>
          </nav>

          <div className="flex items-center gap-4">
            <Link
              to="/status"
              className="hidden sm:inline-flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-emerald-400 transition-colors"
            >
              <div className="relative flex h-2 w-2 items-center justify-center">
                <div className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></div>
                <div className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500"></div>
              </div>
              حالة السيرفر
            </Link>
            <div className="h-4 w-px bg-slate-800 hidden sm:block"></div>
            <Link
              to="/platform"
              className="group relative inline-flex items-center gap-2 overflow-hidden rounded-full bg-white/5 px-6 py-2.5 text-xs font-bold text-white border border-white/10 hover:border-cyan-500/50 hover:bg-white/10 transition-all duration-300"
            >
              <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-cyan-500/20 via-blue-500/20 to-indigo-500/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <span className="relative z-10">دخول المنصة الذاتية</span>
              <ArrowLeft className="relative z-10 size-4 group-hover:-translate-x-1 transition-transform duration-300" />
            </Link>
          </div>
        </div>
      </header>

      <main className="relative z-10 w-full pt-20">
        {/* Hero Section */}
        <section className="relative min-h-[90vh] flex flex-col justify-center items-center px-6 py-20 text-center">
          {/* Floating Particles */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            <div className="absolute top-[20%] right-[20%] size-2 bg-cyan-400 rounded-full shadow-[0_0_15px_rgba(34,211,238,0.8)] animate-float" />
            <div className="absolute top-[40%] left-[15%] size-3 bg-blue-500 rounded-full shadow-[0_0_20px_rgba(59,130,246,0.8)] animate-float-delayed" />
            <div className="absolute bottom-[30%] right-[30%] size-1.5 bg-indigo-400 rounded-full shadow-[0_0_10px_rgba(129,140,248,0.8)] animate-float-slow" />
            <div className="absolute top-[60%] left-[25%] size-2.5 bg-cyan-500 rounded-full shadow-[0_0_15px_rgba(6,182,212,0.8)] animate-float" />
          </div>

          <div className="max-w-5xl mx-auto z-10 flex flex-col items-center mt-10">
            <div className="reveal inline-flex items-center gap-2.5 rounded-full border border-cyan-500/20 bg-cyan-500/5 px-4 py-1.5 font-mono text-xs font-semibold text-cyan-400 backdrop-blur-md mb-8">
              <Sparkles className="size-3.5 text-cyan-400 animate-pulse" />
              ULTIMATE AUTONOMOUS AI SOFTWARE FACTORY — COMPLETE SPEC
            </div>

            <h1 className="reveal delay-100 text-5xl font-black tracking-tight text-white sm:text-7xl lg:text-8xl leading-[1.1] mb-6">
              مصنع البرمجيات <br className="hidden sm:block" />
              <span className="animate-gradient-x bg-gradient-to-r from-cyan-400 via-blue-500 to-indigo-400 bg-clip-text text-transparent inline-block pb-2 mt-2">
                الذاتي الكامل
              </span>
            </h1>

            <p className="reveal delay-200 max-w-2xl text-lg text-slate-400 sm:text-xl leading-relaxed mb-10">
              ليس مجرد محرر كود أو منشئ صفحات عادي. Weaver هو منصة هندسة برمجيات ذاتية بالكامل تبني وتفحص وتدير الأنظمة المعقدة مع Digital Twin وSystem Graph ومراجعة أمان مستقلة و281 محركاً تشغيلياً.
            </p>

            <div className="reveal delay-300 flex flex-wrap items-center justify-center gap-5">
              <Link
                to="/platform"
                className="group relative inline-flex h-14 items-center justify-center gap-3 overflow-hidden rounded-full bg-white px-8 text-sm font-bold text-black transition-all hover:scale-[1.02] hover:shadow-[0_0_40px_rgba(255,255,255,0.3)]"
              >
                <div className="absolute inset-0 flex h-full w-full justify-center [transform:skew(-12deg)_translateX(-100%)] group-hover:duration-1000 group-hover:[transform:skew(-12deg)_translateX(100%)]">
                  <div className="relative h-full w-8 bg-white/20" />
                </div>
                شغّل المنصة الآن
                <ArrowLeft className="size-4 transition-transform group-hover:-translate-x-1" />
              </Link>
              <Link
                to="/auth"
                className="inline-flex h-14 items-center justify-center gap-3 rounded-full border border-white/10 bg-white/5 px-8 text-sm font-semibold text-white backdrop-blur-md transition-all hover:bg-white/10 hover:border-white/20"
              >
                <Terminal className="size-4 text-slate-400" />
                تسجيل الدخول
              </Link>
            </div>
          </div>

          {/* Premium Stats Bar */}
          <div className="reveal delay-300 mt-24 w-full max-w-5xl mx-auto">
            <div className="grid grid-cols-2 gap-px bg-white/5 rounded-3xl overflow-hidden border border-white/10 backdrop-blur-md sm:grid-cols-4 relative shadow-2xl">
              <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-transparent pointer-events-none" />
              {STATS.map((stat, i) => (
                <div key={i} className="bg-[#05070A]/80 p-8 text-center relative group">
                  <div className="absolute inset-0 bg-gradient-to-b from-cyan-500/0 to-cyan-500/0 group-hover:from-cyan-500/5 group-hover:to-transparent transition-all duration-500 pointer-events-none" />
                  <div className="font-mono text-3xl md:text-4xl font-black text-white tracking-tight mb-2 flex items-center justify-center gap-1">
                    <AnimatedNumber value={stat.value} />
                  </div>
                  <div className="text-xs text-slate-400 font-medium tracking-wide uppercase">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Trusted By / Social Proof Segment (Stylized) */}
        <section className="reveal py-10 border-y border-white/5 bg-white/[0.02] overflow-hidden">
          <div className="mx-auto max-w-7xl px-6 flex flex-col md:flex-row items-center justify-between gap-8 opacity-60 grayscale hover:grayscale-0 transition-all duration-700">
            <span className="text-sm font-bold text-slate-500 uppercase tracking-widest whitespace-nowrap">التقنيات المدعومة بالكامل</span>
            <div className="flex flex-wrap justify-center md:justify-end items-center gap-8 md:gap-16">
              <div className="flex items-center gap-2"><Code2 className="size-5" /><span className="font-bold font-mono">React / Next.js</span></div>
              <div className="flex items-center gap-2"><Database className="size-5" /><span className="font-bold font-mono">PostgreSQL / Redis</span></div>
              <div className="flex items-center gap-2"><Globe className="size-5" /><span className="font-bold font-mono">Edge Computing</span></div>
              <div className="flex items-center gap-2"><Lock className="size-5" /><span className="font-bold font-mono">Zero-Trust Auth</span></div>
            </div>
          </div>
        </section>

        {/* Architecture Section */}
        <section id="factory-specs" className="relative px-6 py-32 border-b border-white/5">
          <div className="mx-auto max-w-7xl">
            <div className="reveal flex flex-col items-center text-center mb-20">
              <h2 className="text-3xl font-black text-white md:text-5xl tracking-tight">Enterprise Architecture</h2>
              <p className="mt-6 max-w-2xl text-base text-slate-400">
                منظومة خماسية الطبقات تضمن أقصى أداء وأمان وموثوقية عالية
              </p>
            </div>

            <div className="grid gap-8 md:grid-cols-3">
              {[
                { icon: Cpu, title: "1. Control & Safety Plane", desc: "Kill Switch مفصلي، Bulkheads حماية، Circuit Breaker، وسياسات حوكمة صارمة تمنع الأخطاء الكارثية.", color: "from-cyan-500/20 to-cyan-500/0", border: "group-hover:border-cyan-500/50", iconColor: "text-cyan-400" },
                { icon: Layers, title: "2. Intelligence & Graph Plane", desc: "Digital Twin حيّ، System Graph كامل، Traceability من الكود إلى الإنتاج، وتحكيم متعدد النماذج.", color: "from-blue-500/20 to-blue-500/0", border: "group-hover:border-blue-500/50", iconColor: "text-blue-400" },
                { icon: ShieldCheck, title: "3. Security & Testing", desc: "فريق Red/Blue Team ذاتي، Fuzz & Differential Testing، واختبار عقود الـ APIs بدون ثغرات.", color: "from-indigo-500/20 to-indigo-500/0", border: "group-hover:border-indigo-500/50", iconColor: "text-indigo-400" }
              ].map((item, idx) => (
                <div key={idx} className={`reveal delay-${(idx+1)*100} group relative p-8 rounded-3xl bg-[#080B12] border border-white/5 transition-all duration-500 ${item.border} hover:shadow-2xl hover:-translate-y-2`}>
                  <div className={`absolute inset-0 bg-gradient-to-b ${item.color} opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-3xl pointer-events-none`} />
                  <div className="relative z-10">
                    <div className="flex size-14 items-center justify-center rounded-2xl bg-white/5 border border-white/10 mb-6 group-hover:scale-110 transition-transform duration-500">
                      <item.icon className={`size-6 ${item.iconColor}`} />
                    </div>
                    <h3 className="text-xl font-bold text-white mb-3">{item.title}</h3>
                    <p className="text-sm text-slate-400 leading-relaxed">
                      {item.desc}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Master Features Grid */}
        <section id="master-features" className="relative px-6 py-32 border-b border-white/5 bg-[#030407]">
          <div className="mx-auto max-w-7xl">
            <div className="reveal flex flex-col md:flex-row md:items-end justify-between gap-8 mb-20">
              <div className="max-w-2xl">
                <h2 className="text-3xl font-black text-white md:text-5xl tracking-tight mb-6">الأنظمة الذكية</h2>
                <p className="text-base text-slate-400 leading-relaxed">
                  تقنيات متقدمة تضمن الانتقال من 74% إلى أكثر من 97% في الجودة والجاهزية، مع بنية تحتية مصممة للعمل المستقل بالكامل.
                </p>
              </div>
              <Link to="/platform" className="inline-flex items-center gap-2 text-cyan-400 font-bold hover:text-cyan-300 transition-colors group whitespace-nowrap">
                استكشف المنصة بالكامل
                <ChevronRight className="size-4 group-hover:translate-x-1 transition-transform" />
              </Link>
            </div>

            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {MASTER_FEATURES.map((feat, idx) => (
                <div key={idx} className="reveal group relative p-[1px] rounded-3xl bg-gradient-to-b from-white/10 to-white/5 hover:from-cyan-500/50 hover:to-blue-600/30 transition-all duration-500">
                  <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/20 to-blue-600/20 blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-3xl pointer-events-none" />
                  <div className="relative h-full bg-[#05070A] p-8 rounded-[23px] backdrop-blur-xl z-10">
                    <div className="flex size-12 items-center justify-center rounded-xl bg-gradient-to-tr from-cyan-500/10 to-blue-600/10 text-cyan-400 group-hover:scale-110 group-hover:bg-cyan-500/20 transition-all duration-500 mb-6">
                      <feat.icon className="size-6" />
                    </div>
                    <h3 className="text-lg font-bold text-white mb-3 group-hover:text-cyan-100 transition-colors">{feat.title}</h3>
                    <p className="text-sm text-slate-400 leading-relaxed group-hover:text-slate-300 transition-colors">{feat.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Modes of Operation */}
        <section id="modes" className="relative px-6 py-32 bg-gradient-to-b from-transparent to-white/[0.02]">
          <div className="mx-auto max-w-7xl">
            <div className="reveal text-center mb-20">
              <h2 className="text-3xl font-black text-white md:text-5xl tracking-tight mb-6">أوضاع العمل التكيفية</h2>
              <p className="max-w-2xl mx-auto text-base text-slate-400">تتنقل التشكيلات التلقائية للوكلاء بحسب طبيعة المهمة وحجم التعقيد</p>
            </div>

            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {MODES.map((mode, i) => (
                <div key={i} className={`reveal delay-${(i+1)*100} group rounded-3xl border border-white/5 bg-white/[0.02] p-8 hover:bg-white/[0.04] transition-all duration-300 hover:-translate-y-1`}>
                  <div className="flex size-12 items-center justify-center rounded-2xl bg-blue-500/10 text-blue-400 mb-6 group-hover:bg-blue-500/20 transition-colors">
                    <mode.icon className="size-6" />
                  </div>
                  <h3 className="text-lg font-bold text-white mb-3">{mode.name}</h3>
                  <p className="text-sm text-slate-400 leading-relaxed">{mode.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      {/* Premium Footer */}
      <footer className="relative bg-[#020305] pt-20 pb-10 border-t border-white/5 overflow-hidden">
        {/* Top Gradient Divider */}
        <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-cyan-500/50 to-transparent" />
        
        <div className="mx-auto max-w-7xl px-6">
          <div className="grid gap-12 md:grid-cols-4 mb-16">
            <div className="md:col-span-2">
              <div className="flex items-center gap-3 mb-6">
                <div className="flex size-8 items-center justify-center rounded-lg bg-gradient-to-tr from-cyan-400 to-blue-600 text-[#020305] font-black text-sm shadow-[0_0_15px_rgba(6,182,212,0.3)]">
                  W
                </div>
                <span className="text-xl font-black text-white tracking-tight">Weaver</span>
              </div>
              <p className="text-sm text-slate-400 max-w-sm leading-relaxed mb-8">
                المنصة المستقلة الأولى لهندسة البرمجيات بالذكاء الاصطناعي. تحويل الأفكار إلى نظم معقدة قابلة للتطوير بضغطة زر.
              </p>
              <div className="flex items-center gap-4">
                <div className="px-3 py-1 rounded-full border border-white/10 bg-white/5 text-[10px] font-mono text-slate-400 uppercase tracking-widest">
                  Status: All Systems Operational
                </div>
              </div>
            </div>
            
            <div>
              <h4 className="text-white font-bold mb-6">المنصة</h4>
              <ul className="space-y-4 text-sm text-slate-400">
                <li><Link to="/platform" className="hover:text-cyan-400 transition-colors">لوحة التحكم</Link></li>
                <li><Link to="/auth" className="hover:text-cyan-400 transition-colors">البيئة المعزولة</Link></li>
                <li><a href="#factory-specs" className="hover:text-cyan-400 transition-colors">المواصفات</a></li>
                <li><Link to="/status" className="hover:text-cyan-400 transition-colors">حالة السيرفر</Link></li>
              </ul>
            </div>

            <div>
              <h4 className="text-white font-bold mb-6">قانوني</h4>
              <ul className="space-y-4 text-sm text-slate-400">
                <li><a href="#" className="hover:text-cyan-400 transition-colors">الشروط والأحكام</a></li>
                <li><a href="#" className="hover:text-cyan-400 transition-colors">سياسة الخصوصية</a></li>
                <li><a href="#" className="hover:text-cyan-400 transition-colors">الأمان والخصوصية</a></li>
              </ul>
            </div>
          </div>

          <div className="flex flex-col md:flex-row items-center justify-between gap-4 pt-8 border-t border-white/5 text-xs text-slate-500 font-medium">
            <div>© {new Date().getFullYear()} Weaver Enterprise AI Factory. All Rights Reserved.</div>
            <div className="flex items-center gap-6">
              <span className="hover:text-white transition-colors cursor-pointer">Twitter</span>
              <span className="hover:text-white transition-colors cursor-pointer">GitHub</span>
              <span className="hover:text-white transition-colors cursor-pointer">Discord</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
