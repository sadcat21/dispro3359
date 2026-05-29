CREATE POLICY "PM and assistant can delete debt_payments"
ON public.debt_payments
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role IN ('project_manager','admin_assistant','company_manager')
  )
);

CREATE POLICY "PM and assistant can update debt_payments"
ON public.debt_payments
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role IN ('project_manager','admin_assistant','company_manager')
  )
);