DROP POLICY IF EXISTS "Accountant can update document/invoice stage" ON public.orders;

CREATE POLICY "Accountant can update document/invoice stage"
ON public.orders
FOR UPDATE
USING (
  public.get_user_role() IN ('accountant', 'admin_assistant')
  OR public.has_custom_role('accountant')
  OR public.has_custom_role('admin_assistant')
)
WITH CHECK (
  public.get_user_role() IN ('accountant', 'admin_assistant')
  OR public.has_custom_role('accountant')
  OR public.has_custom_role('admin_assistant')
);