## الهدف
إضافة نافذة اختيار العامل/المدير في صفحة "حذف البيانات" (DataManagement) و"إجراءات السجل" (LedgerAdminActions) بحيث يمكن تصفية الحذف لعامل واحد بدلاً من حذف بيانات الجميع.

## النطاق

### 1. DataManagement.tsx — اختيار العامل لكل قسم قابل للتصفية
لكل قسم من الأقسام التالية، أضف زر "تحديد العامل" يفتح Dialog فيه قائمة العمال (مع بحث):

| القسم | الحقل المستخدم للتصفية | الجدول/الجداول |
|------|----------------------|----------------|
| treasury (خزينة المدير) | `manager_id` / `worker_id` | manager_treasury, manager_handovers, handover_items |
| accounting (جلسات المحاسبة) | `worker_id` | accounting_sessions (+items عبر session_id) |
| liability (ذمة العامل) | `worker_id` | worker_liability_adjustments |
| debts (الديون) | `collected_by` / `worker_id` | debt_payments, debt_collections |
| credits (أرصدة) | `worker_id` | customer_credits |
| loading (جلسات الشحن) | `worker_id` | loading_sessions (+items) |
| stock_movements | `worker_id` | stock_movements, stock_discrepancies |
| worker_stock | `worker_id` | worker_stock |
| expenses | `worker_id` / `created_by` | expenses |
| orders + deliveries | `assigned_worker_id` | orders + cascades |

- زر "كل العمال" يبقى السلوك الحالي (يحذف الكل).
- إذا اختار عاملاً معيّناً: الحذف يتم بـ `.eq('worker_id', X)` بدلاً من `.neq('id', ...)`، ولا يتم تنظيف المراجع المرتبطة (nullifyFkReferences) إلا للسجلات المرتبطة بنفس العامل.

### 2. LedgerAdminActions.tsx — اختيار العامل قبل الأرشفة/الحذف
- إضافة Select للعامل أعلى البطاقة (افتراضي: كل العمال).
- إنشاء RPCs جديدة بتوقيع `(p_worker_id uuid DEFAULT NULL)` لكل من:
  - `archive_cash_movements`, `archive_debt_movements`, `archive_stock_movements`
  - `purge_cash_movements`, `purge_debt_movements`, `purge_stock_movements`
  - النسخ `_archive` و `_all` تبقى كما هي (للحذف الكامل من جدول الأرشيف).
- عند `p_worker_id IS NULL` السلوك القديم؛ عند تمرير id يُصفّى بـ `WHERE worker_id = p_worker_id`.

## مكوّن مشترك جديد
`src/components/admin/WorkerPickerDialog.tsx`:
- يجلب العمال من `profiles` + `worker_roles` (يستثني العامل الحالي تلقائياً للأمان).
- بحث بالاسم، عرض الدور، اختيار واحد.
- يُستخدم من كلا الشاشتين.

## السلوك عند عدم الاختيار
- الافتراضي = "كل العمال" → نفس السلوك الحالي (لا توقّف الاستخدام الحالي).

## تفاصيل تقنية
- DataManagement: تخزين `selectedWorkerId: Record<categoryId, string|null>` في state.
- كل قسم قابل للتصفية يظهر تحته شارة: "العامل: [الاسم] (تغيير)".
- `deleteFromTable` يُستبدل بـ `deleteFromTableFiltered(table, workerColumn?, workerId?)`.
- migration واحدة تنشئ النسخ الجديدة من 6 RPCs مع DEFAULT NULL (متوافقة رجعياً).

## ملفات جديدة/معدّلة
- جديد: `src/components/admin/WorkerPickerDialog.tsx`
- معدّل: `src/components/settings/DataManagement.tsx`
- معدّل: `src/components/admin/LedgerAdminActions.tsx`
- migration: تحديث الـ 6 RPCs لقبول `p_worker_id`
