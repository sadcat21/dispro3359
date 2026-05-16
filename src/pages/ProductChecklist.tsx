import { useState } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import {
  CheckCircle2,
  Clock,
  Lightbulb,
  Trash2,
  ArrowRight,
  Package,
  Users,
  Wallet,
  BarChart3,
  ShieldCheck,
  Truck,
  MessageSquare,
  Bell,
  FileText,
  Award,
  MapPin,
  Database,
  Gauge,
} from "lucide-react";

type Status = "done" | "todo" | "suggest-add" | "suggest-remove";

interface Item {
  title: string;
  desc: string;
  status: Status;
  category: string;
  priority?: "high" | "medium" | "low";
}

const items: Item[] = [
  // ✅ DONE
  { status: "done", category: "نظام الصلاحيات", title: "نظام أدوار متعدد المستويات", desc: "مدير عام، مدير شركة، مدير فرع، مساعد، مشرف داخلي، عامل، أمين مستودع" },
  { status: "done", category: "نظام الصلاحيات", title: "التحكم الديناميكي بظهور الأزرار (useUIOverrides)", desc: "إخفاء/إظهار الأزرار حسب الدور بدون نشر تعديلات" },
  { status: "done", category: "نظام الصلاحيات", title: "صلاحيات المساعدين القابلة للتخصيص", desc: "AssistantPermissionsControl لتفويض صلاحيات محددة" },

  { status: "done", category: "العملاء والطلبات", title: "إدارة كاملة للعملاء", desc: "إضافة، تعديل، حذف، عملاء مكررين، رحلة العميل، حسابات العملاء" },
  { status: "done", category: "العملاء والطلبات", title: "نظام الطلبات وتتبع التعديلات", desc: "OrderTracking + OrderModificationsLog" },
  { status: "done", category: "العملاء والطلبات", title: "المتاجر القريبة (Geo)", desc: "NearbyStores + GeoOperations" },

  { status: "done", category: "المخزون والمستودع", title: "إدارة المخزون الشاملة", desc: "مخزون شخصي، مخزون مستودع، إيصالات، حركات مخزون، تحميل البضاعة" },
  { status: "done", category: "المخزون والمستودع", title: "مراجعة المستودع والموافقات", desc: "WarehouseReview + PendingWarehouseReviews" },

  { status: "done", category: "المالية والمحاسبة", title: "نظام مصاريف متكامل", desc: "تصنيفات متعددة اللغات، مرفقات، موافقة/رفض، Realtime" },
  { status: "done", category: "المالية والمحاسبة", title: "خزينة وحسابات يومية", desc: "ManagerTreasury, AccountingSessions, DailyReceipts, CashLedger, DebtLedger, SurplusDeficitTreasury" },
  { status: "done", category: "المالية والمحاسبة", title: "ديون العملاء والعمال", desc: "CustomerDebts + WorkerDebts + WorkerLiability" },

  { status: "done", category: "العروض والمكافآت", title: "نظام العروض والـ Promo", desc: "ProductOffers, AvailableOffers, PromoTable, PromoTracking, PromoSplits, OfferLedger" },
  { status: "done", category: "العروض والمكافآت", title: "المكافآت والأهداف", desc: "Rewards, Targets, TargetsLeaderboard, WorkerRewards, MyAchievements" },

  { status: "done", category: "التتبع والمتابعة", title: "تتبع العمال والحضور", desc: "WorkerTracking, Attendance, WorkerActions, WorkerRounds" },
  { status: "done", category: "التتبع والمتابعة", title: "سجل النشاطات", desc: "ActivityLogs لكل العمليات الحساسة" },

  { status: "done", category: "البنية التقنية", title: "RLS كامل + جدول user_roles منفصل", desc: "حماية ضد privilege escalation عبر has_role()" },
  { status: "done", category: "البنية التقنية", title: "Realtime updates", desc: "تحديثات لحظية للمصاريف والطلبات" },
  { status: "done", category: "البنية التقنية", title: "نسخ احتياطي واستعادة", desc: "BackupRestore" },
  { status: "done", category: "البنية التقنية", title: "دعم RTL متعدد اللغات", desc: "عربي/فرنسي/إنجليزي" },
  { status: "done", category: "البنية التقنية", title: "محادثة داخلية", desc: "Chat بين الفريق" },

  // ⏳ TODO
  { status: "todo", category: "التقارير", title: "لوحة تقارير تنفيذية (Executive Dashboard)", desc: "KPIs موحدة: المبيعات، الديون، المصاريف، الأرباح، الأداء", priority: "high" },
  { status: "todo", category: "التقارير", title: "تقارير شهرية/سنوية قابلة للتصدير", desc: "PDF + Excel للمصاريف، المبيعات، الديون، الخزينة", priority: "high" },
  { status: "todo", category: "المالية", title: "ربط بنكي / مدفوعات إلكترونية", desc: "تسوية تلقائية مع كشف الحساب البنكي", priority: "medium" },
  { status: "todo", category: "الإشعارات", title: "نظام إشعارات Push موحّد", desc: "تنبيهات للطلبات الجديدة، الموافقات المعلقة، الأهداف", priority: "high" },
  { status: "todo", category: "الجودة", title: "اختبارات آلية (Unit + E2E)", desc: "تغطية المسارات الحساسة: محاسبة، طلبات، صلاحيات", priority: "medium" },
  { status: "todo", category: "الأداء", title: "تحسين الـ bundle size", desc: "ملف App.tsx يحتوي ~100 lazy import، يحتاج تقسيم routes حسب الدور", priority: "medium" },
  { status: "todo", category: "التوثيق", title: "دليل مستخدم تفاعلي لكل دور", desc: "توسيع Guide.tsx بفيديوهات ودورة تعليمية", priority: "low" },

  // 💡 SUGGEST ADD
  { status: "suggest-add", category: "ذكاء الأعمال", title: "تحليلات تنبؤية بالذكاء الاصطناعي", desc: "توقع المبيعات، اكتشاف العملاء المعرضين للفقدان، اقتراح العروض الأنسب", priority: "high" },
  { status: "suggest-add", category: "العمليات الميدانية", title: "تخطيط مسارات التوزيع تلقائياً", desc: "Route Optimization حسب الموقع والأولوية وحجم الطلبات", priority: "high" },
  { status: "suggest-add", category: "العملاء", title: "بوابة عملاء (Customer Portal)", desc: "العميل يطلب، يتابع، يدفع، ويشاهد كشف حسابه بنفسه", priority: "medium" },
  { status: "suggest-add", category: "المخزون", title: "تنبيهات نقص المخزون التلقائية", desc: "Reorder Point + اقتراح كميات الشراء", priority: "high" },
  { status: "suggest-add", category: "المالية", title: "فوترة إلكترونية متوافقة محلياً", desc: "QR code + تكامل مع منظومة الفوترة الحكومية إن وُجدت", priority: "medium" },
  { status: "suggest-add", category: "الموردين", title: "بوابة موردين (Supplier Portal)", desc: "طلبات شراء، استلام، تسويات، تقييم أداء المورد", priority: "medium" },
  { status: "suggest-add", category: "تجربة المستخدم", title: "وضع Offline-first كامل", desc: "العامل يكمل العمل بدون إنترنت ويتزامن لاحقاً", priority: "high" },
  { status: "suggest-add", category: "الأمان", title: "تفعيل 2FA للأدوار الإدارية", desc: "حماية إضافية لحسابات المدراء", priority: "high" },
  { status: "suggest-add", category: "التكامل", title: "تكامل WhatsApp Business", desc: "إرسال الفواتير وتأكيدات الطلبات تلقائياً", priority: "medium" },

  // 🗑️ SUGGEST REMOVE
  { status: "suggest-remove", category: "تنظيف", title: "تصنيفات المصاريف غير المستخدمة", desc: "اتصالات، تنقل ووقود، صيانة، طعام وشراب — معطلة وبدون ترجمات، يفضل حذفها أو إعادة تفعيلها", priority: "low" },
  { status: "suggest-remove", category: "تنظيف", title: "صفحات /admin مكررة في الوظيفة", desc: "مراجعة CashLedger vs DailyReceipts vs ManagerTreasury — احتمال دمج بعضها لتقليل التشتت", priority: "medium" },
  { status: "suggest-remove", category: "تنظيف", title: "ComponentsReference من الإنتاج", desc: "صفحة مرجعية للمطورين، يفضل إخفاؤها خلف dev-only flag", priority: "low" },
  { status: "suggest-remove", category: "تنظيف", title: "تبسيط شريط التنقل في الصفحات الرئيسية", desc: "كل صفحة home لدور بها 15+ زر — يقترح تجميعها في أقسام قابلة للطي", priority: "medium" },
];

