import React from 'react';
import {
  Rocket, BarChart3, CalendarClock, Route, Megaphone, GraduationCap,
  Share2, FileSpreadsheet, Bell, Layers, TrendingUp, Building2,
  Timer, Star, Receipt, Banknote, UserCog, Map, ClipboardList, Repeat
} from 'lucide-react';

const managerControlFeatures = [
  {
    icon: BarChart3,
    title: 'لوحة بيانات المدير',
    desc: 'ملخص لحظي لكل ما يحدث: إجمالي المبيعات، الطلبيات النشطة، التحصيلات، أداء كل عامل — في شاشة واحدة.',
  },
  {
    icon: CalendarClock,
    title: 'مراجعة يومية شاملة',
    desc: 'جلسات محاسبة يومية لكل عامل مع مراجعة النقد، الديون، المرتجعات، والمصاريف قبل اعتمادها.',
  },
  {
    icon: Banknote,
    title: 'خزينة المدير',
    desc: 'تتبع كل المبالغ المستلمة والمُسلّمة مع سجل كامل لحركات الخزينة وتسليمات الأمانات.',
  },
  {
    icon: UserCog,
    title: 'صلاحيات دقيقة لكل مستخدم',
    desc: 'تحكم في ما يراه ويفعله كل عامل — مدير، مشرف، سائق، أمين مخزن — بصلاحيات مخصصة لكل دور.',
  },
];

const fieldOpsFeatures = [
  {
    icon: Route,
    title: 'مسارات توزيع ذكية',
    desc: 'تقسيم المناطق إلى قطاعات ومسارات مع تعيين كل مسار لعامل محدد لتغطية كل العملاء بكفاءة.',
  },
  {
    icon: Map,
    title: 'جولات العمال',
    desc: 'متابعة جولات كل عامل يومياً — كم عميل زار، كم طلبية نفّذ، وما نسبة التغطية لمنطقته.',
  },
  {
    icon: Timer,
    title: 'تسجيل الحضور والانصراف',
    desc: 'تسجيل دخول وخروج العمال مع تحقق GPS — تعرف من بدأ يومه ومتى انتهى وأين كان.',
  },
  {
    icon: Bell,
    title: 'تتبع الطلبيات لحظياً',
    desc: 'حالة كل طلبية واضحة: قيد التحضير، في الطريق، مُسلّمة، مرتجعة — مع أوقات دقيقة لكل مرحلة.',
  },
];

const smartFeatures = [
  {
    icon: Megaphone,
    title: 'نظام عروض وترويج متقدم',
    desc: 'إنشاء عروض بأنواع مختلفة (خصم، هدية، كمية إضافية) مع تطبيق تلقائي عند إنشاء الطلبيات. تقسيم العروض بين العمال بعدالة.',
  },
  {
    icon: Star,
    title: 'نظام مكافآت وإنجازات',
    desc: 'نقاط تلقائية للعمال بناءً على أدائهم — مبيعات، تحصيلات، زيارات. لوحة إنجازات تحفيزية لكل عامل تُعزز المنافسة الإيجابية.',
  },
  {
    icon: Receipt,
    title: 'فواتير مشتركة وتقارير فورية',
    desc: 'إنشاء فواتير احترافية ومشاركتها مباشرة مع العملاء. تقارير يومية وشهرية جاهزة لكل عامل وكل منطقة.',
  },
  {
    icon: Repeat,
    title: 'إدارة المرتجعات والأرصدة',
    desc: 'تسجيل المرتجعات بأسباب واضحة، أرصدة العملاء (credit) تُخصم تلقائياً من الطلبيات القادمة بموافقة المدير.',
  },
];

const growthFeatures = [
  {
    icon: Building2,
    title: 'إدارة فروع متعددة',
    desc: 'أضف فروعاً جديدة بسهولة. كل فرع له مخزونه وعماله وعملاؤه. التقارير تعمل على مستوى الفرع أو الشركة كاملة.',
  },
  {
    icon: FileSpreadsheet,
    title: 'نسخ احتياطي إلى Google Sheets',
    desc: 'تصدير كل بياناتك إلى جداول Google بضغطة واحدة. نسخ احتياطي يومي تلقائي لراحة بالك.',
  },
  {
    icon: Share2,
    title: 'مشاركة سريعة',
    desc: 'مشاركة الفواتير والتقارير والإحصائيات مباشرة عبر WhatsApp أو أي تطبيق — بدون طباعة أو تحويل.',
  },
  {
    icon: GraduationCap,
    title: 'دليل استخدام وتدريب مدمج',
    desc: 'دليل تفاعلي داخل التطبيق يشرح كل ميزة خطوة بخطوة. العمال الجدد يتعلمون بأنفسهم في دقائق.',
  },
];

