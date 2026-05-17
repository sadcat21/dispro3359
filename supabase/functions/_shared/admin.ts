import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const getRequiredEnv = (key: string) => {
  const value = Deno.env.get(key);

  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }

  return value;
};

export const createAdminClient = () => {
  const supabaseUrl = getRequiredEnv("SUPABASE_URL");
  const serviceRoleKey = getRequiredEnv("SUPABASE_SERVICE_ROLE_KEY");

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
};

export const requireAdminSecret = (req: Request) => {
  const expectedSecret = getRequiredEnv("SUPABASE_INTERNAL_ADMIN_SECRET");
  const receivedSecret = req.headers.get("x-admin-secret");

  if (!receivedSecret || receivedSecret !== expectedSecret) {
    throw new Error("Unauthorized admin request");
  }
};

/**
 * Verify the caller is an authenticated admin/branch_admin/company_manager
 * by checking the bearer token's user_id against the user_roles table.
 * Use for edge functions called from the authenticated admin UI.
 */
export const requireAdminUser = async (req: Request) => {
  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) throw new Error("Unauthorized: missing bearer token");

  const admin = createAdminClient();
  const { data: userRes, error: userErr } = await admin.auth.getUser(token);
  if (userErr || !userRes?.user) throw new Error("Unauthorized: invalid session");

  const { data: roles, error: rolesErr } = await admin
    .from("user_roles")
    .select("role")
    .eq("user_id", userRes.user.id);
  if (rolesErr) throw new Error("Unauthorized: role lookup failed");

  const allowed = new Set(["admin", "branch_admin", "company_manager"]);
  const hasRole = (roles ?? []).some((r: { role: string }) => allowed.has(r.role));
  if (!hasRole) throw new Error("Unauthorized: admin role required");

  return userRes.user;
};
