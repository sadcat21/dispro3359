
CREATE POLICY "Company manager can insert workers"
ON public.workers FOR INSERT TO authenticated
WITH CHECK (public.has_custom_role('company_manager'));

CREATE POLICY "Company manager can update workers"
ON public.workers FOR UPDATE TO authenticated
USING (public.has_custom_role('company_manager'));

CREATE POLICY "Company manager can delete workers"
ON public.workers FOR DELETE TO authenticated
USING (public.has_custom_role('company_manager'));
