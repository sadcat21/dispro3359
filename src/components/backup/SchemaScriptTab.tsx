import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  Copy, Download, FileCode, Loader2, ExternalLink, RefreshCw,
  Play, CheckCircle2, XCircle, Eye, EyeOff, ShieldCheck
} from "lucide-react";

const SCRIPT_URL = "/backup/aroma2_schema.sql";

interface ApplyResult {
  total: number;
  executed: number;
  skipped: number;
  errors: { index: number; statement: string; error: string }[];
}

interface VerifyCheck { name: string; expected: number; actual: number; ok: boolean }
interface VerifyResult {
  all_ok: boolean;
  checks: VerifyCheck[];
  actual: {
    tables: number; functions: number; policies: number;
    indexes: number; triggers: number; enums: number; rls_enabled: number;
    tables_detail: { table_name: string; column_count: number }[];
  };
}

const SchemaScriptTab = () => {
  const [content, setContent] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [size, setSize] = useState(0);

  // Apply state
  const [targetUrl, setTargetUrl] = useState("");
  const [targetPwd, setTargetPwd] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [applying, setApplying] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [applyResult, setApplyResult] = useState<ApplyResult | null>(null);
  const [verifyResult, setVerifyResult] = useState<VerifyResult | null>(null);

  const loadScript = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${SCRIPT_URL}?t=${Date.now()}`);
      if (!res.ok) throw new Error("فشل تحميل الملف");
      const text = await res.text();
      setContent(text);
      setSize(new Blob([text]).size);
    } catch (e: any) {
      toast.error(e.message || "تعذر تحميل السكربت");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadScript(); }, []);

  const stats = {
    tables: (content.match(/CREATE TABLE/g) || []).length,
    functions: (content.match(/CREATE OR REPLACE FUNCTION/g) || []).length,
    policies: (content.match(/CREATE POLICY/g) || []).length,
    indexes: (content.match(/CREATE (UNIQUE )?INDEX/g) || []).length,
    triggers: (content.match(/CREATE TRIGGER/g) || []).length,
  };

  const handleCopy = async () => {
    try { await navigator.clipboard.writeText(content); toast.success("تم النسخ"); }
    catch { toast.error("فشل النسخ"); }
  };

  const handleDownload = () => {
    const blob = new Blob([content], { type: "application/sql;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "aroma2_schema.sql";
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleApply = async () => {
    if (!targetUrl || !targetPwd) { toast.error("أدخل بيانات المشروع الهدف"); return; }
    if (!content) { toast.error("السكربت لم يُحمّل بعد"); return; }
    setApplying(true); setApplyResult(null); setVerifyResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("apply-schema", {
        body: { step: "apply", target: { url: targetUrl, db_password: targetPwd }, sql: content },
      });
      if (error) throw new Error(error.message);
      if (!data?.ok) throw new Error(data?.error || "فشل التنفيذ");
      setApplyResult(data);
      if (data.errors?.length) toast.warning(`تم التنفيذ مع ${data.errors.length} أخطاء`);
      else toast.success("تم تنفيذ كل الأوامر بنجاح");
    } catch (e: any) {
      toast.error(e.message || "فشل التنفيذ");
    } finally { setApplying(false); }
  };

  const handleVerify = async () => {
    if (!targetUrl || !targetPwd) { toast.error("أدخل بيانات المشروع الهدف"); return; }
    setVerifying(true); setVerifyResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("apply-schema", {
        body: {
          step: "verify",
          target: { url: targetUrl, db_password: targetPwd },
          expected: stats,
        },
      });
      if (error) throw new Error(error.message);
      if (!data?.ok) throw new Error(data?.error || "فشل التحقق");
      setVerifyResult(data);
      if (data.all_ok) toast.success("التحقق ناجح: كل العناصر موجودة");
      else toast.warning("توجد عناصر ناقصة - راجع التفاصيل");
    } catch (e: any) {
      toast.error(e.message || "فشل التحقق");
    } finally { setVerifying(false); }
  };

  return (
    <div className="space-y-4">
      {/* Script viewer card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileCode className="h-5 w-5" />
            سكربت إنشاء قاعدة البيانات (SQL Schema)
          </CardTitle>
          <CardDescription>
            انسخ السكربت أو نزّله، أو نفّذه مباشرةً على مشروع Supabase جديد عبر الأسفل.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : (
            <>
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">جداول: {stats.tables}</Badge>
                <Badge variant="secondary">دوال: {stats.functions}</Badge>
                <Badge variant="secondary">سياسات: {stats.policies}</Badge>
                <Badge variant="secondary">فهارس: {stats.indexes}</Badge>
                <Badge variant="secondary">Triggers: {stats.triggers}</Badge>
                <Badge variant="outline">{(size / 1024).toFixed(1)} KB</Badge>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button onClick={handleCopy} className="gap-2"><Copy className="h-4 w-4" />نسخ</Button>
                <Button onClick={handleDownload} variant="secondary" className="gap-2"><Download className="h-4 w-4" />تنزيل</Button>
                <Button onClick={() => window.open(SCRIPT_URL, "_blank")} variant="outline" className="gap-2"><ExternalLink className="h-4 w-4" />فتح</Button>
                <Button onClick={loadScript} variant="ghost" size="icon"><RefreshCw className="h-4 w-4" /></Button>
              </div>

              <ScrollArea className="h-[300px] w-full rounded-md border bg-muted/30">
                <pre className="p-4 text-xs leading-relaxed whitespace-pre" dir="ltr"><code>{content}</code></pre>
              </ScrollArea>
            </>
          )}
        </CardContent>
      </Card>

      {/* Direct apply card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Play className="h-5 w-5" />
            تنفيذ مباشر على مشروع Supabase جديد
          </CardTitle>
          <CardDescription>
            أدخل بيانات المشروع الهدف لتنفيذ السكربت ثم التحقق من اكتمال كل الجداول والدوال والسياسات.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3">
            <div className="space-y-2">
              <Label>عنوان المشروع الهدف (URL أو معرّف المشروع)</Label>
              <Input
                placeholder="https://xxxx.supabase.co أو postgresql://..."
                value={targetUrl}
                onChange={(e) => setTargetUrl(e.target.value)}
                dir="ltr"
              />
            </div>
            <div className="space-y-2">
              <Label>كلمة مرور قاعدة البيانات (Database Password)</Label>
              <div className="relative">
                <Input
                  type={showPwd ? "text" : "password"}
                  placeholder="DB password"
                  value={targetPwd}
                  onChange={(e) => setTargetPwd(e.target.value)}
                  dir="ltr"
                  className="pe-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPwd(!showPwd)}
                  className="absolute end-2 top-1/2 -translate-y-1/2 text-muted-foreground"
                >
                  {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <p className="text-xs text-muted-foreground">
                تجدها في: Supabase Dashboard → Project Settings → Database → Connection string
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button onClick={handleApply} disabled={applying || !content} className="gap-2">
              {applying ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
              تنفيذ السكربت
            </Button>
            <Button onClick={handleVerify} disabled={verifying} variant="secondary" className="gap-2">
              {verifying ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
              التحقق من الإنشاء
            </Button>
          </div>

          {/* Apply result */}
          {applyResult && (
            <div className="space-y-2 rounded-md border p-3">
              <div className="flex flex-wrap gap-2 text-sm">
                <Badge variant="outline">إجمالي: {applyResult.total}</Badge>
                <Badge className="bg-green-600 text-white">نُفذت: {applyResult.executed}</Badge>
                <Badge variant="secondary">متجاوزة: {applyResult.skipped}</Badge>
                {applyResult.errors.length > 0 && (
                  <Badge variant="destructive">أخطاء: {applyResult.errors.length}</Badge>
                )}
              </div>
              {applyResult.errors.length > 0 && (
                <ScrollArea className="h-40 rounded border bg-muted/30 p-2">
                  <div className="space-y-2 text-xs" dir="ltr">
                    {applyResult.errors.map((er, i) => (
                      <div key={i} className="border-b pb-1">
                        <div className="text-destructive font-mono">#{er.index}: {er.error}</div>
                        <div className="text-muted-foreground truncate">{er.statement}</div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </div>
          )}

          {/* Verify result */}
          {verifyResult && (
            <div className="space-y-3 rounded-md border p-3">
              <div className="flex items-center gap-2">
                {verifyResult.all_ok ? (
                  <><CheckCircle2 className="h-5 w-5 text-green-600" />
                    <span className="font-semibold text-green-700">تم التحقق: كل العناصر موجودة</span></>
                ) : (
                  <><XCircle className="h-5 w-5 text-destructive" />
                    <span className="font-semibold text-destructive">يوجد نقص في بعض العناصر</span></>
                )}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
                {verifyResult.checks.map((c) => (
                  <div key={c.name} className={`rounded border p-2 ${c.ok ? "bg-green-50 dark:bg-green-950/20" : "bg-destructive/10"}`}>
                    <div className="font-medium flex items-center gap-1">
                      {c.ok ? <CheckCircle2 className="h-3 w-3 text-green-600" /> : <XCircle className="h-3 w-3 text-destructive" />}
                      {c.name}
                    </div>
                    <div className="text-xs text-muted-foreground">{c.actual} / {c.expected}</div>
                  </div>
                ))}
              </div>

              <div className="text-xs text-muted-foreground space-y-1">
                <div>Enums: {verifyResult.actual.enums} • RLS مفعّل على: {verifyResult.actual.rls_enabled} جدول</div>
              </div>

              <details className="text-xs">
                <summary className="cursor-pointer font-medium">تفاصيل الجداول والأعمدة ({verifyResult.actual.tables_detail.length})</summary>
                <ScrollArea className="h-48 mt-2 rounded border bg-muted/30 p-2">
                  <table className="w-full text-xs" dir="ltr">
                    <thead><tr className="border-b"><th className="text-left p-1">Table</th><th className="text-right p-1">Columns</th></tr></thead>
                    <tbody>
                      {verifyResult.actual.tables_detail.map((t) => (
                        <tr key={t.table_name} className="border-b">
                          <td className="p-1 font-mono">{t.table_name}</td>
                          <td className="p-1 text-right">{t.column_count}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </ScrollArea>
              </details>
            </div>
          )}

          <div className="rounded-md border bg-amber-50 dark:bg-amber-950/20 border-amber-300 dark:border-amber-800 p-3 text-xs">
            <p className="font-semibold mb-1">⚠️ ملاحظات أمنية:</p>
            <ul className="list-disc ms-5 space-y-1 text-muted-foreground">
              <li>كلمة مرور قاعدة البيانات لا تُحفظ على الخادم — تُمرَّر مرة واحدة فقط للتنفيذ.</li>
              <li>يفضّل استخدام مشروع Supabase فارغ تمامًا لتجنب التعارض.</li>
              <li>الأخطاء "already exists" تُتجاوز تلقائيًا.</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SchemaScriptTab;
