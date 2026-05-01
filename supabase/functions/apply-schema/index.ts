import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { Client } from "https://deno.land/x/postgres@v0.19.3/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (d: unknown, s = 200) =>
  new Response(JSON.stringify(d), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

function buildConn(projectInput: string, dbPassword: string): string {
  const input = projectInput.trim();
  if (/^postgres(?:ql)?:\/\//i.test(input)) {
    const u = new URL(input);
    if (dbPassword) u.password = dbPassword;
    if (!u.searchParams.has("sslmode")) u.searchParams.set("sslmode", "require");
    return u.toString();
  }
  let ref = "";
  if (/^[a-z0-9]{20}$/i.test(input)) ref = input;
  else {
    const m = input.match(/https?:\/\/([^.]+)\.supabase\.co/i);
    if (m) ref = m[1];
  }
  if (!ref) throw new Error("تعذر تحديد معرف المشروع");
  return `postgresql://postgres:${encodeURIComponent(dbPassword)}@db.${ref}.supabase.co:5432/postgres?sslmode=require`;
}

/** Split SQL into statements respecting $$ ... $$ dollar-quoted blocks (functions). */
function splitSql(sql: string): string[] {
  const stmts: string[] = [];
  let buf = "";
  let i = 0;
  let inDollar = false;
  let dollarTag = "";
  let inLineComment = false;
  let inBlockComment = false;
  let inSingle = false;

  while (i < sql.length) {
    const ch = sql[i];
    const next2 = sql.substr(i, 2);

    if (inLineComment) {
      buf += ch;
      if (ch === "\n") inLineComment = false;
      i++; continue;
    }
    if (inBlockComment) {
      buf += ch;
      if (next2 === "*/") { buf += "/"; i += 2; inBlockComment = false; continue; }
      i++; continue;
    }
    if (inSingle) {
      buf += ch;
      if (ch === "'" && sql[i + 1] !== "'") inSingle = false;
      else if (ch === "'" && sql[i + 1] === "'") { buf += "'"; i++; }
      i++; continue;
    }
    if (inDollar) {
      buf += ch;
      if (ch === "$") {
        const rest = sql.substr(i);
        if (rest.startsWith(dollarTag)) {
          buf += dollarTag.slice(1);
          i += dollarTag.length;
          inDollar = false;
          continue;
        }
      }
      i++; continue;
    }

    if (next2 === "--") { inLineComment = true; buf += ch; i++; continue; }
    if (next2 === "/*") { inBlockComment = true; buf += ch; i++; continue; }
    if (ch === "'") { inSingle = true; buf += ch; i++; continue; }
    if (ch === "$") {
      const m = sql.substr(i).match(/^\$[A-Za-z0-9_]*\$/);
      if (m) {
        dollarTag = m[0];
        inDollar = true;
        buf += dollarTag;
        i += dollarTag.length;
        continue;
      }
    }
    if (ch === ";") {
      const s = buf.trim();
      if (s) stmts.push(s);
      buf = "";
      i++;
      continue;
    }
    buf += ch;
    i++;
  }
  const tail = buf.trim();
  if (tail) stmts.push(tail);
  return stmts;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json();
    const { step, target, sql, expected } = body || {};

    if (!target?.url || !target?.db_password) {
      return json({ ok: false, error: "بيانات الاتصال بالمشروع الهدف مطلوبة" }, 400);
    }

    const conn = buildConn(target.url, target.db_password);
    const client = new Client(conn);
    await client.connect();

    try {
      // ============================================================
      // STEP 1: APPLY SCHEMA
      // ============================================================
      if (step === "apply") {
        if (!sql || typeof sql !== "string") {
          return json({ ok: false, error: "السكربت SQL مطلوب" }, 400);
        }

        const statements = splitSql(sql);
        const total = statements.length;
        let executed = 0;
        let skipped = 0;

        // Track pending statements (index + sql) and retry across passes.
        // Many failures are ordering issues (FK to not-yet-created table,
        // index on missing column, trigger referencing missing function).
        // Re-running pending statements after each pass resolves them.
        let pending: { index: number; stmt: string; error: string }[] =
          statements.map((stmt, index) => ({ index, stmt, error: "" }));

        const MAX_PASSES = 6;
        for (let pass = 0; pass < MAX_PASSES && pending.length > 0; pass++) {
          const next: typeof pending = [];
          for (const item of pending) {
            try {
              await client.queryArray(item.stmt);
              executed++;
            } catch (e: any) {
              const msg = String(e?.message || e);
              if (/already exists|duplicate/i.test(msg)) {
                skipped++;
              } else {
                next.push({ index: item.index, stmt: item.stmt, error: msg });
              }
            }
          }
          // If nothing changed this pass, no point retrying further.
          if (next.length === pending.length) {
            pending = next;
            break;
          }
          pending = next;
        }

        const errors = pending.map((p) => ({
          index: p.index,
          statement: p.stmt.slice(0, 200),
          error: p.error,
        }));

        return json({
          ok: true,
          total,
          executed,
          skipped,
          errors,
        });
      }

      // ============================================================
      // STEP 2: VERIFY
      // ============================================================
      if (step === "verify") {
        // Tables + columns
        const tablesRes = await client.queryObject<{ table_name: string; column_count: number }>(
          `SELECT t.table_name, COUNT(c.column_name)::int AS column_count
           FROM information_schema.tables t
           LEFT JOIN information_schema.columns c
             ON c.table_schema = t.table_schema AND c.table_name = t.table_name
           WHERE t.table_schema = 'public' AND t.table_type = 'BASE TABLE'
           GROUP BY t.table_name ORDER BY t.table_name`
        );

        const fnRes = await client.queryObject<{ count: number }>(
          `SELECT COUNT(*)::int AS count FROM pg_proc p
           JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public'`
        );

        const policyRes = await client.queryObject<{ count: number }>(
          `SELECT COUNT(*)::int AS count FROM pg_policies WHERE schemaname='public'`
        );

        const idxRes = await client.queryObject<{ count: number }>(
          `SELECT COUNT(*)::int AS count FROM pg_indexes WHERE schemaname='public'`
        );

        const trgRes = await client.queryObject<{ count: number }>(
          `SELECT COUNT(*)::int AS count FROM pg_trigger t
           JOIN pg_class c ON c.oid=t.tgrelid
           JOIN pg_namespace n ON n.oid=c.relnamespace
           WHERE n.nspname='public' AND NOT t.tgisinternal`
        );

        const enumRes = await client.queryObject<{ name: string }>(
          `SELECT t.typname AS name FROM pg_type t
           JOIN pg_namespace n ON n.oid=t.typnamespace
           WHERE n.nspname='public' AND t.typtype='e'`
        );

        const rlsRes = await client.queryObject<{ count: number }>(
          `SELECT COUNT(*)::int AS count FROM pg_class c
           JOIN pg_namespace n ON n.oid=c.relnamespace
           WHERE n.nspname='public' AND c.relkind='r' AND c.relrowsecurity=true`
        );

        const actual = {
          tables: tablesRes.rows.length,
          functions: fnRes.rows[0].count,
          policies: policyRes.rows[0].count,
          indexes: idxRes.rows[0].count,
          triggers: trgRes.rows[0].count,
          enums: enumRes.rows.length,
          rls_enabled: rlsRes.rows[0].count,
          tables_detail: tablesRes.rows,
        };

        // Compare with expected counts if provided
        const checks: { name: string; expected: number; actual: number; ok: boolean }[] = [];
        if (expected) {
          if (typeof expected.tables === "number")
            checks.push({ name: "الجداول", expected: expected.tables, actual: actual.tables, ok: actual.tables >= expected.tables });
          if (typeof expected.functions === "number")
            checks.push({ name: "الدوال", expected: expected.functions, actual: actual.functions, ok: actual.functions >= expected.functions });
          if (typeof expected.policies === "number")
            checks.push({ name: "السياسات", expected: expected.policies, actual: actual.policies, ok: actual.policies >= expected.policies });
          if (typeof expected.indexes === "number")
            checks.push({ name: "الفهارس", expected: expected.indexes, actual: actual.indexes, ok: actual.indexes >= expected.indexes });
          if (typeof expected.triggers === "number")
            checks.push({ name: "Triggers", expected: expected.triggers, actual: actual.triggers, ok: actual.triggers >= expected.triggers });
        }

        const all_ok = checks.every((c) => c.ok);

        return json({ ok: true, all_ok, checks, actual });
      }

      // ============================================================
      // STEP 3: RESET (drop & recreate public schema)
      // ============================================================
      if (step === "reset") {
        await client.queryArray(`DROP SCHEMA IF EXISTS public CASCADE;`);
        await client.queryArray(`CREATE SCHEMA public;`);
        await client.queryArray(`GRANT ALL ON SCHEMA public TO postgres;`);
        await client.queryArray(`GRANT ALL ON SCHEMA public TO public;`);
        await client.queryArray(`GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;`);
        await client.queryArray(`GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;`);
        return json({ ok: true, message: "تم تفريغ قاعدة البيانات بنجاح" });
      }

      return json({ ok: false, error: "خطوة غير معروفة" }, 400);
    } finally {
      await client.end();
    }
  } catch (e: any) {
    return json({ ok: false, error: e?.message || String(e) }, 500);
  }
});
