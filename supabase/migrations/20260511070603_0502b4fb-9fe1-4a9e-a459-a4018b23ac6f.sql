CREATE POLICY "Admins can delete manual_invoice_requests"
ON public.manual_invoice_requests FOR DELETE
USING (is_admin() OR has_custom_role('company_manager'));

CREATE POLICY "Admins can delete customer_approval_requests"
ON public.customer_approval_requests FOR DELETE
USING (is_admin() OR has_custom_role('company_manager'));