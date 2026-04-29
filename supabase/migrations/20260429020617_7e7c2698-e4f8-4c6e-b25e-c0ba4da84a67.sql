REVOKE EXECUTE ON FUNCTION public.get_worker_roles(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_worker_roles(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_worker_roles(uuid) TO authenticated;