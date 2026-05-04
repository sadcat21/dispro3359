-- تصفير ذمم العمال مع الإبقاء على الطلبيات
TRUNCATE TABLE 
  public.worker_liability_adjustments,
  public.coin_exchange_tasks,
  public.expenses
RESTART IDENTITY CASCADE;

-- إعادة ضبط الطلبيات: تصبح غير مسلَّمة وغير مدفوعة حتى لا تُحتسب في الذمة
UPDATE public.orders
SET status = 'pending',
    payment_status = 'pending',
    partial_amount = 0,
    prepaid_amount = 0;