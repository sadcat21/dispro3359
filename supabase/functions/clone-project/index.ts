import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { Client } from "https://deno.land/x/postgres@v0.19.3/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function jsonRes(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function normalizeProjectInput(value: string): string {
  return value.trim();
}

function isPostgresConnectionString(value: string): boolean {
  return /^postgres(?:ql)?:\/\//i.test(normalizeProjectInput(value));
}

function extractRef(projectInput: string): string {
  const input = normalizeProjectInput(projectInput);
  if (!input) return "";
  if (/^[a-z0-9]{20}$/i.test(input)) return input;
  const projectUrlMatch = input.match(/https?:\/\/([^.]+)\.supabase\.co(?:\/|$)/i);
  if (projectUrlMatch) return projectUrlMatch[1];
  const directHostMatch = input.match(/(?:^|\/\/)db\.([^.]+)\.supabase\.(?:co|net)(?::\d+)?(?:\/|$)/i);
  if (directHostMatch) return directHostMatch[1];
  if (!isPostgresConnectionString(input)) return "";
  try {
    const parsed = new URL(input);
    const pooledUserMatch = decodeURIComponent(parsed.username).match(/^postgres\.([^.]+)$/i);
    if (pooledUserMatch) return pooledUserMatch[1];
    const directHostRefMatch = parsed.hostname.match(/^db\.([^.]+)\.supabase\.(?:co|net)$/i);
    return directHostRefMatch ? directHostRefMatch[1] : "";
  } catch {
    return "";
  }
}

function buildConnString(projectInput: string, dbPassword: string): string {
  const input = normalizeProjectInput(projectInput);
  if (isPostgresConnectionString(input)) {
    const parsed = new URL(input);
    if (dbPassword) parsed.password = dbPassword;
    if (!parsed.searchParams.has("sslmode")) parsed.searchParams.set("sslmode", "require");
    return parsed.toString();
  }
  const ref = extractRef(input);
  if (!ref) throw new Error("تعذر تحديد معرف مشروع Supabase من القيمة المُدخلة");
  return `postgresql://postgres:${encodeURIComponent(dbPassword)}@db.${ref}.supabase.co:5432/postgres?sslmode=require`;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

function formatConnectionError(error: unknown, projectInput: string): string {
  const message = getErrorMessage(error);
  if (message.includes("Tenant or user not found") && !isPostgresConnectionString(projectInput)) {
    return `${message}. جرّب إدخال Postgres Connection String المباشر.`;
  }
  return message;
}

function toSafeNonNegativeInt(value: unknown, fallback: number, max = Number.MAX_SAFE_INTEGER): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(Math.trunc(parsed), 0), max);
}

function serializeRowValue(value: unknown): unknown {
  if (value !== null && typeof value === "object" && !Array.isArray(value)) {
    return JSON.stringify(value);
  }
  return value;
}

async function getPrimaryKeyColumns(src: Client, table: string): Promise<string[]> {
  const pkResult = await src.queryObject<{ column_name: string }>(`
    SELECT kcu.column_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
     AND tc.table_schema = kcu.table_schema
    WHERE tc.table_schema = 'public'
      AND tc.table_name = '${table}'
      AND tc.constraint_type = 'PRIMARY KEY'
    ORDER BY kcu.ordinal_position
  `);
  return pkResult.rows.map((row) => row.column_name);
}

async function connectDb(projectInput: string, dbPassword: string): Promise<Client> {
  const client = new Client(buildConnString(projectInput, dbPassword));
  await client.connect();
  return client;
}

