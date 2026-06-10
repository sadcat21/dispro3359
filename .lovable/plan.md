
# خطة تنفيذية: تخصيص الجلسة المحاسبية حسب دور العامل

## 1. المبدأ الموحَّد
كل عامل يستلم **نقداً أو وثائق أو تحصيلات** يخضع لجلسة محاسبية إلزامية. الفرق الوحيد بين الأدوار هو **وجود/غياب مرحلتي الشحن والتفريغ والمراجعة النهائية للبضاعة**.

## 2. تصنيف الأدوار إلى فئتين

### الفئة أ — "محاسبة مالية فقط" (بدون بضاعة)
- مندوب المبيعات (`sales_rep`)
- المشرف الداخلي (`internal_supervisor`)
- المشرف الخارجي (`external_supervisor`) — حسب الواقع
- مساعد المدير (`company_manager`) عند تحصيله نقداً

**الالتزامات المطلوبة:**
- النقد المُحصَّل (مبيعات نقدية + تحصيل ديون)
- الوثائق المستلمة (فواتير، وصولات، شيكات)
- ديون العملاء الجديدة
- المصاريف المُنفقة من العامل
- الالتزامات المالية الأخرى (سُلف، تعويضات)

**الالتزامات المُستثناة (مخفية في الواجهة):**
- ❌ تأكيد تفريغ الشاحنة (`unload_confirmed`)
- ❌ مراجعة المخزون المتبقي
- ❌ بطاقة "البضاعة المحمَّلة vs المباعة"
- ❌ الفائض/العجز في القطع

### الفئة ب — "محاسبة كاملة" (مالية + بضاعة)
- مندوب التوصيل (`delivery_rep`)
- مسؤول المخزن (`warehouse_manager`)

**الالتزامات المطلوبة:** كل ما في الفئة أ **+**
- تأكيد تفريغ الشاحنة
- مراجعة مخزون الشاحنة (`preview_recalibrate_worker_stock`)
- الفائض والعجز في القطع
- مطابقة `loading_sessions` مع `delivered orders`
- المراجعة النهائية (`final_review_sessions`)

## 3. خريطة التنفيذ في الكود

### أ. دالة تصنيف مركزية جديدة
ملف جديد: `src/utils/workerAccountingProfile.ts`
```ts
export type AccountingProfile = 'financial_only' | 'full_with_stock';
export function getWorkerAccountingProfile(worker): AccountingProfile
```
المنطق: يقرأ `worker.role` و `custom_role_code` ويُرجع التصنيف.
- `delivery_rep | warehouse_manager` → `full_with_stock`
- الباقي (مع وجود مسؤولية نقدية) → `financial_only`

### ب. تعديل واجهة `CreateSessionDialog.tsx`
- استدعاء `getWorkerAccountingProfile(selectedWorker)`
- إخفاء/إظهار شرطي لـ:
  - بطاقة "تفريغ الشاحنة" (`UnloadConfirmation`)
  - بطاقة "مراجعة المخزون" (`StockReview`)
  - حقل `unload_notes` و `unload_confirmed`
- إبقاء بطاقات: النقد، الوثائق، الديون، المصاريف، الطلبيات قيد التوصيل لكل الأدوار.

### ج. تعديل `useSessionCalculations.ts`
- استقبال البروفايل كمعامل
- في `financial_only`: تخطّي حساب `truck_stock`, `loaded_vs_sold`, `surplus_deficit_pieces`
- إرجاع `items` لا تحتوي على بنود البضاعة

### د. تعديل `useCreateSession` (`useAccountingSessions.ts`)
- عند `financial_only`: تمرير `unload_confirmed: null` و `unload_notes: null`
- تخطّي `recalibrate_worker_stock` بعد الإنشاء (لا حاجة لها)

### هـ. تعديل `useWorkerFrozenStatus.ts`
- التجميد يبقى معطّلاً كسياسة حالية
- لكن منطق الحساب يأخذ البروفايل بعين الاعتبار: عجز البضاعة لا يُجمِّد عاملاً من الفئة أ

### و. التحقق من الأهلية للجلسة
في اختيار العامل بـ `CreateSessionDialog`:
- إظهار شارة "محاسبة مالية فقط" أو "محاسبة كاملة" بجانب اسم العامل
- منع إنشاء جلسة لعامل بلا أي مسؤولية مالية ولا بضاعة (مثل مدير إداري بحت)

## 4. الترجمات (إلزامي حسب SYSTEM_DISPRO.md)
إضافة في `src/i18n/translations.ts` تحت `accounting.profile.*`:
- `financial_only` / `full_with_stock` / `financial_only_badge` / `excluded_stock_notice`

## 5. لا حاجة لتغييرات في قاعدة البيانات
- نستخدم الأعمدة الحالية (`unload_confirmed` nullable مسبقاً)
- لا migration مطلوب — التمييز يحدث على مستوى الواجهة والـ hooks فقط

## 6. خطوات التنفيذ بالترتيب
1. إنشاء `workerAccountingProfile.ts` مع التصنيف
2. تعديل `useSessionCalculations` لاستقبال البروفايل
3. تعديل `CreateSessionDialog` (إخفاء البطاقات شرطياً + شارة)
4. تعديل `useCreateSession` (تخطّي حقول الشاحنة + recalibrate)
5. إضافة الترجمات
6. اختبار يدوي: إنشاء جلسة لمندوب مبيعات، ثم لمندوب توصيل، والتأكد من الفرق

## 7. خارج النطاق (مستقبلاً)
- إعادة تفعيل التجميد فعلياً
- ربط البروفايل بـ `role_permissions` بدل hardcoding
- جلسة محاسبية مشتركة بين عاملين (مندوب + سائق)
