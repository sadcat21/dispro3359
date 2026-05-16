# خطة: إضافة دور "مشرف خارجي" (external_supervisor)

## الهدف
دور جديد بنفس تصميم وهوية المشرف الداخلي، مع أزرار مختلفة في الصفحة الرئيسية:
1. **إنشاء طلب** (نفس زر العامل/مندوب المبيعات)
2. **مهام العمال اليومية** (نفس حوار `TodayCustomersDialog` المستخدم في المشرف الداخلي)
3. **جمع المبيعات** (نفس آلية العامل)
4. **إدارة العملاء** بصلاحيات إضافة/تعديل/حذف مع اشتراط الموافقة (نفس نظام طلبات العمال)

## التغييرات

### 1) قاعدة البيانات (migration)
- إضافة `external_supervisor` إلى enum `app_role`.
- إدراج صف في `custom_roles` بكود `external_supervisor` واسم "مشرف خارجي".
- نسخ صلاحيات `worker` الأساسية إلى الدور الجديد (لإدارة العملاء + إنشاء الطلب + جمع المبيعات)، بحيث تمر طلبات العملاء عبر نفس جدول `customer_change_requests` كما هو الحال للعمال.

### 2) الأنواع والمساعدات
- `src/types/database.ts`: إضافة `'external_supervisor'` إلى `AppRole`.
- `src/lib/utils.ts`: إضافة `isExternalSupervisorRole()`.

### 3) الصفحة الرئيسية للدور
- ملف جديد `src/pages/ExternalSupervisorHome.tsx` مبني نسخاً من `InternalSupervisorHome.tsx` مع نفس الهوية البصرية (نفس الـ hero والـ palette الأزرق)، لكن الشبكة تحتوي فقط على 4 أزرار: إنشاء طلب، مهام العمال اليومية، جمع المبيعات، إدارة العملاء.
- `src/pages/Index.tsx`: توجيه الدور الجديد إلى `ExternalSupervisorHome`.

### 4) التوجيه والحماية
- `src/App.tsx`: إضافة قائمة `EXTERNAL_SUPERVISOR_ALLOWED_PATHS` (`/`, `/orders`, `/customers`, `/sales`...) وتطبيقها في `ProtectedRoute`.
- `src/hooks/useNavigation.ts`: فرع navigation خاص بالدور.

### 5) الترجمات وتسميات الدور
- `src/i18n/translations.ts`: مفاتيح `workers.role_external_supervisor`, `role_selection.external_supervisor_desc`, إلخ.
- `src/pages/admin/Workers.tsx` و `src/components/workers/TestWorkersTab.tsx`: إضافة التسمية.
- `src/components/auth/LoginForm.tsx` و `RoleSelectionDialog.tsx`: إضافة الستايل واللون (مقترح: tealor أخضر مميز).

### 6) موافقة تعديلات العملاء
- التحقق من أن `CustomerApprovalTab.tsx` يعالج طلبات `external_supervisor` تلقائياً (لا حاجة لاستثناء — كونه ليس admin، ستمر طلباته كأي عامل).

## ملاحظات تقنية
- لن أُغيّر منطق "إنشاء الطلب" أو "جمع المبيعات" — سأعيد استخدام نفس صفحات/مكونات العامل (`/orders`, `WorkerHome` collect flow) ليتجنّب الازدواجية.
- بعد تطبيق الهجرة يجب تحديث types من Supabase تلقائياً.

هل توافق على البدء؟
