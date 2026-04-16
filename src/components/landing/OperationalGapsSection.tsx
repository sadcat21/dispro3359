import React, { useState } from 'react';
import {
  ShieldAlert, MapPin, HandshakeIcon, Eye, Gift, DollarSign,
  MessageCircleOff, Users, ClipboardCheck, Lock, ChevronDown, ChevronUp,
  UserCheck, PackageCheck, FileCheck, Smartphone, ScanLine
} from 'lucide-react';

interface GapItem {
  icon: React.ElementType;
  threat: string;
  title: string;
  desc: string;
  solution: string;
}

const dualAuthFeatures = [
  {
    icon: PackageCheck,
    title: 'المصادقة الثنائية على الشحن',
    desc: 'عند شحن البضاعة، يجب أن يوافق كل من أمين المخزن وعامل التوصيل على الكميات. لا يمكن لطرف واحد تسجيل العملية بمفرده.',
    benefit: 'يمنع أي تلاعب في كميات الشحن — الطرفان يتحملان المسؤولية معاً.',
  },
  {
    icon: ClipboardCheck,
    title: 'المصادقة الثنائية على التفريغ',
    desc: 'عند إرجاع البضاعة المتبقية، يجب موافقة الطرفين على الكميات المُعادة. أي فرق يُسجّل تلقائياً.',
    benefit: 'يكشف أي نقص أو فائض فوراً ويُحدد المسؤول عنه.',
  },
  {
    icon: FileCheck,
    title: 'المصادقة على جلسات المحاسبة',
    desc: 'جلسة المحاسبة تتطلب مراجعة وموافقة المدير على كل بند — النقد، الديون، المصاريف، والفائض/العجز.',
    benefit: 'لا يمكن للعامل إخفاء أي مبلغ أو تعديل الأرقام بعد التسجيل.',
  },
];

const selfServiceFeatures = [
  {
    icon: Smartphone,
    title: 'تجميع المبيعات والطلبات',
    desc: 'كل عامل يرى مبيعاته وطلباته وإنجازاته اليومية مباشرة من هاتفه — بدون الحاجة لسؤال أي شخص.',
  },
  {
    icon: Gift,
    title: 'العروض والمكافآت',
    desc: 'العامل يطّلع على العروض الحالية ونقاطه ومكافآته تلقائياً — لا حاجة للتواصل مع الإدارة.',
  },
  {
    icon: Users,
    title: 'المنجزات اليومية',
    desc: 'ملخص يومي شامل لكل عامل: عدد الزيارات، الطلبات المنفذة، التحصيلات، والمرتجعات.',
  },
  {
    icon: ScanLine,
    title: 'مخزون العامل اللحظي',
    desc: 'كل عامل يرى مخزونه الحالي بالتفصيل — لا يحتاج للاتصال بالمستودع للاستفسار.',
  },
];

const fraudGaps: GapItem[] = [
  {
    icon: MapPin,
    threat: 'ماذا لو ادّعى مندوب المبيعات أنه زار العميل وهو لم يفعل؟',
    title: 'تزوير الزيارات الميدانية',
    desc: 'المندوب لا يمكنه تسجيل أي حالة للعميل (مغلق، غير متاح، لم يطلب) إلا إذا كان فعلياً في موقع العميل عبر GPS.',
    solution: 'النظام يتحقق من إحداثيات الموقع قبل السماح بأي تسجيل — أي محاولة من خارج النطاق تُرفض تلقائياً.',
  },
  {
    icon: MapPin,
    threat: 'ماذا لو ادّعى عامل التوصيل أنه وصل للعميل دون أن يذهب فعلاً؟',
    title: 'تزوير التسليم',
    desc: 'عامل التوصيل لا يمكنه تأكيد تسليم طلبية أو تسجيل حالة العميل إلا من موقع العميل الجغرافي.',
    solution: 'التحقق الجغرافي إلزامي لكل عملية تسليم — لا يمكن التلاعب بحالة الطلبية عن بُعد.',
  },
  {
    icon: Gift,
    threat: 'ماذا لو اختلس عامل التوصيل الهدايا والعينات المخصصة للعملاء؟',
    title: 'اختلاس الهدايا',
    desc: 'كل هدية مسجلة في النظام مرتبطة بعميل محدد وطلبية محددة. عند التفريغ، أي نقص في الهدايا يظهر فوراً.',
    solution: 'المصادقة الثنائية عند التفريغ + تسجيل الهدايا لكل طلبية = أي هدية ناقصة تُكتشف تلقائياً.',
  },
  {
    icon: DollarSign,
    threat: 'ماذا لو باع العامل بسعر أعلى وأعطى المدير حساباً بسعر أقل؟',
    title: 'التلاعب بالأسعار',
    desc: 'الأسعار محددة مسبقاً في النظام لكل منتج ولكل عميل. العامل لا يمكنه تغيير السعر — الفاتورة تُنشأ تلقائياً.',
    solution: 'أسعار ثابتة + أسعار خاصة للعملاء مُعتمدة من المدير + فواتير تلقائية = لا مجال للتلاعب.',
  },
  {
    icon: Eye,
    threat: 'ماذا لو أخفى العامل جزءاً من التحصيلات النقدية؟',
    title: 'إخفاء التحصيلات',
    desc: 'كل تحصيل مرتبط بطلبية أو دين محدد. جلسة المحاسبة تقارن المبلغ المتوقع بالمبلغ الفعلي تلقائياً.',
    solution: 'محاسبة تلقائية + كشف العجز الفوري + سجل لا يمكن تعديله = أي فرق يظهر مباشرة.',
  },
  {
    icon: ShieldAlert,
    threat: 'ماذا لو سجّل العامل مصاريف وهمية ليحتفظ بالفرق؟',
    title: 'مصاريف وهمية',
    desc: 'كل مصروف يتطلب تصنيف وصورة إيصال ويمر بمراجعة المدير قبل اعتماده. لا يُحسب تلقائياً.',
    solution: 'نظام موافقة على المصاريف + إيصالات مطلوبة + مراجعة المدير = لا مصاريف بدون إثبات.',
  },
  {
    icon: UserCheck,
    threat: 'ماذا لو أضاف العامل عملاء وهميين لتسجيل مبيعات مزيفة؟',
    title: 'عملاء وهميون',
    desc: 'إضافة عملاء جدد تحتاج موافقة المدير. لا يمكن للعامل إنشاء عميل والبيع له مباشرة.',
    solution: 'نظام موافقة على العملاء الجدد + ربط العميل بموقع جغرافي = لا عملاء وهميين.',
  },
  {
    icon: Lock,
    threat: 'ماذا لو عدّل العامل بيانات طلبية بعد تسليمها؟',
    title: 'تعديل الطلبيات بأثر رجعي',
    desc: 'الطلبيات المكتملة لا يمكن تعديلها. كل تغيير يُسجّل في سجل النشاطات مع الوقت والمسؤول.',
    solution: 'سجل نشاطات غير قابل للتعديل + قفل الطلبيات المكتملة = شفافية كاملة.',
  },
];