// ── analyze ──
async function analyzeSource(src: Client) {
  const tablesResult = await src.queryObject<{ table_name: string; row_count: number }>(`
    SELECT t.table_name, COALESCE(s.n_live_tup, 0)::int as row_count
    FROM information_schema.tables t
    LEFT JOIN pg_stat_user_tables s ON s.relname = t.table_name AND s.schemaname = 'public'
    WHERE t.table_schema = 'public' AND t.table_type = 'BASE TABLE'
      AND t.table_name NOT LIKE 'pg_%'
      AND t.table_name NOT IN ('schema_migrations', 'supabase_migrations')
    ORDER BY t.table_name
  `);
  const funcsResult = await src.queryObject<{ func_name: string; func_lang: string }>(`
    SELECT p.proname as func_name, l.lanname as func_lang
    FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid JOIN pg_language l ON p.prolang = l.oid
    WHERE n.nspname = 'public' AND p.prokind = 'f' AND l.lanname IN ('plpgsql', 'sql')
    ORDER BY p.proname
  `);
  return {
    tables: tablesResult.rows,
    functions: funcsResult.rows,
    total_tables: tablesResult.rows.length,
    total_functions: funcsResult.rows.length,
  };
}

// ── get_table_order ── lightweight step to return sorted table list
async function getTableOrder(src: Client) {
  const tablesResult = await src.queryObject<{ table_name: string }>(`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      AND table_name NOT LIKE 'pg_%' AND table_name NOT IN ('schema_migrations', 'supabase_migrations')
    ORDER BY table_name
  `);
  const depsResult = await src.queryObject<{ table_name: string; ref_table: string }>(`
    SELECT tc.table_name, ccu.table_name AS ref_table
    FROM information_schema.table_constraints tc
    JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name = tc.constraint_name
    WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public'
  `);
  const allTables = tablesResult.rows.map(r => r.table_name);
  const allTableSet = new Set(allTables);
  const deps = new Map<string, Set<string>>();
  for (const t of allTables) deps.set(t, new Set());
  for (const d of depsResult.rows) {
    if (deps.has(d.table_name) && d.table_name !== d.ref_table) deps.get(d.table_name)!.add(d.ref_table);
  }
  const sorted: string[] = [];
  const visited = new Set<string>();
  const visiting = new Set<string>();
  function visit(name: string) {
    if (visited.has(name)) return;
    if (visiting.has(name)) return;
    visiting.add(name);
    for (const dep of deps.get(name) || []) { if (allTableSet.has(dep)) visit(dep); }
    visiting.delete(name); visited.add(name); sorted.push(name);
  }
  for (const t of allTables) visit(t);
  return sorted;
}

// ── migrate_schema ── (one table at a time)
async function migrateSchemaForTable(src: Client, tgt: Client, table: string, opts: { drop_existing: boolean; include_indexes: boolean; include_rls: boolean }) {
  const logs: string[] = [];
  if (opts.drop_existing) {
    try { await tgt.queryObject(`DROP TABLE IF EXISTS public."${table}" CASCADE`); logs.push(`🗑️ حذف: ${table}`); } catch (e) { logs.push(`⚠️ فشل حذف ${table}: ${(e as Error).message}`); }
  }
  const colsResult = await src.queryObject<{ column_name: string; data_type: string; udt_name: string; is_nullable: string; column_default: string | null; character_maximum_length: number | null }>(`
    SELECT column_name, data_type, udt_name, is_nullable, column_default, character_maximum_length
    FROM information_schema.columns WHERE table_schema = 'public' AND table_name = '${table}' ORDER BY ordinal_position
  `);
  if (colsResult.rows.length === 0) return { ok: true, created: false, logs: [`⏭️ ${table}: لا أعمدة`] };

  const colDefs = colsResult.rows.map(c => {
    let type = c.udt_name;
    const typeMap: Record<string, string> = { varchar: c.character_maximum_length ? `varchar(${c.character_maximum_length})` : "varchar", int4: "integer", int8: "bigint", float8: "double precision", float4: "real", bool: "boolean", timestamptz: "timestamp with time zone", timestamp: "timestamp without time zone", _text: "text[]", _uuid: "uuid[]", _int4: "integer[]", _float8: "double precision[]", _varchar: "varchar[]" };
    type = typeMap[type] || type;
    let def = `"${c.column_name}" ${type}`;
    if (c.is_nullable === "NO") def += " NOT NULL";
    if (c.column_default) def += ` DEFAULT ${c.column_default}`;
    return def;
  });

  const pkResult = await src.queryObject<{ column_name: string }>(`
    SELECT kcu.column_name FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
    WHERE tc.table_schema = 'public' AND tc.table_name = '${table}' AND tc.constraint_type = 'PRIMARY KEY'
  `);
  let pkClause = "";
  if (pkResult.rows.length > 0) pkClause = `, PRIMARY KEY (${pkResult.rows.map(r => `"${r.column_name}"`).join(", ")})`;

  await tgt.queryObject(`CREATE TABLE IF NOT EXISTS public."${table}" (\n  ${colDefs.join(",\n  ")}${pkClause}\n)`);
  logs.push(`✅ إنشاء: ${table} (${colsResult.rows.length} عمود)`);

  if (opts.include_rls) { try { await tgt.queryObject(`ALTER TABLE public."${table}" ENABLE ROW LEVEL SECURITY`); } catch (_) {} }
  return { ok: true, created: true, logs };
}