const statusMeta: Record<Status, { label: string; icon: typeof CheckCircle2; color: string; bg: string; border: string }> = {
  "done": { label: "تم الإنجاز", icon: CheckCircle2, color: "text-emerald-700", bg: "bg-emerald-50", border: "border-emerald-200" },
  "todo": { label: "قيد التنفيذ", icon: Clock, color: "text-amber-700", bg: "bg-amber-50", border: "border-amber-200" },
  "suggest-add": { label: "مقترح للإضافة", icon: Lightbulb, color: "text-sky-700", bg: "bg-sky-50", border: "border-sky-200" },
  "suggest-remove": { label: "مقترح للإزالة/التبسيط", icon: Trash2, color: "text-rose-700", bg: "bg-rose-50", border: "border-rose-200" },
};

const categoryIcon: Record<string, typeof Package> = {
  "نظام الصلاحيات": ShieldCheck,
  "العملاء والطلبات": Users,
  "المخزون والمستودع": Package,
  "المالية والمحاسبة": Wallet,
  "العروض والمكافآت": Award,
  "التتبع والمتابعة": MapPin,
  "البنية التقنية": Database,
  "التقارير": BarChart3,
  "المالية": Wallet,
  "الإشعارات": Bell,
  "الجودة": ShieldCheck,
  "الأداء": Gauge,
  "التوثيق": FileText,
  "ذكاء الأعمال": BarChart3,
  "العمليات الميدانية": Truck,
  "العملاء": Users,
  "المخزون": Package,
  "الموردين": Truck,
  "تجربة المستخدم": Gauge,
  "الأمان": ShieldCheck,
  "التكامل": MessageSquare,
  "تنظيف": Trash2,
};

