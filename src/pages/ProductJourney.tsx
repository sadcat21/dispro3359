import React from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Factory, Warehouse, Truck, ShoppingBag, Banknote, Calculator, Landmark, CheckCircle2 } from "lucide-react";
import hero from "@/assets/journey/hero.jpg";
import s1 from "@/assets/journey/01-factory-reception.jpg";
import s2 from "@/assets/journey/02-branch-stock.jpg";
import s3 from "@/assets/journey/03-worker-loading.jpg";
import s4 from "@/assets/journey/04-customer-sale.jpg";
import s5 from "@/assets/journey/05-collection.jpg";
import s6 from "@/assets/journey/06-accounting-session.jpg";
import s7 from "@/assets/journey/07-manager-handover.jpg";

const steps = [
  { n: 1, icon: Factory, title: "استلام المنتج من المصنع", desc: "يتم استلام المنتجات من المصنع وتسجيل الكميات والأسعار في مخزن الفرع. يقوم النظام بتسجيل كل عملية استلام بدقة مع توثيق المصدر والوقت.", img: s1, color: "from-blue-500 to-cyan-500" },
  { n: 2, icon: Warehouse, title: "إدارة مخزون الفرع", desc: "تنتقل المنتجات إلى مخزون الفرع حيث تظهر الكميات المتاحة بشكل لحظي مع تنبيهات للمنتجات المنخفضة وحالة كل صنف.", img: s2, color: "from-cyan-500 to-teal-500" },
  { n: 3, icon: Truck, title: "تحميل العامل التجاري", desc: "يقوم مدير الفرع بتحميل المنتجات على العامل التجاري عبر جلسة تحميل دقيقة، تسجل المسؤولية المالية للعامل عن البضاعة.", img: s3, color: "from-teal-500 to-emerald-500" },
  { n: 4, icon: ShoppingBag, title: "البيع للعميل", desc: "يقوم العامل بزيارة العملاء وبيع المنتجات عبر واجهة بيع سريعة تدعم المنتجات والعروض والحساب الفوري للإجمالي.", img: s4, color: "from-emerald-500 to-green-500" },
  { n: 5, icon: Banknote, title: "تحصيل المبلغ", desc: "يتم تحصيل المبلغ نقداً أو ديناً مع توثيق طريقة الدفع وحفظ سجل كامل لكل معاملة مع العميل.", img: s5, color: "from-green-500 to-lime-500" },
  { n: 6, icon: Calculator, title: "جلسة المحاسبة", desc: "في نهاية اليوم تُفتح جلسة محاسبة للعامل، تُقارن المبيعات الإجمالية مع النقد الفعلي والديون والمصاريف لكشف أي فروقات.", img: s6, color: "from-lime-500 to-yellow-500" },
  { n: 7, icon: Landmark, title: "تسليم المبلغ لمدير الفرع", desc: "بعد إغلاق الجلسة يتم تسليم المبلغ النهائي لمدير الفرع مع توقيع وتأكيد رقمي يحفظ في خزنة المدير.", img: s7, color: "from-yellow-500 to-orange-500" },
];

