# خطة: نظام تحكم موسّع للعروض

## 1. تعديل قاعدة البيانات (product_offers)
إضافة أعمدة جديدة:
- `scope_stages` (text[]): قائمة المراحل التي يظهر فيها العرض. القيم الممكنة:
  - `worker_loading` — تحميل العامل
  - `order_creation` — إنشاء الطلب
  - `direct_sale` — البيع المباشر
  - `warehouse_sale` — بيع من المستودع
- `auto_fill_quantities` (boolean, default true): إذا مفعّل، الضغط على زر التفعيل يُدخل الكميات تلقائياً. إذا معطّل، يُدخل المستخدم الكميات يدوياً.
- `is_mandatory` (boolean, default false): إذا مفعّل، لا يمكن إتمام العملية (شحن/بيع/إضافة منتج) دون تفعيل العرض.

## 2. واجهة إنشاء/تعديل العرض (`AddProductOfferDialog`)
إضافة قسم جديد "مرحلة النطاق" يحتوي:
- 4 Checkboxes للمراحل (`scope_stages`)
- Switch: "إدخال تلقائي للكميات" (`auto_fill_quantities`)
- Switch: "تفعيل إجباري" (`is_mandatory`)

## 3. عرض العرض في المراحل
في كل مرحلة (`worker_loading`, `order_creation`, `direct_sale`, `warehouse_sale`):
- التحقق من أن `scope_stages` يحتوي على المرحلة الحالية قبل عرض العرض
- إظهار زر "تفعيل العرض" بدل التطبيق التلقائي
- عند الضغط:
  - إذا `auto_fill_quantities=true`: تعبئة الكميات في الحقول
  - إذا `auto_fill_quantities=false`: السماح بإدخال يدوي
- إذا `is_mandatory=true` ولم يُفعّل العرض: منع الإكمال مع رسالة تحذيرية

## 4. الملفات المتأثرة
- migration جديدة لإضافة الأعمدة
- `src/types/productOffer.ts` — تحديث الواجهة
- `src/components/offers/AddProductOfferDialog.tsx` (أو ما يعادلها) — قسم النطاق
- `src/components/orders/ProductQuantityDialog.tsx` — زر التفعيل + منطق الإجبارية في إنشاء الطلب
- مكوّنات تحميل العامل والبيع المباشر والمستودع — نفس المنطق

## أسئلة قبل البدء
1. هل يكفي عرض زر "تفعيل" واحد لكل عرض، أم نحتاج تتبّع حالة "مفعّل/مرفوض" في `order_items`؟
2. عند `is_mandatory=true` في مرحلة لا تنطبق فيها شروط العرض (الكميات أقل)، هل يبقى المنتج قابلاً للإضافة عادةً؟
