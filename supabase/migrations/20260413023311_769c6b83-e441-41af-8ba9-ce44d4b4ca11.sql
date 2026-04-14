
-- Enable pg_net for HTTP requests
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Schedule daily backup at midnight (00:00 UTC)
SELECT cron.schedule(
  'daily-backup-to-sheets',
  '0 0 * * *',
  $$
  SELECT
    net.http_post(
      url := 'https://lygyeesqdenbauimkrjy.supabase.co/functions/v1/backup-to-sheets',
      headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx5Z3llZXNxZGVuYmF1aW1rcmp5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAxMDg4MjQsImV4cCI6MjA4NTY4NDgyNH0.p6E_tk81qo-j2-9RTXMba4UqiObS5Esvx7TJBTYuD1g"}'::jsonb,
      body := '{"action": "export", "payload": {"google_script_url_from_settings": true}}'::jsonb
    ) AS request_id;
  $$
);
