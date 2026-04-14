import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  ArrowRight, Users, MapPin, Truck, ShoppingCart, Phone, Eye, CheckCircle,
  Navigation, Clock, Calendar, Package, Banknote, FileText, Search,
  GraduationCap, BookOpen, ChevronDown, ChevronUp, Star, AlertTriangle,
  Printer, DoorClosed, UserX, ShoppingBag, LogIn, KeyRound, Zap, Shield,
  RefreshCw, Filter, Smartphone, Route, Bell, MessageSquare, BarChart3,
  Settings, CircleDot, Layers, ArrowLeftRight, HandCoins, Receipt, Timer,
  GitBranch, ArrowDown, CircleDollarSign, Factory, Warehouse, CreditCard,
  TrendingUp, Repeat, XCircle, Plus, Minus, Edit, RotateCcw
} from 'lucide-react';

// ─── Collapsible Section ───
const TrainingSection: React.FC<{
  title: string;
  icon: React.ReactNode;
  badge?: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}> = ({ title, icon, badge, children, defaultOpen = false }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-2xl border border-border/60 bg-card shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between p-3 sm:p-4 hover:bg-muted/40 transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
            {icon}
          </div>
          <span className="text-sm font-bold text-foreground">{title}</span>
          {badge && <Badge variant="secondary" className="text-[9px] px-1.5 h-4">{badge}</Badge>}
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
      </button>
      {open && <div className="px-3 sm:px-4 pb-4 space-y-3 border-t border-border/40 pt-3">{children}</div>}
    </div>
  );
};

// ─── Screenshot Thumbnail ───
const ScreenshotThumb: React.FC<{
  src: string;
  alt: string;
  caption: string;
  sub?: string;
}> = ({ src, alt, caption, sub }) => (
  <div className="space-y-1.5">
    <div className="rounded-xl border border-border/60 overflow-hidden bg-muted/20 p-1.5">
      <img
        src={src}
        alt={alt}
        className="w-full max-h-[280px] object-contain rounded-lg"
        loading="lazy"
      />
    </div>
    <p className="text-[11px] font-semibold text-foreground px-1">{caption}</p>
    {sub && <p className="text-[10px] text-muted-foreground px-1">{sub}</p>}
  </div>
);

// ─── Info Pill ───
const InfoPill: React.FC<{
  icon: React.ReactNode;
  title: string;
  desc: string;
}> = ({ icon, title, desc }) => (
  <div className="flex items-start gap-2.5 rounded-xl border border-border/50 bg-muted/20 p-2.5">
    <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
      {icon}
    </div>
    <div className="min-w-0">
      <p className="text-[11px] font-bold text-foreground">{title}</p>
      <p className="text-[10px] text-muted-foreground leading-relaxed">{desc}</p>
    </div>
  </div>
);

// ─── Step Card ───
const StepCard: React.FC<{
  number: number;
  title: string;
  desc: string;
  color?: string;
}> = ({ number, title, desc, color = 'bg-primary text-primary-foreground' }) => (
  <div className="flex items-start gap-2.5">
    <div className={`w-6 h-6 rounded-full ${color} flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5`}>
      {number}
    </div>
    <div>
      <p className="text-[11px] font-bold text-foreground">{title}</p>
      <p className="text-[10px] text-muted-foreground leading-relaxed">{desc}</p>
    </div>
  </div>
);

// ─── Section Subtitle ───
const SectionTitle: React.FC<{ icon: React.ReactNode; children: React.ReactNode }> = ({ icon, children }) => (
  <div className="flex items-center gap-2 pt-1">
    <span className="text-primary">{icon}</span>
    <h4 className="text-xs font-bold text-foreground">{children}</h4>
  </div>
);

// ═══════════════════════════════════════════════
// Flow Diagram Components
// ═══════════════════════════════════════════════

const FlowNode: React.FC<{
  icon: React.ReactNode;
  label: string;
  variant?: 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'muted';
}> = ({ icon, label, variant = 'primary' }) => {
  const variants = {
    primary: 'bg-primary/10 border-primary/30 text-primary',
    success: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400',
    warning: 'bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400',
    danger: 'bg-destructive/10 border-destructive/30 text-destructive',
    info: 'bg-blue-500/10 border-blue-500/30 text-blue-600 dark:text-blue-400',
    muted: 'bg-muted/40 border-border/60 text-muted-foreground',
  };
  return (
    <div className={`flex items-center gap-2 rounded-xl border-2 px-3 py-2 ${variants[variant]}`}>
      <div className="shrink-0">{icon}</div>
      <span className="text-[11px] font-bold whitespace-nowrap">{label}</span>
    </div>
  );
};