const ProductJourney: React.FC = () => {
  return (
    <div dir="rtl" className="min-h-screen bg-gradient-to-b from-background to-muted/30">
      {/* Top bar */}
      <header className="sticky top-0 z-40 backdrop-blur-lg bg-background/80 border-b">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition">
            <ArrowLeft className="w-4 h-4" />
            العودة للرئيسية
          </Link>
          <div className="text-sm font-bold">رحلة المنتج</div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="container mx-auto px-4 py-12 md:py-20">
          <div className="grid md:grid-cols-2 gap-8 items-center">
            <div className="space-y-5">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-xs font-bold">
                <CheckCircle2 className="w-3.5 h-3.5" />
                رحلة شاملة بـ 7 خطوات
              </div>
              <h1 className="text-3xl md:text-5xl font-extrabold leading-tight bg-gradient-to-l from-primary via-cyan-500 to-emerald-500 bg-clip-text text-transparent">
                رحلة المنتج من المصنع إلى خزنة مدير الفرع
              </h1>
              <p className="text-muted-foreground md:text-lg leading-relaxed">
                تتبع كامل ومُحكم لكل خطوة من استلام المنتج من المصنع، مروراً بالمخزون والتحميل والبيع، وصولاً إلى تسليم النقد لمدير الفرع. شفافية كاملة، مسؤولية واضحة، وأرقام دقيقة.
              </p>
              <div className="flex flex-wrap gap-3 pt-2">
                <a href="#steps" className="px-6 py-3 rounded-xl bg-primary text-primary-foreground font-bold hover:opacity-90 transition shadow-lg">
                  استكشف الرحلة
                </a>
                <Link to="/auth" className="px-6 py-3 rounded-xl border-2 border-primary/30 font-bold hover:bg-primary/5 transition">
                  ابدأ الآن
                </Link>
              </div>
            </div>
            <div className="relative">
              <div className="absolute -inset-4 bg-gradient-to-br from-primary/20 via-cyan-500/20 to-emerald-500/20 rounded-3xl blur-2xl" />
              <img src={hero} alt="رحلة المنتج" className="relative rounded-2xl shadow-2xl border" />
            </div>
          </div>
        </div>
      </section>

      {/* Steps */}
      <section id="steps" className="py-12 md:py-20">
        <div className="container mx-auto px-4 space-y-16 md:space-y-24">
          {steps.map((step, idx) => {
            const Icon = step.icon;
            const reverse = idx % 2 === 1;
            return (
              <div key={step.n} className={`grid md:grid-cols-2 gap-8 md:gap-12 items-center ${reverse ? "md:[direction:ltr]" : ""}`}>
                <div className={`space-y-4 ${reverse ? "md:[direction:rtl]" : ""}`}>
                  <div className="flex items-center gap-3">
                    <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${step.color} flex items-center justify-center shadow-lg`}>
                      <Icon className="w-7 h-7 text-white" />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-xs text-muted-foreground font-mono">الخطوة {step.n} من {steps.length}</span>
                      <span className="text-xs font-bold text-primary">ÉTAPE {String(step.n).padStart(2, "0")}</span>
                    </div>
                  </div>
                  <h2 className="text-2xl md:text-4xl font-extrabold leading-tight">{step.title}</h2>
                  <p className="text-muted-foreground md:text-lg leading-relaxed">{step.desc}</p>
                  <div className="flex items-center gap-2 pt-2">
                    <div className={`h-1 w-16 rounded-full bg-gradient-to-l ${step.color}`} />
                    <span className="text-xs text-muted-foreground">شاشة فعلية من النظام</span>
                  </div>
                </div>
                <div className={`relative group ${reverse ? "md:[direction:rtl]" : ""}`}>
                  <div className={`absolute -inset-6 rounded-3xl blur-2xl opacity-30 bg-gradient-to-br ${step.color} group-hover:opacity-50 transition`} />
                  <div className="relative rounded-3xl overflow-hidden border-2 border-border bg-card shadow-2xl transition-transform group-hover:scale-[1.02]">
                    <img src={step.img} alt={step.title} loading="lazy" className="w-full h-auto" />
                  </div>
                  <div className="absolute -top-3 -start-3 w-12 h-12 rounded-full bg-background border-2 border-primary flex items-center justify-center font-bold text-primary shadow-lg">
                    {step.n}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 md:py-24 bg-gradient-to-br from-primary/5 via-cyan-500/5 to-emerald-500/5">
        <div className="container mx-auto px-4 text-center max-w-3xl space-y-6">
          <h2 className="text-3xl md:text-5xl font-extrabold">شفافية كاملة من البداية إلى النهاية</h2>
          <p className="text-muted-foreground md:text-lg">
            نظام واحد متكامل يربط المصنع بالمخزون بالعامل بالعميل بالمحاسبة بالخزنة. كل دينار يُحسب، كل منتج يُتتبع، وكل مسؤولية تُوثَّق.
          </p>
          <div className="flex flex-wrap gap-3 justify-center pt-4">
            <Link to="/auth" className="px-8 py-4 rounded-xl bg-primary text-primary-foreground font-bold hover:opacity-90 transition shadow-xl">
              ابدأ تجربتك المجانية
            </Link>
            <Link to="/landing" className="px-8 py-4 rounded-xl border-2 border-primary/30 font-bold hover:bg-primary/5 transition">
              اعرف المزيد
            </Link>
          </div>
        </div>
      </section>

      <footer className="py-8 border-t text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} — رحلة المنتج من المصنع إلى خزنة مدير الفرع
      </footer>
    </div>
  );
};

export default ProductJourney;