CREATE POLICY "Workers can delete own debt_payments"
ON public.debt_payments
FOR DELETE
TO authenticated
USING (worker_id = public.get_worker_id());

CREATE POLICY "Workers can update own debt_payments"
ON public.debt_payments
FOR UPDATE
TO authenticated
USING (worker_id = public.get_worker_id());