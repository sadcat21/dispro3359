#!/usr/bin/env node
/**
 * فحص i18n: يكتشف النصوص العربية الثابتة (literals) داخل src/
 * خارج المجلدات المسموح بها (src/i18n, src/data) وخارج التعليقات.
 *
 * يستخدم baseline (scripts/i18n-baseline.json) لتجاهل النصوص الموجودة سلفاً
 * بحيث يفشل CI فقط عند إضافة نصوص جديدة. لإعادة بناء الـ baseline:
 *   node scripts/check-i18n.mjs --update-baseline
 *
 * استثناءات أخرى:
 *  - التعليقات (// و /* *‎/)
 *  - أي سطر يحتوي على // i18n-ignore
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(process.cwd(), 'src');
const ALLOWED_DIRS = [path.join(ROOT, 'i18n'), path.join(ROOT, 'data')];
const EXTS = new Set(['.ts', '.tsx', '.js', '.jsx']);
const BASELINE_FILE = path.resolve(process.cwd(), 'scripts/i18n-baseline.json');

const ARABIC_RE = /[\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF]/;

const updateMode = process.argv.includes('--update-baseline');

function isAllowed(file) {
  return ALLOWED_DIRS.some((d) => file === d || file.startsWith(d + path.sep));
}

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

function stripLineComment(line) {
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

// Counts per file (يعتمد على عدد الأسطر المخالفة لكل ملف، أكثر استقراراً من التجزئة)
const counts = {};

for (const file of walk(ROOT)) {
  const text = fs.readFileSync(file, 'utf8');
  const noBlock = text.replace(/\/\*[\s\S]*?\*\//g, (m) => ' '.repeat(m.length));
  const lines = noBlock.split('\n');
  let n = 0;
  const orig = text.split('\n');
  lines.forEach((line, idx) => {
    const raw = orig[idx] || '';
    if (raw.includes('i18n-ignore')) return;
    const stripped = stripLineComment(line);
    if (ARABIC_RE.test(stripped)) n++;
  });
  if (n > 0) counts[path.relative(process.cwd(), file).replace(/\\/g, '/')] = n;
}

if (updateMode) {
  fs.mkdirSync(path.dirname(BASELINE_FILE), { recursive: true });
  fs.writeFileSync(BASELINE_FILE, JSON.stringify(counts, null, 2) + '\n');
  console.log(`✅ Baseline updated (${Object.keys(counts).length} files).`);
  process.exit(0);
}

let baseline = {};
if (fs.existsSync(BASELINE_FILE)) {
  baseline = JSON.parse(fs.readFileSync(BASELINE_FILE, 'utf8'));
}

const newOffenders = [];
const regressed = [];

for (const [file, n] of Object.entries(counts)) {
  const base = baseline[file] || 0;
  if (base === 0) {
    newOffenders.push({ file, n });
  } else if (n > base) {
    regressed.push({ file, n, base });
  }
}

if (newOffenders.length === 0 && regressed.length === 0) {
  console.log('✅ i18n check passed: لا توجد نصوص عربية جديدة خارج src/i18n');
  process.exit(0);
}

console.error('❌ i18n check failed:\n');
if (newOffenders.length) {
  console.error(`ملفات جديدة تحتوي نصوصاً عربية ثابتة (${newOffenders.length}):`);
  for (const o of newOffenders) console.error(`  + ${o.file}  (${o.n} سطر)`);
  console.error('');
}
if (regressed.length) {
  console.error(`ملفات ازدادت فيها النصوص الثابتة (${regressed.length}):`);
  for (const o of regressed) console.error(`  ↑ ${o.file}  (${o.base} → ${o.n})`);
  console.error('');
}
console.error('💡 الحل: انقل النصوص إلى src/i18n/translations.ts واستخدم t("key").');
console.error('   لتعديل القائمة المرجعية بعد إصلاحات كبيرة:');
console.error('   node scripts/check-i18n.mjs --update-baseline');
process.exit(1);
