-- Expand RLS on product_offer_tiers to include company managers / role-based managers
DROP POLICY IF EXISTS "Allow insert for admins and branch admins" ON public.product_offer_tiers;
DROP POLICY IF EXISTS "Allow update for admins and branch admins" ON public.product_offer_tiers;
DROP POLICY IF EXISTS "Allow delete for admins and branch admins" ON public.product_offer_tiers;
DROP POLICY IF EXISTS "Offer tiers manage insert" ON public.product_offer_tiers;
DROP POLICY IF EXISTS "Offer tiers manage update" ON public.product_offer_tiers;
DROP POLICY IF EXISTS "Offer tiers manage delete" ON public.product_offer_tiers;

CREATE POLICY "Offer tiers manage insert"
ON public.product_offer_tiers
FOR INSERT
WITH CHECK (
  public.is_admin()
  OR public.is_branch_admin()
  OR public.has_custom_role('company_manager')
  OR public.has_custom_role('admin_assistant')
  OR public.can_manage_product_offers(public.get_worker_id())
);

CREATE POLICY "Offer tiers manage update"
ON public.product_offer_tiers
FOR UPDATE
USING (
  public.is_admin()
  OR public.is_branch_admin()
  OR public.has_custom_role('company_manager')
  OR public.has_custom_role('admin_assistant')
  OR public.can_manage_product_offers(public.get_worker_id())
);

CREATE POLICY "Offer tiers manage delete"
ON public.product_offer_tiers
FOR DELETE
USING (
  public.is_admin()
  OR public.is_branch_admin()
  OR public.has_custom_role('company_manager')
  OR public.has_custom_role('admin_assistant')
  OR public.can_manage_product_offers(public.get_worker_id())
);