# تأكيد البيع المنقسم حسب طريقة الدفع

## الهدف
عند احتواء السلة على أصناف بطرق دفع مختلفة (مثلاً F1-Cash + F1-VRST، أو F1 + F2)، تظهر نافذة تأكيد بأقسام منفصلة — قسم لكل مجموعة دفع. يتم تفعيل زر "تأكيد الكل" فقط بعد إكمال جميع الأقسام، ويُسجَّل كل قسم كسجل مبيعات مستقل ضمن نفس الطلبية.

## نطاق التغيير
- `src/components/warehouse/DirectSaleDialog.tsx` (بيع مباشر)
- `src/components/orders/CreateOrderDialog.tsx` (إنشاء طلبية توصيل)
- مكوّن مشترك جديد: `src/components/sales/SplitPaymentConfirmDialog.tsx`
- أداة مساعدة جديدة: `src/utils/splitOrderByPaymentGroup.ts`

## المنطق

### 1) تجميع الأصناف
دالة `groupItemsByPaymentKey(items, fallbackPayment)`:
- المفتاح = `${paymentType}|${invoicePaymentMethod ?? '-'}|${invoicePaymentSubType ?? '-'}`
- يُستخدم `item.itemPaymentType/itemInvoicePaymentMethod/itemInvoicePaymentSubType` مع fallback للقيم العامة (كما هو منفّذ سابقاً).
- يُعيد: `Array<{ key, label (F1/F2/F1-VRST Cash/F1-VRST Doc/…), items, subtotal, stampAmount, total }>`.

### 2) النافذة الجديدة `SplitPaymentConfirmDialog`
- إذا كان عدد المجموعات = 1 → استخدام التدفّق الحالي بدون تغيير.
- إذا ≥ 2: عرض كرت لكل مجموعة يحتوي:
  - شارة الطريقة (F1، F1-VRST Cash، F2…).
  - قائمة الأصناف + الإجمالي الجزئي + الطابع إن وجد.
  - الحقول الخاصّة بكل طريقة (Versement رقم/تاريخ، رقم Chèque، مبلغ نقدي…) — نفس الحقول الحالية لكن مكرّرة لكل قسم.
  - شارة حالة: `incomplete | ready`.
- زر "تأكيد الكل" مُعطَّل ما لم يصبح كل قسم `ready`.

### 3) التسجيل في قاعدة البيانات
- يبقى `orders` (أو البيع المباشر) كسجلٍ واحد بإجمالي السلة كاملاً.
- في حلقة `sales_tracking`: عوض إدراج سطر واحد للطلبية، نُدرج سطراً لكل مجموعة دفع — مع `payment_type/invoice_payment_method/invoice_payment_subtype/amount` الخاصة بالمجموعة، ومرجع `order_id` نفسه.
- باقي المسارات (تخفيض المخزون، الديون، الإيصالات…) تبقى كما هي لأن منطقها يدور حول `order_items` لا المجموعات.

### 4) نقاط الإدماج
- `DirectSaleDialog` السطر ~666 (`handleConfirmSale`) والسطر ~872 (`sales_tracking`): استبدال إنشاء الكرت الواحد بقراءة المجموعات من حالة `SplitPaymentConfirmDialog`، ثم تكرار إدخال `sales_tracking` للمجموعات.
- `CreateOrderDialog`: نفس الفكرة في خطوة التأكيد النهائية.

## مخطط التدفق
```text
السلة ── groupItemsByPaymentKey ──► [G1, G2, ...]
                                        │
                              عدد المجموعات؟
                              │            │
                            =1            ≥2
                              │            │
                       تدفّق حالي     SplitConfirmDialog
                                          │
                                  تعبئة كل قسم ─► ready
                                          │
                              "تأكيد الكل" ─► إنشاء order واحد
                                          │
                                   لكل G: insert sales_tracking
```

## ما هو خارج النطاق
- لا تغيير في مخطط قاعدة البيانات (الأعمدة الحالية في `sales_tracking` كافية).
- لا تغيير في تدفّق التسليم/المخزون/الديون.
- التحقق من توافق Stamp يتم لكل مجموعة على حدة (cash داخل F1 فقط — كما هو حالياً).

## التحقق
1. سلة بمنتج F1-Cash + منتج F1-VRST-Doc → نافذتان، زر معطّل حتى الاكتمال، سطران في `sales_tracking`.
2. سلة بمنتج F1 + منتج F2 → نافذتان منفصلتان.
3. سلة بطريقة واحدة → نفس السلوك السابق دون أي اختلاف بصري.