// ── migrate_data_table ── one table at a time
async function migrateDataForTable(src: Client, tgt: Client, table: string, opts: { offset: number; batch_size: number }) {
  const logs: string[] = [];
  const countRes = await src.queryObject<{ c: number }>(`SELECT COUNT(*)::int as c FROM public."${table}"`);
  const rowCount = countRes.rows[0]?.c || 0;
  if (rowCount === 0) {
    return {
      ok: true,
      rows_inserted: 0,
      rows_processed: 0,
      failed_rows: 0,
      total_rows: 0,
      next_offset: 0,
      has_more: false,
      logs: [`⏭️ ${table}: فارغ`],
    };
  }

  const offset = Math.min(toSafeNonNegativeInt(opts.offset, 0), rowCount);
  const batchSize = Math.max(1, toSafeNonNegativeInt(opts.batch_size, 100, 200));

  if (offset >= rowCount) {
    return {
      ok: true,
      rows_inserted: 0,
      rows_processed: 0,
      failed_rows: 0,
      total_rows: rowCount,
      next_offset: rowCount,
      has_more: false,
      logs: [`✅ ${table}: ${rowCount}/${rowCount} صف`],
    };
  }

  const pkColumns = await getPrimaryKeyColumns(src, table);
  const orderByClause = pkColumns.length > 0
    ? pkColumns.map((column) => `"${column}"`).join(", ")
    : "ctid";

  // Disable FK checks and triggers for this session
  try { await tgt.queryObject(`SET session_replication_role = 'replica'`); } catch (_) {}
  try { await tgt.queryObject(`ALTER TABLE public."${table}" DISABLE TRIGGER ALL`); } catch (_) {}

  const dataRes = await src.queryObject(`SELECT * FROM public."${table}" ORDER BY ${orderByClause} LIMIT ${batchSize} OFFSET ${offset}`);
  const rows = dataRes.rows as Record<string, unknown>[];

  if (rows.length === 0) {
    try { await tgt.queryObject(`ALTER TABLE public."${table}" ENABLE TRIGGER ALL`); } catch (_) {}
    try { await tgt.queryObject(`SET session_replication_role = 'DEFAULT'`); } catch (_) {}
    return {
      ok: true,
      rows_inserted: 0,
      rows_processed: 0,
      failed_rows: 0,
      total_rows: rowCount,
      next_offset: rowCount,
      has_more: false,
      logs: [`✅ ${table}: ${rowCount}/${rowCount} صف`],
    };
  }

  const cols = Object.keys(rows[0]);
  const colList = cols.map(c => `"${c}"`).join(", ");
  const rowPlaceholders = `(${cols.map((_, i) => `$${i + 1}`).join(", ")})`;
  const rowInsertSql = `WITH inserted_row AS (
    INSERT INTO public."${table}" (${colList})
    VALUES ${rowPlaceholders}
    ON CONFLICT DO NOTHING
    RETURNING 1
  )
  SELECT COUNT(*)::int AS inserted FROM inserted_row`;

  let inserted = 0;
  let failed = 0;

  const valueParts: string[] = [];
  let paramIdx = 1;
  const params: unknown[] = [];
  for (const row of rows) {
    const placeholders = cols.map(() => `$${paramIdx++}`);
    valueParts.push(`(${placeholders.join(", ")})`);
    for (const col of cols) params.push(serializeRowValue(row[col]));
  }

  try {
    const bulkInsertSql = `WITH inserted_rows AS (
      INSERT INTO public."${table}" (${colList})
      VALUES ${valueParts.join(", ")}
      ON CONFLICT DO NOTHING
      RETURNING 1
    )
    SELECT COUNT(*)::int AS inserted FROM inserted_rows`;
    const insertRes = await tgt.queryObject<{ inserted: number }>(bulkInsertSql, params);
    inserted += insertRes.rows[0]?.inserted || 0;
  } catch (batchError) {
    logs.push(`⚠️ ${table}: فشل الإدراج الدفعي عند الصفوف ${offset + 1}-${offset + rows.length}، سيتم المحاولة صفاً بصف`);
    let sampleFailures = 0;
    for (const [index, row] of rows.entries()) {
      try {
        const rowParams = cols.map((col) => serializeRowValue(row[col]));
        const rowRes = await tgt.queryObject<{ inserted: number }>(rowInsertSql, rowParams);
        inserted += rowRes.rows[0]?.inserted || 0;
      } catch (rowError) {
        failed++;
        if (sampleFailures < 3) {
          logs.push(`⚠️ ${table}: تعذر إدراج الصف ${offset + index + 1} - ${getErrorMessage(rowError)}`);
          sampleFailures++;
        }
      }
    }
    if (failed === rows.length) {
      logs.push(`⚠️ ${table}: جميع صفوف هذه الدفعة فشلت بعد محاولة بديلة. السبب الأول: ${getErrorMessage(batchError)}`);
    }
  }

  try { await tgt.queryObject(`ALTER TABLE public."${table}" ENABLE TRIGGER ALL`); } catch (_) {}
  try { await tgt.queryObject(`SET session_replication_role = 'DEFAULT'`); } catch (_) {}

  const nextOffset = Math.min(offset + rows.length, rowCount);
  const hasMore = nextOffset < rowCount;
  const icon = failed > 0 ? "⚠️" : hasMore ? "⏳" : "✅";
  logs.push(`${icon} ${table}: ${nextOffset}/${rowCount} صف (${inserted} تم إدراجها${failed > 0 ? `، ${failed} فشل` : ""})`);
  return {
    ok: true,
    rows_inserted: inserted,
    rows_processed: rows.length,
    failed_rows: failed,
    total_rows: rowCount,
    next_offset: nextOffset,
    has_more: hasMore,
    logs,
  };
}

