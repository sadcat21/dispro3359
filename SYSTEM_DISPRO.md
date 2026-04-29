# 🔒 تشديدات نظام DisPro — قواعد إلزامية لكل تعديل أو إضافة

> هذا الملف يحتوي على القواعد الصارمة التي يجب الالتزام بها في **أي تعديل أو إضافة** مهما كانت النسخة أو حجم التغيير. أضف لاحقاً أي تشديدات جديدة في نهاية الملف.

---

## 1. الترجمات والديناميكية اللغوية (إلزامي)

**القاعدة:** كل نص يظهر للمستخدم في الواجهة **يجب** أن يكون مترجماً ديناميكياً عبر نظام الترجمة، ولا يجوز كتابة أي نص ثابت (hardcoded) بأي لغة في مكونات الواجهة.

### ✅ الواجب فعله:
1. عند إضافة أي نص جديد في الواجهة:
   - أضف مفتاح الترجمة في `src/i18n/translations.ts` بجميع اللغات الثلاث: `ar`, `fr`, `en`.
   - استخدم الدالة `t('your.key')` من `useLanguage()` لعرض النص.
2. عند إضافة صفحة جديدة (مثل `/worker-roles-management`):
   - عناوين الصفحة، أزرار، رسائل toast، tooltips، placeholders، خيارات select... **كل شيء** يمر عبر `t()`.
   - أضف مفتاح للقائمة الجانبية والروابط في `AdminHome` و`useNavigation`.
3. اختبر الواجهة بعد التغيير في اللغات الثلاث (ar / fr / en) للتأكد من عدم ظهور نصوص ثابتة.

### ❌ ممنوع:
```tsx
// ممنوع — نص ثابت
<Button>إدارة أدوار العمال</Button>
{ label: 'إدارة أدوار العمال' }
toast.success('تم الحفظ بنجاح');
```

### ✅ الصحيح:
```tsx
<Button>{t('worker_roles.title')}</Button>
{ label: t('nav.worker_roles_management') }
toast.success(t('common.saved_successfully'));
```

### بنية مفاتيح الترجمة:
- `nav.*` → عناصر التنقل والقائمة الجانبية
- `admin_home.*` → صفحة لوحة الإدارة
- `<feature>.<key>` → نصوص خاصة بميزة (مثل `worker_roles.add_role`)
- `common.*` → نصوص متكررة (حفظ، إلغاء، تأكيد...)

---

## 2. الأدوار التنفيذية المخصصة (Custom Roles)

### 2026-04-29 — دور "مساعد المدير العام" (company_manager)
- **النوع:** custom_role (سجل في `custom_roles` بكود `company_manager`) + قيمة جديدة في enum `app_role` (يُضاف عبر migration).
- **الواجهة:** صفحة `CompanyManagerHome.tsx` بثيم Emerald + Gold (مختلف عن AdminHome) — تُفتح تلقائياً عبر `Index.tsx` عند `activeRole.custom_role_code === 'company_manager'`، ويُعرض للمستخدم باسم "مساعد المدير العام".
- **الترجمات:** كل المفاتيح تحت `company_manager.*` في `src/i18n/translations.ts`.
- **التنقل:** قائمة جانبية مخصصة في `useNavigation.ts` تحت فرع `activeRole.custom_role_code === 'company_manager'`.
- **القاعدة:** عند إضافة أي دور تنفيذي جديد، اتبع نفس النمط:
  1. enum value + custom_role + role_permissions (migration)
  2. توجيه من `Index.tsx` لصفحة مخصصة بثيم مميز
  3. فرع خاص في `useNavigation.ts`
  4. تحديث `RoleSelectionDialog.tsx` بأيقونة/لون مميز
  5. كل النصوص عبر `t()` في `translations.ts`

