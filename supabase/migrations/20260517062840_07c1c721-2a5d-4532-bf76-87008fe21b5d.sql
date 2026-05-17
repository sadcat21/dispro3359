
-- ============ app_settings: restrict writes to admins ============
DROP POLICY IF EXISTS "Admins can insert app settings" ON public.app_settings;
DROP POLICY IF EXISTS "Admins can update app settings" ON public.app_settings;

CREATE POLICY "Admins can insert app settings"
  ON public.app_settings FOR INSERT
  TO authenticated
  WITH CHECK (is_admin() OR is_branch_admin());

CREATE POLICY "Admins can update app settings"
  ON public.app_settings FOR UPDATE
  TO authenticated
  USING (is_admin() OR is_branch_admin())
  WITH CHECK (is_admin() OR is_branch_admin());

-- ============ backup_logs: restrict everything to admins ============
DROP POLICY IF EXISTS "Authenticated users can view backup logs" ON public.backup_logs;
DROP POLICY IF EXISTS "Authenticated users can insert backup logs" ON public.backup_logs;
DROP POLICY IF EXISTS "Authenticated users can update backup logs" ON public.backup_logs;

CREATE POLICY "Admins can view backup logs"
  ON public.backup_logs FOR SELECT
  TO authenticated
  USING (is_admin());

CREATE POLICY "Admins can insert backup logs"
  ON public.backup_logs FOR INSERT
  TO authenticated
  WITH CHECK (is_admin());

CREATE POLICY "Admins can update backup logs"
  ON public.backup_logs FOR UPDATE
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- ============ pending_offer_confirmations: fix broken ownership check ============
DROP POLICY IF EXISTS "pending_offer_update_auth" ON public.pending_offer_confirmations;

CREATE POLICY "pending_offer_update_auth"
  ON public.pending_offer_confirmations FOR UPDATE
  TO authenticated
  USING ((worker_id = get_worker_id()) OR is_admin_user())
  WITH CHECK ((worker_id = get_worker_id()) OR is_admin_user());
