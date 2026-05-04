-- Expand can_manage_product_offers to include custom roles allowed to create offers
create or replace function public.can_manage_product_offers(p_worker_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.workers w
    where w.id = p_worker_id
      and w.is_active = true
      and (
        w.role in ('admin'::public.app_role, 'branch_admin'::public.app_role)
        or exists (
          select 1
          from public.worker_roles wr
          join public.custom_roles cr on cr.id = wr.custom_role_id
          where wr.worker_id = w.id
            and cr.code in ('warehouse_manager', 'company_manager', 'accountant', 'branch_manager')
        )
      )
  );
$$;
