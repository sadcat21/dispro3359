
TRUNCATE TABLE 
  public.stock_confirmations,
  public.manual_invoice_requests,
  public.worker_load_requests,
  public.worker_load_request_items,
  public.factory_orders,
  public.factory_order_items,
  public.warehouse_review_sessions,
  public.warehouse_review_items,
  public.manager_review_sessions,
  public.final_review_sessions,
  public.final_review_items,
  public.stock_disputes,
  public.stock_discrepancies,
  public.stock_workflow_transitions,
  public.customer_approval_requests
RESTART IDENTITY CASCADE;