const OperationalGapsSection: React.FC = () => {
  const [expandedGap, setExpandedGap] = useState<number | null>(null);

  return (
    <>
      {/* Self-Service Section */}
      <section className="px-4 py-16">
        <div className="mx-auto max-w-5xl">
          <div className="mb-10 text-center">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-sm font-medium text-primary">
              <MessageCircleOff className="h-4 w-4" />
              تقليل التواصل المباشر
            </div>
            <h2 className="mb-3 text-2xl font-bold sm:text-3xl">كل عامل يجد ما يحتاجه بنفسه</h2>
            <p className="text-muted-foreground">لا حاجة للاتصال بالمدير أو بزملاء العمل — كل البيانات متاحة لحظياً</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {selfServiceFeatures.map((f, i) => (
              <div key={i} className="flex gap-3 rounded-xl border bg-card p-4 shadow-sm">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                  <f.icon className="h-5 w-5 text-primary" />
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

      {/* Dual Authentication Section */}
      <section className="bg-primary/5 px-4 py-16">
        <div className="mx-auto max-w-5xl">
          <div className="mb-10 text-center">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-sm font-medium text-primary">
              <HandshakeIcon className="h-4 w-4" />
              المصادقة الثنائية على العمليات
            </div>
            <h2 className="mb-3 text-2xl font-bold sm:text-3xl">لا عملية تمر بطرف واحد</h2>
            <p className="text-muted-foreground">كل عملية حساسة تتطلب موافقة طرفين — لضمان الشفافية ومنع التلاعب</p>
          </div>
          <div className="grid gap-5 sm:grid-cols-3">
            {dualAuthFeatures.map((f, i) => (
              <div key={i} className="rounded-xl border bg-card p-5 shadow-sm">
                <div className="mb-3 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-sm">
                  <f.icon className="h-5 w-5" />
                </div>
                <h3 className="mb-2 text-lg font-bold">{f.title}</h3>
                <p className="mb-3 text-sm leading-relaxed text-muted-foreground">{f.desc}</p>
                <div className="rounded-lg bg-emerald-500/10 p-2.5 text-xs font-medium text-emerald-700 dark:text-emerald-400">
                  ✓ {f.benefit}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Fraud Prevention Section */}
      <section className="bg-destructive/5 px-4 py-16">
        <div className="mx-auto max-w-5xl">
          <div className="mb-10 text-center">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-destructive/20 bg-destructive/5 px-4 py-1.5 text-sm font-medium text-destructive">
              <ShieldAlert className="h-4 w-4" />
              إغلاق ثغرات التحايل
            </div>
            <h2 className="mb-3 text-2xl font-bold sm:text-3xl">ماذا يمكن أن يفعل العامل؟ وكيف أغلقنا الثغرة؟</h2>
            <p className="text-muted-foreground">حللنا كل سيناريو تحايل ممكن وبنينا حماية مدمجة لكل واحد منها</p>
          </div>
          <div className="space-y-3">
            {fraudGaps.map((g, i) => (
              <div key={i} className="overflow-hidden rounded-xl border border-destructive/20 bg-card shadow-sm">
                <button
                  onClick={() => setExpandedGap(expandedGap === i ? null : i)}
                  className="flex w-full items-center gap-3 p-4 text-right"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-destructive/10">
                    <g.icon className="h-4 w-4 text-destructive" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-bold text-destructive">{g.threat}</p>
                  </div>
                  {expandedGap === i
                    ? <ChevronUp className="h-5 w-5 shrink-0 text-muted-foreground" />
                    : <ChevronDown className="h-5 w-5 shrink-0 text-muted-foreground" />
                  }
                </button>
                {expandedGap === i && (
                  <div className="border-t px-4 pb-4 pt-3 space-y-3">
                    <div>
                      <span className="text-xs font-bold text-destructive">⚠ الثغرة:</span>
                      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{g.desc}</p>
                    </div>
                    <div className="rounded-lg bg-emerald-500/10 p-3">
                      <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400">✓ كيف أغلقناها:</span>
                      <p className="mt-1 text-sm leading-relaxed text-emerald-700 dark:text-emerald-400">{g.solution}</p>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
};

export default OperationalGapsSection;
