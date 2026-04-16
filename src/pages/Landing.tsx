import React, { useState } from 'react';
import { 
  Shield, Lock, Server, Zap, BarChart3, Users, Truck, Package, 
  Wallet, MapPin, Clock, CheckCircle2, ArrowLeft, ChevronDown, ChevronUp,
  ShieldCheck, Database, Cloud, Eye, Star, TrendingUp, AlertTriangle,
  Target, Award, Phone, MessageCircle, ArrowRight, Sparkles
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import OperationalGapsSection from '@/components/landing/OperationalGapsSection';

const Landing: React.FC = () => {
  const navigate = useNavigate();
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const problems = [
    {
      icon: AlertTriangle,
      title: 'فقدان السيطرة على المخزون',
      desc: 'لا تعرف الكميات الحقيقية في المستودع أو عند السائقين، مما يؤدي لخسائر مالية يومية غير مرئية.',
    },
    {
      icon: Clock,
      title: 'ضياع الوقت في المحاسبة اليدوية',
      desc: 'ساعات يومية تُهدر في حساب المبيعات والديون والمصاريف يدوياً مع احتمالية أخطاء كبيرة.',
    },
    {
      icon: Eye,
      title: 'غياب الرؤية الميدانية',
      desc: 'لا تعرف أين يتواجد السائقون ولا تستطيع تتبع مسار التوزيع أو أداء كل عامل بشكل حقيقي.',
    },
    {
      icon: Wallet,
      title: 'ديون العملاء المتراكمة',
      desc: 'صعوبة تتبع الديون وجدولة التحصيل، مما يؤدي لتراكم مبالغ كبيرة وخسائر في التدفق النقدي.',
    },
    {
      icon: Users,
      title: 'صعوبة إدارة فريق كبير',
      desc: 'مع زيادة عدد السائقين والمشرفين يصبح من المستحيل متابعة الجميع بكفاءة بدون نظام متكامل.',
    },
    {
      icon: Target,
      title: 'غياب البيانات لاتخاذ القرارات',
      desc: 'قرارات عشوائية بدون إحصائيات دقيقة عن المبيعات، المنتجات الأكثر طلباً، وأداء المناطق.',
    },
  ];

  const solutions = [
    {
      icon: Package,
      title: 'إدارة مخزون ذكية',
      desc: 'تتبع لحظي للمخزون في المستودع وعند كل سائق. شحن وتفريغ مع محاسبة فورية وكشف الفروقات تلقائياً.',
      color: 'from-emerald-500 to-teal-600',
    },
    {
      icon: Truck,
      title: 'نظام توزيع متكامل',
      desc: 'إنشاء طلبيات، تتبع التسليم، إدارة المرتجعات، وتوزيع المناطق على السائقين بمرونة كاملة.',
      color: 'from-blue-500 to-indigo-600',
    },
    {
      icon: Wallet,
      title: 'محاسبة تلقائية دقيقة',
      desc: 'جلسات محاسبة يومية، خزينة المدير، تتبع الديون، التحصيل، المصاريف، والفائض والعجز تلقائياً.',
      color: 'from-amber-500 to-orange-600',
    },
    {
      icon: MapPin,
      title: 'تتبع GPS والعمليات الجغرافية',
      desc: 'تتبع مواقع السائقين لحظياً، مسارات التوزيع، والتأكد من تواجد العمال في مناطقهم المخصصة.',
      color: 'from-sky-500 to-blue-600',
    },
    {
      icon: BarChart3,
      title: 'إحصائيات وتقارير شاملة',
      desc: 'لوحات بيانات تفاعلية للمبيعات، أداء العمال، حركة المخزون، والتقارير المالية اليومية والشهرية.',
      color: 'from-violet-500 to-purple-600',
    },
    {
      icon: Award,
      title: 'نظام مكافآت وتحفيز',
      desc: 'نقاط ومكافآت للعمال بناءً على الأداء، نظام عروض وترويج، وتتبع الإنجازات لكل عامل.',
      color: 'from-rose-500 to-pink-600',
    },
  ];

  const results = [
    { value: '70%', label: 'تقليل وقت المحاسبة', icon: Clock },
    { value: '95%', label: 'دقة تتبع المخزون', icon: Package },
    { value: '50%', label: 'تحسين تحصيل الديون', icon: TrendingUp },
    { value: '100%', label: 'رؤية ميدانية كاملة', icon: Eye },
  ];

  const securityFeatures = [
    {
      icon: Lock,
      title: 'تشفير كامل للبيانات',
      desc: 'جميع البيانات مشفرة أثناء النقل والتخزين بمعايير AES-256 المستخدمة في البنوك العالمية.',
    },
    {
      icon: Shield,
      title: 'صلاحيات متعددة المستويات',
      desc: 'نظام أدوار متقدم (مدير، مشرف، سائق، أمين مخزن) مع تحكم دقيق في صلاحيات كل مستخدم.',
    },
    {
      icon: Server,
      title: 'خوادم سحابية عالمية',
      desc: 'مستضاف على بنية Supabase السحابية مع نسخ احتياطية تلقائية يومية وضمان تشغيل 99.9%.',
    },
    {
      icon: Database,
      title: 'نسخ احتياطي واستعادة',
      desc: 'نظام نسخ احتياطي متكامل مع إمكانية التصدير إلى Google Sheets واستعادة البيانات في أي وقت.',
    },
    {
      icon: ShieldCheck,
      title: 'حماية من الاختراقات',
      desc: 'Row Level Security (RLS) على كل جدول، مما يمنع أي مستخدم من الوصول لبيانات لا تخصه.',
    },
    {
      icon: Cloud,
      title: 'بدون توقف أو تعطل',
      desc: 'بنية تحتية مصممة للتوسع التلقائي. حتى لو زاد عدد المستخدمين 10 أضعاف، النظام يعمل بسلاسة.',
    },
  ];

  const faqs = [
    {
      q: 'هل بياناتي آمنة فعلاً؟',
      a: 'نعم 100%. نستخدم نفس تقنيات التشفير المستخدمة في البنوك. كل مستخدم يرى فقط البيانات المصرح له بها، ولا يمكن لأي شخص الوصول لبيانات شركتك حتى فريقنا التقني.',
    },
    {
      q: 'ماذا لو انقطع الإنترنت؟',
      a: 'التطبيق مصمم للعمل حتى مع اتصال ضعيف. البيانات تُحفظ محلياً وتُزامن تلقائياً عند عودة الاتصال. لن تفقد أي بيانات.',
    },
    {
      q: 'هل يحتاج تدريب طويل؟',
      a: 'التطبيق مصمم ليكون بسيطاً جداً. السائقون يتعلمون استخدامه خلال 15 دقيقة فقط. ونوفر دليل استخدام مدمج ودعم فني مستمر.',
    },
    {
      q: 'هل يمكنني تجربته قبل الالتزام؟',
      a: 'بالتأكيد! نوفر فترة تجريبية كاملة مع كل الميزات. جرّب النظام مع فريقك وتأكد من ملاءمته لعملك قبل أي التزام.',
    },
    {
      q: 'كم عدد المستخدمين المدعوم؟',
      a: 'لا يوجد حد! سواء كان لديك 5 سائقين أو 500، النظام يتوسع تلقائياً. أضف فروعاً وعمالاً بلا قيود.',
    },
  ];

  const features = [
    'إدارة الطلبيات والمبيعات',
    'شحن وتفريغ المخزون',
    'محاسبة يومية تلقائية',
    'تتبع GPS للسائقين',
    'إدارة ديون العملاء',
    'خزينة المدير',
    'نظام العروض والترويج',
    'إدارة المصاريف',
    'سجل النشاطات',
    'نظام المكافآت',
    'إدارة الفروع',
    'تقارير وإحصائيات',
    'إدارة العملاء',
    'نظام الصلاحيات',
    'النسخ الاحتياطي',
    'التواصل الداخلي',
  ];

  return (
    <div className="min-h-screen bg-background text-foreground" dir="rtl">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-bl from-primary/10 via-background to-accent/10 px-4 pb-16 pt-8">
        <div className="mx-auto max-w-4xl text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-sm font-medium text-primary">
            <Sparkles className="h-4 w-4" />
            نظامك المخصص لإدارة التوزيع
          </div>
          <h1 className="mb-6 text-3xl font-extrabold leading-tight tracking-tight sm:text-5xl">
            بنينا لك نظاماً يفهم
            <br />
            <span className="bg-gradient-to-l from-primary to-primary/70 bg-clip-text text-transparent">
              تفاصيل عملك بالكامل
            </span>
          </h1>
          <p className="mx-auto mb-8 max-w-2xl text-lg leading-relaxed text-muted-foreground">
            هذا النظام صُمّم خصيصاً لاحتياجاتك — المخزون، المبيعات، المحاسبة، تتبع السائقين، وإدارة الديون. كل شيء في مكان واحد، بدون فوضى ولا دفاتر.
          </p>
          <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Button size="lg" className="w-full gap-2 text-base sm:w-auto" onClick={() => navigate('/login')}>
              ادخل إلى نظامك
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <Button size="lg" variant="outline" className="w-full gap-2 text-base sm:w-auto" asChild>
              <a href="#features">
                اكتشف ما أعددناه لك
                <ChevronDown className="h-5 w-5" />
              </a>
            </Button>
          </div>
        </div>
      </section>

      {/* Problems Section */}
      <section className="bg-destructive/5 px-4 py-16">
        <div className="mx-auto max-w-5xl">
          <div className="mb-10 text-center">
            <h2 className="mb-3 text-2xl font-bold sm:text-3xl">نعرف التحديات التي تواجهها يومياً</h2>
            <p className="text-muted-foreground">هذه المشاكل التي كنت تعاني منها — وبنينا الحل لكل واحدة منها</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {problems.map((p, i) => (
              <div key={i} className="flex gap-3 rounded-xl border border-destructive/20 bg-card p-4 shadow-sm">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-destructive/10">
                  <p.icon className="h-5 w-5 text-destructive" />
                </div>
                <div>
                  <h3 className="mb-1 font-bold">{p.title}</h3>
                  <p className="text-sm leading-relaxed text-muted-foreground">{p.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Solutions Section */}
      <section id="features" className="px-4 py-16">
        <div className="mx-auto max-w-5xl">
          <div className="mb-10 text-center">
            <h2 className="mb-3 text-2xl font-bold sm:text-3xl">ما أعددناه لك في النظام</h2>
            <p className="text-muted-foreground">كل أداة تحتاجها موجودة ومجهّزة — فقط ابدأ باستخدامها</p>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {solutions.map((s, i) => (
              <div key={i} className="group rounded-xl border bg-card p-5 shadow-sm transition-shadow hover:shadow-md">
                <div className={`mb-3 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br ${s.color} text-white shadow-sm`}>
                  <s.icon className="h-5 w-5" />
                </div>
                <h3 className="mb-2 text-lg font-bold">{s.title}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Results Section */}
      <section className="bg-primary/5 px-4 py-16">
        <div className="mx-auto max-w-4xl">
          <div className="mb-10 text-center">
            <h2 className="mb-3 text-2xl font-bold sm:text-3xl">النتائج التي ستلاحظها مباشرة</h2>
            <p className="text-muted-foreground">هذا ما سيتغيّر في عملك من أول أسبوع استخدام</p>
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {results.map((r, i) => (
              <div key={i} className="flex flex-col items-center rounded-xl border bg-card p-5 text-center shadow-sm">
                <r.icon className="mb-2 h-8 w-8 text-primary" />
                <span className="text-3xl font-extrabold text-primary">{r.value}</span>
                <span className="mt-1 text-sm text-muted-foreground">{r.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* All Features Grid */}
      <section className="px-4 py-16">
        <div className="mx-auto max-w-4xl">
          <div className="mb-10 text-center">
            <h2 className="mb-3 text-2xl font-bold sm:text-3xl">+16 أداة جاهزة لك في نظامك</h2>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {features.map((f, i) => (
              <div key={i} className="flex items-center gap-2 rounded-lg border bg-card px-3 py-2.5 text-sm font-medium shadow-sm">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" />
                {f}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Security Section */}
      <section className="bg-accent/5 px-4 py-16">
        <div className="mx-auto max-w-5xl">
          <div className="mb-10 text-center">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-sm font-medium text-primary">
              <Shield className="h-4 w-4" />
              أمان على مستوى البنوك
            </div>
            <h2 className="mb-3 text-2xl font-bold sm:text-3xl">بياناتك في أمان تام</h2>
            <p className="text-muted-foreground">نأخذ أمان بياناتك على محمل الجد. إليك كيف نحميها:</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {securityFeatures.map((s, i) => (
              <div key={i} className="flex gap-3 rounded-xl border bg-card p-4 shadow-sm">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                  <s.icon className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h3 className="mb-1 font-bold">{s.title}</h3>
                  <p className="text-sm leading-relaxed text-muted-foreground">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="px-4 py-16">
        <div className="mx-auto max-w-3xl">
          <div className="mb-10 text-center">
            <h2 className="mb-3 text-2xl font-bold sm:text-3xl">أسئلة شائعة</h2>
          </div>
          <div className="space-y-3">
            {faqs.map((faq, i) => (
              <div key={i} className="rounded-xl border bg-card shadow-sm">
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="flex w-full items-center justify-between gap-3 p-4 text-right font-bold"
                >
                  <span>{faq.q}</span>
                  {openFaq === i ? <ChevronUp className="h-5 w-5 shrink-0 text-muted-foreground" /> : <ChevronDown className="h-5 w-5 shrink-0 text-muted-foreground" />}
                </button>
                {openFaq === i && (
                  <div className="border-t px-4 pb-4 pt-3 text-sm leading-relaxed text-muted-foreground">
                    {faq.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-gradient-to-bl from-primary to-primary/80 px-4 py-16 text-primary-foreground">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="mb-4 text-2xl font-extrabold sm:text-3xl">نظامك جاهز — ابدأ الآن</h2>
          <p className="mb-8 text-lg opacity-90">
            كل شيء مُعدّ ومجهّز لك. ادخل وابدأ بإدارة التوزيع بطريقة جديدة كلياً.
          </p>
          <div className="flex justify-center">
            <Button size="lg" variant="secondary" className="w-full gap-2 text-base sm:w-auto" onClick={() => navigate('/login')}>
              ادخل إلى نظامك الآن
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t bg-card px-4 py-8 text-center text-sm text-muted-foreground">
        <p>© {new Date().getFullYear()} Laser Food — نظام إدارة التوزيع المتكامل</p>
      </footer>
    </div>
  );
};

export default Landing;
