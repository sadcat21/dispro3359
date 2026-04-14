import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createAdminClient } from "../_shared/admin.ts";
import { handleCors, jsonResponse } from "../_shared/cors.ts";

type BackupAction = "export" | "restore" | "upload_images" | "status";

const TABLES_TO_BACKUP = [
  "workers", "branches", "customers", "products", "orders", "order_items",
  "sectors", "promos", "stock", "expenses", "app_settings", "user_roles",
  "customer_accounts", "customer_payments", "activity_logs",
];

// Google Apps Script returns 302 redirects - we must follow manually with POST
async function postToGoogleScript(url: string, body: unknown): Promise<Response> {
  let currentUrl = url;
  for (let i = 0; i < 5; i++) {
    const res = await fetch(currentUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      redirect: "manual",
    });
    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get("location");
      if (location) {
        currentUrl = location;
        continue;
      }
    }
    return res;
  }
  throw new Error("Too many redirects from Google Apps Script");
}

serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const { action, payload } = (await req.json()) as {
      action?: BackupAction;
      payload?: Record<string, unknown>;
    };

    const supabase = createAdminClient();

    // Support reading google_script_url from app_settings for automated cron calls
    let googleScriptUrl = payload?.google_script_url as string;
    if (!googleScriptUrl && payload?.google_script_url_from_settings) {
      const { data: setting } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "google_script_url")
        .maybeSingle();
      googleScriptUrl = setting?.value || "";
    }
    if (!googleScriptUrl && action !== "status") {
      return jsonResponse({ ok: false, error: "Missing google_script_url" }, 400);
    }


    switch (action) {
      case "export": {
        const branchId = payload?.branch_id as string | null;
        const customTables = payload?.tables as string[] | undefined;
        const dateFrom = payload?.date_from as string | undefined;
        const dateTo = payload?.date_to as string | undefined;
        const createNewSheet = payload?.create_new_sheet as boolean | undefined;
        
        const tablesToExport = customTables && customTables.length > 0
          ? customTables.filter(t => TABLES_TO_BACKUP.includes(t))
          : TABLES_TO_BACKUP;

        const results: Record<string, { count: number; status: string }> = {};
        let totalRows = 0;
        
        // Collect all data first
        const allTableData: Record<string, { data: Record<string, unknown>[]; headers: string[] }> = {};

        for (const table of tablesToExport) {
          try {
            let query = supabase.from(table).select("*");
            if (branchId && ["customers", "orders", "workers", "sectors", "stock", "expenses"].includes(table)) {
              query = query.eq("branch_id", branchId);
            }
            // Apply date filters on created_at if provided
            if (dateFrom) {
              query = query.gte("created_at", dateFrom);
            }
            if (dateTo) {
              query = query.lte("created_at", dateTo + "T23:59:59.999Z");
            }

            const { data, error } = await query;
            if (error) {
              results[table] = { count: 0, status: `error: ${error.message}` };
              continue;
            }
            if (!data || data.length === 0) {
              results[table] = { count: 0, status: "empty" };
              continue;
            }

            allTableData[table] = { data, headers: Object.keys(data[0]) };
            results[table] = { count: data.length, status: "pending" };
            totalRows += data.length;
          } catch (tableError) {
            const msg = tableError instanceof Error ? tableError.message : "Unknown error";
            results[table] = { count: 0, status: `error: ${msg}` };
          }
        }

        let sheetUrl: string | undefined;

        if (createNewSheet && Object.keys(allTableData).length > 0) {
          // Create a new Google Spreadsheet with all data
          const dateLabel = dateFrom && dateTo 
            ? `${dateFrom} - ${dateTo}` 
            : new Date().toISOString().split("T")[0];
          
          const tablesPayload: Record<string, { data: Record<string, unknown>[]; headers: string[] }> = {};
          for (const [tName, tData] of Object.entries(allTableData)) {
            tablesPayload[tName] = { data: tData.data, headers: tData.headers };
          }

          try {
            const response = await postToGoogleScript(googleScriptUrl, {
              action: "create_new_spreadsheet",
              title: `نسخة احتياطية - ${dateLabel}`,
              tables: tablesPayload,
            });

            if (response.ok) {
              const result = await response.json();
              if (result.ok) {
                sheetUrl = result.sheet_url;
                for (const tName of Object.keys(allTableData)) {
                  results[tName] = { ...results[tName], status: "success" };
                }
              } else {
                for (const tName of Object.keys(allTableData)) {
                  results[tName] = { ...results[tName], status: `error: ${result.error}` };
                }
              }
            } else {
              const errText = await response.text();
              for (const tName of Object.keys(allTableData)) {
                results[tName] = { ...results[tName], status: `upload_error: ${errText}` };
              }
            }
          } catch (e) {
            const msg = e instanceof Error ? e.message : "Unknown error";
            for (const tName of Object.keys(allTableData)) {
              results[tName] = { ...results[tName], status: `error: ${msg}` };
            }
          }
        } else {
          // Write to existing spreadsheet (original behavior)
          for (const [table, tableData] of Object.entries(allTableData)) {
            try {
              const response = await postToGoogleScript(googleScriptUrl, {
                action: "write_sheet",
                sheet_name: table,
                data: tableData.data,
                headers: tableData.headers,
              });

              if (!response.ok) {
                const errText = await response.text();
                results[table] = { count: tableData.data.length, status: `upload_error: ${errText}` };
              } else {
                results[table] = { count: tableData.data.length, status: "success" };
              }
            } catch (tableError) {
              const msg = tableError instanceof Error ? tableError.message : "Unknown error";
              results[table] = { count: results[table]?.count || 0, status: `error: ${msg}` };
            }
          }
        }

        return jsonResponse({
          ok: true, total_rows: totalRows, tables: results,
          timestamp: new Date().toISOString(),
          ...(sheetUrl ? { sheet_url: sheetUrl } : {}),
        });
      }

      case "upload_images": {
        const { data: products, error } = await supabase
          .from("products")
          .select("id, name, image_url")
          .not("image_url", "is", null);

        if (error) throw error;

        const imageResults: Array<{ id: string; name: string; status: string }> = [];

        for (const product of products || []) {
          try {
            const response = await postToGoogleScript(googleScriptUrl, {
              action: "upload_image",
              image_url: product.image_url,
              file_name: `product_${product.id}_${product.name}`,
              folder_name: "Backup_Images",
            });

            if (response.ok) {
              const result = await response.json();
              imageResults.push({
                id: product.id, name: product.name,
                status: result.ok ? "success" : `failed: ${result.error || "unknown"}`,
              });
            } else {
              imageResults.push({ id: product.id, name: product.name, status: "failed" });
            }
          } catch (e) {
            const msg = e instanceof Error ? e.message : "error";
            imageResults.push({ id: product.id, name: product.name, status: `error: ${msg}` });
          }
        }

        return jsonResponse({
          ok: true,
          total_images: imageResults.length,
          successful: imageResults.filter(r => r.status === "success").length,
          results: imageResults,
        });
      }

      case "restore": {
        const tableName = payload?.table_name as string;
        if (!tableName || !TABLES_TO_BACKUP.includes(tableName)) {
          return jsonResponse({ ok: false, error: "Invalid or missing table_name" }, 400);
        }

        const response = await postToGoogleScript(googleScriptUrl, {
          action: "read_sheet",
          sheet_name: tableName,
        });

        if (!response.ok) {
          return jsonResponse({ ok: false, error: "Failed to read from Google Sheets" }, 500);
        }

        const sheetData = await response.json();
        const rows = sheetData.data as Record<string, unknown>[];

        if (!rows || rows.length === 0) {
          return jsonResponse({ ok: true, restored: 0, message: "No data to restore" });
        }

        const { error: upsertError } = await supabase
          .from(tableName)
          .upsert(rows, { onConflict: "id" });

        if (upsertError) throw upsertError;

        return jsonResponse({
          ok: true, restored: rows.length, table: tableName,
          timestamp: new Date().toISOString(),
        });
      }

      case "status":
        return jsonResponse({ ok: true, tables: TABLES_TO_BACKUP, message: "Backup system is ready" });

      default:
        return jsonResponse({ ok: false, error: "Use: export, restore, upload_images, status" }, 400);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return jsonResponse({ ok: false, error: message }, 500);
  }
});