#!/usr/bin/env node
/**
 * فحص i18n: يكتشف النصوص العربية الثابتة (literals) داخل src/
 * خارج المجلدات المسموح بها (src/i18n, src/data) وخارج التعليقات.
 *
 * يفشل (exit 1) عند العثور على أي نص عربي ثابت في كود JSX/TS.
 *
 * استثناءات:
 *  - التعليقات (// أو ‎/* *‎/)
 *  - الملفات داخل src/i18n و src/data
 *  - الأسطر التي تنتهي بـ // i18n-ignore
 *  - مفاتيح الكائنات/الخصائص ذات النصوص العربية المستخدمة كمعرّفات داخلية
 *    (مثل title: 'المحاسبة...' في AdminHome — تُستخدم كمفتاح خريطة)
 *    عبّر عن ذلك بإضافة // i18n-ignore في نفس السطر.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(process.cwd(), 'src');
const ALLOWED_DIRS = [path.join(ROOT, 'i18n'), path.join(ROOT, 'data')];
const EXTS = new Set(['.ts', '.tsx', '.js', '.jsx']);

// نطاق Unicode للأحرف العربية
const ARABIC_RE = /[\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF]/;

/** هل المسار داخل مجلد مسموح به؟ */
function isAllowed(file) {
  return ALLOWED_DIRS.some((d) => file === d || file.startsWith(d + path.sep));
}

/** اجمع كل الملفات المرشحة للفحص */
function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (isAllowed(full)) continue;
      walk(full, out);
    } else if (EXTS.has(path.extname(entry.name))) {
      out.push(full);
    }
  }
  return out;
}

/** أزل التعليقات من السطر (تبسيط — ليس محلل JS كامل لكنه كافٍ لاكتشاف //) */
function stripLineComment(line) {
  // أبسط محاولة: لا نزيل // إذا كانت داخل سلسلة نصية
  let inStr = null;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    const prev = line[i - 1];
    if (inStr) {
      if (c === inStr && prev !== '\\') inStr = null;
    } else {
      if (c === '"' || c === "'" || c === '`') inStr = c;
      else if (c === '/' && line[i + 1] === '/') return line.slice(0, i);
    }
  }
  return line;
}

const offenders = [];

for (const file of walk(ROOT)) {
  const text = fs.readFileSync(file, 'utf8');

  // أزل التعليقات متعددة الأسطر /* ... */
  const noBlockComments = text.replace(/\/\*[\s\S]*?\*\//g, (m) => ' '.repeat(m.length));
  const lines = noBlockComments.split('\n');

  lines.forEach((rawLine, idx) => {
    if (rawLine.includes('i18n-ignore')) return;
    const line = stripLineComment(rawLine);
    if (!ARABIC_RE.test(line)) return;
    offenders.push({
      file: path.relative(process.cwd(), file),
      line: idx + 1,
      content: rawLine.trim().slice(0, 200),
    });
  });
}

if (offenders.length === 0) {
  console.log('✅ i18n check passed: لا توجد نصوص عربية ثابتة خارج src/i18n');
  process.exit(0);
}

console.error(`❌ i18n check failed: تم العثور على ${offenders.length} نص عربي ثابت خارج src/i18n\n`);
for (const o of offenders.slice(0, 200)) {
  console.error(`  ${o.file}:${o.line}  ${o.content}`);
}
if (offenders.length > 200) {
  console.error(`  ... و ${offenders.length - 200} نتيجة أخرى`);
}
console.error('\n💡 الحل: انقل النص إلى src/i18n/translations.ts واستخدم t("key")');
console.error('   أو أضف // i18n-ignore في نهاية السطر إذا كان النص معرّفاً داخلياً.');
process.exit(1);
