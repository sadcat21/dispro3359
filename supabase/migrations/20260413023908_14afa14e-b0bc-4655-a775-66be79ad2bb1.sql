
CREATE TABLE public.backup_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  backup_type text NOT NULL DEFAULT 'manual', -- manual, daily_incremental, full_periodic
  status text NOT NULL DEFAULT 'running', -- running, success, failed
  total_rows integer DEFAULT 0,
  tables_count integer DEFAULT 0,
  table_details jsonb DEFAULT '{}'::jsonb,
  google_sheet_url text,
  google_sheet_id text,
  date_from timestamptz,
  date_to timestamptz,
  selected_tables text[],
  error_message text,
  triggered_by text DEFAULT 'system', -- system, manual, cron
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

ALTER TABLE public.backup_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view backup logs"
ON public.backup_logs FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Authenticated users can insert backup logs"
ON public.backup_logs FOR INSERT TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can update backup logs"
ON public.backup_logs FOR UPDATE TO authenticated
USING (true);
