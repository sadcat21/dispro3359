
-- ENUMS
CREATE TYPE public.target_metric_type AS ENUM ('sales_amount','deliveries_count','cartons_sold');
CREATE TYPE public.target_period_type AS ENUM ('daily','weekly','monthly');
CREATE TYPE public.target_progress_status AS ENUM ('in_progress','achieved','missed');

CREATE OR REPLACE FUNCTION public.can_manage_targets(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('admin'::public.app_role, 'admin_assistant'::public.app_role, 'company_manager'::public.app_role)
  );
$$;

CREATE TABLE public.worker_targets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  metric_type public.target_metric_type NOT NULL,
  period_type public.target_period_type NOT NULL,
  target_value numeric NOT NULL CHECK (target_value > 0),
  start_date date NOT NULL,
  end_date date NOT NULL,
  worker_id uuid REFERENCES public.workers(id) ON DELETE CASCADE,
  reward_amount numeric NOT NULL DEFAULT 0 CHECK (reward_amount >= 0),
  penalty_amount numeric NOT NULL DEFAULT 0 CHECK (penalty_amount >= 0),
  min_achievement_pct numeric NOT NULL DEFAULT 100 CHECK (min_achievement_pct > 0 AND min_achievement_pct <= 200),
  bonus_per_extra_unit numeric NOT NULL DEFAULT 0 CHECK (bonus_per_extra_unit >= 0),
  is_active boolean NOT NULL DEFAULT true,
  notes text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (end_date >= start_date)
);

CREATE INDEX idx_worker_targets_active ON public.worker_targets(is_active, start_date, end_date);
CREATE INDEX idx_worker_targets_worker ON public.worker_targets(worker_id) WHERE worker_id IS NOT NULL;

ALTER TABLE public.worker_targets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view targets" ON public.worker_targets FOR SELECT TO authenticated USING (true);
CREATE POLICY "Managers can insert targets" ON public.worker_targets FOR INSERT TO authenticated WITH CHECK (public.can_manage_targets(auth.uid()));
CREATE POLICY "Managers can update targets" ON public.worker_targets FOR UPDATE TO authenticated USING (public.can_manage_targets(auth.uid())) WITH CHECK (public.can_manage_targets(auth.uid()));
CREATE POLICY "Managers can delete targets" ON public.worker_targets FOR DELETE TO authenticated USING (public.can_manage_targets(auth.uid()));

CREATE TRIGGER trg_worker_targets_updated_at
  BEFORE UPDATE ON public.worker_targets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.worker_target_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  target_id uuid NOT NULL REFERENCES public.worker_targets(id) ON DELETE CASCADE,
  worker_id uuid NOT NULL REFERENCES public.workers(id) ON DELETE CASCADE,
  period_start date NOT NULL,
  period_end date NOT NULL,
  achieved_value numeric NOT NULL DEFAULT 0,
  achievement_pct numeric NOT NULL DEFAULT 0,
  status public.target_progress_status NOT NULL DEFAULT 'in_progress',
  reward_calculated numeric NOT NULL DEFAULT 0,
  penalty_calculated numeric NOT NULL DEFAULT 0,
  reward_applied boolean NOT NULL DEFAULT false,
  last_calculated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (target_id, worker_id, period_start)
);

CREATE INDEX idx_target_progress_worker ON public.worker_target_progress(worker_id, period_start DESC);
CREATE INDEX idx_target_progress_target ON public.worker_target_progress(target_id);

ALTER TABLE public.worker_target_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View own or managers" ON public.worker_target_progress FOR SELECT TO authenticated
  USING (public.can_manage_targets(auth.uid()) OR worker_id = public.get_worker_id());
CREATE POLICY "Managers insert progress" ON public.worker_target_progress FOR INSERT TO authenticated WITH CHECK (public.can_manage_targets(auth.uid()));
CREATE POLICY "Managers update progress" ON public.worker_target_progress FOR UPDATE TO authenticated USING (public.can_manage_targets(auth.uid())) WITH CHECK (public.can_manage_targets(auth.uid()));
CREATE POLICY "Managers delete progress" ON public.worker_target_progress FOR DELETE TO authenticated USING (public.can_manage_targets(auth.uid()));

