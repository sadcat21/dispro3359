
WITH new_debt AS (
  INSERT INTO public.worker_debts (worker_id, amount, debt_type, description, branch_id, created_by)
  VALUES (
    'ce5b6f33-1cfd-4e09-8eb7-d456ee3aa2ab',
    100,
    'deficit',
    'تحويل عجز خزينة لدين العامل (تسوية يدوية لسطر سابق)',
    '9ba3c0af-f12f-4c0f-8a3c-7b9d3e3988c6',
    'b5d6d2a1-e69a-4254-bce7-f4cab1856c5c'
  )
  RETURNING id
)
UPDATE public.manager_treasury mt
SET resolution_splits = (
  SELECT jsonb_agg(
    CASE
      WHEN (elem->>'id') = '73f5fcda-e14f-4099-bd19-468256831342'
      THEN elem
           || jsonb_build_object(
                'party_type', 'worker',
                'party_id', 'ce5b6f33-1cfd-4e09-8eb7-d456ee3aa2ab',
                'party_label', 'hssm27',
                'linked_debt_id', (SELECT id::text FROM new_debt)
              )
      ELSE elem
    END
  )
  FROM jsonb_array_elements(mt.resolution_splits) elem
)
WHERE mt.id = '959deb73-a636-41b5-ac12-63f976bce031';
