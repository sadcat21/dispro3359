
-- 1) Prevent NEW duplicates only (does not touch existing rows)
CREATE OR REPLACE FUNCTION public.prevent_duplicate_customers()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_norm_phone TEXT;
  v_norm_name  TEXT;
  v_exists     BOOLEAN;
BEGIN
  v_norm_name  := NULLIF(TRIM(NEW.name), '');
  v_norm_phone := NULLIF(REGEXP_REPLACE(COALESCE(NEW.phone, ''), '\s+', '', 'g'), '');

  IF v_norm_name IS NULL OR v_norm_phone IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.customers c
    WHERE c.id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
      AND TRIM(c.name) = v_norm_name
      AND REGEXP_REPLACE(COALESCE(c.phone, ''), '\s+', '', 'g') = v_norm_phone
  ) INTO v_exists;

  IF v_exists THEN
    RAISE EXCEPTION 'duplicate_customer: عميل بنفس الاسم ورقم الهاتف موجود مسبقاً (%, %)', v_norm_name, v_norm_phone
      USING ERRCODE = 'unique_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_duplicate_customers_trg ON public.customers;
CREATE TRIGGER prevent_duplicate_customers_trg
BEFORE INSERT OR UPDATE OF name, phone ON public.customers
FOR EACH ROW
EXECUTE FUNCTION public.prevent_duplicate_customers();


-- 2) Merge function: move all related rows from drop_ids -> keep_id, then delete drops
CREATE OR REPLACE FUNCTION public.merge_customers(keep_id UUID, drop_ids UUID[])
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r           RECORD;
  v_sql       TEXT;
  v_moved     JSONB := '{}'::jsonb;
  v_count     BIGINT;
BEGIN
  IF keep_id IS NULL OR drop_ids IS NULL OR array_length(drop_ids, 1) IS NULL THEN
    RAISE EXCEPTION 'keep_id and drop_ids are required';
  END IF;
  IF keep_id = ANY(drop_ids) THEN
    RAISE EXCEPTION 'keep_id cannot be in drop_ids';
  END IF;

  -- Update every public table that has a customer_id column
  FOR r IN
    SELECT table_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND column_name = 'customer_id'
      AND table_name NOT LIKE 'v\_%' ESCAPE '\'  -- skip views
  LOOP
    -- skip views explicitly
    IF EXISTS (SELECT 1 FROM information_schema.views WHERE table_schema='public' AND table_name = r.table_name) THEN
      CONTINUE;
    END IF;

    v_sql := format(
      'UPDATE public.%I SET customer_id = $1 WHERE customer_id = ANY($2)',
      r.table_name
    );
    BEGIN
      EXECUTE v_sql USING keep_id, drop_ids;
      GET DIAGNOSTICS v_count = ROW_COUNT;
      IF v_count > 0 THEN
        v_moved := v_moved || jsonb_build_object(r.table_name, v_count);
      END IF;
    EXCEPTION WHEN unique_violation THEN
      -- if the keep customer already has the same row (unique constraint), delete the dup row instead
      EXECUTE format('DELETE FROM public.%I WHERE customer_id = ANY($1)', r.table_name) USING drop_ids;
    END;
  END LOOP;

  -- Finally remove the duplicate customer rows
  DELETE FROM public.customers WHERE id = ANY(drop_ids);

  RETURN jsonb_build_object('keep_id', keep_id, 'dropped', array_length(drop_ids,1), 'moved', v_moved);
END;
$$;

REVOKE ALL ON FUNCTION public.merge_customers(UUID, UUID[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.merge_customers(UUID, UUID[]) TO authenticated;
