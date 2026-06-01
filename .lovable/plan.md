# خطة دعم تعدد اللغات الشامل

## الوضع الحالي

- نظام جاهز: `LanguageContext` يدعم `ar / fr / en` + دالتي `t()` للواجهة و`tp()` للطباعة، مع تبديل اتجاه `rtl/ltr` تلقائياً.
- ملف الترجمات الرئيسي: `src/i18n/translations.ts` (≈2885 سطر) + `landingTranslations.ts` للصفحة العامة.
- فاحص `scripts/check-i18n.mjs` مع baseline يكشف النصوص العربية الثابتة.
- النتيجة الحالية: **89 ملف جديد** بنصوص عربية ثابتة + **54 ملف** ازدادت فيه النصوص → الكثير من الأزرار/الحوارات/الصفحات ليست متعددة اللغات.

## الهدف

كل نص ظاهر للمستخدم (صفحات، حوارات، أزرار، toasts، tooltips، labels، رسائل خطأ) يمر عبر `t()` ويُترجم للغات الثلاث، مع منع إدخال نصوص ثابتة جديدة عبر CI.

## مراحل التنفيذ

### المرحلة 1 — البنية التحتية (سريعة)
1. إضافة `ar/fr/en` تلقائياً لمفاتيح `translations.ts` الناقصة (سكربت تدقيق يكشف المفاتيح غير المكتملة).
2. إضافة helper `tArr(key)` للقوائم، و`tWithVars(key, vars)` لاستبدال `{name}` بدل التركيب اليدوي.
3. إضافة قاعدة ESLint مخصصة (أو تعزيز `check-i18n`) تفشل عند:
   - JSX text عربي ثابت
   - props مثل `placeholder=`، `title=`، `aria-label=`، `label=`، `description=` بقيمة عربية ثابتة
   - `toast.success/error/warning` بنص ثابت
4. تشغيل الفاحص في CI (موجود حالياً في `.github/workflows/i18n-check.yml` — التأكد من تفعيله بدون baseline متساهلة).

### المرحلة 2 — مسح وتصنيف الملفات الـ143
تقسيمها لخمس مجموعات حسب الأولوية، كل مجموعة = PR/دفعة مستقلة:

| المجموعة | الملفات (أمثلة) | الأولوية |
|---|---|---|
| A. صفحات الإدارة الأساسية | `admin/LoadStock`, `admin/Products`, `admin/ManagerAccountingReview`, `admin/BackupRestore`, `admin/PromoTable`, `admin/CustomerJourney`, `admin/WorkerActions`, `admin/WarehouseStock` | عالية |
| B. صفحات المستخدم | `Orders`, `MyDeliveries`, `MyAchievements`, `AdminHome` | عالية |
| C. الحوارات (Dialogs) | كل `*Dialog.tsx` في `accounting/`, `orders/`, `sales/`, `stock/`, `customers/`, `treasury/` | عالية |
| D. المكونات المشتركة | `BottomNav`, `MobileLayout`, `RefreshButton`, `permissions/*` | متوسطة |
| E. الـ Hooks (toasts/رسائل) | `useOrders`, `useStockConfirmations`, `useWarehouseStock`, `useManagerConfirmations`... | متوسطة |

### المرحلة 3 — منهجية الاستبدال داخل كل ملف
1. استخراج كل نص عربي ثابت إلى مفتاح في `translations.ts` تحت مساحة اسم متسقة:
   - `orders.dialog.confirm_title`
   - `accounting.review.toast.saved`
   - `admin.load_stock.button.submit`
2. توليد ترجمات `fr` و`en` تلقائياً عبر edge function `translate-text` (موجودة)، ثم مراجعة بشرية للمصطلحات المالية/المخزنية.
3. تبديل النص في JSX بـ `{t('orders.dialog.confirm_title')}`.
4. تشغيل الفاحص بعد كل ملف: عداده يجب أن ينخفض.

### المرحلة 4 — اختبار التبديل
- صفحة `admin/Settings` فيها مبدّل اللغة — اختبار يدوي لكل صفحة بـ `ar → fr → en` والتحقق من:
  - عدم تكسر الـ layout (نصوص طويلة بالفرنسية).
  - تبديل اتجاه `rtl/ltr` للأرقام/الأيقونات.
  - الطباعة (`tp`) تستعمل `printLanguage` المنفصل.

### المرحلة 5 — قفل الجودة
- تصفير `scripts/i18n-baseline.json` بعد المرحلة 2.
- إضافة pre-commit hook يشغّل `check-i18n.mjs`.
- توثيق القواعد في `README.md` (قسم i18n): "كل نص جديد يجب أن يمر عبر t()".

## التقدير

- المرحلة 1: ~1 ساعة عمل.
- المرحلة 2+3: تقريباً 2–4 ساعات لكل مجموعة × 5 مجموعات. يمكن البدء بمجموعة واحدة كـ proof-of-concept.
- المرحلة 4+5: ~1 ساعة.

## الخطوة التالية بعد الموافقة

أبدأ فوراً بـ **المرحلة 1** (البنية + تعزيز الفاحص) ثم **المجموعة A** (صفحات الإدارة الأساسية) كأول دفعة قابلة للمراجعة، إلا إذا فضّلت أن أبدأ بمجموعة أخرى.