const FlowArrow: React.FC<{ label?: string; direction?: 'down' | 'right' }> = ({ label, direction = 'down' }) => (
  <div className={`flex ${direction === 'down' ? 'flex-col items-center py-1' : 'flex-row items-center px-1'}`}>
    <ArrowDown className={`w-4 h-4 text-muted-foreground ${direction === 'right' ? 'rotate-[-90deg]' : ''}`} />
    {label && <span className="text-[9px] text-muted-foreground font-medium">{label}</span>}
  </div>
);

const FlowBranch: React.FC<{ children: React.ReactNode; label?: string }> = ({ children, label }) => (
  <div className="space-y-1">
    {label && (
      <div className="flex items-center gap-1.5">
        <GitBranch className="w-3 h-3 text-muted-foreground" />
        <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">{label}</span>
      </div>
    )}
    <div className="flex flex-wrap gap-2 pr-3 border-r-2 border-dashed border-border/60">
      {children}
    </div>
  </div>
);

// ─── Inventory Flow Diagram ───
const InventoryFlowDiagram: React.FC = () => (
  <div className="space-y-4">
    <div className="text-center">
      <h3 className="text-sm font-bold text-foreground">حركة المخزون</h3>
      <p className="text-[10px] text-muted-foreground">من المصنع حتى العميل أو الإرجاع</p>
    </div>
    
    <div className="flex flex-col items-center gap-1">
      <FlowNode icon={<Factory className="w-4 h-4" />} label="المصنع / المورّد" variant="warning" />
      <FlowArrow label="استلام بضاعة" />
      <FlowNode icon={<Warehouse className="w-4 h-4" />} label="مستودع الفرع" variant="info" />
      <FlowArrow label="تحميل الشاحنة" />
      <FlowNode icon={<Truck className="w-4 h-4" />} label="شاحنة المندوب" variant="primary" />
      <FlowArrow />
      
      <div className="w-full grid grid-cols-2 gap-3 mt-1">
        <div className="flex flex-col items-center gap-1">
          <FlowArrow label="توصيل / بيع" />
          <FlowNode icon={<Users className="w-4 h-4" />} label="العميل" variant="success" />
          <FlowArrow label="مرتجع" />
          <FlowNode icon={<RotateCcw className="w-4 h-4" />} label="مرتجع للشاحنة" variant="muted" />
        </div>
        <div className="flex flex-col items-center gap-1">
          <FlowArrow label="بيع مباشر" />
          <FlowNode icon={<ShoppingBag className="w-4 h-4" />} label="بيع فوري" variant="success" />
          <FlowArrow label="تالف" />
          <FlowNode icon={<XCircle className="w-4 h-4" />} label="تالف / إرجاع مصنع" variant="danger" />
        </div>
      </div>

      <div className="mt-3 w-full">
        <FlowBranch label="تحويلات">
          <FlowNode icon={<ArrowLeftRight className="w-3.5 h-3.5" />} label="تبادل بين الفروع" variant="info" />
          <FlowNode icon={<Repeat className="w-3.5 h-3.5" />} label="تبادل بين المندوبين" variant="info" />
        </FlowBranch>
      </div>
    </div>
  </div>
);

