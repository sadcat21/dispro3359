
-- 1) Trigger function: insert admin row when project_manager is added
CREATE OR REPLACE FUNCTION public.sync_project_manager_admin()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.role = 'project_manager' AND NEW.user_id IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, worker_id, role)
    VALUES (NEW.user_id, NEW.worker_id, 'admin')
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_project_manager_admin ON public.user_roles;
CREATE TRIGGER trg_sync_project_manager_admin
AFTER INSERT ON public.user_roles
FOR EACH ROW
EXECUTE FUNCTION public.sync_project_manager_admin();

-- 2) Trigger function: remove paired admin row when project_manager is removed
--    (only removes admin row if user still has NO other project_manager AND the admin row was paired)
CREATE OR REPLACE FUNCTION public.unsync_project_manager_admin()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.role = 'project_manager' AND OLD.user_id IS NOT NULL THEN
    -- Only remove the paired admin if no other project_manager rows remain for this user
    IF NOT EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = OLD.user_id AND role = 'project_manager'
    ) THEN
      DELETE FROM public.user_roles
      WHERE user_id = OLD.user_id
        AND role = 'admin'
        -- guard: only delete admin rows that were auto-paired (no explicit admin worker_id mismatch)
        AND (worker_id IS NOT DISTINCT FROM OLD.worker_id);
    END IF;
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_unsync_project_manager_admin ON public.user_roles;
CREATE TRIGGER trg_unsync_project_manager_admin
AFTER DELETE ON public.user_roles
FOR EACH ROW
EXECUTE FUNCTION public.unsync_project_manager_admin();

-- 3) Backfill: add admin row for existing project_managers who don't have it
INSERT INTO public.user_roles (user_id, worker_id, role)
SELECT DISTINCT pm.user_id, pm.worker_id, 'admin'::app_role
FROM public.user_roles pm
WHERE pm.role = 'project_manager'
  AND pm.user_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.user_roles a
    WHERE a.user_id = pm.user_id AND a.role = 'admin'
  );
