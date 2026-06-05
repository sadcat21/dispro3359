
## الهدف
- لا تظهر فاتورة/وثيقة في صفحات «تتبع الفواتير» و«تتبع الوثائق» إلا بعد أن يتخذ مدير الفرع قرارًا صريحًا في جلسة محاسبة العامل.
- داخل الجلسة: صف قابل للنقر يفتح نافذة تأكيد فيها زرّان: «تأكيد الاستلام» (أخضر) و«لم تُستلم» (أحمر).
- القرار يُحدِّث صفحات التتبع تلقائيًا.

## تغييرات قاعدة البيانات
عمودان جديدان على `orders`:

| عمود | النوع | الافتراضي | معناه |
|---|---|---|---|
| `invoice_manager_decision` | text nullable | NULL | NULL = لم يقرر بعد، `received` = استلمها مختومة، `not_received` = لم تُستلم |
| `document_manager_decision` | text nullable | NULL | NULL = لم يقرر بعد، `received` = استلم الوثيقة، `not_received` = لم تُستلم |

دالة RPC جديدة `set_manager_invoice_decision(p_order_id, p_decision, p_invoice_number, p_issue_date)`:
- `received` → يستدعي منطق `confirm_order_invoice_receipt` (يضع invoice_stage='sealed' وinvoice_received_at و invoice_number) ويضع `invoice_manager_decision='received'`.
- `not_received` → يضع `invoice_manager_decision='not_received'` ويُبقي invoice_stage على `unsealed`.

دالة RPC جديدة `set_manager_document_decision(p_order_id, p_decision)`:
- `received` → `document_stage='received'`, `document_status='received'`, `document_manager_decision='received'`.
- `not_received` → `document_manager_decision='not_received'`, `document_stage='pending'`.

تحديث RPC `confirm_order_invoice_receipt` ليضع أيضًا `invoice_stage='sealed'` و`invoice_manager_decision='received'`.

## تغييرات الواجهة

### 1) `src/components/accounting/DocumentCollectionsSummary.tsx`
- بطاقات المستندات تصبح صفوفًا قابلة للنقر تفتح نافذة تأكيد جديدة (مماثلة لنافذة الفاتورة المختومة) فيها:
  - تفاصيل العميل والمبلغ ونوع الوثيقة.
  - زر «تأكيد الاستلام» (أخضر) ← يستدعي `set_manager_document_decision('received')`.
  - زر «لم تُستلم» (أحمر) ← يستدعي `set_manager_document_decision('not_received')`.
- نفس النافذة في قسم «الفواتير المختومة» تكتسب زر «لم تُستلم» الأحمر بجانب «تأكيد الاستلام» (يستدعي `set_manager_invoice_decision('not_received')`).
- إزالة منطق `receivedDocs` المحلي لأن القرار صار يُحفظ في قاعدة البيانات.

### 2) `src/components/accounting/InvoiceTrackingDialog.tsx` و `src/pages/InvoiceTracking.tsx`
- إضافة فلتر `invoice_manager_decision = 'not_received'` لجلب «غير ممهورة»، و`'received'` لتبويبات «ممهورة» / «جاهزة».
- إخفاء الطلبات حيث `invoice_manager_decision IS NULL`.

### 3) `src/components/accounting/DocumentTrackingDialog.tsx` و `src/pages/DocumentTracking.tsx`
- فلتر مماثل على `document_manager_decision`:
  - تبويبة «غير مستلمة» تعرض الصفوف ذات القرار `not_received`.
  - تبويبتا «مستلمة/جاهزة» تعرضان الصفوف ذات القرار `received`.

## الملفات المتأثرة
- `supabase/migrations/<new>.sql` (الأعمدة + الدوال)
- `src/components/accounting/DocumentCollectionsSummary.tsx`
- `src/components/accounting/InvoiceTrackingDialog.tsx`
- `src/components/accounting/DocumentTrackingDialog.tsx`
- `src/pages/InvoiceTracking.tsx`
- `src/pages/DocumentTracking.tsx`

## ملاحظة على البيانات الموجودة
سأترك الأعمدة الجديدة NULL على الطلبات القديمة (لن تظهر في التتبع). إن كنت تريد إعادة إدراج الطلبات القديمة كـ«غير مستلمة/غير مممهورة» تلقائيًا بناءً على الحالة الحالية، أخبرني وسأضيف خطوة `UPDATE` في الترحيل.