// ─── Order Lifecycle Diagram ───
const OrderLifecycleDiagram: React.FC = () => (
  <div className="space-y-4">
    <div className="text-center">
      <h3 className="text-sm font-bold text-foreground">دورة حياة الطلبية</h3>
      <p className="text-[10px] text-muted-foreground">من الإنشاء حتى التسليم مع جميع الاحتمالات</p>
    </div>

    <div className="flex flex-col items-center gap-1">
      <FlowNode icon={<Plus className="w-4 h-4" />} label="إنشاء الطلبية" variant="primary" />
      <FlowArrow label="اختيار العميل + نوع الفاتورة" />
      <FlowNode icon={<Package className="w-4 h-4" />} label="إضافة المنتجات والكميات" variant="info" />
      <FlowArrow label="حفظ" />
      <FlowNode icon={<Clock className="w-4 h-4" />} label="طلبية معلّقة" variant="warning" />
      <FlowArrow />

      {/* Modification branches */}
      <div className="w-full rounded-xl border border-dashed border-border/60 p-3 space-y-2 bg-muted/10">
        <div className="flex items-center gap-1.5">
          <Edit className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-[10px] font-bold text-muted-foreground">احتمالات التعديل قبل التسليم</span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <FlowNode icon={<Plus className="w-3.5 h-3.5" />} label="إضافة منتج جديد" variant="success" />
          <FlowNode icon={<Minus className="w-3.5 h-3.5" />} label="حذف منتج" variant="danger" />
          <FlowNode icon={<TrendingUp className="w-3.5 h-3.5" />} label="زيادة الكمية" variant="info" />
          <FlowNode icon={<ArrowDown className="w-3.5 h-3.5" />} label="تقليل الكمية" variant="warning" />
        </div>
      </div>

      <FlowArrow />

      <div className="w-full grid grid-cols-2 gap-3">
        <div className="flex flex-col items-center gap-1">
          <FlowNode icon={<Truck className="w-4 h-4" />} label="تسليم للعميل" variant="success" />
          <FlowArrow label="اختيار طريقة الدفع" />
          <FlowNode icon={<Banknote className="w-4 h-4" />} label="دفع / دين" variant="success" />
          <FlowArrow />
          <FlowNode icon={<Printer className="w-4 h-4" />} label="طباعة الوصل" variant="muted" />
        </div>
        <div className="flex flex-col items-center gap-1">
          <FlowNode icon={<XCircle className="w-4 h-4" />} label="إلغاء الطلبية" variant="danger" />
          <FlowArrow label="سبب الإلغاء" />
          <FlowNode icon={<RotateCcw className="w-4 h-4" />} label="إرجاع المخزون" variant="warning" />
        </div>
      </div>

      {/* Post-delivery */}
      <div className="mt-3 w-full rounded-xl border border-dashed border-border/60 p-3 space-y-2 bg-muted/10">
        <div className="flex items-center gap-1.5">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
          <span className="text-[10px] font-bold text-muted-foreground">بعد التسليم (يحتاج موافقة المدير)</span>
        </div>
        <div className="grid grid-cols-1 gap-1.5">
          <FlowNode icon={<Edit className="w-3.5 h-3.5" />} label="تعديل الكميات → موافقة المدير" variant="warning" />
          <FlowNode icon={<RotateCcw className="w-3.5 h-3.5" />} label="مرتجع جزئي → خصم من الفاتورة" variant="warning" />
        </div>
      </div>
    </div>
  </div>
);

// ─── Money Flow Diagram ───
const MoneyFlowDiagram: React.FC = () => (
  <div className="space-y-4">
    <div className="text-center">
      <h3 className="text-sm font-bold text-foreground">حركة الأموال</h3>
      <p className="text-[10px] text-muted-foreground">من العميل إلى الجهة العليا مع طرق الدفع</p>
    </div>

    <div className="flex flex-col items-center gap-1">
      <FlowNode icon={<Users className="w-4 h-4" />} label="العميل" variant="primary" />
      <FlowArrow label="دفع" />

      {/* Invoice types */}
      <div className="w-full rounded-xl border border-border/50 p-3 space-y-2 bg-muted/10">
        <span className="text-[10px] font-bold text-foreground">نوع الفاتورة</span>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1.5">
            <FlowNode icon={<FileText className="w-3.5 h-3.5" />} label="فاتورة 1" variant="info" />
            <div className="pr-2 space-y-1 text-[9px] text-muted-foreground">
              <div className="flex items-center gap-1">
                <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                <span>شيك (Chèque)</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                <span>فيرسمو (Versement)</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-1.5 h-1.5 rounded-full bg-purple-500" />
                <span>فارسمو جوك (Versement Joue)</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-1.5 h-1.5 rounded-full bg-orange-500" />
                <span>إسباس (Espèce / كاش)</span>
              </div>
            </div>
          </div>
          <div className="space-y-1.5">
            <FlowNode icon={<Receipt className="w-3.5 h-3.5" />} label="فاتورة 2" variant="warning" />
            <div className="pr-2 space-y-1 text-[9px] text-muted-foreground">
              <div className="flex items-center gap-1">
                <div className="w-1.5 h-1.5 rounded-full bg-teal-500" />
                <span>تجزئة</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                <span>جملة</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-1.5 h-1.5 rounded-full bg-pink-500" />
                <span>سوبر جملة</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <FlowArrow label="تحصيل" />
      <FlowNode icon={<HandCoins className="w-4 h-4" />} label="خزينة المندوب" variant="success" />
      <FlowArrow label="تسليم يومي" />
      <FlowNode icon={<Shield className="w-4 h-4" />} label="خزينة المشرف" variant="info" />
      <FlowArrow label="توحيد" />
      <FlowNode icon={<CircleDollarSign className="w-4 h-4" />} label="الجهة العليا / البنك" variant="primary" />

      {/* Special cases */}
      <div className="mt-3 w-full rounded-xl border border-dashed border-border/60 p-3 space-y-2 bg-muted/10">
        <span className="text-[10px] font-bold text-muted-foreground">حالات خاصة</span>
        <div className="grid grid-cols-1 gap-1.5">
          <FlowNode icon={<Clock className="w-3.5 h-3.5" />} label="دين → تحصيل لاحق حسب الجدول" variant="warning" />
          <FlowNode icon={<XCircle className="w-3.5 h-3.5" />} label="شيك مرفوض → إعادة تحصيل أو متابعة قانونية" variant="danger" />
          <FlowNode icon={<ArrowLeftRight className="w-3.5 h-3.5" />} label="فائض / عجز → مراجعة وتسوية" variant="info" />
        </div>
      </div>
    </div>
  </div>
);