CREATE TRIGGER trg_worker_target_progress_updated_at
  BEFORE UPDATE ON public.worker_target_progress
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.get_target_period_bounds(_period public.target_period_type, _date date)
RETURNS TABLE(period_start date, period_end date)
LANGUAGE plpgsql IMMUTABLE
AS $$
BEGIN
  IF _period = 'daily' THEN RETURN QUERY SELECT _date, _date;
  ELSIF _period = 'weekly' THEN RETURN QUERY SELECT (date_trunc('week', _date)::date), (date_trunc('week', _date)::date + 6);
  ELSE RETURN QUERY SELECT (date_trunc('month', _date)::date), ((date_trunc('month', _date) + interval '1 month - 1 day')::date);
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.calculate_worker_target_progress(_target_id uuid, _worker_id uuid, _reference_date date DEFAULT CURRENT_DATE)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_target public.worker_targets%ROWTYPE;
  v_pstart date; v_pend date;
  v_achieved numeric := 0; v_pct numeric := 0;
  v_status public.target_progress_status;
  v_reward numeric := 0; v_penalty numeric := 0;
  v_progress_id uuid;
BEGIN
  SELECT * INTO v_target FROM public.worker_targets WHERE id = _target_id;
  IF NOT FOUND OR NOT v_target.is_active THEN RETURN NULL; END IF;

  SELECT period_start, period_end INTO v_pstart, v_pend
    FROM public.get_target_period_bounds(v_target.period_type, _reference_date);

  IF v_pend < v_target.start_date OR v_pstart > v_target.end_date THEN RETURN NULL; END IF;
  v_pstart := GREATEST(v_pstart, v_target.start_date);
  v_pend := LEAST(v_pend, v_target.end_date);

  IF v_target.metric_type = 'sales_amount' THEN
    SELECT COALESCE(SUM(total_sales), 0) INTO v_achieved
      FROM public.accounting_sessions
      WHERE worker_id = _worker_id AND status = 'closed' AND session_date BETWEEN v_pstart AND v_pend;
  ELSIF v_target.metric_type = 'deliveries_count' THEN
    SELECT COUNT(*) INTO v_achieved
      FROM public.accounting_sessions
      WHERE worker_id = _worker_id AND status = 'closed' AND session_date BETWEEN v_pstart AND v_pend;
  ELSIF v_target.metric_type = 'cartons_sold' THEN
    SELECT COALESCE(SUM(total_cartons_sold), 0) INTO v_achieved
      FROM public.accounting_sessions
      WHERE worker_id = _worker_id AND status = 'closed' AND session_date BETWEEN v_pstart AND v_pend;
  END IF;

  v_pct := CASE WHEN v_target.target_value > 0 THEN ROUND((v_achieved / v_target.target_value) * 100, 2) ELSE 0 END;

  IF v_pct >= 100 THEN v_status := 'achieved';
  ELSIF _reference_date > v_target.end_date OR _reference_date > v_pend THEN
    IF v_pct >= v_target.min_achievement_pct THEN v_status := 'achieved'; ELSE v_status := 'missed'; END IF;
  ELSE v_status := 'in_progress';
  END IF;

  IF v_pct >= v_target.min_achievement_pct THEN
    v_reward := v_target.reward_amount;
    IF v_target.bonus_per_extra_unit > 0 AND v_achieved > v_target.target_value THEN
      v_reward := v_reward + (v_achieved - v_target.target_value) * v_target.bonus_per_extra_unit;
    END IF;
  ELSIF v_status = 'missed' THEN v_penalty := v_target.penalty_amount;
  END IF;

  INSERT INTO public.worker_target_progress (
    target_id, worker_id, period_start, period_end,
    achieved_value, achievement_pct, status,
    reward_calculated, penalty_calculated, last_calculated_at
  ) VALUES (
    _target_id, _worker_id, v_pstart, v_pend,
    v_achieved, v_pct, v_status, v_reward, v_penalty, now()
  )
  ON CONFLICT (target_id, worker_id, period_start) DO UPDATE SET
    achieved_value = EXCLUDED.achieved_value,
    achievement_pct = EXCLUDED.achievement_pct,
    status = EXCLUDED.status,
    reward_calculated = EXCLUDED.reward_calculated,
    penalty_calculated = EXCLUDED.penalty_calculated,
    last_calculated_at = now()
  RETURNING id INTO v_progress_id;

  RETURN v_progress_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.recalculate_targets_for_worker(_worker_id uuid, _reference_date date DEFAULT CURRENT_DATE)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_target_id uuid; v_count integer := 0;
BEGIN
  FOR v_target_id IN
    SELECT id FROM public.worker_targets
    WHERE is_active = true
      AND (worker_id IS NULL OR worker_id = _worker_id)
      AND _reference_date BETWEEN start_date AND end_date
  LOOP
    PERFORM public.calculate_worker_target_progress(v_target_id, _worker_id, _reference_date);
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_recalc_targets_on_accounting()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'closed' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'closed') THEN
    PERFORM public.recalculate_targets_for_worker(NEW.worker_id, NEW.session_date);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_accounting_sessions_recalc_targets
  AFTER INSERT OR UPDATE ON public.accounting_sessions
  FOR EACH ROW EXECUTE FUNCTION public.trg_recalc_targets_on_accounting();
