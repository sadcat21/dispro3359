## الهدف
إضافة زر "طلب من المصنع" لمدير الفرع يسمح بإرسال طلب منتجات يمر بدورة موافقة (المساعد ← مدير النظام) وعند الموافقة يظهر زر واتساب يفتح محادثة مع مندوب المصنع برسالة جاهزة.

## التغييرات

### 1) قاعدة البيانات (migration)
- إضافة قيمة جديدة `'factory_request'` لعمود `order_type` في `factory_orders` (بجانب `sending` و`receiving` الحاليين)، أو استخدام `'receiving'` مع `status='draft'` يبدأها مدير الفرع. **القرار:** استخدام `order_type='factory_request'` لفصل المنطق.
- إضافة جدول/إعداد `factory_sales_rep_phone` على مستوى الفرع: عمود نصي `factory_sales_phone TEXT` في `branches` (أبسط حل).
- تعديل RPC `approve_factory_order` / `submit_factory_order_for_approval` لقبول النوع الجديد (نفس مسار الموافقة الحالي: pending_approval → assistant → system_manager → confirmed).

### 2) واجهة مدير الفرع
- مكوّن جديد `FactoryRequestDialog.tsx` في `src/components/stock/` مبني على نمط `FactoryDeliveryDialog`:
  - اختيار المنتجات والكميات (BoxPieceInput + SimpleProductPickerDialog) — نفس تجربة الإيصالات.
  - حقل لرقم هاتف المندوب (يُحفظ في `branches.factory_sales_phone` ويُملأ تلقائياً).
  - ملاحظات اختيارية.
  - عند الحفظ: إنشاء `factory_orders` بـ `order_type='factory_request'`, `status='pending_approval'` + `factory_order_items`.
- إضافة زر "📦 طلب من المصنع" في `BranchManagerHome.tsx` بجانب أزرار المصنع الحالية.

### 3) صفحة الموافقات
- في `FactoryApprovalsDialog.tsx` و`BranchManagerApprovals.tsx`: عرض الطلبات الجديدة من النوع `factory_request` بنفس آلية الموافقة متعددة المراحل (موجودة بالفعل عبر hook `useApproveFactoryOrder`).

### 4) إشعار + زر واتساب على بطاقة الطلب
- في `BranchManagerHome.tsx`: استعلام للطلبات `order_type='factory_request' AND status IN ('confirmed','in_production','ready_for_delivery')` للفرع الحالي.
- عرض بطاقة/شارة "تمت الموافقة على طلبك للمصنع" + زر أيقونة واتساب أخضر.
- عند الضغط: بناء نص الرسالة `طلب من فرع {branch.name}:\n- {product.name}: {qty}\n...` ثم فتح:
  `https://wa.me/{phone}?text={encodeURIComponent(message)}`

## الملفات
- **migration**: إضافة `factory_sales_phone` لـ `branches` + سماح القيمة الجديدة في CHECK constraint إن وُجد.
- **جديد**: `src/components/stock/FactoryRequestDialog.tsx`, `src/components/stock/FactoryRequestApprovedBanner.tsx`
- **تعديل**: `src/pages/BranchManagerHome.tsx` (زر + بانر), `src/components/stock/FactoryApprovalsDialog.tsx` (دعم النوع الجديد), `src/pages/admin/BranchManagerApprovals.tsx`

## تفاصيل تقنية
- رسالة الواتساب بالعربية، الأرقام تُنسَّق بـ `dbBPDisplay` (صناديق وقطع).
- رقم الهاتف يُنظَّف من رموز غير الأرقام قبل تمريره لـ `wa.me`.
- نفس نمط realtime subscription الموجود لتحديث الحالة فوراً عند الموافقة.

هل أتابع التنفيذ؟