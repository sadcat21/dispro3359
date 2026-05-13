
# نظام العروض المؤجلة (Deferred Offer Confirmation)

## الفكرة
عند إنشاء/تعديل عرض، يُضاف Switch جديد: **"عرض مؤجل التأكيد"** (`is_deferred_confirmation`).
- إذا كان مُفعَّلاً: عند تطبيق العرض في البيع، يُسجَّل تفصيل العرض والهدية في السجل، **ولا** تُخصم كمية الهدية من رصيد العامل.
- يظهر السجل في تبويب جديد "العروض بانتظار التأكيد" داخل صفحة إنجازات اليوم.
- لكل زبون كرت؛ بالضغط عليه تُعرض المنتجات التي سُجِّل لها عرض، مع زر **"تأكيد"** لكل منتج على حدة.
- عند التأكيد فقط، تُخصم كمية الهدية من مخزون العامل وتُسجَّل الحركة فعلياً.

## 1. قاعدة البيانات (migration)

### تعديل `product_offers`
- `is_deferred_confirmation boolean default false`

### جدول جديد `pending_offer_confirmations`
أعمدة:
- `id, created_at, updated_at`
- `order_id` (مرجع للطلب الذي طُبِّق فيه العرض، nullable)
- `order_item_id` (nullable)
- `offer_id` (مرجع `product_offers`)
- `product_id`, `product_name`, `pieces_per_box`
- `gift_product_id`, `gift_product_name`
- `gift_boxes int default 0`, `gift_pieces int default 0`
- `customer_id`, `customer_name`
- `worker_id`, `worker_name`
- `branch_id`, `branch_name`
- `source` (`direct_sale|delivery_sale|warehouse_sale|order`)
- `status text default 'pending'` (`pending|confirmed|rejected`)
- `confirmed_at timestamptz null`, `confirmed_by uuid null`
- `notes text null`

RLS:
- قراءة: المستخدمون المصادق عليهم في نفس الفرع.
- إدراج: المستخدمون المصادق عليهم.
- تحديث (للتأكيد/الرفض): المدراء (`has_role admin/branch_manager`) أو صاحب السجل.

دالة `confirm_pending_offer(p_id uuid)`:
- تحدّث `status='confirmed', confirmed_at=now(), confirmed_by=auth.uid()`.
- تُدرج صفاً في `sales_tracking` بكميات الهدية فقط (sold_*=0, gift_*=الكمية) لخصم المخزون كما يفعل النظام الحالي.

## 2. الأنواع والثوابت
- `src/types/productOffer.ts`: إضافة `is_deferred_confirmation?: boolean`.
- `src/types/pendingOffer.ts` (جديد): واجهة `PendingOfferConfirmation`.

## 3. تطبيق العرض في تدفقات البيع
الملفات المتأثرة (المسارات التي تطبّق العروض حالياً):
- `src/components/orders/ProductQuantityDialog.tsx`
- `src/components/orders/ModifyOrderDialog.tsx`
- مكوّنات البيع المباشر/المستودع التي تستخدم `recordSaleTracking`

عند الحفظ:
- إذا العرض المُطبَّق `is_deferred_confirmation=true`:
  - **لا تُمرَّر** كميات الهدية إلى `recordSaleTracking` (تبقى 0).
  - تُستدعى دالة جديدة `recordPendingOfferConfirmation(...)` تُدرج صفاً في `pending_offer_confirmations`.
- إذا `false`: السلوك الحالي بدون تغيير.

ملف جديد: `src/utils/pendingOfferConfirmations.ts` يحتوي `recordPendingOfferConfirmation()` و`confirmPendingOffer(id)`.

## 4. واجهة إنشاء/تعديل العرض
- `src/components/offers/AddProductOfferDialog.tsx` (أو `CreateOfferDialog.tsx`):
  - إضافة Switch ضمن "إعدادات العرض": **"تأكيد لاحق (لا يُخصم من رصيد العامل حتى يُؤكَّد)"**.

## 5. تبويب "العروض بانتظار التأكيد" في إنجازات اليوم
- إيجاد صفحة الإنجازات الحالية (يُرجَّح `src/pages/admin/SalesTrackingLedger.tsx` أو ما يكافئها) واستخدام `<Tabs>`.
- تبويب جديد: قائمة كروت لكل زبون فيه `pending` (تجميع حسب `customer_id`):
  - عنوان الكارت: اسم الزبون + عدد المنتجات المعلَّقة.
  - عند الضغط: Dialog يعرض كل منتج بسطر فيه: اسم المنتج + كمية الهدية بصيغة B.P + زر **"تأكيد"** يستدعي `confirm_pending_offer`.
- Hook جديد: `src/hooks/usePendingOfferConfirmations.ts` (fetch + realtime + confirm).

## 6. عرض الهدية في تفاصيل البيع
- تظل الهدية مرئية في تفاصيل الطلب/البيع كما هي اليوم؛ نضيف فقط شارة "بانتظار التأكيد" حين يكون السجل المرتبط في حالة pending (اختياري في `OrderDetailsDialog.tsx`).

## التفاصيل التقنية
- خصم المخزون اليوم يتم عبر `sales_tracking` + triggers DB موجودة. الدالة `confirm_pending_offer` ستُدرج صفاً مكافئاً للحركة لتفعيل نفس المسار.
- لا تغيير على ملف `src/integrations/supabase/types.ts` (يُعاد توليده تلقائياً بعد migration).

## أسئلة قبل البدء
1. تأكيد المسار: تبويب التأكيد يكون داخل صفحة إنجازات اليوم الحالية أم صفحة مستقلة جديدة؟
2. من له صلاحية التأكيد: العامل نفسه، مدير الفرع فقط، أم كلاهما؟
3. هل الرفض مطلوب الآن (زر "رفض") أم يكفي زر "تأكيد" فقط في هذه المرحلة؟