// ═══════════════════════════════════════════════
// Main Training Page
// ═══════════════════════════════════════════════

const Training: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="p-3 sm:p-4 space-y-3 pb-24 max-w-2xl mx-auto" dir="rtl">
      {/* ─── Header ─── */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary via-primary/90 to-primary/70 p-4 text-primary-foreground shadow-lg">
        <div className="absolute inset-0 opacity-[0.07]">
          <div className="absolute -top-8 -left-8 w-32 h-32 rounded-full bg-white" />
          <div className="absolute -bottom-6 -right-6 w-24 h-24 rounded-full bg-white" />
          <div className="absolute top-1/2 left-1/2 w-20 h-20 rounded-full bg-white" />
        </div>
        <div className="relative flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-white/15 backdrop-blur-sm flex items-center justify-center">
            <GraduationCap className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-lg font-bold">دليل التدريب الشامل</h1>
            <p className="text-primary-foreground/70 text-[11px] mt-0.5">تعلّم استخدام جميع ميزات التطبيق كالمحترفين</p>
          </div>
        </div>
      </div>

      <Button variant="ghost" size="sm" onClick={() => navigate('/')} className="text-xs gap-1.5 h-8">
        <ArrowRight className="w-3.5 h-3.5" />
        العودة
      </Button>

      {/* ═══ Main Tabs: الشروحات | المخططات ═══ */}
      <Tabs defaultValue="guides" className="w-full">
        <TabsList className="w-full h-10 grid grid-cols-2">
          <TabsTrigger value="guides" className="text-xs gap-1.5">
            <BookOpen className="w-3.5 h-3.5" />
            الشروحات
          </TabsTrigger>
          <TabsTrigger value="diagrams" className="text-xs gap-1.5">
            <GitBranch className="w-3.5 h-3.5" />
            المخططات
          </TabsTrigger>
        </TabsList>

        {/* ═══════════════════════════════════ */}
        {/* تبويب الشروحات                      */}
        {/* ═══════════════════════════════════ */}
        <TabsContent value="guides" className="space-y-3 mt-3">
          {/* نافذة عملاء اليوم */}
          <TrainingSection title="نافذة عملاء اليوم" icon={<Users className="w-5 h-5" />} badge="أساسي" defaultOpen>
            <div className="rounded-xl bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-800/40 p-3 space-y-1.5">
              <div className="flex items-center gap-2">
                <Star className="w-4 h-4 text-amber-600" />
                <span className="text-xs font-bold text-amber-800 dark:text-amber-300">ما هي نافذة عملاء اليوم؟</span>
              </div>
              <p className="text-[11px] text-amber-900/80 dark:text-amber-200/80 leading-relaxed">
                هي الأداة الرئيسية للمندوب. تعرض عملاء اليوم مرتبين حسب القُرب من موقعك، مع كل المعلومات: الديون، الطلبيات، حالة الزيارة. كل شيء تحتاجه في شاشة واحدة.
              </p>
            </div>

            <SectionTitle icon={<Smartphone className="w-3.5 h-3.5" />}>شاشات حقيقية</SectionTitle>
            <div className="grid grid-cols-2 gap-2">
              <ScreenshotThumb src="/training/today-customers.png" alt="عملاء اليوم" caption="العرض الرئيسي" sub="القطاعات والعملاء مع الفلاتر" />
              <ScreenshotThumb src="/training/today-customers-2.png" alt="التمرير" caption="التمرير للأسفل" sub="باقي العملاء حسب القطاع" />
            </div>

            <SectionTitle icon={<Filter className="w-3.5 h-3.5" />}>أزرار التصفية</SectionTitle>
            <p className="text-[10px] text-muted-foreground">اضغط على أي فلتر لعرض العملاء حسب نوع النشاط:</p>
            <div className="grid grid-cols-2 gap-2">
              <ScreenshotThumb src="/training/delivery-filter.png" alt="توصيل" caption="🚚 التوصيل" sub="عملاء التوصيل وحالة التسليم" />
              <ScreenshotThumb src="/training/orders-filter.png" alt="طلبات" caption="📦 الطلبات" sub="الطلبيات المعلقة" />
              <ScreenshotThumb src="/training/direct-sale-filter.png" alt="بيع مباشر" caption="🛒 البيع المباشر" sub="البيع بدون طلبية مسبقة" />
              <ScreenshotThumb src="/training/debts-filter.png" alt="ديون" caption="💰 الديون" sub="العملاء المدينون والمبالغ" />
            </div>

            <SectionTitle icon={<CircleDot className="w-3.5 h-3.5" />}>عند النقر على العميل</SectionTitle>
            <p className="text-[10px] text-muted-foreground">النقر على اسم العميل يفتح نافذة إنشاء طلبية:</p>
            <div className="max-w-[260px] mx-auto">
              <ScreenshotThumb src="/training/create-order.png" alt="إنشاء طلبية" caption="نافذة إنشاء الطلبية" sub="اختر Facture 1/2 ونوع التسعير" />
            </div>

            <SectionTitle icon={<CheckCircle className="w-3.5 h-3.5" />}>بعد الزيارة</SectionTitle>
            <p className="text-[10px] text-muted-foreground">بعد تسجيل أي إجراء، يتم تحديث الحالة تلقائيًا:</p>
            <div className="max-w-[280px] mx-auto">
              <ScreenshotThumb src="/training/after-visit.png" alt="بعد الزيارة" caption="تحديث تلقائي" sub="العدادات وحالة العميل تتحدث فورًا" />
            </div>

            <SectionTitle icon={<Zap className="w-3.5 h-3.5" />}>جميع الإجراءات المتاحة</SectionTitle>
            <Tabs defaultValue="main" className="w-full">
              <TabsList className="w-full h-8 grid grid-cols-3 text-[10px]">
                <TabsTrigger value="main" className="text-[10px] px-1">أساسية</TabsTrigger>
                <TabsTrigger value="sales" className="text-[10px] px-1">البيع والطلبات</TabsTrigger>
                <TabsTrigger value="finance" className="text-[10px] px-1">المالية والديون</TabsTrigger>
              </TabsList>

              <TabsContent value="main" className="space-y-1.5 mt-2">
                <InfoPill icon={<Phone className="w-3.5 h-3.5 text-green-600" />} title="اتصال بالعميل" desc="يتصل مباشرة برقم العميل المسجل. نصيحة: اتصل قبل الزيارة للتأكد من تواجده." />
                <InfoPill icon={<Navigation className="w-3.5 h-3.5 text-blue-600" />} title="التنقل / الملاحة" desc="يفتح Google Maps مع الموقع الدقيق للعميل. يعمل حتى بدون إنترنت إذا حملت الخريطة مسبقًا." />
                <InfoPill icon={<Eye className="w-3.5 h-3.5 text-purple-600" />} title="عرض ملف العميل" desc="يعرض كل شيء: المعلومات الشخصية، سجل الطلبيات، الديون، الزيارات السابقة، الأسعار الخاصة." />
                <InfoPill icon={<DoorClosed className="w-3.5 h-3.5 text-gray-500" />} title="محل مغلق" desc="سجّل أن المحل كان مغلقًا. تُحتسب كزيارة مكتملة ويتم إخطار المدير. سر: يمكن إضافة ملاحظة." />
                <InfoPill icon={<UserX className="w-3.5 h-3.5 text-red-500" />} title="العميل غير متاح / رفض" desc="عند رفض الاستقبال أو عدم التواجد. تُسجل كزيارة وتظهر في تقرير المدير." />
                <InfoPill icon={<RefreshCw className="w-3.5 h-3.5 text-cyan-600" />} title="تحديث البيانات" desc="اسحب للأسفل لتحديث القائمة. مفيد بعد إضافة عميل جديد أو تغيير الجدول." />
              </TabsContent>

              <TabsContent value="sales" className="space-y-1.5 mt-2">
                <InfoPill icon={<ShoppingCart className="w-3.5 h-3.5 text-orange-600" />} title="إنشاء طلبية جديدة" desc="اضغط على اسم العميل → اختر Facture 1 أو 2 → حدد نوع التسعير (جملة/تجزئة/خاص) → أضف المنتجات → احفظ." />
                <InfoPill icon={<ShoppingBag className="w-3.5 h-3.5 text-indigo-600" />} title="بيع مباشر (فوري)" desc="بيع بدون طلبية مسبقة. المنتجات تُخصم من مخزونك مباشرة. مثالي للعملاء العابرين." />
                <InfoPill icon={<Truck className="w-3.5 h-3.5 text-teal-600" />} title="تسليم طلبية موجودة" desc="إذا كان للعميل طلبية معلقة (شارة زرقاء)، اضغط عليها لتأكيد التسليم وتحديد طريقة الدفع." />
                <InfoPill icon={<Printer className="w-3.5 h-3.5 text-slate-600" />} title="طباعة الوصل" desc="بعد البيع أو التسليم، اطبع وصل حراري عبر بلوتوث. سر: يمكنك إعادة طباعة أي وصل سابق من ملف العميل." />
                <InfoPill icon={<ArrowLeftRight className="w-3.5 h-3.5 text-amber-600" />} title="تعديل طلبية" desc="يمكنك تعديل الكميات أو إضافة/حذف منتجات قبل التسليم. بعد التسليم يحتاج موافقة المدير." />
                <InfoPill icon={<Receipt className="w-3.5 h-3.5 text-pink-600" />} title="اختيار نوع الفاتورة" desc="Facture 1: فاتورة عادية. Facture 2: فاتورة ضريبية. اختر حسب نوع العميل وطلبه." />
              </TabsContent>

              <TabsContent value="finance" className="space-y-1.5 mt-2">
                <InfoPill icon={<Banknote className="w-3.5 h-3.5 text-red-600" />} title="تحصيل دين" desc="اضغط على شارة الدين → أدخل المبلغ المحصّل → اختر طريقة الدفع (نقدي/شيك/تحويل). سر: يمكنك تحصيل جزئي." />
                <InfoPill icon={<HandCoins className="w-3.5 h-3.5 text-emerald-600" />} title="زيارة بدون دفع" desc="إذا زرت عميلًا مدينًا ورفض الدفع، سجّل 'زيارة بدون دفع' مع السبب. تُعطي المدير صورة واضحة." />
                <InfoPill icon={<FileText className="w-3.5 h-3.5 text-amber-600" />} title="تحصيل مستندات" desc="بعض العملاء يحتاجون تسليم مستندات (شيكات، أوراق). يمكنك تسجيل استلامها مباشرة." />
                <InfoPill icon={<Shield className="w-3.5 h-3.5 text-violet-600" />} title="ثقة العميل" desc="شارة ملونة بجانب كل عميل تدل على مستوى ثقته (أخضر/أصفر/أحمر). تُحسب من تاريخ الدفع والتعامل." />
                <InfoPill icon={<Clock className="w-3.5 h-3.5 text-slate-600" />} title="جدول الدفع" desc="سر: بعض العملاء لديهم جدول دفع محدد. يظهر تلقائيًا عند فتح ملف العميل." />
                <InfoPill icon={<Bell className="w-3.5 h-3.5 text-orange-500" />} title="تنبيهات الدين" desc="إذا تجاوز دين العميل الحد المسموح، يظهر تحذير تلقائي عند محاولة البيع له." />
              </TabsContent>
            </Tabs>

            <SectionTitle icon={<Star className="w-3.5 h-3.5" />}>أسرار ونصائح المحترفين</SectionTitle>
            <div className="grid grid-cols-1 gap-1.5">
              {[
                { title: 'ابدأ بالأقرب', desc: 'رتّب زياراتك من الأقرب للأبعد لتوفير الوقت والوقود. النظام يرتبها تلقائيًا.', icon: <Route className="w-3.5 h-3.5 text-green-600" /> },
                { title: 'حصّل أثناء التوصيل', desc: 'إذا كان للعميل دين، حصّله أثناء تسليم الطلبية بدلاً من زيارة منفصلة.', icon: <Banknote className="w-3.5 h-3.5 text-red-600" /> },
                { title: 'استخدم الفلاتر بذكاء', desc: 'ابدأ بفلتر "التوصيل" لتسليم الطلبيات، ثم "الديون" للتحصيل، ثم "البيع" للعملاء الجدد.', icon: <Filter className="w-3.5 h-3.5 text-blue-600" /> },
                { title: 'اتصل قبل الزيارة', desc: 'اتصل بالعميل قبل 10 دقائق للتأكد من تواجده وتجنب الزيارات الفاشلة.', icon: <Phone className="w-3.5 h-3.5 text-emerald-600" /> },
                { title: 'فعّل GPS دائمًا', desc: 'GPS ضروري لحساب المسافات بدقة ولتسجيل موقع الزيارة في تقرير المدير.', icon: <MapPin className="w-3.5 h-3.5 text-orange-600" /> },
                { title: 'سجّل كل شيء', desc: 'حتى الزيارات الفاشلة (محل مغلق/رفض) سجّلها. تساعد المدير في تقييم الأداء.', icon: <BarChart3 className="w-3.5 h-3.5 text-purple-600" /> },
                { title: 'غيّر اليوم للتخطيط', desc: 'يمكنك عرض عملاء الغد أو أي يوم آخر مسبقًا للتخطيط. اضغط أزرار الأيام في الأعلى.', icon: <Calendar className="w-3.5 h-3.5 text-indigo-600" /> },
                { title: 'البحث السريع', desc: 'استخدم شريط البحث للوصول لعميل محدد بسرعة بدلاً من التمرير في القائمة.', icon: <Search className="w-3.5 h-3.5 text-cyan-600" /> },
              ].map((tip, idx) => (
                <div key={idx} className="flex items-start gap-2 rounded-lg border border-border/40 bg-muted/15 p-2">
                  <div className="w-6 h-6 rounded-md bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">{tip.icon}</div>
                  <div>
                    <p className="text-[11px] font-bold text-foreground">{tip.title}</p>
                    <p className="text-[10px] text-muted-foreground leading-relaxed">{tip.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            <SectionTitle icon={<Layers className="w-3.5 h-3.5" />}>سيناريوهات يومية شائعة</SectionTitle>
            <div className="space-y-2">
              <div className="rounded-xl border border-border/50 bg-muted/10 p-3 space-y-2">
                <p className="text-[11px] font-bold text-foreground">📦 سيناريو 1: تسليم طلبية + تحصيل دين</p>
                <div className="space-y-1">
                  <StepCard number={1} title="افتح نافذة عملاء اليوم" desc="اختر فلتر 'التوصيل' لعرض الطلبيات المعلقة" />
                  <StepCard number={2} title="اضغط على العميل" desc="اعرض تفاصيل الطلبية وتأكد من المنتجات والكميات" />
                  <StepCard number={3} title="سلّم وأكّد" desc="اختر طريقة الدفع (نقدي/دين/شيك) واضغط تأكيد التسليم" />
                  <StepCard number={4} title="حصّل الدين" desc="إذا كان عليه دين سابق، اضغط شارة الدين وأدخل المبلغ المحصّل" />
                  <StepCard number={5} title="اطبع الوصل" desc="اطبع وصل التسليم والتحصيل معًا للعميل" />
                </div>
              </div>

              <div className="rounded-xl border border-border/50 bg-muted/10 p-3 space-y-2">
                <p className="text-[11px] font-bold text-foreground">🛒 سيناريو 2: بيع مباشر لعميل جديد</p>
                <div className="space-y-1">
                  <StepCard number={1} title="اختر فلتر 'البيع المباشر'" desc="يعرض العملاء المتاحين للبيع الفوري" />
                  <StepCard number={2} title="اضغط على اسم العميل" desc="ستفتح نافذة إنشاء طلبية - اختر نوع الفاتورة" />
                  <StepCard number={3} title="أضف المنتجات" desc="ابحث عن المنتج أو تصفح الأقسام واختر الكميات" />
                  <StepCard number={4} title="راجع وأكّد" desc="تحقق من الإجمالي وطريقة الدفع ثم احفظ" />
                </div>
              </div>

              <div className="rounded-xl border border-border/50 bg-muted/10 p-3 space-y-2">
                <p className="text-[11px] font-bold text-foreground">🚫 سيناريو 3: عميل غير متاح</p>
                <div className="space-y-1">
                  <StepCard number={1} title="اذهب للموقع" desc="استخدم زر الملاحة للوصول" />
                  <StepCard number={2} title="تحقق من المحل" desc="إذا كان مغلقًا اضغط 'محل مغلق'" />
                  <StepCard number={3} title="أضف ملاحظة" desc="اكتب ملاحظة مثل 'مغلق منذ أسبوعين' لإبلاغ المدير" />
                </div>
              </div>
            </div>

            <div className="rounded-xl bg-destructive/5 border border-destructive/20 p-3 space-y-1.5">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-destructive" />
                <span className="text-xs font-bold text-destructive">تنبيهات مهمة</span>
              </div>
              <ul className="text-[10px] text-destructive/80 space-y-1 list-none">
                <li>⚠️ لا تبع لعميل تجاوز الحد الائتماني بدون موافقة المدير</li>
                <li>⚠️ سجّل كل زيارة حتى لو لم يتم البيع - مهم لتقييم أدائك</li>
                <li>⚠️ تأكد من GPS قبل بدء العمل - بدونه لن تُسجل مواقع الزيارات</li>
                <li>⚠️ لا تغادر موقع العميل قبل طباعة الوصل وتسليمه</li>
              </ul>
            </div>
          </TrainingSection>

          {/* تسجيل الدخول */}
          <TrainingSection title="تسجيل الدخول" icon={<LogIn className="w-5 h-5" />}>
            <div className="rounded-xl bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200/60 p-3 space-y-2">
              <div className="flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-amber-600" />
                <span className="text-xs font-bold text-amber-800 dark:text-amber-300">كيفية تسجيل الدخول</span>
              </div>
              <p className="text-[11px] text-amber-900/80 leading-relaxed">
                أدخل اسم المستخدم وكلمة المرور ثم اضغط "تسجيل الدخول". ستُوجَّه تلقائيًا حسب صلاحياتك.
              </p>
              <div className="max-w-[220px] mx-auto">
                <ScreenshotThumb src="/training/login-screen.png" alt="تسجيل الدخول" caption="شاشة تسجيل الدخول" />
              </div>
              <div className="space-y-1 mt-1">
                <StepCard number={1} title="أدخل اسم المستخدم" desc="الذي أعطاك إياه المدير" />
                <StepCard number={2} title="أدخل كلمة المرور" desc="كلمة المرور الخاصة بحسابك" />
                <StepCard number={3} title="اضغط تسجيل الدخول" desc="سيتم التوجيه للصفحة المناسبة تلقائيًا" />
              </div>
            </div>
          </TrainingSection>

          {/* الصفحة الرئيسية */}
          <TrainingSection title="الصفحة الرئيسية" icon={<BookOpen className="w-5 h-5" />}>
            <div className="max-w-[280px] mx-auto">
              <ScreenshotThumb src="/training/admin-home.png" alt="الرئيسية" caption="الصفحة الرئيسية للمدير" sub="أقسام وظيفية مع اختصارات سريعة" />
            </div>
          </TrainingSection>

          {/* الإعدادات */}
          <TrainingSection title="إعدادات النظام" icon={<Settings className="w-5 h-5" />}>
            <div className="max-w-[280px] mx-auto">
              <ScreenshotThumb src="/training/settings-screen.png" alt="الإعدادات" caption="صفحة الإعدادات" sub="اللغة، حجم الخط، الفرع، والصلاحيات" />
            </div>
          </TrainingSection>

          {/* أقسام قادمة */}
          <TrainingSection title="إدارة المنتجات" icon={<Package className="w-5 h-5" />} badge="قريبًا">
            <p className="text-xs text-muted-foreground text-center py-4">سيتم إضافة شرح تفصيلي قريبًا</p>
          </TrainingSection>

          <TrainingSection title="المحاسبة والفوترة" icon={<FileText className="w-5 h-5" />} badge="قريبًا">
            <p className="text-xs text-muted-foreground text-center py-4">سيتم إضافة شرح تفصيلي قريبًا</p>
          </TrainingSection>
        </TabsContent>

        {/* ═══════════════════════════════════ */}
        {/* تبويب المخططات                      */}
        {/* ═══════════════════════════════════ */}
        <TabsContent value="diagrams" className="space-y-4 mt-3">
          <div className="rounded-xl bg-primary/5 border border-primary/20 p-3 text-center">
            <p className="text-xs font-bold text-foreground">مخططات توضيحية تفاعلية</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">تتبّع حركة المخزون والطلبيات والأموال بصريًا</p>
          </div>

          {/* مخطط حركة المخزون */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                  <Package className="w-4 h-4 text-blue-600" />
                </div>
                <div>
                  <CardTitle className="text-sm">حركة المخزون</CardTitle>
                  <CardDescription className="text-[10px]">من المصنع حتى العميل أو الإرجاع</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <InventoryFlowDiagram />
            </CardContent>
          </Card>

          {/* مخطط دورة حياة الطلبية */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                  <ShoppingCart className="w-4 h-4 text-emerald-600" />
                </div>
                <div>
                  <CardTitle className="text-sm">دورة حياة الطلبية</CardTitle>
                  <CardDescription className="text-[10px]">من الإنشاء حتى التسليم مع احتمالات التعديل</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <OrderLifecycleDiagram />
            </CardContent>
          </Card>

          {/* مخطط حركة الأموال */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
                  <CircleDollarSign className="w-4 h-4 text-amber-600" />
                </div>
                <div>
                  <CardTitle className="text-sm">حركة الأموال</CardTitle>
                  <CardDescription className="text-[10px]">من التحصيل حتى التوريد مع طرق الدفع</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <MoneyFlowDiagram />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Training;