// ── migrate_fks ── add foreign keys
async function migrateForeignKeys(src: Client, tgt: Client) {
  const fkResult = await src.queryObject<{ constraint_name: string; table_name: string; column_name: string; ref_table: string; ref_column: string }>(`
    SELECT tc.constraint_name, tc.table_name, kcu.column_name, ccu.table_name AS ref_table, ccu.column_name AS ref_column
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public'
  `);
  let count = 0;
  for (const fk of fkResult.rows) {
    try {
      await tgt.queryObject(`ALTER TABLE public."${fk.table_name}" ADD CONSTRAINT "${fk.constraint_name}" FOREIGN KEY ("${fk.column_name}") REFERENCES public."${fk.ref_table}"("${fk.ref_column}") ON DELETE CASCADE`);
      count++;
    } catch (_) {}
  }
  return { ok: true, fk_count: count, logs: [`🔗 إضافة ${count} مفتاح أجنبي`] };
}

// ── migrate_functions ──
async function migrateFunctions(src: Client, tgt: Client) {
  const logs: string[] = [];
  const funcsResult = await src.queryObject<{ func_name: string; func_def: string }>(`
    SELECT p.proname as func_name, pg_get_functiondef(p.oid) as func_def
    FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid JOIN pg_language l ON p.prolang = l.oid
    WHERE n.nspname = 'public' AND p.prokind = 'f' AND l.lanname IN ('plpgsql', 'sql')
      AND p.proname NOT LIKE 'gtrgm_%' AND p.proname NOT LIKE 'gin_%'
      AND p.proname NOT IN ('set_limit','show_limit','show_trgm','similarity','similarity_op','similarity_dist','word_similarity','word_similarity_op','word_similarity_dist_op','word_similarity_commutator_op','word_similarity_dist_commutator_op','strict_word_similarity','strict_word_similarity_op','strict_word_similarity_commutator_op','strict_word_similarity_dist_op','strict_word_similarity_dist_commutator_op')
  `);

  // Sort functions: create functions that others depend on first
  // Do multiple passes to resolve dependencies
  const remaining = [...funcsResult.rows];
  const created = new Set<string>();
  let maxPasses = 5;
  let totalCreated = 0;

  while (remaining.length > 0 && maxPasses > 0) {
    maxPasses--;
    const failed: typeof remaining = [];
    for (const func of remaining) {
      try {
        await tgt.queryObject(func.func_def.replace(/^CREATE FUNCTION/, "CREATE OR REPLACE FUNCTION"));
        totalCreated++;
        created.add(func.func_name);
        logs.push(`✅ دالة: ${func.func_name}`);
      } catch (e) {
        const msg = (e as Error).message;
        // If it fails due to missing dependency, retry in next pass
        if (msg.includes("does not exist") && maxPasses > 0) {
          failed.push(func);
        } else {
          logs.push(`❌ دالة ${func.func_name}: ${msg}`);
        }
      }
    }
    remaining.length = 0;
    remaining.push(...failed);
  }

  return { ok: true, functions_created: totalCreated, logs };
}

