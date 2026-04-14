import React, { useState, useMemo } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { toast } from 'sonner';
import {
  Search, Copy, ShoppingCart, Package, Users, Wallet, Warehouse, Truck,
  CreditCard, Gift, FileText, Settings, BarChart3, MapPin, MessageSquare,
  Clock, Shield, CheckSquare, Split, Receipt, Scale, Trophy, ChevronDown, ChevronUp,
  Building2, UserCog, CalendarDays, BookOpen, ListTodo, Database, Activity,
  Eye, Play
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import DialogPreviewRenderer, { PREVIEWABLE_DIALOGS } from '@/components/admin/DialogPreviewRenderer';

// ─── Dialog/Window Reference Data ───

type PreviewType = 'dialog' | 'page' | 'none';

interface WindowRef {
  name: string;
  codePath: string;
  description: string;
  features: string[];
  connections: ('inventory' | 'treasury' | 'customers' | 'orders' | 'workers' | 'accounting' | 'debts' | 'products')[];
  previewType?: PreviewType;
  previewRoute?: string; // For page-type previews
}

interface CategoryGroup {
  label: string;
  icon: React.ElementType;
  color: string;
  windows: WindowRef[];
}

const CATEGORIES: CategoryGroup[] = [
  {
    label: 'الطلبيات',
    icon: ShoppingCart,
    color: 'bg-blue-100 text-blue-700',
    windows: [
      {
        name: 'إنشاء طلبية',
        codePath: 'src/components/orders/CreateOrderDialog.tsx',
        description: 'نافذة إنشاء طلبية جديدة مع اختيار العميل والمنتجات',
        features: ['اختيار العميل من القائمة', 'إضافة المنتجات بالكميات', 'حساب المبلغ تلقائياً', 'اختيار نوع الدفع (F1/F2)', 'تعيين عامل التوصيل', 'تطبيق الأسعار الخاصة'],
        connections: ['inventory', 'customers', 'orders', 'products'],
      },
      {
        name: 'تفاصيل طلبية',
        codePath: 'src/components/orders/OrderDetailsDialog.tsx',
        description: 'عرض تفاصيل طلبية كاملة مع جميع المعلومات',
        features: ['عرض بيانات العميل', 'قائمة المنتجات والكميات', 'حالة الطلبية', 'معلومات الدفع', 'سجل الأحداث', 'طباعة الطلبية'],
        connections: ['orders', 'customers', 'products'],
      },
      {
        name: 'تعديل طلبية',
        codePath: 'src/components/orders/ModifyOrderDialog.tsx',
        description: 'تعديل طلبية موجودة (المنتجات، الكميات، المبلغ)',
        features: ['تعديل المنتجات', 'تغيير الكميات', 'تحديث المبلغ', 'تسجيل سبب التعديل'],
        connections: ['orders', 'inventory', 'products'],
      },
      {
        name: 'سير الطلبية',
        codePath: 'src/components/orders/OrderFlowDialog.tsx',
        description: 'نافذة إدارة سير عمل الطلبية خطوة بخطوة',
        features: ['تغيير الحالة', 'تأكيد التسليم', 'تأكيد الدفع', 'إرجاع/إلغاء'],
        connections: ['orders', 'inventory', 'treasury', 'customers'],
      },
      {
        name: 'اختيار العميل',
        codePath: 'src/components/orders/CustomerPickerDialog.tsx',
        description: 'نافذة البحث واختيار العميل عند إنشاء طلبية',
        features: ['بحث بالاسم/الهاتف', 'عرض المتجر', 'إنشاء عميل جديد'],
        connections: ['customers'],
      },
      {
        name: 'كمية المنتج',
        codePath: 'src/components/orders/ProductQuantityDialog.tsx',
        description: 'نافذة تحديد كمية المنتج عند إضافته للطلبية',
        features: ['إدخال الكمية', 'عرض السعر', 'حساب المجموع'],
        connections: ['products', 'inventory'],
      },
      {
        name: 'بحث طلبيات',
        codePath: 'src/components/orders/OrderSearchDialog.tsx',
        description: 'بحث متقدم في الطلبيات',
        features: ['بحث بالرمز', 'بحث بالعميل', 'فلترة بالحالة'],
        connections: ['orders'],
      },
      {
        name: 'طباعة طلبيات',
        codePath: 'src/components/orders/PrintOrdersDialog.tsx',
        description: 'طباعة مجموعة طلبيات مختارة',
        features: ['اختيار الطلبيات', 'إعدادات الطباعة', 'معاينة قبل الطباعة'],
        connections: ['orders'],
      },
      {
        name: 'تعيين عامل بعد الحفظ',
        codePath: 'src/components/orders/AssignWorkerAfterSaveDialog.tsx',
        description: 'تعيين عامل توصيل بعد حفظ الطلبية',
        features: ['اختيار العامل', 'تعيين تلقائي'],
        connections: ['orders', 'workers'],
      },
      {
        name: 'تعديل عميل (من الطلبية)',
        codePath: 'src/components/orders/EditCustomerDialog.tsx',
        description: 'تعديل بيانات العميل مباشرة من نافذة الطلبية',
        features: ['تعديل الاسم/العنوان', 'تحديث الهاتف'],
        connections: ['customers'],
      },
      {
        name: 'عملية ما بعد التسليم',
        codePath: 'src/components/orders/PostDeliveryConfirmDialog.tsx',
        description: 'تأكيد عملية ما بعد التسليم',
        features: ['تأكيد التسليم', 'تسجيل الدفع', 'ملاحظات'],
        connections: ['orders', 'treasury'],
      },
      {
        name: 'دفع التوصيل',
        codePath: 'src/components/orders/DeliveryPaymentDialog.tsx',
        description: 'تسجيل دفع عند التوصيل',
        features: ['إدخال المبلغ المستلم', 'طريقة الدفع', 'إنشاء دين إذا لزم'],
        connections: ['orders', 'treasury', 'debts'],
      },
      {
        name: 'بيع عند التوصيل',
        codePath: 'src/components/orders/DeliverySaleDialog.tsx',
        description: 'تسجيل بيع مباشر أثناء التوصيل',
        features: ['إضافة منتجات', 'تسجيل البيع', 'خصم من المخزون'],
        connections: ['orders', 'inventory', 'treasury'],
      },
      {
        name: 'إجراء على العميل',
        codePath: 'src/components/orders/CustomerActionDialog.tsx',
        description: 'إجراءات سريعة على العميل من قائمة الطلبيات',
        features: ['الاتصال', 'عرض الملف', 'إنشاء طلبية جديدة'],
        connections: ['customers', 'orders'],
      },
      {
        name: 'التحقق من الشيك',
        codePath: 'src/components/orders/CheckVerificationDialog.tsx',
        description: 'التحقق من صحة الشيك',
        features: ['إدخال بيانات الشيك', 'التحقق', 'تأكيد'],
        connections: ['treasury'],
      },
      {
        name: 'دفع الإيصال',
        codePath: 'src/components/orders/ReceiptPaymentDialog.tsx',
        description: 'تسجيل دفع بإيصال',
        features: ['تسجيل الإيصال', 'ربط بالطلبية'],
        connections: ['orders', 'treasury'],
      },
    ],
  },
  {
    label: 'المخزون والشحن',
    icon: Warehouse,
    color: 'bg-green-100 text-green-700',
    windows: [
      {
        name: 'تحميل سريع',
        codePath: 'src/components/stock/QuickLoadDialog.tsx',
        description: 'تحميل سريع للمنتجات على شاحنة العامل',
        features: ['اختيار المنتجات', 'تحديد الكميات', 'تأكيد التحميل', 'خصم من المستودع'],
        connections: ['inventory', 'workers'],
      },
      {
        name: 'اختيار منتج',
        codePath: 'src/components/stock/ProductPickerDialog.tsx',
        description: 'نافذة اختيار منتج من القائمة',
        features: ['بحث بالاسم', 'عرض الصور', 'عرض المخزون المتاح'],
        connections: ['products', 'inventory'],
      },
      {
        name: 'اختيار منتج بسيط',
        codePath: 'src/components/stock/SimpleProductPickerDialog.tsx',
        description: 'نافذة اختيار منتج مبسطة',
        features: ['قائمة بسيطة', 'اختيار سريع'],
        connections: ['products'],
      },
      {
        name: 'اختيار عامل',
        codePath: 'src/components/stock/WorkerPickerDialog.tsx',
        description: 'اختيار عامل لعملية التحميل',
        features: ['قائمة العمال النشطين', 'بحث'],
        connections: ['workers'],
      },
      {
        name: 'تحقق المخزون',
        codePath: 'src/components/stock/StockVerificationDialog.tsx',
        description: 'التحقق من صحة المخزون الفعلي مقابل النظام',
        features: ['جرد المنتجات', 'مقارنة الكميات', 'تسجيل الفروقات'],
        connections: ['inventory'],
      },
      {
        name: 'تفاصيل النقص',
        codePath: 'src/components/stock/ShortageDetailsDialog.tsx',
        description: 'عرض تفاصيل النقص في المخزون',
        features: ['المنتجات الناقصة', 'الكميات', 'التقارير'],
        connections: ['inventory'],
      },
      {
        name: 'فجوات المستودع',
        codePath: 'src/components/stock/WarehouseGapDetailsDialog.tsx',
        description: 'تفاصيل الفجوات بين المخزون المتوقع والفعلي',
        features: ['تحليل الفجوات', 'أسباب النقص/الزيادة'],
        connections: ['inventory'],
      },
      {
        name: 'حاسبة البالتات',
        codePath: 'src/components/stock/PalletCalculatorDialog.tsx',
        description: 'حساب عدد البالتات المطلوبة',
        features: ['حساب تلقائي', 'عدد المنتجات لكل بالت'],
        connections: ['inventory'],
      },
      {
        name: 'إعدادات البالتات',
        codePath: 'src/components/stock/PalletSettingsDialog.tsx',
        description: 'إعدادات تكوين البالتات',
        features: ['عدد القطع لكل بالت', 'إعدادات المنتج'],
        connections: ['products'],
      },
      {
        name: 'استلام من المصنع (سريع)',
        codePath: 'src/components/stock/FactoryReceiptQuickDialog.tsx',
        description: 'استلام سريع للمنتجات من المصنع',
        features: ['تسجيل الكميات المستلمة', 'إضافة للمستودع'],
        connections: ['inventory'],
      },
      {
        name: 'تسليم للمصنع (سريع)',
        codePath: 'src/components/stock/FactoryDeliveryQuickDialog.tsx',
        description: 'تسليم سريع للمنتجات للمصنع',
        features: ['تسجيل الكميات المسلمة', 'خصم من المستودع'],
        connections: ['inventory'],
      },
      {
        name: 'تسليم المصنع',
        codePath: 'src/components/stock/FactoryDeliveryDialog.tsx',
        description: 'نافذة تسليم تفصيلية للمصنع',
        features: ['قائمة المنتجات', 'الكميات', 'ملاحظات'],
        connections: ['inventory'],
      },
      {
        name: 'احتياجات التحميل بالجملة',
        codePath: 'src/components/stock/BulkLoadNeedsDialog.tsx',
        description: 'حساب احتياجات التحميل لعدة عمال',
        features: ['حساب تلقائي', 'توزيع على العمال'],
        connections: ['inventory', 'workers'],
      },
      {
        name: 'تحميل جزئي من الطلبيات',
        codePath: 'src/components/stock/PartialLoadFromOrdersDialog.tsx',
        description: 'تحميل جزئي بناءً على طلبيات محددة',
        features: ['اختيار الطلبيات', 'حساب الكميات', 'تحميل'],
        connections: ['inventory', 'orders'],
      },
      {
        name: 'طلب تحميل العامل',
        codePath: 'src/components/stock/WorkerLoadRequestDialog.tsx',
        description: 'طلب تحميل من العامل للمستودع',
        features: ['اختيار المنتجات', 'تحديد الكميات', 'إرسال الطلب'],
        connections: ['inventory', 'workers'],
      },
      {
        name: 'جلسة تبديل العملات',
        codePath: 'src/components/stock/ExchangeSessionDialog.tsx',
        description: 'جلسة تبديل العملات المعدنية',
        features: ['إدخال المبالغ', 'حساب الفرق'],
        connections: ['treasury'],
      },
      {
        name: 'تفريغ الشاحنة',
        codePath: 'src/components/accounting/EmptyTruckDialog.tsx',
        description: 'تفريغ بضاعة الشاحنة وإرجاعها للمستودع',
        features: ['جرد المنتجات المتبقية', 'إرجاع للمستودع', 'تسجيل الفروقات'],
        connections: ['inventory', 'workers'],
      },
    ],
  },
  {
    label: 'المستودع',
    icon: Package,
    color: 'bg-teal-100 text-teal-700',
    windows: [
      {
        name: 'بيع مباشر من المستودع',
        codePath: 'src/components/warehouse/DirectSaleDialog.tsx',
        description: 'بيع مباشر من المستودع بدون طلبية',
        features: ['اختيار المنتجات', 'تسجيل الدفع', 'خصم فوري من المخزون'],
        connections: ['inventory', 'treasury'],
      },
      {
        name: 'تحميل سريع للعامل (مستودع)',
        codePath: 'src/components/warehouse/QuickLoadWorkerDialog.tsx',
        description: 'تحميل سريع من المستودع للعامل',
        features: ['اختيار العامل', 'المنتجات', 'التحميل'],
        connections: ['inventory', 'workers'],
      },
      {
        name: 'استلام سريع (مستودع)',
        codePath: 'src/components/warehouse/QuickReceiptDialog.tsx',
        description: 'استلام سريع للبضاعة في المستودع',
        features: ['تسجيل الكميات', 'إضافة للمخزون'],
        connections: ['inventory'],
      },
      {
        name: 'تعديل مخزون يدوي',
        codePath: 'src/components/warehouse/StockManualEditDialog.tsx',
        description: 'تعديل يدوي لكميات المخزون',
        features: ['تعديل الكمية', 'سبب التعديل', 'تسجيل السجل'],
        connections: ['inventory'],
      },
      {
        name: 'مخزون فارغ',
        codePath: 'src/components/warehouse/StockEmptyDialog.tsx',
        description: 'إشعار/إدارة المنتجات الفارغة',
        features: ['قائمة المنتجات النافذة', 'طلب إعادة تعبئة'],
        connections: ['inventory'],
      },
      {
        name: 'فائض مخزون',
        codePath: 'src/components/warehouse/StockOverflowDialog.tsx',
        description: 'إدارة فائض المخزون',
        features: ['المنتجات الزائدة', 'تسوية'],
        connections: ['inventory'],
      },
      {
        name: 'مراجعة المستودع',
        codePath: 'src/components/warehouse/WarehouseReviewDialog.tsx',
        description: 'مراجعة شاملة لحالة المستودع',
        features: ['جرد كامل', 'مقارنة', 'تقرير'],
        connections: ['inventory'],
      },
    ],
  },
  {
    label: 'العملاء',
    icon: Users,
    color: 'bg-purple-100 text-purple-700',
    windows: [
      {
        name: 'ملف العميل',
        codePath: 'src/components/customers/CustomerProfileDialog.tsx',
        description: 'عرض كامل لملف العميل',
        features: ['البيانات الأساسية', 'سجل الطلبيات', 'الديون', 'الأسعار الخاصة', 'الموقع'],
        connections: ['customers', 'orders', 'debts'],
      },
      {
        name: 'أسعار خاصة للعميل',
        codePath: 'src/components/customers/CustomerSpecialPricesDialog.tsx',
        description: 'إدارة أسعار خاصة لعميل محدد',
        features: ['تعيين سعر خاص', 'ربط بمنتج', 'تاريخ الصلاحية'],
        connections: ['customers', 'products'],
      },
      {
        name: 'مراجعة تغييرات العميل',
        codePath: 'src/components/customers/CustomerChangeReviewDialog.tsx',
        description: 'مراجعة والموافقة على تغييرات بيانات العميل',
        features: ['عرض التغييرات', 'موافقة/رفض', 'سجل التعديلات'],
        connections: ['customers'],
      },
      {
        name: 'إعدادات حقول العميل',
        codePath: 'src/components/customers/CustomerFieldSettingsDialog.tsx',
        description: 'تخصيص الحقول المعروضة في نموذج العميل',
        features: ['إظهار/إخفاء حقول', 'ترتيب الحقول'],
        connections: ['customers'],
      },
      {
        name: 'إدارة القطاعات',
        codePath: 'src/components/customers/ManageSectorsDialog.tsx',
        description: 'إدارة قطاعات التوزيع الجغرافية',
        features: ['إنشاء قطاع', 'تعديل', 'ربط بالعملاء'],
        connections: ['customers'],
      },
    ],
  },
  {
    label: 'الديون',
    icon: CreditCard,
    color: 'bg-red-100 text-red-700',
    windows: [
      {
        name: 'تفاصيل الدين',
        codePath: 'src/components/debts/DebtDetailsDialog.tsx',
        description: 'عرض تفاصيل دين عميل',
        features: ['المبلغ الأصلي', 'المدفوع', 'المتبقي', 'سجل التحصيل'],
        connections: ['debts', 'customers', 'orders'],
      },
      {
        name: 'تحصيل دين',
        codePath: 'src/components/debts/CollectDebtDialog.tsx',
        description: 'تسجيل تحصيل دين من عميل',
        features: ['إدخال المبلغ', 'طريقة الدفع', 'ملاحظات'],
        connections: ['debts', 'treasury', 'customers'],
      },
      {
        name: 'تحصيل دين عميل',
        codePath: 'src/components/debts/CollectCustomerDebtDialog.tsx',
        description: 'تحصيل ديون عميل محدد',
        features: ['قائمة الديون', 'تحصيل جزئي/كامل'],
        connections: ['debts', 'customers', 'treasury'],
      },
      {
        name: 'سير الدين',
        codePath: 'src/components/debts/DebtFlowDialog.tsx',
        description: 'سير عمل تحصيل الدين',
        features: ['تسجيل الزيارة', 'تحصيل', 'تأجيل', 'ملاحظات'],
        connections: ['debts', 'customers'],
      },
      {
        name: 'عملية تحصيل',
        codePath: 'src/components/debts/DebtCollectionDialog.tsx',
        description: 'تسجيل عملية تحصيل',
        features: ['المبلغ', 'التاريخ', 'الطريقة'],
        connections: ['debts', 'treasury'],
      },
      {
        name: 'عملية تحصيل مُنجزة',
        codePath: 'src/components/debts/CollectedDebtOperationDialog.tsx',
        description: 'عرض تفاصيل عملية تحصيل مكتملة',
        features: ['المبلغ المحصل', 'التفاصيل', 'الإيصال'],
        connections: ['debts', 'treasury'],
      },
      {
        name: 'زيارة بدون دفع',
        codePath: 'src/components/debts/VisitNoPaymentDialog.tsx',
        description: 'تسجيل زيارة لعميل بدون دفع',
        features: ['سبب عدم الدفع', 'موعد المتابعة'],
        connections: ['debts', 'customers'],
      },
    ],
  },
  {
    label: 'الخزينة',
    icon: Wallet,
    color: 'bg-amber-100 text-amber-700',
    windows: [
      {
        name: 'طلب فاتورة',
        codePath: 'src/components/treasury/InvoiceRequestDialog.tsx',
        description: 'طلب فاتورة رسمية',
        features: ['بيانات الفاتورة', 'نوع الفاتورة', 'إرسال الطلب'],
        connections: ['treasury', 'orders'],
      },
      {
        name: 'إعدادات الفاتورة',
        codePath: 'src/components/treasury/InvoiceSettingsDialog.tsx',
        description: 'إعدادات نظام الفواتير',
        features: ['قالب الفاتورة', 'الأرقام التسلسلية', 'بيانات الشركة'],
        connections: ['treasury'],
      },
      {
        name: 'تجميع النقدية',
        codePath: 'src/components/treasury/CashConsolidationDialog.tsx',
        description: 'تجميع النقد من العمال',
        features: ['استلام النقد', 'المبلغ المتوقع vs الفعلي', 'تسجيل الفرق'],
        connections: ['treasury', 'workers'],
      },
      {
        name: 'نموذج تجميع النقدية',
        codePath: 'src/components/treasury/CashConsolidationFormDialog.tsx',
        description: 'نموذج إدخال تفاصيل تجميع النقد',
        features: ['فئات النقد', 'المجموع', 'التأكيد'],
        connections: ['treasury'],
      },
      {
        name: 'تبديل العملات المعدنية',
        codePath: 'src/components/treasury/CoinExchangeDialog.tsx',
        description: 'إدارة عمليات تبديل العملات المعدنية',
        features: ['المبلغ', 'العامل', 'المتابعة'],
        connections: ['treasury', 'workers'],
      },
      {
        name: 'طلبية سريعة',
        codePath: 'src/components/treasury/QuickOrderDialog.tsx',
        description: 'إنشاء طلبية سريعة من الخزينة',
        features: ['إدخال سريع', 'تأكيد فوري'],
        connections: ['treasury', 'orders'],
      },
      {
        name: 'تفاصيل طريقة الدفع',
        codePath: 'src/components/treasury/PaymentMethodDetailsDialog.tsx',
        description: 'عرض تفاصيل طريقة دفع محددة',
        features: ['النوع', 'المبالغ', 'التفاصيل'],
        connections: ['treasury'],
      },
      {
        name: 'اختيار عنصر التسليم',
        codePath: 'src/components/treasury/HandoverItemPickerDialog.tsx',
        description: 'اختيار عناصر للتسليم المالي',
        features: ['القائمة', 'الاختيار', 'التأكيد'],
        connections: ['treasury'],
      },
      {
        name: 'تفاصيل الطوابع',
        codePath: 'src/components/treasury/StampDetailsDialog.tsx',
        description: 'تفاصيل طوابع الضريبة',
        features: ['الأنواع', 'الكميات', 'القيم'],
        connections: ['treasury', 'products'],
      },
      {
        name: 'ديون غير محصلة',
        codePath: 'src/components/treasury/UncollectedDebtsDialog.tsx',
        description: 'عرض الديون غير المحصلة',
        features: ['القائمة', 'المبالغ', 'العملاء'],
        connections: ['treasury', 'debts', 'customers'],
      },
      {
        name: 'طلبيات العميل (خزينة)',
        codePath: 'src/components/treasury/TreasuryCustomerOrdersDialog.tsx',
        description: 'طلبيات عميل محدد من واجهة الخزينة',
        features: ['قائمة الطلبيات', 'المبالغ', 'الحالات'],
        connections: ['treasury', 'orders', 'customers'],
      },
      {
        name: 'تعديل تجميع الخزينة',
        codePath: 'src/components/treasury/TreasuryConsolidationEditDialog.tsx',
        description: 'تعديل عملية تجميع خزينة',
        features: ['تعديل المبالغ', 'تحديث التفاصيل'],
        connections: ['treasury'],
      },
      {
        name: 'إعدادات الخزينة',
        codePath: 'src/components/treasury/TreasurySettingsDialog.tsx',
        description: 'إعدادات عامة للخزينة',
        features: ['طرق الدفع', 'الإعدادات العامة'],
        connections: ['treasury'],
      },
    ],
  },
  {
    label: 'المحاسبة',
    icon: Scale,
    color: 'bg-indigo-100 text-indigo-700',
    windows: [
      {
        name: 'إنشاء جلسة محاسبة',
        codePath: 'src/components/accounting/CreateSessionDialog.tsx',
        description: 'إنشاء جلسة محاسبة جديدة لعامل',
        features: ['اختيار العامل', 'تحديد الفترة', 'بدء الجلسة'],
        connections: ['accounting', 'workers'],
      },
      {
        name: 'تفاصيل جلسة المحاسبة',
        codePath: 'src/components/accounting/SessionDetailsDialog.tsx',
        description: 'عرض تفاصيل جلسة محاسبة كاملة',
        features: ['ملخص المبيعات', 'المخزون', 'النقد', 'الفروقات'],
        connections: ['accounting', 'treasury', 'inventory'],
      },
      {
        name: 'ملخص طلبيات العامل',
        codePath: 'src/components/accounting/WorkerOrdersSummaryDialog.tsx',
        description: 'ملخص طلبيات عامل في فترة محددة',
        features: ['عدد الطلبيات', 'الحالات', 'المبالغ'],
        connections: ['accounting', 'orders'],
      },
      {
        name: 'ملخص مبيعات العامل',
        codePath: 'src/components/accounting/WorkerSalesSummaryDialog.tsx',
        description: 'ملخص مبيعات عامل',
        features: ['المنتجات المباعة', 'الكميات', 'القيم'],
        connections: ['accounting', 'inventory'],
      },
      {
        name: 'ملخص مبيعات المدير',
        codePath: 'src/components/accounting/ManagerSalesSummaryDialog.tsx',
        description: 'ملخص مبيعات شامل للمدير',
        features: ['كل العمال', 'إجمالي المبيعات', 'مقارنة'],
        connections: ['accounting', 'treasury'],
      },
      {
        name: 'ملخص هدايا العامل',
        codePath: 'src/components/accounting/WorkerGiftsSummaryDialog.tsx',
        description: 'ملخص الهدايا الموزعة من عامل',
        features: ['المنتجات', 'الكميات', 'العملاء'],
        connections: ['accounting', 'inventory', 'customers'],
      },
      {
        name: 'معاينة تسليم العامل',
        codePath: 'src/components/accounting/WorkerHandoverPreviewDialog.tsx',
        description: 'معاينة بيانات التسليم قبل الإنهاء',
        features: ['النقد', 'المخزون', 'الشيكات', 'المراجعة'],
        connections: ['accounting', 'treasury', 'inventory'],
      },
      {
        name: 'جلسات محاسبة العامل',
        codePath: 'src/components/accounting/WorkerAccountingSessionsDialog.tsx',
        description: 'سجل جميع جلسات محاسبة عامل',
        features: ['قائمة الجلسات', 'الحالات', 'التفاصيل'],
        connections: ['accounting', 'workers'],
      },
      {
        name: 'طباعة قالب',
        codePath: 'src/components/accounting/TemplatePrintDialog.tsx',
        description: 'طباعة بقالب مخصص',
        features: ['اختيار القالب', 'البيانات', 'الطباعة'],
        connections: ['accounting'],
      },
      {
        name: 'إعدادات طباعة الهدايا',
        codePath: 'src/components/accounting/GiftsPrintSettingsDialog.tsx',
        description: 'إعدادات طباعة تقرير الهدايا',
        features: ['الأعمدة', 'التنسيق', 'المعاينة'],
        connections: ['accounting'],
      },
    ],
  },
  {
    label: 'المبيعات',
    icon: Receipt,
    color: 'bg-emerald-100 text-emerald-700',
    windows: [
      {
        name: 'مركز المبيعات',
        codePath: 'src/components/sales/SalesHubDialog.tsx',
        description: 'مركز شامل لإدارة المبيعات',
        features: ['إدخال البيع', 'اختيار المنتجات', 'التسعير', 'الطباعة'],
        connections: ['inventory', 'treasury', 'customers', 'products'],
      },
    ],
  },
  {
    label: 'المنتجات والأسعار',
    icon: Package,
    color: 'bg-cyan-100 text-cyan-700',
    windows: [
      {
        name: 'تحديث أسعار بالجملة',
        codePath: 'src/components/products/GroupPriceUpdateDialog.tsx',
        description: 'تحديث أسعار مجموعة منتجات دفعة واحدة',
        features: ['اختيار المجموعة', 'النسبة/المبلغ', 'تطبيق'],
        connections: ['products'],
      },
      {
        name: 'قالب فاتورة المنتج',
        codePath: 'src/components/products/ProductInvoiceTemplateDialog.tsx',
        description: 'إعداد قالب فاتورة للمنتج',
        features: ['تصميم القالب', 'البيانات', 'المعاينة'],
        connections: ['products', 'treasury'],
      },
      {
        name: 'شرائح الأسعار بالكمية',
        codePath: 'src/components/products/QuantityPriceTiersDialog.tsx',
        description: 'إعداد شرائح أسعار حسب الكمية',
        features: ['نطاقات الكمية', 'السعر لكل شريحة'],
        connections: ['products'],
      },
      {
        name: 'سعر الطابع',
        codePath: 'src/components/products/StampPriceDialog.tsx',
        description: 'إعداد سعر طابع الضريبة للمنتج',
        features: ['السعر', 'النوع', 'التطبيق'],
        connections: ['products', 'treasury'],
      },
      {
        name: 'شرائح الطوابع',
        codePath: 'src/components/products/StampTiersDialog.tsx',
        description: 'إعداد شرائح أسعار الطوابع',
        features: ['الشرائح', 'الأسعار', 'الكميات'],
        connections: ['products', 'treasury'],
      },
    ],
  },
  {
    label: 'العروض والترويج',
    icon: Gift,
    color: 'bg-pink-100 text-pink-700',
    windows: [
      {
        name: 'إنشاء عرض',
        codePath: 'src/components/offers/CreateOfferDialog.tsx',
        description: 'إنشاء عرض ترويجي جديد',
        features: ['نوع العرض', 'المنتجات', 'الفترة', 'الشروط'],
        connections: ['products', 'customers'],
      },
      {
        name: 'إدخال ترويج يدوي',
        codePath: 'src/components/offers/ManualPromoEntryDialog.tsx',
        description: 'إدخال عملية ترويج يدوية',
        features: ['المنتج', 'الكمية', 'العميل'],
        connections: ['products', 'customers', 'inventory'],
      },
      {
        name: 'إضافة عرض ترويجي',
        codePath: 'src/components/promo/AddPromoDialog.tsx',
        description: 'إضافة عرض ترويجي جديد',
        features: ['التفاصيل', 'الشروط', 'الفترة'],
        connections: ['products'],
      },
      {
        name: 'إضافة عميل للعرض',
        codePath: 'src/components/promo/AddCustomerDialog.tsx',
        description: 'إضافة عميل لعرض ترويجي محدد',
        features: ['اختيار العميل', 'الربط بالعرض'],
        connections: ['customers', 'products'],
      },
      {
        name: 'تقسيم ترويج',
        codePath: 'src/components/promo/CreatePromoSplitDialog.tsx',
        description: 'تقسيم عرض ترويجي على عدة عمال',
        features: ['توزيع الكميات', 'اختيار العمال'],
        connections: ['products', 'workers'],
      },
      {
        name: 'تفاصيل تقسيم الترويج',
        codePath: 'src/components/promo/PromoSplitDetailsDialog.tsx',
        description: 'عرض تفاصيل تقسيم ترويج',
        features: ['التوزيع', 'الحالة', 'التقدم'],
        connections: ['products', 'workers'],
      },
    ],
  },
  {
    label: 'المصاريف',
    icon: FileText,
    color: 'bg-orange-100 text-orange-700',
    windows: [
      {
        name: 'إضافة مصروف',
        codePath: 'src/components/expenses/AddExpenseDialog.tsx',
        description: 'إضافة مصروف جديد',
        features: ['الفئة', 'المبلغ', 'الوصف', 'إرفاق إيصال'],
        connections: ['treasury'],
      },
      {
        name: 'مراجعة مصروف',
        codePath: 'src/components/expenses/ReviewExpenseDialog.tsx',
        description: 'مراجعة والموافقة/رفض مصروف',
        features: ['التفاصيل', 'الإيصال', 'موافقة/رفض'],
        connections: ['treasury'],
      },
      {
        name: 'عارض الإيصالات',
        codePath: 'src/components/expenses/ReceiptViewerDialog.tsx',
        description: 'عرض صور الإيصالات',
        features: ['عرض الصورة', 'تكبير/تصغير'],
        connections: ['treasury'],
      },
      {
        name: 'إدارة فئات المصاريف',
        codePath: 'src/components/expenses/ManageCategoriesDialog.tsx',
        description: 'إدارة فئات المصاريف',
        features: ['إنشاء فئة', 'تعديل', 'تفعيل/تعطيل'],
        connections: ['treasury'],
      },
    ],
  },
  {
    label: 'الوثائق',
    icon: FileText,
    color: 'bg-slate-100 text-slate-700',
    windows: [
      {
        name: 'تحصيل وثيقة',
        codePath: 'src/components/documents/DocCollectDialog.tsx',
        description: 'تسجيل تحصيل وثيقة من عميل',
        features: ['نوع الوثيقة', 'التأكيد', 'الملاحظات'],
        connections: ['customers', 'orders'],
      },
      {
        name: 'زيارة بدون تحصيل وثيقة',
        codePath: 'src/components/documents/DocVisitNoCollectionDialog.tsx',
        description: 'تسجيل زيارة لتحصيل وثيقة لم تنجح',
        features: ['السبب', 'الموعد التالي'],
        connections: ['customers'],
      },
      {
        name: 'سير الوثيقة',
        codePath: 'src/components/documents/DocumentFlowDialog.tsx',
        description: 'سير عمل تحصيل الوثيقة',
        features: ['تحصيل', 'تأجيل', 'إلغاء'],
        connections: ['customers', 'orders'],
      },
    ],
  },
  {
    label: 'العمال والحضور',
    icon: UserCog,
    color: 'bg-violet-100 text-violet-700',
    windows: [
      {
        name: 'تعديل ملف العامل',
        codePath: 'src/components/workers/EditWorkerProfileDialog.tsx',
        description: 'تعديل بيانات ملف العامل',
        features: ['البيانات الشخصية', 'الدور', 'الحالة'],
        connections: ['workers'],
      },
      {
        name: 'إنجازات العامل',
        codePath: 'src/components/workers/WorkerAchievementsDialog.tsx',
        description: 'عرض إنجازات ومكافآت العامل',
        features: ['النقاط', 'المراتب', 'التاريخ'],
        connections: ['workers'],
      },
      {
        name: 'إعدادات الحضور',
        codePath: 'src/components/attendance/AttendanceSettingsDialog.tsx',
        description: 'إعدادات نظام الحضور والانصراف',
        features: ['أوقات العمل', 'المسافة المسموحة', 'الموقع'],
        connections: ['workers'],
      },
      {
        name: 'موقع حضور العامل',
        codePath: 'src/components/attendance/WorkerAttendanceLocationDialog.tsx',
        description: 'عرض موقع تسجيل حضور العامل على الخريطة',
        features: ['الموقع على الخريطة', 'المسافة', 'الوقت'],
        connections: ['workers'],
      },
      {
        name: 'سجل حضور العامل',
        codePath: 'src/components/attendance/WorkerAttendanceLogDialog.tsx',
        description: 'سجل تفصيلي لحضور وانصراف العامل',
        features: ['التواريخ', 'الأوقات', 'الحالة'],
        connections: ['workers'],
      },
    ],
  },
  {
    label: 'المكافآت والنقاط',
    icon: Trophy,
    color: 'bg-yellow-100 text-yellow-700',
    windows: [
      {
        name: 'إنشاء مهمة مكافأة',
        codePath: 'src/components/rewards/CreateRewardTaskDialog.tsx',
        description: 'إنشاء مهمة جديدة للنقاط والمكافآت',
        features: ['نوع المهمة', 'النقاط', 'الشروط'],
        connections: ['workers'],
      },
      {
        name: 'تعديل مهمة مكافأة',
        codePath: 'src/components/rewards/EditRewardTaskDialog.tsx',
        description: 'تعديل مهمة مكافأة موجودة',
        features: ['التفاصيل', 'النقاط', 'الحالة'],
        connections: ['workers'],
      },
      {
        name: 'تعديل عقوبة',
        codePath: 'src/components/rewards/EditRewardPenaltyDialog.tsx',
        description: 'تعديل عقوبة/خصم نقاط',
        features: ['النقاط المخصومة', 'السبب'],
        connections: ['workers'],
      },
      {
        name: 'مسابقة مكافآت',
        codePath: 'src/components/rewards/RewardContestDialog.tsx',
        description: 'إدارة مسابقة مكافآت بين العمال',
        features: ['الشروط', 'الجوائز', 'الترتيب'],
        connections: ['workers'],
      },
      {
        name: 'نقاط العامل',
        codePath: 'src/components/rewards/WorkerPointsDialog.tsx',
        description: 'عرض تفصيلي لنقاط عامل',
        features: ['النقاط المكتسبة', 'المخصومة', 'السجل'],
        connections: ['workers'],
      },
      {
        name: 'ملف العامل المالي',
        codePath: 'src/components/rewards/WorkerFinancialDialog.tsx',
        description: 'عرض الوضع المالي للعامل',
        features: ['الراتب', 'المكافآت', 'الخصومات', 'الرصيد'],
        connections: ['workers', 'treasury'],
      },
    ],
  },
  {
    label: 'القطاعات والتتبع',
    icon: MapPin,
    color: 'bg-lime-100 text-lime-700',
    windows: [
      {
        name: 'تغطية القطاع',
        codePath: 'src/components/sectors/SectorCoverageDialog.tsx',
        description: 'عرض تغطية قطاع محدد',
        features: ['العملاء في القطاع', 'نسبة التغطية'],
        connections: ['customers'],
      },
      {
        name: 'جدول القطاع',
        codePath: 'src/components/sectors/SectorScheduleDialog.tsx',
        description: 'جدول زيارات القطاع',
        features: ['أيام الزيارة', 'التوزيع', 'التكرار'],
        connections: ['customers', 'workers'],
      },
      {
        name: 'عملاء اليوم',
        codePath: 'src/components/sectors/TodayCustomersDialog.tsx',
        description: 'قائمة عملاء اليوم حسب القطاع',
        features: ['العملاء المجدولين', 'الحالة', 'الترتيب'],
        connections: ['customers'],
      },
      {
        name: 'إعدادات التتبع',
        codePath: 'src/components/map/TrackingSettingsDialog.tsx',
        description: 'إعدادات تتبع موقع العمال',
        features: ['فترة التحديث', 'الدقة', 'البطارية'],
        connections: ['workers'],
      },
    ],
  },
  {
    label: 'المهام والمحادثات',
    icon: ListTodo,
    color: 'bg-sky-100 text-sky-700',
    windows: [
      {
        name: 'إضافة مهمة',
        codePath: 'src/components/tasks/AddTaskDialog.tsx',
        description: 'إضافة مهمة جديدة للعامل',
        features: ['العنوان', 'الوصف', 'الموعد', 'الأولوية'],
        connections: ['workers'],
      },
      {
        name: 'محادثة جديدة',
        codePath: 'src/components/chat/NewChatDialog.tsx',
        description: 'إنشاء محادثة جديدة',
        features: ['اختيار المشاركين', 'نوع المحادثة'],
        connections: ['workers'],
      },
    ],
  },
  {
    label: 'المصادقة والنظام',
    icon: Shield,
    color: 'bg-gray-100 text-gray-700',
    windows: [
      {
        name: 'اختيار الفرع',
        codePath: 'src/components/auth/BranchSelectionDialog.tsx',
        description: 'اختيار الفرع عند تسجيل الدخول',
        features: ['قائمة الفروع', 'التبديل بين الفروع'],
        connections: [],
      },
      {
        name: 'اختيار الدور',
        codePath: 'src/components/auth/RoleSelectionDialog.tsx',
        description: 'اختيار الدور عند تسجيل الدخول',
        features: ['الأدوار المتاحة', 'الصلاحيات'],
        connections: [],
      },
      {
        name: 'إعدادات أعمدة الطباعة',
        codePath: 'src/components/print/PrintColumnsConfigDialog.tsx',
        description: 'تخصيص أعمدة الطباعة',
        features: ['اختيار الأعمدة', 'الترتيب', 'العرض'],
        connections: [],
      },
      {
        name: 'إيصال الطباعة',
        codePath: 'src/components/printing/ReceiptDialog.tsx',
        description: 'معاينة وطباعة الإيصال',
        features: ['المعاينة', 'الطباعة', 'المشاركة'],
        connections: ['orders', 'treasury'],
      },
    ],
  },
];

const CONNECTION_LABELS: Record<string, { label: string; color: string }> = {
  inventory: { label: 'المخزون', color: 'bg-green-200 text-green-800' },
  treasury: { label: 'الخزينة', color: 'bg-amber-200 text-amber-800' },
  customers: { label: 'العملاء', color: 'bg-purple-200 text-purple-800' },
  orders: { label: 'الطلبيات', color: 'bg-blue-200 text-blue-800' },
  workers: { label: 'العمال', color: 'bg-violet-200 text-violet-800' },
  accounting: { label: 'المحاسبة', color: 'bg-indigo-200 text-indigo-800' },
  debts: { label: 'الديون', color: 'bg-red-200 text-red-800' },
  products: { label: 'المنتجات', color: 'bg-cyan-200 text-cyan-800' },
};

// Route map for pages that can be previewed via navigation
const PAGE_ROUTES: Record<string, string> = {
  'src/pages/AdminHome.tsx': '/',
  'src/pages/Orders.tsx': '/orders',
  'src/pages/Customers.tsx': '/customers',
  'src/pages/BranchStock.tsx': '/stock',
  'src/pages/ManagerTreasury.tsx': '/manager-treasury',
  'src/pages/Deliveries.tsx': '/deliveries',
  'src/pages/WorkerManagement.tsx': '/worker-management',
  'src/pages/MyStock.tsx': '/my-stock',
  'src/pages/MySales.tsx': '/my-sales',
  'src/pages/Expenses.tsx': '/expenses',
  'src/pages/FactoryOrders.tsx': '/factory-orders',
  'src/pages/OrderTracking.tsx': '/order-tracking',
  'src/pages/AccountingSessions.tsx': '/accounting-sessions',
  'src/pages/DailyReports.tsx': '/daily-reports',
  'src/pages/SharedInvoices.tsx': '/shared-invoices',
  'src/pages/DebtManagement.tsx': '/debt-management',
  'src/pages/ManagerReview.tsx': '/manager-review',
  'src/pages/SalesAggregation.tsx': '/sales-aggregation',
  'src/pages/WorkerDebts.tsx': '/worker-debts',
  'src/pages/CustomerAccounts.tsx': '/customer-accounts',
  'src/pages/SurplusDeficit.tsx': '/surplus-deficit',
};

const ComponentsReference: React.FC = () => {
  const { language } = useLanguage();
  const isRTL = language === 'ar';
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set([CATEGORIES[0].label]));
  const [connectionFilter, setConnectionFilter] = useState<string | null>(null);
  const [previewDialog, setPreviewDialog] = useState<WindowRef | null>(null);
  const [livePreviewPath, setLivePreviewPath] = useState<string | null>(null);

  const toggleCategory = (label: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  };

  const expandAll = () => setExpandedCategories(new Set(CATEGORIES.map(c => c.label)));
  const collapseAll = () => setExpandedCategories(new Set());

  const filteredCategories = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return CATEGORIES.map(cat => ({
      ...cat,
      windows: cat.windows.filter(w => {
        const matchSearch = !q || w.name.includes(q) || w.codePath.toLowerCase().includes(q) || w.description.includes(q);
        const matchConnection = !connectionFilter || w.connections.includes(connectionFilter as any);
        return matchSearch && matchConnection;
      }),
    })).filter(cat => cat.windows.length > 0);
  }, [searchQuery, connectionFilter]);

  const totalWindows = CATEGORIES.reduce((sum, c) => sum + c.windows.length, 0);

  const copyPath = (path: string) => {
    navigator.clipboard.writeText(path);
    toast.success('تم نسخ المسار');
  };

  const handlePreview = (win: WindowRef) => {
    const route = win.previewRoute || PAGE_ROUTES[win.codePath];
    if (route) {
      navigate(route);
    } else if (PREVIEWABLE_DIALOGS.has(win.codePath)) {
      setLivePreviewPath(win.codePath);
    } else {
      setPreviewDialog(win);
    }
  };

  const canLivePreview = (win: WindowRef) => PREVIEWABLE_DIALOGS.has(win.codePath);

  const isPage = (win: WindowRef) => !!(win.previewRoute || PAGE_ROUTES[win.codePath]);

  return (
    <div className="space-y-3 pb-20" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="space-y-1">
        <h1 className="text-xl font-bold">📋 مرجع النوافذ والمكونات</h1>
        <p className="text-xs text-muted-foreground">
          {totalWindows} نافذة في {CATEGORIES.length} فئة — انقر على اسم الملف لنسخه • انقر 👁️ لمعاينة حية
        </p>
      </div>

      {/* Search & Filters */}
      <Card>
        <CardContent className="p-3 space-y-2">
          <div className="relative">
            <Search className="absolute end-2 top-2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="بحث بالاسم أو المسار..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="h-8 text-sm pe-8"
            />
          </div>
          <div className="flex flex-wrap gap-1">
            <Badge
              variant={connectionFilter === null ? 'default' : 'outline'}
              className="text-[10px] cursor-pointer"
              onClick={() => setConnectionFilter(null)}
            >
              الكل
            </Badge>
            {Object.entries(CONNECTION_LABELS).map(([key, { label, color }]) => (
              <Badge
                key={key}
                variant="outline"
                className={`text-[10px] cursor-pointer ${connectionFilter === key ? color + ' border-transparent' : ''}`}
                onClick={() => setConnectionFilter(connectionFilter === key ? null : key)}
              >
                {label}
              </Badge>
            ))}
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" className="text-[10px] h-6" onClick={expandAll}>توسيع الكل</Button>
            <Button variant="ghost" size="sm" className="text-[10px] h-6" onClick={collapseAll}>طي الكل</Button>
          </div>
        </CardContent>
      </Card>

      {/* Categories */}
      {filteredCategories.map(cat => {
        const isExpanded = expandedCategories.has(cat.label);
        const Icon = cat.icon;
        return (
          <Card key={cat.label}>
            <div
              className="flex items-center justify-between p-3 cursor-pointer hover:bg-muted/30 transition-colors"
              onClick={() => toggleCategory(cat.label)}
            >
              <div className="flex items-center gap-2">
                <div className={`p-1.5 rounded-md ${cat.color}`}>
                  <Icon className="h-4 w-4" />
                </div>
                <span className="font-semibold text-sm">{cat.label}</span>
                <Badge variant="secondary" className="text-[10px]">{cat.windows.length}</Badge>
              </div>
              {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </div>
            {isExpanded && (
              <div className="px-3 pb-3 space-y-2">
                <Separator />
                {cat.windows.map((win, idx) => {
                  const pageMode = isPage(win);
                  return (
                  <div key={idx} className="border rounded-lg p-3 space-y-2 bg-muted/10">
                    <div className="flex items-start justify-between gap-2">
                      <div className="font-medium text-sm">{win.name}</div>
                      <Button
                        variant={pageMode || canLivePreview(win) ? 'default' : 'outline'}
                        size="sm"
                        className={`h-7 text-[10px] gap-1 shrink-0 ${pageMode || canLivePreview(win) ? '' : 'text-primary border-primary/30 hover:bg-primary/10'}`}
                        onClick={() => handlePreview(win)}
                      >
                        {canLivePreview(win) ? <Play className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                        {pageMode ? 'فتح الصفحة' : canLivePreview(win) ? 'فتح النافذة' : 'معلومات'}
                      </Button>
                    </div>
                    <button
                      className="flex items-center gap-1.5 text-[11px] font-mono text-primary bg-primary/5 rounded px-2 py-1 hover:bg-primary/10 transition-colors w-full text-start"
                      onClick={() => copyPath(win.codePath)}
                    >
                      <Copy className="h-3 w-3 shrink-0" />
                      <span className="truncate">{win.codePath}</span>
                    </button>
                    <p className="text-xs text-muted-foreground">{win.description}</p>
                    <div className="space-y-1">
                      <div className="text-[10px] font-medium text-muted-foreground">الميزات:</div>
                      <ul className="text-[11px] space-y-0.5 list-disc list-inside text-muted-foreground">
                        {win.features.map((f, i) => <li key={i}>{f}</li>)}
                      </ul>
                    </div>
                    {win.connections.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {win.connections.map(conn => {
                          const c = CONNECTION_LABELS[conn];
                          return c ? (
                            <Badge key={conn} variant="outline" className={`text-[9px] py-0 px-1.5 ${c.color} border-transparent`}>
                              {c.label}
                            </Badge>
                          ) : null;
                        })}
                      </div>
                    )}
                  </div>
                  );
                })}
              </div>
            )}
          </Card>
        );
      })}
      {/* Preview Dialog for sub-windows */}
      <Dialog open={!!previewDialog} onOpenChange={(open) => !open && setPreviewDialog(null)}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-base">{previewDialog?.name}</DialogTitle>
            <DialogDescription className="text-xs">{previewDialog?.description}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="bg-muted/30 rounded-lg p-4 text-center space-y-2">
              <Eye className="h-8 w-8 mx-auto text-primary/40" />
              <p className="text-sm font-medium">هذه نافذة فرعية (Dialog)</p>
              <p className="text-xs text-muted-foreground">
                لمعاينتها حياً، افتحها من مكانها الأصلي في التطبيق
              </p>
            </div>
            <div className="space-y-1.5">
              <div className="text-[11px] font-medium">📁 مسار الملف:</div>
              <button
                className="flex items-center gap-1.5 text-[11px] font-mono text-primary bg-primary/5 rounded px-2 py-1.5 hover:bg-primary/10 transition-colors w-full text-start"
                onClick={() => { if (previewDialog) copyPath(previewDialog.codePath); }}
              >
                <Copy className="h-3 w-3 shrink-0" />
                <span className="truncate">{previewDialog?.codePath}</span>
              </button>
            </div>
            {previewDialog && previewDialog.features.length > 0 && (
              <div className="space-y-1">
                <div className="text-[11px] font-medium">✨ الميزات:</div>
                <ul className="text-[11px] space-y-0.5 list-disc list-inside text-muted-foreground">
                  {previewDialog.features.map((f, i) => <li key={i}>{f}</li>)}
                </ul>
              </div>
            )}
            {previewDialog && previewDialog.connections.length > 0 && (
              <div className="space-y-1">
                <div className="text-[11px] font-medium">🔗 الارتباطات:</div>
                <div className="flex flex-wrap gap-1">
                  {previewDialog.connections.map(conn => {
                    const c = CONNECTION_LABELS[conn];
                    return c ? (
                      <Badge key={conn} variant="outline" className={`text-[9px] py-0 px-1.5 ${c.color} border-transparent`}>
                        {c.label}
                      </Badge>
                    ) : null;
                  })}
                </div>
              </div>
            )}
      {/* Live Dialog Preview */}
      <DialogPreviewRenderer
        codePath={livePreviewPath || ''}
        open={!!livePreviewPath}
        onOpenChange={(open) => { if (!open) setLivePreviewPath(null); }}
      />
    </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ComponentsReference;
