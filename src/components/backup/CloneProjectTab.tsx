import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Loader2, Database, Server, ArrowLeftRight, Play, Eye, EyeOff,
  CheckCircle, XCircle, AlertTriangle, Zap, Table2
} from "lucide-react";

interface AnalysisResult {
  tables: { table_name: string; row_count: number }[];
  functions: { func_name: string; func_lang: string }[];
  total_tables: number;
  total_functions: number;
}

type MigrationStep = "idle" | "analyzing" | "analyzed" | "migrating" | "completed" | "error";

const DATA_BATCH_SIZE = 100;
const MIN_DATA_BATCH_SIZE = 25;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const CloneProjectTab = () => {
  const [sourceUrl, setSourceUrl] = useState("");
  const [sourceDbPassword, setSourceDbPassword] = useState("");
  const [showSourcePassword, setShowSourcePassword] = useState(false);
  const [targetUrl, setTargetUrl] = useState("");
  const [targetDbPassword, setTargetDbPassword] = useState("");
  const [showTargetPassword, setShowTargetPassword] = useState(false);

  const [includeData, setIncludeData] = useState(true);
  const [includeFunctions, setIncludeFunctions] = useState(true);
  const [includeIndexes, setIncludeIndexes] = useState(true);
  const [includeRLS, setIncludeRLS] = useState(true);
  const [dropExisting, setDropExisting] = useState(false);

  const [step, setStep] = useState<MigrationStep>("idle");
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [progress, setProgress] = useState(0);
  const [currentAction, setCurrentAction] = useState("");
  const [summary, setSummary] = useState<{
    tables_created?: number;
    total_rows?: number;
    functions_created?: number;
    policies_created?: number;
  }>({});

  const addLogs = (newLogs: string[]) => setLogs(prev => [...prev, ...newLogs]);

  const callClone = async (stepName: string, options: Record<string, unknown> = {}) => {
    const { data, error } = await supabase.functions.invoke("clone-project", {
      body: {
        step: stepName,
        source: { url: sourceUrl, db_password: sourceDbPassword },
        target: { url: targetUrl, db_password: targetDbPassword },
        options,
      },
    });
    if (error) throw new Error(error.message || "خطأ في الاتصال");
    if (!data?.ok) throw new Error(data?.error || "فشل العملية");
    return data;
  };

  const callCloneWithRetry = async (stepName: string, options: Record<string, unknown> = {}, retries = 2) => {
    let lastError: unknown;
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        return await callClone(stepName, options);
      } catch (error) {
        lastError = error;
        if (attempt === retries) break;
        await sleep(700 * (attempt + 1));
      }
    }
    throw lastError;
  };

  const handleAnalyze = async () => {
    if (!sourceUrl || !sourceDbPassword) { toast.error("أدخل بيانات المشروع المصدر"); return; }
    setStep("analyzing"); setLogs([]); setAnalysis(null);
    try {
      addLogs(["🔍 جاري تحليل المشروع المصدر..."]);
      const result = await callClone("analyze");
      setAnalysis(result);
      setStep("analyzed");
      addLogs([`✅ تم التحليل: ${result.total_tables} جدول، ${result.total_functions} دالة`]);
      toast.success("تم تحليل المشروع بنجاح");
    } catch (e: any) {
      setStep("error"); addLogs([`❌ فشل التحليل: ${e.message}`]); toast.error(e.message);
    }
  };

  const handleMigrate = async () => {
    if (!targetUrl || !targetDbPassword) { toast.error("أدخل بيانات المشروع المستهدف"); return; }
    const confirmed = window.confirm("⚠️ تحذير: هذا الإجراء قد يؤدي إلى الكتابة فوق البيانات الموجودة.\n\nهل أنت متأكد؟");
    if (!confirmed) return;

    setStep("migrating"); setLogs([]); setSummary({}); setProgress(0);

    try {
      let hasWarnings = false;

      // 1. Get table order
      setCurrentAction("تحليل ترتيب الجداول...");
      addLogs(["📋 جاري تحديد ترتيب الجداول..."]);
      const orderResult = await callClone("get_table_order");
      const tables: string[] = Array.from(new Set(orderResult.tables || []));
      if ((orderResult.tables || []).length !== tables.length) {
        hasWarnings = true;
        addLogs([`⚠️ تم حذف ${orderResult.tables.length - tables.length} جدول مكرر من ترتيب النقل لتفادي الإعادة الجزئية`]);
      }
      addLogs([`📋 ${tables.length} جدول بالترتيب الصحيح`]);

      // Calculate total steps
      const rowCountByTable = new Map((analysis?.tables || []).map((item) => [item.table_name, item.row_count]));
      const dataSteps = includeData
        ? tables.reduce((sum, table) => sum + Math.max(1, Math.ceil((rowCountByTable.get(table) || 0) / DATA_BATCH_SIZE)), 0)
        : 0;
      const totalSteps = 2 + tables.length + dataSteps + 1 + (includeIndexes ? 1 : 0) + (includeFunctions ? 1 : 0) + (includeRLS ? 1 : 0);
      let doneSteps = 0;
      const tick = () => { doneSteps++; setProgress(Math.min((doneSteps / totalSteps) * 100, 99)); };

      // 2a. Migrate sequences
      setCurrentAction("نقل التسلسلات (Sequences)...");
      addLogs(["🔢 نقل التسلسلات..."]);
      try {
        const seqRes = await callClone("migrate_sequences");
        addLogs(seqRes.logs || []);
      } catch (e: any) { addLogs([`⚠️ التسلسلات: ${e.message}`]); }
      tick();

      // 2b. Migrate enums & extensions
      setCurrentAction("نقل الأنواع والإضافات...");
      addLogs(["🔧 نقل الأنواع (Enums) والإضافات..."]);
      const enumRes = await callClone("migrate_enums");
      addLogs(enumRes.logs || []);
      tick();

      // 3. Schema per table
      let tablesCreated = 0;
      for (const table of tables) {
        setCurrentAction(`إنشاء جدول: ${table}`);
        try {
          const res = await callClone("migrate_schema_table", {
            table_name: table,
            drop_existing: dropExisting,
            include_indexes: includeIndexes,
            include_rls: includeRLS,
          });
          addLogs(res.logs || []);
          if (res.created) tablesCreated++;
        } catch (e: any) {
          addLogs([`❌ فشل إنشاء ${table}: ${e.message}`]);
        }
        tick();
      }
      setSummary(prev => ({ ...prev, tables_created: tablesCreated }));

      // 4. Data per table (chunked to avoid worker limits)
      if (includeData) {
        let totalRows = 0;
        for (const table of tables) {
          let offset = 0;
          let batchSize = DATA_BATCH_SIZE;
          let hasMore = true;

          while (hasMore) {
            const totalTableRows = rowCountByTable.get(table) || 0;
            setCurrentAction(`نقل بيانات: ${table} ${totalTableRows > 0 ? `(${Math.min(offset + 1, totalTableRows)}/${totalTableRows})` : ""}`.trim());
            try {
              const res = await callCloneWithRetry("migrate_data_table", {
                table_name: table,
                offset,
                batch_size: batchSize,
              });
              addLogs(res.logs || []);
              totalRows += res.rows_inserted || 0;
              if ((res.failed_rows || 0) > 0) hasWarnings = true;

              offset = typeof res.next_offset === "number"
                ? res.next_offset
                : offset + (res.rows_processed || batchSize);
              hasMore = Boolean(res.has_more);
              tick();
            } catch (e: any) {
              const message = e.message || "فشل نقل البيانات";
              if (message.includes("WORKER_LIMIT") && batchSize > MIN_DATA_BATCH_SIZE) {
                batchSize = Math.max(MIN_DATA_BATCH_SIZE, Math.floor(batchSize / 2));
                hasWarnings = true;
                addLogs([`⚠️ ${table}: تم تقليل حجم الدفعة إلى ${batchSize} صف لتجاوز حد الموارد`]);
                continue;
              }

              hasWarnings = true;
              addLogs([`❌ بيانات ${table}: ${message}`]);
              hasMore = false;
            }
          }
        }
        setSummary(prev => ({ ...prev, total_rows: totalRows }));
      }

      // 5. Foreign keys (after data to avoid partial inserts)
      setCurrentAction("إضافة المفاتيح الأجنبية...");
      addLogs(["🔗 إضافة المفاتيح الأجنبية..."]);
      try {
        const fkRes = await callClone("migrate_fks");
        addLogs(fkRes.logs || []);
      } catch (e: any) {
        hasWarnings = true;
        addLogs([`⚠️ المفاتيح الأجنبية: ${e.message}`]);
      }
      tick();

      // 6. Indexes (after data for faster inserts)
      if (includeIndexes) {
        setCurrentAction("إنشاء الفهارس...");
        addLogs(["📇 إنشاء الفهارس..."]);
        try {
          const idxRes = await callClone("migrate_indexes");
          addLogs(idxRes.logs || []);
        } catch (e: any) {
          hasWarnings = true;
          addLogs([`⚠️ الفهارس: ${e.message}`]);
        }
        tick();
      }

      // 7. Functions
      if (includeFunctions) {
        setCurrentAction("نقل الدوال البرمجية...");
        addLogs(["⚙️ نقل الدوال البرمجية..."]);
        try {
          const funcRes = await callClone("migrate_functions");
          addLogs(funcRes.logs || []);
          setSummary(prev => ({ ...prev, functions_created: funcRes.functions_created }));
        } catch (e: any) {
          hasWarnings = true;
          addLogs([`❌ الدوال: ${e.message}`]);
        }
        tick();
      }

      // 8. RLS
      if (includeRLS) {
        setCurrentAction("نقل سياسات الأمان...");
        addLogs(["🔒 نقل سياسات الأمان..."]);
        try {
          const rlsRes = await callClone("migrate_rls");
          addLogs(rlsRes.logs || []);
          setSummary(prev => ({ ...prev, policies_created: rlsRes.policies_created }));
        } catch (e: any) {
          hasWarnings = true;
          addLogs([`❌ سياسات الأمان: ${e.message}`]);
        }
        tick();
      }

      setProgress(100);
      setStep("completed");
      setCurrentAction("");
      addLogs([hasWarnings ? "⚠️ اكتملت عملية النسخ مع بعض التحذيرات، راجع السجل للتفاصيل." : "🎉 تمت عملية النسخ بنجاح!"]);
      if (hasWarnings) {
        toast.warning("اكتملت عملية النسخ مع بعض التحذيرات");
      } else {
        toast.success("تمت عملية نسخ المشروع بنجاح!");
      }
    } catch (e: any) {
      setStep("error"); addLogs([`❌ خطأ: ${e.message}`]); toast.error(e.message);
    }
  };

  const isBusy = step === "analyzing" || step === "migrating";

  return (
    <div className="space-y-4">
      <Card className="border-orange-300 bg-orange-50 dark:bg-orange-950/20">
        <CardContent className="p-3">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-orange-600 mt-0.5 shrink-0" />
            <p className="text-xs text-orange-800 dark:text-orange-200">
              <strong>تحذير:</strong> بيانات الاعتماد تُستخدم فقط أثناء التنفيذ ولا يتم تخزينها. استخدم <strong>كلمة مرور قاعدة البيانات</strong>، ويمكنك أيضاً لصق <strong>Postgres Connection String</strong> المباشر.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Source */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2"><Server className="h-4 w-4 text-blue-600" />المشروع المصدر</CardTitle>
          <CardDescription>المشروع الذي سيتم نسخ البيانات منه</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs">Supabase URL أو Postgres Connection String</Label>
            <Input value={sourceUrl} onChange={e => setSourceUrl(e.target.value)} placeholder="https://xxxxx.supabase.co أو postgresql://..." dir="ltr" className="text-xs font-mono" disabled={isBusy} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">كلمة مرور قاعدة البيانات</Label>
            <div className="relative">
              <Input type={showSourcePassword ? "text" : "password"} value={sourceDbPassword} onChange={e => setSourceDbPassword(e.target.value)} placeholder="Database Password" dir="ltr" className="text-xs font-mono pl-10" disabled={isBusy} />
              <Button type="button" variant="ghost" size="icon" className="absolute left-0 top-0 h-full w-10" onClick={() => setShowSourcePassword(!showSourcePassword)}>
                {showSourcePassword ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
              </Button>
            </div>
          </div>
          <Button onClick={handleAnalyze} disabled={isBusy || !sourceUrl || !sourceDbPassword} variant="outline" size="sm" className="w-full">
            {step === "analyzing" ? <><Loader2 className="h-3 w-3 ml-2 animate-spin" />جاري التحليل...</> : <><Database className="h-3 w-3 ml-2" />تحليل المشروع</>}
          </Button>
        </CardContent>
      </Card>

      {/* Analysis */}
      {analysis && (
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><Table2 className="h-4 w-4 text-green-600" />نتيجة التحليل</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div className="bg-muted rounded-lg p-3 text-center"><p className="text-2xl font-bold text-primary">{analysis.total_tables}</p><p className="text-xs text-muted-foreground">جدول</p></div>
              <div className="bg-muted rounded-lg p-3 text-center"><p className="text-2xl font-bold text-primary">{analysis.total_functions}</p><p className="text-xs text-muted-foreground">دالة</p></div>
            </div>
            <ScrollArea className="h-32">
              <div className="space-y-1">
                {analysis.tables.map(t => (
                  <div key={t.table_name} className="flex justify-between text-xs px-2 py-1 rounded bg-muted/50">
                    <span className="font-mono">{t.table_name}</span>
                    <Badge variant="secondary" className="text-[10px]">{t.row_count} صف</Badge>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* Target */}
      {analysis && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2"><ArrowLeftRight className="h-4 w-4 text-purple-600" />المشروع المستهدف</CardTitle>
            <CardDescription>المشروع الذي سيتم نسخ البيانات إليه</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs">Supabase URL أو Postgres Connection String</Label>
              <Input value={targetUrl} onChange={e => setTargetUrl(e.target.value)} placeholder="https://yyyyy.supabase.co أو postgresql://..." dir="ltr" className="text-xs font-mono" disabled={isBusy} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">كلمة مرور قاعدة البيانات</Label>
              <div className="relative">
                <Input type={showTargetPassword ? "text" : "password"} value={targetDbPassword} onChange={e => setTargetDbPassword(e.target.value)} placeholder="Database Password" dir="ltr" className="text-xs font-mono pl-10" disabled={isBusy} />
                <Button type="button" variant="ghost" size="icon" className="absolute left-0 top-0 h-full w-10" onClick={() => setShowTargetPassword(!showTargetPassword)}>
                  {showTargetPassword ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Options */}
      {analysis && (
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><Zap className="h-4 w-4 text-yellow-600" />خيارات النقل</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-center gap-2"><Checkbox id="includeData" checked={includeData} onCheckedChange={v => setIncludeData(!!v)} disabled={isBusy} /><label htmlFor="includeData" className="text-xs cursor-pointer">نقل البيانات</label></div>
              <div className="flex items-center gap-2"><Checkbox id="includeFunctions" checked={includeFunctions} onCheckedChange={v => setIncludeFunctions(!!v)} disabled={isBusy} /><label htmlFor="includeFunctions" className="text-xs cursor-pointer">نقل الدوال</label></div>
              <div className="flex items-center gap-2"><Checkbox id="includeIndexes" checked={includeIndexes} onCheckedChange={v => setIncludeIndexes(!!v)} disabled={isBusy} /><label htmlFor="includeIndexes" className="text-xs cursor-pointer">نقل الفهارس</label></div>
              <div className="flex items-center gap-2"><Checkbox id="includeRLS" checked={includeRLS} onCheckedChange={v => setIncludeRLS(!!v)} disabled={isBusy} /><label htmlFor="includeRLS" className="text-xs cursor-pointer">نقل سياسات RLS</label></div>
            </div>
            <div className="border-t pt-3">
              <div className="flex items-center gap-2"><Checkbox id="dropExisting" checked={dropExisting} onCheckedChange={v => setDropExisting(!!v)} disabled={isBusy} /><label htmlFor="dropExisting" className="text-xs cursor-pointer text-destructive font-medium">حذف الجداول الموجودة قبل النقل ⚠️</label></div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Progress */}
      {step !== "idle" && step !== "analyzing" && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              {step === "completed" ? <CheckCircle className="h-4 w-4 text-green-600" /> : step === "error" ? <XCircle className="h-4 w-4 text-destructive" /> : isBusy ? <Loader2 className="h-4 w-4 animate-spin text-primary" /> : <Database className="h-4 w-4" />}
              {step === "completed" ? "اكتمل!" : step === "error" ? "خطأ" : step === "analyzed" ? "جاهز للنقل" : currentAction || "جاري النقل..."}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {isBusy && <Progress value={progress} className="h-2" />}
            {(step === "completed" || Object.keys(summary).length > 0) && (
              <div className="grid grid-cols-2 gap-2">
                {summary.tables_created !== undefined && <div className="bg-muted rounded p-2 text-center"><p className="text-lg font-bold">{summary.tables_created}</p><p className="text-[10px] text-muted-foreground">جدول</p></div>}
                {summary.total_rows !== undefined && <div className="bg-muted rounded p-2 text-center"><p className="text-lg font-bold">{summary.total_rows}</p><p className="text-[10px] text-muted-foreground">صف</p></div>}
                {summary.functions_created !== undefined && <div className="bg-muted rounded p-2 text-center"><p className="text-lg font-bold">{summary.functions_created}</p><p className="text-[10px] text-muted-foreground">دالة</p></div>}
                {summary.policies_created !== undefined && <div className="bg-muted rounded p-2 text-center"><p className="text-lg font-bold">{summary.policies_created}</p><p className="text-[10px] text-muted-foreground">سياسة أمان</p></div>}
              </div>
            )}
            <ScrollArea className="h-48 border rounded-lg">
              <div className="p-3 space-y-1 font-mono text-xs" dir="ltr">
                {logs.map((log, i) => (
                  <div key={i} className={log.startsWith("❌") ? "text-destructive" : log.startsWith("⚠️") ? "text-yellow-600" : ""}>{log}</div>
                ))}
                {isBusy && <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin" /><span>{currentAction || "جاري المعالجة..."}</span></div>}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* Action Buttons */}
      {analysis && step !== "completed" && (
        <Button onClick={handleMigrate} disabled={isBusy || !targetUrl || !targetDbPassword} className="w-full" size="lg">
          {isBusy ? <><Loader2 className="h-4 w-4 ml-2 animate-spin" />جاري النقل...</> : <><Play className="h-4 w-4 ml-2" />بدء النسخ الكامل</>}
        </Button>
      )}

      {step === "completed" && (
        <Button onClick={() => { setStep("idle"); setAnalysis(null); setLogs([]); setProgress(0); setSummary({}); }} variant="outline" className="w-full">عملية نسخ جديدة</Button>
      )}
    </div>
  );
};

export default CloneProjectTab;
