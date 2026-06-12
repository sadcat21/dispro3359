
ALTER TABLE public.manager_treasury
  DROP CONSTRAINT IF EXISTS manager_treasury_resolution_type_check;

ALTER TABLE public.manager_treasury
  ADD CONSTRAINT manager_treasury_resolution_type_check
  CHECK (
    resolution_type IS NULL OR resolution_type = ANY (ARRAY[
      'auto_writeoff',
      'worker_debt',
      'manager_approved_writeoff',
      'investigation',
      'customer_repayment',
      'tolerance_writeoff',
      'split_writeoff_debt',
      'deduct_from_reward',
      'offset_against_return',
      'worker_acknowledged',
      'credit_to_customer',
      'carry_forward',
      'transfer_to_other_employee'
    ])
  );
