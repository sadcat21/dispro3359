## ما المطلوب

بعد أن يؤكد المدير المراجعة النهائية للمخزون (`warehouse_review_sessions.is_final = true`) ويترتب على الموظف عجز/دين، يجب **تجميد** كل العمليات التالية على الموظف حتى يسوّي حسابه:

1. **الطلبيات المسلَّمة (delivered orders)** – لا تعديل، لا حذف، لا تغيير حالة، لا تغيير الدفع.
2. **عروض الأسعار / الكوتيشن (quotations / promos)** – لا تعديل ولا حذف ولا تحويل لطلبية.
3. **تأكيدات الهدايا المعلّقة (pending gift confirmations)** – لا قبول، لا رفض، لا تعديل.

## كيف نتعرّف على الموظف "المجمَّد"

موظف يُعتبر مجمَّداً إذا تحقق الشرطان:
- يوجد `warehouse_review_sessions` خاصة به بحالة `is_final = true` و`completed_at IS NOT NULL`.
- يوجد `worker_debts` بنوع `deficit` مرتبط بهذه المراجعة (`remaining_amount > 0` أو `status != 'paid'`).

سننشئ هوك مركزي `useWorkerFrozenStatus(workerId)` يُرجع `{ isFrozen, debtAmount, reviewSessionId }` ليُستخدم في كل الواجهات.

## التغييرات

### 1. هوك جديد
`src/hooks/useWorkerFrozenStatus.ts`
- استعلام يجمع بين `warehouse_review_sessions` (final) و`worker_debts` غير المسددة.
- يُعرض على شكل React Query هوك مع realtime على الجدولين.

### 2. حماية على مستوى الواجهة (UI guard)

| الملف | التغيير |
|------|--------|
| `src/components/orders/DeliveryPaymentDialog.tsx` و كل ديالوغ تعديل طلبية مسلَّمة | تعطيل أزرار الحفظ + رسالة "الموظف مجمَّد بسبب عجز غير مسدد" |
| `src/pages/admin/PromoTable.tsx` و `src/components/promo/*` (Edit/Delete/Convert) | نفس التعطيل لعروض الأسعار التابعة للموظف |
| `src/components/stock/StockConfirmationsPopover.tsx` و `ManagerConfirmationsPanel.tsx` و `FactoryApprovalsDialog.tsx` (الجزء الخاص بـ pending gift confirmations) | تعطيل أزرار "قبول/رفض" مع شارة "مجمَّد" |

كل واجهة تستخدم `useWorkerFrozenStatus(order.assigned_worker_id)` ثم:
```tsx
<Button disabled={isFrozen || ...}>...</Button>
{isFrozen && <Alert>الموظف مجمَّد - يجب تسوية العجز أولاً</Alert>}
```

### 3. حماية على مستوى قاعدة البيانات (RLS + Trigger)

نضيف دالة `public.is_worker_frozen(_worker_id uuid) returns boolean` (SECURITY DEFINER) ثم triggers `BEFORE UPDATE/DELETE` على:
- `orders` (عند `status='delivered'`)
- `promos` / `quotations`
- `stock_confirmations` (نوع gift، حالة pending)

كل trigger يرفع `RAISE EXCEPTION 'WORKER_FROZEN'` إذا الموظف مجمَّد، باستثناء العمليات التي:
- يقوم بها admin / project_manager / company_manager.
- تسجّل دفعة على الدين نفسه.

### 4. فك التجميد

تلقائي – بمجرد أن يصبح `worker_debts.remaining_amount = 0` أو `status = 'paid'`، يعود الموظف لوضع طبيعي بدون تدخل يدوي.

## الملفات المتأثرة

- جديد: `src/hooks/useWorkerFrozenStatus.ts`
- جديد: `src/components/workers/FrozenWorkerBadge.tsx` (شارة مشتركة)
- معدَّل: `DeliveryPaymentDialog.tsx`, `PromoTable.tsx`, `StockConfirmationsPopover.tsx`, `ManagerConfirmationsPanel.tsx`, `FactoryApprovalsDialog.tsx`
- migration: دالة `is_worker_frozen` + 3 triggers.

## ما هو خارج النطاق

- تجميد عمليات أخرى (تحميل، بيع مباشر، تحصيل) – موجودة سابقاً أو ستُعالج لاحقاً.
- إشعارات تلقائية للموظف بأنه مجمَّد.
