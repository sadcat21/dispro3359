-- حذف بيانات المبيعات والحركات والديون مع الإبقاء على الطلبيات
TRUNCATE TABLE 
  public.debt_payments,
  public.debt_collections,
  public.debt_movements,
  public.customer_debts,
  public.stock_movements,
  public.cash_movements,
  public.receipts,
  public.final_review_sessions,
  public.loading_sessions,
  public.accounting_sessions,
  public.promos,
  public.promo_splits,
  public.worker_stock,
  public.warehouse_stock
RESTART IDENTITY CASCADE;