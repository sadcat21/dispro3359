
ALTER TABLE public.expenses
  ADD COLUMN IF NOT EXISTS handover_id uuid REFERENCES public.manager_handovers(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS expenses_handover_id_idx ON public.expenses(handover_id);

CREATE OR REPLACE FUNCTION public.attach_expenses_to_handover()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.expenses
     SET handover_id = NEW.id
   WHERE handover_id IS NULL
     AND status = 'approved'
     AND created_at <= NEW.created_at
     AND (NEW.branch_id IS NULL OR branch_id = NEW.branch_id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_attach_expenses_to_handover ON public.manager_handovers;
CREATE TRIGGER trg_attach_expenses_to_handover
AFTER INSERT ON public.manager_handovers
FOR EACH ROW EXECUTE FUNCTION public.attach_expenses_to_handover();