const AdvancedFeaturesSection: React.FC = () => {
  return (
    <>
      {/* Manager Control */}
      <section className="px-4 py-16">
        <div className="mx-auto max-w-5xl">
          <div className="mb-10 text-center">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-sm font-medium text-primary">
              <Layers className="h-4 w-4" />
              تحكّم كامل للمدير
            </div>
            <h2 className="mb-3 text-2xl font-bold sm:text-3xl">كل شيء تحت سيطرتك</h2>
            <p className="text-muted-foreground">أدوات مخصصة لك كمدير — تراقب، تراجع، وتتخذ قرارات بثقة</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {managerControlFeatures.map((f, i) => (
              <div key={i} className="flex gap-3 rounded-xl border bg-card p-5 shadow-sm transition-shadow hover:shadow-md">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 text-white shadow-sm">
                  <f.icon className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="mb-1 font-bold">{f.title}</h3>
                  <p className="text-sm leading-relaxed text-muted-foreground">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Field Operations */}
      <section className="bg-accent/5 px-4 py-16">
        <div className="mx-auto max-w-5xl">
          <div className="mb-10 text-center">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-sm font-medium text-primary">
              <Rocket className="h-4 w-4" />
              عمليات ميدانية متقدمة
            </div>
            <h2 className="mb-3 text-2xl font-bold sm:text-3xl">تعرف ماذا يحدث في الميدان — لحظة بلحظة</h2>
            <p className="text-muted-foreground">أدوات تتبع ومراقبة تمنحك رؤية كاملة لما يجري خارج المكتب</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {fieldOpsFeatures.map((f, i) => (
              <div key={i} className="flex gap-3 rounded-xl border bg-card p-5 shadow-sm transition-shadow hover:shadow-md">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500 to-blue-600 text-white shadow-sm">
                  <f.icon className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="mb-1 font-bold">{f.title}</h3>
                  <p className="text-sm leading-relaxed text-muted-foreground">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Smart Features */}
      <section className="px-4 py-16">
        <div className="mx-auto max-w-5xl">
          <div className="mb-10 text-center">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-sm font-medium text-primary">
              <TrendingUp className="h-4 w-4" />
              ميزات ذكية تزيد أرباحك
            </div>
            <h2 className="mb-3 text-2xl font-bold sm:text-3xl">أدوات مصممة لزيادة المبيعات وتقليل الخسائر</h2>
            <p className="text-muted-foreground">ليس فقط إدارة — بل أدوات تساعدك تبيع أكثر وتخسر أقل</p>
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            {smartFeatures.map((f, i) => (
              <div key={i} className="rounded-xl border bg-card p-5 shadow-sm transition-shadow hover:shadow-md">
                <div className="mb-3 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-sm">
                  <f.icon className="h-5 w-5" />
                </div>
                <h3 className="mb-2 text-lg font-bold">{f.title}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Growth & Scalability */}
      <section className="bg-primary/5 px-4 py-16">
        <div className="mx-auto max-w-5xl">
          <div className="mb-10 text-center">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-sm font-medium text-primary">
              <Building2 className="h-4 w-4" />
              جاهز للنمو معك
            </div>
            <h2 className="mb-3 text-2xl font-bold sm:text-3xl">نظام ينمو مع نمو شركتك</h2>
            <p className="text-muted-foreground">سواء كنت تدير فرعاً واحداً أو عشرة — النظام مصمم للتوسع</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {growthFeatures.map((f, i) => (
              <div key={i} className="flex gap-3 rounded-xl border bg-card p-5 shadow-sm transition-shadow hover:shadow-md">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-sm">
                  <f.icon className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="mb-1 font-bold">{f.title}</h3>
                  <p className="text-sm leading-relaxed text-muted-foreground">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
};

export default AdvancedFeaturesSection;
