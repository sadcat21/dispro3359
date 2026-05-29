CREATE POLICY "Admins can delete collections"
ON public.debt_collections
FOR DELETE
TO authenticated
USING (public.is_admin() OR public.is_branch_admin());