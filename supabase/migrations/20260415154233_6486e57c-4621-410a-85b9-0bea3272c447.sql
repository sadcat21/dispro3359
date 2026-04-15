
-- Fix all existing records: set remaining_amount = total_amount - paid_amount
UPDATE public.customer_debts
SET remaining_amount = total_amount - paid_amount
WHERE remaining_amount IS NULL 
   OR remaining_amount != (total_amount - paid_amount);

-- Create trigger function to auto-calculate remaining_amount
CREATE OR REPLACE FUNCTION public.calculate_debt_remaining_amount()
RETURNS TRIGGER AS $$
BEGIN
  NEW.remaining_amount := NEW.total_amount - NEW.paid_amount;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create trigger
CREATE TRIGGER trg_calculate_debt_remaining
  BEFORE INSERT OR UPDATE OF total_amount, paid_amount
  ON public.customer_debts
  FOR EACH ROW
  EXECUTE FUNCTION public.calculate_debt_remaining_amount();
