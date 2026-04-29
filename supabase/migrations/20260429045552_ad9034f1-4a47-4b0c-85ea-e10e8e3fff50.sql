REVOKE EXECUTE ON FUNCTION public.forward_manual_invoice_request_to_management(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.forward_manual_invoice_request_to_management(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.forward_manual_invoice_request_to_management(uuid) TO authenticated;