// ── migrate_rls ──
async function migrateRLS(src: Client, tgt: Client) {
  const logs: string[] = [];
  const policiesResult = await src.queryObject<{ tablename: string; policyname: string; permissive: string; roles: string[]; cmd: string; qual: string | null; with_check: string | null }>(`
    SELECT tablename, policyname, permissive, roles, cmd, qual, with_check FROM pg_policies WHERE schemaname = 'public'
  `);
  let created = 0;
  for (const pol of policiesResult.rows) {
    try {
      let sql = `CREATE POLICY "${pol.policyname}" ON public."${pol.tablename}" AS ${pol.permissive === "PERMISSIVE" ? "PERMISSIVE" : "RESTRICTIVE"} FOR ${pol.cmd} TO ${pol.roles.join(", ")}`;
      if (pol.qual) sql += ` USING (${pol.qual})`;
      if (pol.with_check) sql += ` WITH CHECK (${pol.with_check})`;
      await tgt.queryObject(sql);
      created++;
    } catch (_) {}
  }
  if (created > 0) logs.push(`🔒 إنشاء ${created} سياسة أمان`);
  return { ok: true, policies_created: created, logs };
}

// ── main handler ──
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json();
    const { step, source, target, options = {} } = body;

    if (!source?.url || !source?.db_password) return jsonRes({ ok: false, error: "بيانات المشروع المصدر مطلوبة" }, 400);

    let sourceClient: Client;
    try { sourceClient = await connectDb(source.url, source.db_password); } catch (e) {
      return jsonRes({ ok: false, error: `فشل الاتصال بالمشروع المصدر: ${formatConnectionError(e, source.url)}` }, 400);
    }

    try {
      if (step === "analyze") {
        const result = await analyzeSource(sourceClient);
        return jsonRes({ ok: true, ...result });
      }

      if (step === "get_table_order") {
        const sorted = await getTableOrder(sourceClient);
        return jsonRes({ ok: true, tables: sorted });
      }

      // Steps requiring target
      if (!target?.url || !target?.db_password) return jsonRes({ ok: false, error: "بيانات المشروع المستهدف مطلوبة" }, 400);
      let targetClient: Client;
      try { targetClient = await connectDb(target.url, target.db_password); } catch (e) {
        return jsonRes({ ok: false, error: `فشل الاتصال بالمشروع المستهدف: ${formatConnectionError(e, target.url)}` }, 400);
      }

      try {
        if (step === "migrate_sequences") {
          const seqResult = await sourceClient.queryObject<{ sequence_name: string; start_value: string; data_type: string }>(`
            SELECT s.sequencename as sequence_name, 
                   COALESCE(s.start_value::text, '1') as start_value,
                   COALESCE(s.data_type, 'bigint') as data_type
            FROM pg_sequences s
            WHERE s.schemaname = 'public'
          `);
          const logs: string[] = [];
          for (const seq of seqResult.rows) {
            try {
              await targetClient.queryObject(`CREATE SEQUENCE IF NOT EXISTS public."${seq.sequence_name}" AS ${seq.data_type}`);
              // Sync current value
              const curVal = await sourceClient.queryObject<{ last_value: string }>(`SELECT last_value::text FROM public."${seq.sequence_name}"`);
              if (curVal.rows[0]?.last_value) {
                await targetClient.queryObject(`SELECT setval('public."${seq.sequence_name}"', ${curVal.rows[0].last_value})`);
              }
              logs.push(`✅ تسلسل: ${seq.sequence_name}`);
            } catch (_) {}
          }
          return jsonRes({ ok: true, logs });
        }

        if (step === "migrate_enums") {
          const enumsResult = await sourceClient.queryObject<{ type_name: string; enum_values: string[] }>(`
            SELECT t.typname as type_name, array_agg(e.enumlabel ORDER BY e.enumsortorder) as enum_values
            FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid JOIN pg_namespace n ON t.typnamespace = n.oid
            WHERE n.nspname = 'public' GROUP BY t.typname
          `);
          const logs: string[] = [];
          for (const en of enumsResult.rows) {
            try {
              const vals = en.enum_values.map((v: string) => `'${v}'`).join(", ");
              await targetClient.queryObject(`DO $$ BEGIN CREATE TYPE public."${en.type_name}" AS ENUM (${vals}); EXCEPTION WHEN duplicate_object THEN NULL; END $$`);
              logs.push(`✅ نوع: ${en.type_name}`);
            } catch (_) {}
          }
          try { await targetClient.queryObject(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`); } catch (_) {}
          try { await targetClient.queryObject(`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`); } catch (_) {}
          return jsonRes({ ok: true, logs });
        }

        if (step === "migrate_schema_table") {
          const table = options.table_name;
          if (!table) return jsonRes({ ok: false, error: "table_name مطلوب" }, 400);
          const result = await migrateSchemaForTable(sourceClient, targetClient, table, {
            drop_existing: options.drop_existing || false,
            include_indexes: options.include_indexes !== false,
            include_rls: options.include_rls !== false,
          });
          return jsonRes(result);
        }

        if (step === "migrate_fks") {
          const result = await migrateForeignKeys(sourceClient, targetClient);
          return jsonRes(result);
        }

        if (step === "migrate_indexes") {
          const idxResult = await sourceClient.queryObject<{ indexdef: string }>(`
            SELECT indexdef FROM pg_indexes WHERE schemaname = 'public' AND indexname NOT LIKE '%_pkey' AND indexdef NOT LIKE '%UNIQUE%'
          `);
          let count = 0;
          for (const idx of idxResult.rows) {
            try { await targetClient.queryObject(idx.indexdef.replace("CREATE INDEX", "CREATE INDEX IF NOT EXISTS")); count++; } catch (_) {}
          }
          return jsonRes({ ok: true, index_count: count, logs: [`📇 إنشاء ${count} فهرس`] });
        }

        if (step === "migrate_data_table") {
          const table = options.table_name;
          if (!table) return jsonRes({ ok: false, error: "table_name مطلوب" }, 400);
          const result = await migrateDataForTable(sourceClient, targetClient, table, {
            offset: toSafeNonNegativeInt(options.offset, 0),
            batch_size: toSafeNonNegativeInt(options.batch_size, 100, 200),
          });
          return jsonRes(result);
        }

        if (step === "migrate_functions") {
          const result = await migrateFunctions(sourceClient, targetClient);
          return jsonRes(result);
        }

        if (step === "migrate_rls") {
          const result = await migrateRLS(sourceClient, targetClient);
          return jsonRes(result);
        }

        return jsonRes({ ok: false, error: `خطوة غير معروفة: ${step}` }, 400);
      } finally {
        await targetClient.end();
      }
    } finally {
      await sourceClient.end();
    }
  } catch (e) {
    console.error("Clone error:", e);
    return jsonRes({ ok: false, error: getErrorMessage(e) || "خطأ غير متوقع" }, 500);
  }
});
