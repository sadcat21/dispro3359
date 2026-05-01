import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Copy, Download, FileCode, Loader2, ExternalLink, RefreshCw } from "lucide-react";

const SCRIPT_URL = "/backup/aroma2_schema.sql";

const SchemaScriptTab = () => {
  const [content, setContent] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [size, setSize] = useState(0);

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

  useEffect(() => {
    loadScript();
  }, []);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      toast.success("تم نسخ السكربت إلى الحافظة");
    } catch {
      toast.error("فشل النسخ - حاول التحديد اليدوي");
    }
  };

  const handleDownload = () => {
    const blob = new Blob([content], { type: "application/sql;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "aroma2_schema.sql";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("بدأ التنزيل");
  };

  const handleOpen = () => {
    window.open(SCRIPT_URL, "_blank", "noopener,noreferrer");
  };

  const stats = {
    tables: (content.match(/CREATE TABLE/g) || []).length,
    functions: (content.match(/CREATE OR REPLACE FUNCTION/g) || []).length,
    policies: (content.match(/CREATE POLICY/g) || []).length,
    indexes: (content.match(/CREATE (UNIQUE )?INDEX/g) || []).length,
    triggers: (content.match(/CREATE TRIGGER/g) || []).length,
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileCode className="h-5 w-5" />
            سكربت إنشاء قاعدة البيانات (SQL Schema)
          </CardTitle>
          <CardDescription>
            سكربت كامل لإنشاء جميع الجداول، الدوال، الفهارس، Triggers، وسياسات RLS في مشروع Supabase جديد.
            الصقه في SQL Editor واضغط Run.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
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
                <Button onClick={handleCopy} className="gap-2">
                  <Copy className="h-4 w-4" />
                  نسخ السكربت كاملاً
                </Button>
                <Button onClick={handleDownload} variant="secondary" className="gap-2">
                  <Download className="h-4 w-4" />
                  تنزيل ملف .sql
                </Button>
                <Button onClick={handleOpen} variant="outline" className="gap-2">
                  <ExternalLink className="h-4 w-4" />
                  فتح في تبويبة جديدة
                </Button>
                <Button onClick={loadScript} variant="ghost" size="icon" title="إعادة التحميل">
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>

              <ScrollArea className="h-[500px] w-full rounded-md border bg-muted/30">
                <pre className="p-4 text-xs leading-relaxed whitespace-pre" dir="ltr">
                  <code>{content}</code>
                </pre>
              </ScrollArea>

              <div className="rounded-md border bg-muted/30 p-3 text-sm space-y-1">
                <p className="font-semibold">طريقة الاستخدام:</p>
                <ol className="list-decimal ms-5 space-y-1 text-muted-foreground">
                  <li>أنشئ مشروع Supabase جديد</li>
                  <li>افتح SQL Editor من لوحة التحكم</li>
                  <li>الصق السكربت كاملاً ثم اضغط Run</li>
                  <li>اربط المشروع الجديد بنسخة Lovable الجديدة</li>
                </ol>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default SchemaScriptTab;
