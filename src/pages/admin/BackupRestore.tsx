import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { 
  Database, Download, Upload, Image, Settings, CheckCircle, 
  XCircle, Loader2, CloudUpload, RefreshCw, ArrowLeft, Copy, Info,
  ExternalLink, Clock, History, FileSpreadsheet, Play, ArrowLeftRight, FileCode
} from "lucide-react";
import CloneProjectTab from "@/components/backup/CloneProjectTab";
import SchemaScriptTab from "@/components/backup/SchemaScriptTab";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";

const TABLES = [
  "workers", "branches", "customers", "products", "orders", "order_items",
  "sectors", "promos", "stock", "expenses", "app_settings", "user_roles",
  "customer_accounts", "customer_payments", "activity_logs",
];

interface TableResult {
  count: number;
  status: string;
}

interface BackupLog {
  id: string;
  backup_type: string;
  status: string;
  total_rows: number;
  tables_count: number;
  table_details: Record<string, unknown>;
  google_sheet_url: string | null;
  triggered_by: string;
  created_at: string;
  completed_at: string | null;
  error_message: string | null;
  date_from: string | null;
  date_to: string | null;
  selected_tables: string[] | null;
}

const BackupRestore = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [scriptUrl, setScriptUrl] = useState(() => localStorage.getItem("backup_script_url") || "");
  const [isExporting, setIsExporting] = useState(false);
  const [isUploadingImages, setIsUploadingImages] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [isCustomExporting, setIsCustomExporting] = useState(false);
  const [restoreTable, setRestoreTable] = useState("");
  const [exportResults, setExportResults] = useState<Record<string, TableResult> | null>(null);
  const [showScript, setShowScript] = useState(false);
  
  // Custom export state
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [selectedTables, setSelectedTables] = useState<string[]>([...TABLES]);
  const [selectAll, setSelectAll] = useState(true);

  // Also save script URL to app_settings for cron
  const saveUrl = async () => {
    localStorage.setItem("backup_script_url", scriptUrl);
    try {
      const { error } = await supabase
        .from("app_settings")
        .upsert({ key: "google_script_url", value: scriptUrl }, { onConflict: "key" });
      if (!error) {
        toast.success("تم حفظ رابط Google Script");
      } else {
        toast.success("تم حفظ الرابط محلياً");
      }
    } catch {
      toast.success("تم حفظ الرابط محلياً");
    }
  };

  // Load saved Google Sheet URL
  const { data: savedSheetUrl } = useQuery({
    queryKey: ["app_settings", "google_sheet_url"],
    queryFn: async () => {
      const { data } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "google_sheet_url")
        .maybeSingle();
      return data?.value || null;
    },
  });

  // Load script URL from app_settings if not in localStorage
  useEffect(() => {
    if (!scriptUrl && savedSheetUrl) {
      setScriptUrl(savedSheetUrl);
      localStorage.setItem("backup_script_url", savedSheetUrl);
    }
  }, [savedSheetUrl]);

  // Fetch backup logs
  const { data: backupLogs = [], isLoading: logsLoading } = useQuery({
    queryKey: ["backup_logs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("backup_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data as BackupLog[];
    },
  });

  const callBackupFunction = async (action: string, extraPayload: Record<string, unknown> = {}) => {
    const { data, error } = await supabase.functions.invoke("backup-to-sheets", {
      body: {
        action,
        payload: {
          google_script_url: scriptUrl,
          ...extraPayload,
        },
      },
    });
    if (error) throw error;
    return data;
  };

  const logBackup = async (type: string, triggeredBy: string, extra: Partial<BackupLog> = {}) => {
    const { data } = await supabase
      .from("backup_logs")
      .insert({
        backup_type: type,
        status: "running",
        triggered_by: triggeredBy,
        ...extra,
      } as any)
      .select("id")
      .single();
    return data?.id;
  };

  const updateBackupLog = async (logId: string, updates: Record<string, unknown>) => {
    await supabase
      .from("backup_logs")
      .update({ ...updates, completed_at: new Date().toISOString() } as any)
      .eq("id", logId);
    queryClient.invalidateQueries({ queryKey: ["backup_logs"] });
  };

  const handleExport = async () => {
    if (!scriptUrl) {
      toast.error("أدخل رابط Google Apps Script أولاً");
      return;
    }
    setIsExporting(true);
    setExportResults(null);
    const logId = await logBackup("manual", "manual");
    try {
      const result = await callBackupFunction("export");
      if (result.ok) {
        setExportResults(result.tables);
        toast.success(`تم تصدير ${result.total_rows} سجل بنجاح`);
        if (logId) {
          await updateBackupLog(logId, {
            status: "success",
            total_rows: result.total_rows,
            tables_count: Object.keys(result.tables).length,
            table_details: result.tables,
          });
        }
      } else {
        toast.error(result.error || "فشل التصدير");
        if (logId) await updateBackupLog(logId, { status: "failed", error_message: result.error });
      }
    } catch (err) {
      toast.error("خطأ في الاتصال بخدمة النسخ الاحتياطي");
      if (logId) await updateBackupLog(logId, { status: "failed", error_message: String(err) });
    } finally {
      setIsExporting(false);
    }
  };

  const handleCustomExport = async () => {
    if (!scriptUrl) {
      toast.error("أدخل رابط Google Apps Script أولاً");
      return;
    }
    if (selectedTables.length === 0) {
      toast.error("اختر جدولاً واحداً على الأقل");
      return;
    }
    setIsCustomExporting(true);
    const logId = await logBackup("manual", "manual", {
      date_from: dateFrom || null,
      date_to: dateTo || null,
      selected_tables: selectedTables,
    } as any);
    try {
      const result = await callBackupFunction("export", {
        tables: selectedTables,
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
        create_new_sheet: true,
      });
      if (result.ok) {
        toast.success(`تم تصدير ${result.total_rows} سجل بنجاح`);
        if (logId) {
          await updateBackupLog(logId, {
            status: "success",
            total_rows: result.total_rows,
            tables_count: Object.keys(result.tables || {}).length,
            table_details: result.tables,
            google_sheet_url: result.sheet_url || null,
          });
        }
      } else {
        toast.error(result.error || "فشل التصدير");
        if (logId) await updateBackupLog(logId, { status: "failed", error_message: result.error });
      }
    } catch (err) {
      toast.error("خطأ في التصدير المخصص");
      if (logId) await updateBackupLog(logId, { status: "failed", error_message: String(err) });
    } finally {
      setIsCustomExporting(false);
    }
  };

  const handleUploadImages = async () => {
    if (!scriptUrl) {
      toast.error("أدخل رابط Google Apps Script أولاً");
      return;
    }
    setIsUploadingImages(true);
    try {
      const result = await callBackupFunction("upload_images");
      if (result.ok) {
        toast.success(`تم رفع ${result.successful} من ${result.total_images} صورة`);
      } else {
        toast.error(result.error || "فشل رفع الصور");
      }
    } catch (err) {
      toast.error("خطأ في رفع الصور");
    } finally {
      setIsUploadingImages(false);
    }
  };

  const handleRestore = async () => {
    if (!scriptUrl || !restoreTable) {
      toast.error("اختر جدولاً للاستعادة");
      return;
    }
    const confirmed = window.confirm(
      `⚠️ هل أنت متأكد من استعادة جدول "${restoreTable}"؟\nسيتم دمج البيانات من Google Sheets مع قاعدة البيانات الحالية.`
    );
    if (!confirmed) return;

    setIsRestoring(true);
    try {
      const result = await callBackupFunction("restore", { table_name: restoreTable });
      if (result.ok) {
        toast.success(`تم استعادة ${result.restored} سجل في جدول ${restoreTable}`);
      } else {
        toast.error(result.error || "فشلت الاستعادة");
      }
    } catch (err) {
      toast.error("خطأ في استعادة البيانات");
    } finally {
      setIsRestoring(false);
    }
  };

  const toggleTable = (table: string) => {
    setSelectedTables(prev => {
      const next = prev.includes(table) ? prev.filter(t => t !== table) : [...prev, table];
      setSelectAll(next.length === TABLES.length);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectAll) {
      setSelectedTables([]);
      setSelectAll(false);
    } else {
      setSelectedTables([...TABLES]);
      setSelectAll(true);
    }
  };

  const getBackupTypeLabel = (type: string) => {
    switch (type) {
      case "manual": return "يدوي";
      case "daily_incremental": return "تزايدي يومي";
      case "full_periodic": return "كامل دوري";
      default: return type;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "success": return <Badge className="bg-green-100 text-green-800 text-[10px]">نجح</Badge>;
      case "failed": return <Badge variant="destructive" className="text-[10px]">فشل</Badge>;
      case "running": return <Badge className="bg-blue-100 text-blue-800 text-[10px]">جاري...</Badge>;
      default: return <Badge variant="secondary" className="text-[10px]">{status}</Badge>;
    }
  };

  const googleAppsScriptCode = `// ======= Google Apps Script - نظام النسخ الاحتياطي =======
// 1. افتح Google Sheets جديد
// 2. Extensions > Apps Script
// 3. الصق هذا الكود واحفظ
// 4. Deploy > New deployment > Web app
// 5. Execute as: Me, Access: Anyone
// 6. انسخ الرابط وضعه في الحقل أعلاه

function doPost(e) {
  try {
    var payload = JSON.parse(e.postData.contents);
    var action = payload.action;
    
    switch(action) {
      case "write_sheet":
        return writeSheet(payload);
      case "read_sheet":
        return readSheet(payload);
      case "upload_image":
        return uploadImage(payload);
      case "create_new_spreadsheet":
        return createNewSpreadsheet(payload);
      default:
        return jsonResponse({ok: false, error: "Unknown action"});
    }
  } catch(err) {
    return jsonResponse({ok: false, error: err.toString()});
  }
}

function createNewSpreadsheet(payload) {
  var title = payload.title || "نسخة احتياطية - " + new Date().toLocaleDateString("ar");
  var ss = SpreadsheetApp.create(title);
  var sheetUrl = ss.getUrl();
  var sheetId = ss.getId();
  
  // Write each table
  var tables = payload.tables || {};
  for (var tableName in tables) {
    var tableData = tables[tableName];
    if (!tableData.data || tableData.data.length === 0) continue;
    
    var sheet = ss.insertSheet(tableName);
    var headers = tableData.headers;
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold");
    sheet.getRange(1, 1, 1, headers.length).setBackground("#4285f4");
    sheet.getRange(1, 1, 1, headers.length).setFontColor("#ffffff");
    
    var rows = tableData.data.map(function(row) {
      return headers.map(function(h) {
        var val = row[h];
        return val === null || val === undefined ? "" : val;
      });
    });
    sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
    
    for (var i = 1; i <= headers.length; i++) {
      sheet.autoResizeColumn(i);
    }
  }
  
  // Remove default Sheet1
  var defaultSheet = ss.getSheetByName("Sheet1");
  if (defaultSheet && ss.getSheets().length > 1) {
    ss.deleteSheet(defaultSheet);
  }
  
  return jsonResponse({ok: true, sheet_url: sheetUrl, sheet_id: sheetId});
}

function writeSheet(payload) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheetName = payload.sheet_name;
  var headers = payload.headers;
  var data = payload.data;
  
  var sheet = ss.getSheetByName(sheetName);
  if (sheet) { sheet.clear(); } else { sheet = ss.insertSheet(sheetName); }
  
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold");
  sheet.getRange(1, 1, 1, headers.length).setBackground("#4285f4");
  sheet.getRange(1, 1, 1, headers.length).setFontColor("#ffffff");
  
  if (data.length > 0) {
    var rows = data.map(function(row) {
      return headers.map(function(h) {
        var val = row[h];
        return val === null || val === undefined ? "" : val;
      });
    });
    sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
  }
  
  for (var i = 1; i <= headers.length; i++) { sheet.autoResizeColumn(i); }
  
  var metaSheet = ss.getSheetByName("_backup_meta");
  if (!metaSheet) {
    metaSheet = ss.insertSheet("_backup_meta");
    metaSheet.getRange(1, 1, 1, 3).setValues([["Table", "Rows", "Last Updated"]]);
    metaSheet.getRange(1, 1, 1, 3).setFontWeight("bold");
  }
  
  var metaData = metaSheet.getDataRange().getValues();
  var found = false;
  for (var r = 1; r < metaData.length; r++) {
    if (metaData[r][0] === sheetName) {
      metaSheet.getRange(r+1, 2).setValue(data.length);
      metaSheet.getRange(r+1, 3).setValue(new Date().toISOString());
      found = true;
      break;
    }
  }
  if (!found) { metaSheet.appendRow([sheetName, data.length, new Date().toISOString()]); }
  
  return jsonResponse({ok: true, rows: data.length});
}

function readSheet(payload) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(payload.sheet_name);
  if (!sheet) { return jsonResponse({ok: false, error: "Sheet not found: " + payload.sheet_name}); }
  
  var values = sheet.getDataRange().getValues();
  if (values.length < 2) { return jsonResponse({ok: true, data: []}); }
  
  var headers = values[0];
  var data = [];
  for (var i = 1; i < values.length; i++) {
    var row = {};
    for (var j = 0; j < headers.length; j++) {
      var val = values[i][j];
      row[headers[j]] = val === "" ? null : val;
    }
    data.push(row);
  }
  return jsonResponse({ok: true, data: data});
}

function uploadImage(payload) {
  var imageUrl = payload.image_url;
  var fileName = payload.file_name;
  var folderName = payload.folder_name || "Backup_Images";
  
  try {
    var folders = DriveApp.getFoldersByName(folderName);
    var folder = folders.hasNext() ? folders.next() : DriveApp.createFolder(folderName);
    var response = UrlFetchApp.fetch(imageUrl);
    var blob = response.getBlob().setName(fileName);
    folder.createFile(blob);
    return jsonResponse({ok: true, file_name: fileName});
  } catch(err) {
    return jsonResponse({ok: false, error: err.toString()});
  }
}

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function doGet(e) {
  return jsonResponse({ok: true, message: "Backup API is running"});
}`;

  const copyScript = () => {
    navigator.clipboard.writeText(googleAppsScriptCode);
    toast.success("تم نسخ الكود");
  };

  // Get the last known Google Sheet URL from logs
  const lastSheetUrl = backupLogs.find(l => l.google_sheet_url)?.google_sheet_url;

  return (
    <div className="p-4 pb-24 space-y-4 max-w-2xl mx-auto" dir="rtl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Database className="h-5 w-5 text-primary" />
            النسخ الاحتياطي
          </h1>
          <p className="text-sm text-muted-foreground">تصدير واستعادة البيانات عبر Google Sheets</p>
        </div>
        {(lastSheetUrl || scriptUrl) && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const url = lastSheetUrl || scriptUrl.replace("/exec", "").replace("macros/s/", "spreadsheets/d/");
              window.open(url, "_blank");
            }}
          >
            <ExternalLink className="h-4 w-4 ml-1" />
            فتح Google Sheets
          </Button>
        )}
      </div>

      <Tabs defaultValue="export" className="w-full">
        <TabsList className="grid w-full grid-cols-6 h-auto">
          <TabsTrigger value="export" className="text-xs py-2">
            <CloudUpload className="h-3 w-3 ml-1" />
            تصدير
          </TabsTrigger>
          <TabsTrigger value="custom" className="text-xs py-2">
            <FileSpreadsheet className="h-3 w-3 ml-1" />
            مخصص
          </TabsTrigger>
          <TabsTrigger value="restore" className="text-xs py-2">
            <RefreshCw className="h-3 w-3 ml-1" />
            استعادة
          </TabsTrigger>
          <TabsTrigger value="clone" className="text-xs py-2">
            <ArrowLeftRight className="h-3 w-3 ml-1" />
            نسخ مشروع
          </TabsTrigger>
          <TabsTrigger value="schema" className="text-xs py-2">
            <FileCode className="h-3 w-3 ml-1" />
            سكربت SQL
          </TabsTrigger>
          <TabsTrigger value="logs" className="text-xs py-2">
            <History className="h-3 w-3 ml-1" />
            السجل
          </TabsTrigger>
        </TabsList>

        {/* Setup Card - shown in all tabs */}
        <Card className="mt-4">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Settings className="h-4 w-4" />
              إعداد الاتصال
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <Input
                value={scriptUrl}
                onChange={(e) => setScriptUrl(e.target.value)}
                placeholder="https://script.google.com/macros/s/.../exec"
                dir="ltr"
                className="text-xs"
              />
              <Button onClick={saveUrl} size="sm">حفظ</Button>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => setShowScript(!showScript)}
            >
              <Info className="h-4 w-4 ml-2" />
              {showScript ? "إخفاء" : "عرض"} كود Google Apps Script
            </Button>
            {showScript && (
              <div className="relative">
                <Button
                  variant="secondary"
                  size="sm"
                  className="absolute top-2 left-2 z-10"
                  onClick={copyScript}
                >
                  <Copy className="h-3 w-3 ml-1" />
                  نسخ
                </Button>
                <pre className="bg-muted p-4 rounded-lg text-xs overflow-auto max-h-64 text-left" dir="ltr">
                  {googleAppsScriptCode}
                </pre>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Export Tab */}
        <TabsContent value="export" className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <CloudUpload className="h-4 w-4 text-green-600" />
                تصدير كامل
              </CardTitle>
              <CardDescription>نسخ جميع الجداول إلى Google Sheets</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button onClick={handleExport} disabled={isExporting || !scriptUrl} className="w-full">
                {isExporting ? (
                  <><Loader2 className="h-4 w-4 ml-2 animate-spin" />جاري التصدير...</>
                ) : (
                  <><Upload className="h-4 w-4 ml-2" />تصدير جميع البيانات</>
                )}
              </Button>

              <Button
                onClick={handleUploadImages}
                disabled={isUploadingImages || !scriptUrl}
                variant="outline"
                className="w-full"
              >
                {isUploadingImages ? (
                  <><Loader2 className="h-4 w-4 ml-2 animate-spin" />جاري رفع الصور...</>
                ) : (
                  <><Image className="h-4 w-4 ml-2" />رفع الصور إلى Google Drive</>
                )}
              </Button>

              {exportResults && (
                <div className="space-y-1 mt-3">
                  <h4 className="text-sm font-medium">نتائج التصدير:</h4>
                  <div className="grid grid-cols-1 gap-1">
                    {Object.entries(exportResults).map(([table, result]) => (
                      <div key={table} className="flex items-center justify-between text-xs py-1 px-2 rounded bg-muted">
                        <span className="font-mono">{table}</span>
                        <div className="flex items-center gap-2">
                          <span>{result.count} سجل</span>
                          {result.status === "success" ? (
                            <CheckCircle className="h-3 w-3 text-green-600" />
                          ) : result.status === "empty" ? (
                            <Badge variant="secondary" className="text-[10px]">فارغ</Badge>
                          ) : (
                            <XCircle className="h-3 w-3 text-red-500" />
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Custom Export Tab */}
        <TabsContent value="custom" className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <FileSpreadsheet className="h-4 w-4 text-blue-600" />
                تصدير مخصص
              </CardTitle>
              <CardDescription>إنشاء ملف Google Sheet جديد مع تحديد الفترة والجداول</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Date Range */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">من تاريخ</Label>
                  <Input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    dir="ltr"
                    className="text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">إلى تاريخ</Label>
                  <Input
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    dir="ltr"
                    className="text-xs"
                  />
                </div>
              </div>

              {/* Table Selection */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs">اختر الجداول</Label>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="selectAll"
                      checked={selectAll}
                      onCheckedChange={toggleSelectAll}
                    />
                    <label htmlFor="selectAll" className="text-xs cursor-pointer">تحديد الكل</label>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-1.5 max-h-48 overflow-y-auto">
                  {TABLES.map((table) => (
                    <div key={table} className="flex items-center gap-2 py-1">
                      <Checkbox
                        id={table}
                        checked={selectedTables.includes(table)}
                        onCheckedChange={() => toggleTable(table)}
                      />
                      <label htmlFor={table} className="text-xs font-mono cursor-pointer">{table}</label>
                    </div>
                  ))}
                </div>
              </div>

              <Button
                onClick={handleCustomExport}
                disabled={isCustomExporting || !scriptUrl || selectedTables.length === 0}
                className="w-full"
              >
                {isCustomExporting ? (
                  <><Loader2 className="h-4 w-4 ml-2 animate-spin" />جاري إنشاء الملف...</>
                ) : (
                  <><Play className="h-4 w-4 ml-2" />إنشاء ملف Google Sheet جديد</>
                )}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Restore Tab */}
        <TabsContent value="restore" className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <RefreshCw className="h-4 w-4 text-orange-600" />
                استعادة البيانات
              </CardTitle>
              <CardDescription>استعادة جدول محدد من Google Sheets</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                <Label>اختر الجدول</Label>
                <Select value={restoreTable} onValueChange={setRestoreTable}>
                  <SelectTrigger>
                    <SelectValue placeholder="اختر جدولاً..." />
                  </SelectTrigger>
                  <SelectContent>
                    {TABLES.map((t) => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                onClick={handleRestore}
                disabled={isRestoring || !scriptUrl || !restoreTable}
                variant="destructive"
                className="w-full"
              >
                {isRestoring ? (
                  <><Loader2 className="h-4 w-4 ml-2 animate-spin" />جاري الاستعادة...</>
                ) : (
                  <><Download className="h-4 w-4 ml-2" />استعادة الجدول</>
                )}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Clone Project Tab */}
        <TabsContent value="clone" className="space-y-4">
          <CloneProjectTab />
        </TabsContent>

        {/* Logs Tab */}
        <TabsContent value="logs" className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <History className="h-4 w-4 text-purple-600" />
                سجل النسخ الاحتياطي
              </CardTitle>
              <CardDescription>عرض جميع عمليات النسخ الاحتياطي السابقة</CardDescription>
            </CardHeader>
            <CardContent>
              {logsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : backupLogs.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">لا توجد عمليات نسخ احتياطي سابقة</p>
              ) : (
                <div className="space-y-2">
                  {backupLogs.map((log) => (
                    <div key={log.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          {getStatusBadge(log.status)}
                          <Badge variant="outline" className="text-[10px]">{getBackupTypeLabel(log.backup_type)}</Badge>
                          <span className="text-[10px] text-muted-foreground">{log.triggered_by === "cron" ? "تلقائي" : "يدوي"}</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {format(new Date(log.created_at), "yyyy/MM/dd HH:mm")}
                          {log.total_rows > 0 && <span>• {log.total_rows} سجل</span>}
                          {log.tables_count > 0 && <span>• {log.tables_count} جدول</span>}
                        </div>
                        {log.error_message && (
                          <p className="text-xs text-destructive">{log.error_message}</p>
                        )}
                      </div>
                      {log.google_sheet_url && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => window.open(log.google_sheet_url!, "_blank")}
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default BackupRestore;