export default function ProductChecklist() {
  const [filter, setFilter] = useState<Status | "all">("all");

  const counts = {
    done: items.filter((i) => i.status === "done").length,
    todo: items.filter((i) => i.status === "todo").length,
    "suggest-add": items.filter((i) => i.status === "suggest-add").length,
    "suggest-remove": items.filter((i) => i.status === "suggest-remove").length,
  };
  const total = items.length;
  const completion = Math.round((counts.done / total) * 100);

  const filtered = filter === "all" ? items : items.filter((i) => i.status === filter);

  // group by category for the chosen filter
  const grouped = filtered.reduce<Record<string, Item[]>>((acc, item) => {
    (acc[item.category] = acc[item.category] || []).push(item);
    return acc;
  }, {});

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50/30 p-4 md:p-8" dir="rtl">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-slate-900">
              مراجعة شاملة للنظام – Checklist
            </h1>
            <p className="text-slate-600 mt-2">
              نظرة تنفيذية على ما أُنجز، ما تبقى، وما يُقترح إضافته أو تبسيطه.
            </p>
          </div>
          <Button asChild variant="outline">
            <Link to="/">
              <ArrowRight className="ml-2 h-4 w-4 rotate-180" />
              العودة للرئيسية
            </Link>
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {(["done", "todo", "suggest-add", "suggest-remove"] as Status[]).map((s) => {
            const m = statusMeta[s];
            const Icon = m.icon;
            return (
              <button
                key={s}
                onClick={() => setFilter(filter === s ? "all" : s)}
                className={`text-right rounded-xl border ${m.border} ${m.bg} p-4 transition hover:scale-[1.02] ${
                  filter === s ? "ring-2 ring-offset-2 ring-slate-400" : ""
                }`}
              >
                <div className="flex items-center justify-between">
                  <Icon className={`h-5 w-5 ${m.color}`} />
                  <span className={`text-2xl font-bold ${m.color}`}>{counts[s]}</span>
                </div>
                <div className={`mt-2 text-sm font-medium ${m.color}`}>{m.label}</div>
              </button>
            );
          })}
        </div>

        {/* Progress */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center justify-between">
              <span>نسبة الإنجاز الإجمالية</span>
              <span className="text-emerald-700 text-xl">{completion}%</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Progress value={completion} className="h-3" />
            <p className="text-xs text-slate-500 mt-2">
              {counts.done} مهمة منجزة من إجمالي {total} عنصر في الـ checklist.
            </p>
          </CardContent>
        </Card>

        {/* Filter tabs */}
        <Tabs value={filter} onValueChange={(v) => setFilter(v as Status | "all")}>
          <TabsList className="grid grid-cols-5 w-full">
            <TabsTrigger value="all">الكل ({total})</TabsTrigger>
            <TabsTrigger value="done">منجز ({counts.done})</TabsTrigger>
            <TabsTrigger value="todo">متبقي ({counts.todo})</TabsTrigger>
            <TabsTrigger value="suggest-add">إضافة ({counts["suggest-add"]})</TabsTrigger>
            <TabsTrigger value="suggest-remove">إزالة ({counts["suggest-remove"]})</TabsTrigger>
          </TabsList>

          <TabsContent value={filter} className="mt-4 space-y-6">
            {Object.entries(grouped).map(([cat, list]) => {
              const Icon = categoryIcon[cat] || Package;
              return (
                <div key={cat}>
                  <div className="flex items-center gap-2 mb-3">
                    <Icon className="h-5 w-5 text-slate-700" />
                    <h2 className="text-lg font-semibold text-slate-800">{cat}</h2>
                    <Badge variant="secondary">{list.length}</Badge>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    {list.map((item, idx) => {
                      const m = statusMeta[item.status];
                      const ItemIcon = m.icon;
                      return (
                        <Card
                          key={idx}
                          className={`border ${m.border} ${m.bg}/40 hover:shadow-md transition`}
                        >
                          <CardContent className="p-4">
                            <div className="flex items-start gap-3">
                              <ItemIcon className={`h-5 w-5 mt-0.5 shrink-0 ${m.color}`} />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <h3 className="font-semibold text-slate-900">{item.title}</h3>
                                  {item.priority && (
                                    <Badge
                                      variant={
                                        item.priority === "high"
                                          ? "destructive"
                                          : item.priority === "medium"
                                          ? "default"
                                          : "secondary"
                                      }
                                      className="text-[10px]"
                                    >
                                      {item.priority === "high"
                                        ? "أولوية عالية"
                                        : item.priority === "medium"
                                        ? "متوسطة"
                                        : "منخفضة"}
                                    </Badge>
                                  )}
                                </div>
                                <p className="text-sm text-slate-600 mt-1 leading-relaxed">
                                  {item.desc}
                                </p>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </TabsContent>
        </Tabs>

        <p className="text-center text-xs text-slate-400 pt-4">
          مراجعة أعدّت بناءً على فحص شامل للكود (~100 صفحة، 40+ مجموعة مكوّنات، قاعدة بيانات بصلاحيات RLS كاملة).
        </p>
      </div>
    </div>
  );
}
