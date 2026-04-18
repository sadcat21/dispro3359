
-- 1) Merge duplicate warehouse_stock rows (sum quantities into one, delete the rest)
-- Pick the most-recently-updated row as the survivor and aggregate the others into it.
WITH ranked AS (
  SELECT id, product_id, branch_id, quantity,
         ROW_NUMBER() OVER (PARTITION BY product_id, branch_id ORDER BY updated_at DESC, id) AS rn
  FROM public.warehouse_stock
),
survivors AS (
  SELECT product_id, branch_id, id AS keeper_id
  FROM ranked
  WHERE rn = 1
),
totals AS (
  SELECT product_id, branch_id,
         (FLOOR(SUM(FLOOR(quantity) * COALESCE((SELECT pieces_per_box FROM public.products p WHERE p.id = ws.product_id), 1)
                + ROUND((quantity - FLOOR(quantity)) * 100)))
          / NULLIF(COALESCE((SELECT pieces_per_box FROM public.products p WHERE p.id = ws.product_id), 1), 0)
         )
         + (MOD(SUM(FLOOR(quantity) * COALESCE((SELECT pieces_per_box FROM public.products p WHERE p.id = ws.product_id), 1)
                + ROUND((quantity - FLOOR(quantity)) * 100))::numeric,
                COALESCE((SELECT pieces_per_box FROM public.products p WHERE p.id = ws.product_id), 1)::numeric)
           ) / 100.0 AS merged_qty
  FROM public.warehouse_stock ws
  GROUP BY product_id, branch_id
  HAVING COUNT(*) > 1
)
UPDATE public.warehouse_stock ws
SET quantity = t.merged_qty,
    updated_at = now()
FROM totals t, survivors s
WHERE ws.id = s.keeper_id
  AND s.product_id = t.product_id
  AND s.branch_id = t.branch_id;

-- Delete the duplicate rows (non-survivors) for groups that had duplicates
DELETE FROM public.warehouse_stock ws
WHERE EXISTS (
  SELECT 1
  FROM (
    SELECT id,
           ROW_NUMBER() OVER (PARTITION BY product_id, branch_id ORDER BY updated_at DESC, id) AS rn
    FROM public.warehouse_stock
  ) r
  WHERE r.id = ws.id AND r.rn > 1
);

-- 2) Prevent duplicates going forward
CREATE UNIQUE INDEX IF NOT EXISTS warehouse_stock_branch_product_uniq
  ON public.warehouse_stock (branch_id, product_id);
